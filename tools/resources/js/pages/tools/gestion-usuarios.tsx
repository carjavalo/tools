import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { usePermisosVista } from '@/hooks/use-permisos-vista';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import {
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Eye,
    LoaderCircle,
    Pencil,
    Search,
    Trash2,
    UserPlus,
    Users,
    XCircle,
} from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';

interface ManagedUser {
    id: number;
    name: string;
    rol: string;
    Apellido1: string | null;
    apellido2: string | null;
    tipo_Docu: string | null;
    Numero_D: string | null;
    // Los médicos no inician sesión y pueden quedar sin correo.
    email: string | null;
    Telefono1: string | null;
    telefono2: string | null;
    Direccion: string | null;
    Eps: string | null;
    codesp: string | null;
    email_verified_at: string | null;
    created_at: string | null;
}

interface TipoDocOption {
    id: number;
    Nombre: string;
}

interface EspecialidadOption {
    id: number;
    espcodser: string | null;
    Nombre: string;
}

interface Paginated<T> {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

interface PageProps {
    users: Paginated<ManagedUser>;
    filters: { search: string; perPage: number };
    tiposDocumento: TipoDocOption[];
    rolesList: TipoDocOption[];
    epsList: TipoDocOption[];
    especialidadesList: EspecialidadOption[];
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Inicio', href: dashboard().url },
    { title: 'Gestión de Usuarios', href: '/tools/gestion-usuarios' },
];

type UserForm = {
    name: string;
    rol: string;
    Apellido1: string;
    apellido2: string;
    tipo_Docu: string;
    Numero_D: string;
    email: string;
    Telefono1: string;
    telefono2: string;
    Direccion: string;
    Eps: string;
    codesp: string;
    password: string;
    password_confirmation: string;
};

const emptyForm: UserForm = {
    name: '',
    rol: 'paciente',
    Apellido1: '',
    apellido2: '',
    tipo_Docu: '',
    Numero_D: '',
    email: '',
    Telefono1: '',
    telefono2: '',
    Direccion: '',
    Eps: '',
    codesp: '',
    password: '',
    password_confirmation: '',
};

function fullName(u: ManagedUser) {
    return [u.name, u.Apellido1, u.apellido2].filter(Boolean).join(' ');
}

function initials(u: ManagedUser) {
    const a = u.name?.charAt(0) ?? '';
    const b = u.Apellido1?.charAt(0) ?? '';
    return (a + b).toUpperCase() || 'US';
}

function formatDate(value: string | null) {
    if (!value) return '—';
    try {
        return new Intl.DateTimeFormat('es-CO', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        }).format(new Date(value));
    } catch {
        return '—';
    }
}

export default function GestionUsuarios({
    users,
    filters,
    tiposDocumento,
    rolesList,
    epsList,
    especialidadesList,
}: PageProps) {
    const { flash } = usePage<SharedData>().props;
    const acciones = usePermisosVista('gestion-usuarios');
    const [search, setSearch] = useState(filters.search ?? '');
    const didMount = useRef(false);
    const [formOpen, setFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [viewUser, setViewUser] = useState<ManagedUser | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [notice, setNotice] = useState<{
        type: 'success' | 'error';
        msg: string;
    } | null>(null);

    const form = useForm<UserForm>({ ...emptyForm });

    useEffect(() => {
        if (flash?.success) {
            setNotice({ type: 'success', msg: flash.success });
        } else if (flash?.error) {
            setNotice({ type: 'error', msg: flash.error });
        }
    }, [flash?.success, flash?.error]);

    useEffect(() => {
        if (!notice) return;
        const timer = setTimeout(() => setNotice(null), 4000);
        return () => clearTimeout(timer);
    }, [notice]);

    useEffect(() => {
        if (!didMount.current) {
            didMount.current = true;
            return;
        }
        const timer = setTimeout(() => {
            router.get(
                '/tools/gestion-usuarios',
                { search, perPage: filters.perPage },
                { preserveState: true, preserveScroll: true, replace: true },
            );
        }, 350);
        return () => clearTimeout(timer);
    }, [search]);

    const goToPage = (page: number) => {
        router.get(
            '/tools/gestion-usuarios',
            { search, perPage: filters.perPage, page },
            { preserveState: true, preserveScroll: true },
        );
    };

    const changePerPage = (n: number) => {
        router.get(
            '/tools/gestion-usuarios',
            { search, perPage: n },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const openCreate = () => {
        form.reset();
        form.clearErrors();
        setEditingId(null);
        setFormOpen(true);
    };

    const openEdit = (u: ManagedUser) => {
        form.clearErrors();
        form.setData({
            name: u.name ?? '',
            rol: u.rol ?? 'paciente',
            Apellido1: u.Apellido1 ?? '',
            apellido2: u.apellido2 ?? '',
            tipo_Docu: u.tipo_Docu ?? '',
            Numero_D: u.Numero_D ?? '',
            email: u.email ?? '',
            Telefono1: u.Telefono1 ?? '',
            telefono2: u.telefono2 ?? '',
            Direccion: u.Direccion ?? '',
            Eps: u.Eps ?? '',
            codesp: u.codesp ?? '',
            password: '',
            password_confirmation: '',
        });
        setEditingId(u.id);
        setFormOpen(true);
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        const options = {
            preserveScroll: true,
            onSuccess: () => {
                setFormOpen(false);
                form.reset();
            },
        };
        if (editingId) {
            form.put(`/tools/gestion-usuarios/${editingId}`, options);
        } else {
            form.post('/tools/gestion-usuarios', options);
        }
    };

    const confirmDelete = () => {
        if (!deleteTarget) return;
        router.delete(`/tools/gestion-usuarios/${deleteTarget.id}`, {
            preserveScroll: true,
            onStart: () => setDeleting(true),
            onFinish: () => setDeleting(false),
            onSuccess: () => setDeleteTarget(null),
        });
    };

    const isEditing = editingId !== null;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Gestión de Usuarios" />

            <div className="flex h-full flex-1 flex-col gap-6 p-4 md:p-6">
                {/* Encabezado */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex size-11 items-center justify-center rounded-xl bg-[#2d3e83]/10 text-[#2d3e83] dark:bg-white/10 dark:text-white">
                            <Users className="size-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">
                                Gestión de Usuarios
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                Crea, consulta, edita y elimina los usuarios del
                                sistema.
                            </p>
                        </div>
                    </div>
                    {acciones.crear && (
                        <Button onClick={openCreate} className="gap-2">
                            <UserPlus className="size-4" />
                            Crear usuario
                        </Button>
                    )}
                </div>

                {/* Notificación */}
                {notice && (
                    <div
                        className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-sm ${
                            notice.type === 'success'
                                ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200'
                                : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200'
                        }`}
                    >
                        {notice.type === 'success' ? (
                            <CheckCircle2 className="size-5 shrink-0" />
                        ) : (
                            <XCircle className="size-5 shrink-0" />
                        )}
                        {notice.msg}
                    </div>
                )}

                {/* Tarjeta de tabla */}
                <div className="flex flex-1 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
                    <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="relative w-full sm:max-w-xs">
                            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Buscar por nombre, correo o documento…"
                                className="pl-9"
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground">
                                {users.total}{' '}
                                {users.total === 1 ? 'usuario' : 'usuarios'}
                            </span>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                    Mostrar
                                </span>
                                <Select
                                    value={String(filters.perPage)}
                                    onValueChange={(v) =>
                                        changePerPage(Number(v))
                                    }
                                >
                                    <SelectTrigger className="h-9 w-20">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="12">12</SelectItem>
                                        <SelectItem value="24">24</SelectItem>
                                        <SelectItem value="36">36</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
                                <tr>
                                    <th className="px-4 py-3 font-medium">
                                        Usuario
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Tipo Documento
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Documento
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        EPS
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Teléfono 1
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Teléfono 2
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Dirección
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Email
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Rol
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Estado
                                    </th>
                                    <th className="px-4 py-3 text-right font-medium">
                                        Acciones
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {users.data.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={11}
                                            className="px-4 py-12 text-center text-muted-foreground"
                                        >
                                            No se encontraron usuarios.
                                        </td>
                                    </tr>
                                )}
                                {users.data.map((u) => (
                                    <tr
                                        key={u.id}
                                        className="transition-colors hover:bg-muted/40"
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#2d3e83] text-xs font-semibold text-white">
                                                    {initials(u)}
                                                </div>
                                                <span className="font-medium text-foreground">
                                                    {fullName(u)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {u.tipo_Docu || '—'}
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {u.Numero_D || '—'}
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {u.Eps || '—'}
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {u.Telefono1 || '—'}
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {u.telefono2 || '—'}
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {u.Direccion || '—'}
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {u.email || '—'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span
                                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                                    u.rol === 'Super Admin'
                                                        ? 'bg-[#2d3e83]/10 text-[#2d3e83] dark:bg-white/15 dark:text-white'
                                                        : u.rol === 'Operador'
                                                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                                                          : u.rol === 'Medico'
                                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                                            : 'bg-muted text-muted-foreground'
                                                }`}
                                            >
                                                {u.rol || 'paciente'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {u.email_verified_at ? (
                                                <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-300">
                                                    Verificado
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                                                    Pendiente
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="size-8 text-muted-foreground hover:text-[#2d3e83] dark:hover:text-white"
                                                    title="Ver"
                                                    onClick={() =>
                                                        setViewUser(u)
                                                    }
                                                >
                                                    <Eye className="size-4" />
                                                </Button>
                                                {acciones.editar && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="size-8 text-muted-foreground hover:text-[#2d3e83] dark:hover:text-white"
                                                        title="Editar"
                                                        onClick={() =>
                                                            openEdit(u)
                                                        }
                                                    >
                                                        <Pencil className="size-4" />
                                                    </Button>
                                                )}
                                                {acciones.borrar && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="size-8 text-muted-foreground hover:text-red-600"
                                                        title="Eliminar"
                                                        onClick={() =>
                                                            setDeleteTarget(u)
                                                        }
                                                    >
                                                        <Trash2 className="size-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Paginación */}
                    <div className="flex flex-col items-center justify-between gap-3 border-t p-4 sm:flex-row">
                        <span className="text-sm text-muted-foreground">
                            {users.total > 0
                                ? `Mostrando ${users.from}–${users.to} de ${users.total}`
                                : 'Sin registros'}
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                disabled={users.current_page <= 1}
                                onClick={() => goToPage(users.current_page - 1)}
                            >
                                <ChevronLeft className="size-4" />
                                Anterior
                            </Button>
                            <span className="px-1 text-sm text-muted-foreground">
                                Página {users.current_page} de {users.last_page}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                disabled={users.current_page >= users.last_page}
                                onClick={() => goToPage(users.current_page + 1)}
                            >
                                Siguiente
                                <ChevronRight className="size-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Diálogo Crear / Editar */}
            <Dialog
                open={formOpen}
                onOpenChange={(open) => {
                    setFormOpen(open);
                    if (!open) form.clearErrors();
                }}
            >
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {isEditing ? 'Editar usuario' : 'Crear usuario'}
                        </DialogTitle>
                        <DialogDescription>
                            {isEditing
                                ? 'Actualiza la información del usuario. Deja la contraseña en blanco para conservarla.'
                                : 'Completa la información para registrar un nuevo usuario.'}
                        </DialogDescription>
                    </DialogHeader>

                    <form
                        onSubmit={submit}
                        className="grid gap-4 sm:grid-cols-2"
                    >
                        <div className="grid gap-2 sm:col-span-2">
                            <Label htmlFor="rol">Rol *</Label>
                            <Select
                                value={form.data.rol}
                                onValueChange={(v) => {
                                    form.setData('rol', v);
                                    // La especialidad solo aplica a médicos.
                                    if (v !== 'Medico') {
                                        form.setData('codesp', '');
                                    }
                                    // El médico no inicia sesión: se descarta
                                    // el correo, que queda oculto.
                                    if (v === 'Medico') {
                                        form.setData('email', '');
                                    }
                                    // Médico y paciente no usan contraseña.
                                    if (v === 'Medico' || v === 'paciente') {
                                        form.setData('password', '');
                                        form.setData(
                                            'password_confirmation',
                                            '',
                                        );
                                    }
                                }}
                            >
                                <SelectTrigger id="rol">
                                    <SelectValue placeholder="Seleccione un rol" />
                                </SelectTrigger>
                                <SelectContent>
                                    {rolesList.map((r) => (
                                        <SelectItem key={r.id} value={r.Nombre}>
                                            {r.Nombre}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <InputError message={form.errors.rol} />
                        </div>

                        {/* Especialidad: solo visible/obligatoria si el rol es Medico */}
                        {form.data.rol === 'Medico' && (
                            <div className="grid gap-2 sm:col-span-2">
                                <Label htmlFor="codesp">Especialidad *</Label>
                                <Select
                                    value={form.data.codesp}
                                    onValueChange={(v) =>
                                        form.setData('codesp', v)
                                    }
                                >
                                    <SelectTrigger id="codesp">
                                        <SelectValue placeholder="Seleccione la especialidad del médico" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {especialidadesList.map((esp) => (
                                            <SelectItem
                                                key={esp.id}
                                                value={String(esp.espcodser)}
                                            >
                                                {esp.espcodser} — {esp.Nombre}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <InputError message={form.errors.codesp} />
                            </div>
                        )}

                        <div className="grid gap-2">
                            <Label htmlFor="name">Nombres *</Label>
                            <Input
                                id="name"
                                value={form.data.name}
                                onChange={(e) =>
                                    form.setData('name', e.target.value)
                                }
                                autoFocus
                            />
                            <InputError message={form.errors.name} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="Apellido1">Primer apellido</Label>
                            <Input
                                id="Apellido1"
                                value={form.data.Apellido1}
                                onChange={(e) =>
                                    form.setData('Apellido1', e.target.value)
                                }
                            />
                            <InputError message={form.errors.Apellido1} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="apellido2">Segundo apellido</Label>
                            <Input
                                id="apellido2"
                                value={form.data.apellido2}
                                onChange={(e) =>
                                    form.setData('apellido2', e.target.value)
                                }
                            />
                            <InputError message={form.errors.apellido2} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="tipo_Docu">Tipo de documento</Label>
                            <Select
                                value={form.data.tipo_Docu}
                                onValueChange={(v) =>
                                    form.setData('tipo_Docu', v)
                                }
                            >
                                <SelectTrigger id="tipo_Docu">
                                    <SelectValue placeholder="Seleccione" />
                                </SelectTrigger>
                                <SelectContent>
                                    {tiposDocumento.map((t) => (
                                        <SelectItem key={t.id} value={t.Nombre}>
                                            {t.Nombre}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <InputError message={form.errors.tipo_Docu} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="Numero_D">
                                Número de documento
                            </Label>
                            <Input
                                id="Numero_D"
                                value={form.data.Numero_D}
                                onChange={(e) =>
                                    form.setData('Numero_D', e.target.value)
                                }
                            />
                            <InputError message={form.errors.Numero_D} />
                        </div>

                        {/* El médico no inicia sesión: no se le pide correo. */}
                        {form.data.rol !== 'Medico' && (
                            <div className="grid gap-2">
                                <Label htmlFor="email">
                                    Correo electrónico *
                                </Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={form.data.email}
                                    onChange={(e) =>
                                        form.setData('email', e.target.value)
                                    }
                                />
                                <InputError message={form.errors.email} />
                            </div>
                        )}

                        <div className="grid gap-2">
                            <Label htmlFor="Telefono1">Teléfono 1</Label>
                            <Input
                                id="Telefono1"
                                value={form.data.Telefono1}
                                onChange={(e) =>
                                    form.setData('Telefono1', e.target.value)
                                }
                            />
                            <InputError message={form.errors.Telefono1} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="telefono2">Teléfono 2</Label>
                            <Input
                                id="telefono2"
                                value={form.data.telefono2}
                                onChange={(e) =>
                                    form.setData('telefono2', e.target.value)
                                }
                            />
                            <InputError message={form.errors.telefono2} />
                        </div>

                        <div className="grid gap-2 sm:col-span-2">
                            <Label htmlFor="Direccion">Dirección</Label>
                            <Input
                                id="Direccion"
                                value={form.data.Direccion}
                                onChange={(e) =>
                                    form.setData('Direccion', e.target.value)
                                }
                            />
                            <InputError message={form.errors.Direccion} />
                        </div>

                        <div className="grid gap-2 sm:col-span-2">
                            <Label htmlFor="Eps">EPS</Label>
                            <Select
                                value={form.data.Eps}
                                onValueChange={(v) => form.setData('Eps', v)}
                            >
                                <SelectTrigger id="Eps">
                                    <SelectValue placeholder="Seleccione la EPS" />
                                </SelectTrigger>
                                <SelectContent>
                                    {epsList.map((e) => (
                                        <SelectItem key={e.id} value={e.Nombre}>
                                            {e.Nombre}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <InputError message={form.errors.Eps} />
                        </div>

                        {/* Médico y paciente no inician sesión: sin contraseña. */}
                        {form.data.rol !== 'Medico' &&
                            form.data.rol !== 'paciente' && (
                                <>
                                    <div className="grid gap-2">
                                        <Label htmlFor="password">
                                            {isEditing
                                                ? 'Nueva contraseña'
                                                : 'Contraseña *'}
                                        </Label>
                                        <Input
                                            id="password"
                                            type="password"
                                            autoComplete="new-password"
                                            value={form.data.password}
                                            onChange={(e) =>
                                                form.setData(
                                                    'password',
                                                    e.target.value,
                                                )
                                            }
                                        />
                                        <InputError
                                            message={form.errors.password}
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="password_confirmation">
                                            Confirmar contraseña
                                        </Label>
                                        <Input
                                            id="password_confirmation"
                                            type="password"
                                            autoComplete="new-password"
                                            value={
                                                form.data.password_confirmation
                                            }
                                            onChange={(e) =>
                                                form.setData(
                                                    'password_confirmation',
                                                    e.target.value,
                                                )
                                            }
                                        />
                                    </div>
                                </>
                            )}

                        <DialogFooter className="sm:col-span-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setFormOpen(false)}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={form.processing}>
                                {form.processing && (
                                    <LoaderCircle className="size-4 animate-spin" />
                                )}
                                {isEditing
                                    ? 'Guardar cambios'
                                    : 'Crear usuario'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Diálogo Ver */}
            <Dialog
                open={viewUser !== null}
                onOpenChange={(open) => !open && setViewUser(null)}
            >
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Detalle del usuario</DialogTitle>
                        <DialogDescription>
                            Información registrada del usuario.
                        </DialogDescription>
                    </DialogHeader>
                    {viewUser && (
                        <div className="grid gap-4">
                            <div className="flex items-center gap-3">
                                <div className="flex size-12 items-center justify-center rounded-full bg-[#2d3e83] text-sm font-semibold text-white">
                                    {initials(viewUser)}
                                </div>
                                <div>
                                    <div className="font-semibold text-foreground">
                                        {fullName(viewUser)}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        {viewUser.email || '—'}
                                    </div>
                                </div>
                            </div>
                            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                                <Detail label="Rol" value={viewUser.rol} />
                                <Detail
                                    label="Tipo de documento"
                                    value={viewUser.tipo_Docu}
                                />
                                <Detail
                                    label="Número de documento"
                                    value={viewUser.Numero_D}
                                />
                                <Detail
                                    label="Teléfono 1"
                                    value={viewUser.Telefono1}
                                />
                                <Detail
                                    label="Teléfono 2"
                                    value={viewUser.telefono2}
                                />
                                <Detail
                                    label="Dirección"
                                    value={viewUser.Direccion}
                                />
                                <Detail label="EPS" value={viewUser.Eps} />
                                {viewUser.rol === 'Medico' && (
                                    <Detail
                                        label="Especialidad"
                                        value={
                                            especialidadesList.find(
                                                (e) =>
                                                    String(e.espcodser) ===
                                                    viewUser.codesp,
                                            )?.Nombre ??
                                            viewUser.codesp ??
                                            null
                                        }
                                    />
                                )}
                                <Detail
                                    label="Estado"
                                    value={
                                        viewUser.email_verified_at
                                            ? 'Verificado'
                                            : 'Pendiente'
                                    }
                                />
                                <Detail
                                    label="Registrado"
                                    value={formatDate(viewUser.created_at)}
                                />
                            </dl>
                        </div>
                    )}
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setViewUser(null)}
                        >
                            Cerrar
                        </Button>
                        {viewUser && acciones.editar && (
                            <Button
                                onClick={() => {
                                    const u = viewUser;
                                    setViewUser(null);
                                    openEdit(u);
                                }}
                                className="gap-2"
                            >
                                <Pencil className="size-4" />
                                Editar
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Diálogo Eliminar */}
            <Dialog
                open={deleteTarget !== null}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Eliminar usuario</DialogTitle>
                        <DialogDescription>
                            Esta acción no se puede deshacer. ¿Deseas eliminar a{' '}
                            <span className="font-semibold text-foreground">
                                {deleteTarget ? fullName(deleteTarget) : ''}
                            </span>
                            ?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeleteTarget(null)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmDelete}
                            disabled={deleting}
                        >
                            {deleting && (
                                <LoaderCircle className="size-4 animate-spin" />
                            )}
                            Eliminar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}

function Detail({ label, value }: { label: string; value: string | null }) {
    return (
        <div>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="font-medium text-foreground">{value || '—'}</dd>
        </div>
    );
}
