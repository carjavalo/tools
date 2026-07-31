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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { usePermisosVista } from '@/hooks/use-permisos-vista';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import {
    Ban,
    Check,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Eye,
    Handshake,
    ListChecks,
    LoaderCircle,
    Pencil,
    Plus,
    Search,
    ShieldCheck,
    Trash2,
    X,
    XCircle,
} from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';

interface ConvenioRow {
    id: number;
    nit_Convenio: string;
    nombre: string;
    regimen: string;
    tarifa: string;
    vigencia_inicio: string | null;
    vigencia_fin: string | null;
    nit_empresa: string;
    Estado: boolean;
    created_at: string | null;
    eps: { nit_empresa: string; Nombre: string } | null;
}

interface EpsOption {
    id: number;
    Nombre: string;
    nit_empresa: string;
}

interface RegimenRow {
    id: number;
    nombre: string;
    descripcion: string | null;
    estado: boolean;
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
    convenios: Paginated<ConvenioRow>;
    filters: { search: string; eps: string };
    stats: { total: number; activos: number; inactivos: number };
    epsOptions: EpsOption[];
    regimenes: RegimenRow[];
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Inicio', href: dashboard().url },
    { title: 'Gestión Convenios', href: '/tools/gestion-convenios' },
];

type ConvenioForm = {
    nit_Convenio: string;
    nombre: string;
    regimen: string;
    tarifa: string;
    vigencia_inicio: string;
    vigencia_fin: string;
    nit_empresa: string;
    Estado: boolean;
};

const emptyForm: ConvenioForm = {
    nit_Convenio: '',
    nombre: '',
    regimen: '',
    tarifa: '',
    vigencia_inicio: '',
    vigencia_fin: '',
    nit_empresa: '',
    Estado: true,
};

const formatVigencia = (row: ConvenioRow) => {
    if (!row.vigencia_inicio && !row.vigencia_fin) return '—';
    return `${row.vigencia_inicio ?? '—'} a ${row.vigencia_fin ?? '—'}`;
};

type RegimenForm = {
    nombre: string;
    descripcion: string;
    estado: boolean;
};

const emptyRegimenForm: RegimenForm = {
    nombre: '',
    descripcion: '',
    estado: true,
};

export default function GestionConvenios({
    convenios,
    filters,
    stats,
    epsOptions,
    regimenes,
}: PageProps) {
    const { flash } = usePage<SharedData>().props;
    const acciones = usePermisosVista('gestion-convenios');
    const accionesRegimen = usePermisosVista('gestion-regimen');
    const [search, setSearch] = useState(filters.search ?? '');
    const [epsFilter, setEpsFilter] = useState(filters.eps ?? '');
    const [formOpen, setFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [viewRow, setViewRow] = useState<ConvenioRow | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<ConvenioRow | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [notice, setNotice] = useState<{
        type: 'success' | 'error';
        msg: string;
    } | null>(null);

    const form = useForm<ConvenioForm>({ ...emptyForm });
    const didMount = useRef(false);

    // Mini CRUD de regímenes
    const [regimenOpen, setRegimenOpen] = useState(false);
    const [regimenEditingId, setRegimenEditingId] = useState<number | null>(
        null,
    );
    const [regimenDeleteId, setRegimenDeleteId] = useState<number | null>(
        null,
    );
    const regimenForm = useForm<RegimenForm>({ ...emptyRegimenForm });

    // Notificaciones flash
    useEffect(() => {
        if (flash?.success) setNotice({ type: 'success', msg: flash.success });
        else if (flash?.error) setNotice({ type: 'error', msg: flash.error });
    }, [flash?.success, flash?.error]);

    useEffect(() => {
        if (!notice) return;
        const timer = setTimeout(() => setNotice(null), 4000);
        return () => clearTimeout(timer);
    }, [notice]);

    // Búsqueda y filtro con debounce (servidor)
    useEffect(() => {
        if (!didMount.current) {
            didMount.current = true;
            return;
        }
        const timer = setTimeout(() => {
            router.get(
                '/tools/gestion-convenios',
                {
                    ...(search ? { search } : {}),
                    ...(epsFilter ? { eps: epsFilter } : {}),
                },
                { preserveState: true, preserveScroll: true, replace: true },
            );
        }, 350);
        return () => clearTimeout(timer);
    }, [search, epsFilter]);

    const goToPage = (page: number) => {
        router.get(
            '/tools/gestion-convenios',
            {
                ...(search ? { search } : {}),
                ...(epsFilter ? { eps: epsFilter } : {}),
                page,
            },
            { preserveState: true, preserveScroll: true },
        );
    };

    const openCreate = () => {
        form.reset();
        form.clearErrors();
        setEditingId(null);
        setFormOpen(true);
    };

    const openEdit = (row: ConvenioRow) => {
        form.clearErrors();
        form.setData({
            nit_Convenio: row.nit_Convenio,
            nombre: row.nombre,
            regimen: row.regimen,
            tarifa: row.tarifa,
            vigencia_inicio: row.vigencia_inicio ?? '',
            vigencia_fin: row.vigencia_fin ?? '',
            nit_empresa: row.nit_empresa,
            Estado: row.Estado,
        });
        setEditingId(row.id);
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
            form.put(`/tools/gestion-convenios/${editingId}`, options);
        } else {
            form.post('/tools/gestion-convenios', options);
        }
    };

    const toggleEstado = (row: ConvenioRow) => {
        router.put(
            `/tools/gestion-convenios/${row.id}`,
            {
                nit_Convenio: row.nit_Convenio,
                nombre: row.nombre,
                regimen: row.regimen,
                tarifa: row.tarifa,
                vigencia_inicio: row.vigencia_inicio ?? '',
                vigencia_fin: row.vigencia_fin ?? '',
                nit_empresa: row.nit_empresa,
                Estado: !row.Estado,
            },
            { preserveScroll: true, preserveState: true },
        );
    };

    const confirmDelete = () => {
        if (!deleteTarget) return;
        router.delete(`/tools/gestion-convenios/${deleteTarget.id}`, {
            preserveScroll: true,
            onStart: () => setDeleting(true),
            onFinish: () => setDeleting(false),
            onSuccess: () => setDeleteTarget(null),
        });
    };

    // ----- Mini CRUD de regímenes -----

    const resetRegimenForm = () => {
        regimenForm.reset();
        regimenForm.clearErrors();
        setRegimenEditingId(null);
        setRegimenDeleteId(null);
    };

    const openRegimenEdit = (row: RegimenRow) => {
        regimenForm.clearErrors();
        regimenForm.setData({
            nombre: row.nombre,
            descripcion: row.descripcion ?? '',
            estado: row.estado,
        });
        setRegimenEditingId(row.id);
        setRegimenDeleteId(null);
    };

    const submitRegimen = (e: FormEvent) => {
        e.preventDefault();
        const isNew = regimenEditingId === null;
        const nombre = regimenForm.data.nombre.trim();
        const previo = regimenes.find(
            (r) => r.id === regimenEditingId,
        )?.nombre;
        const options = {
            preserveScroll: true,
            onSuccess: () => {
                // Actualiza el select del convenio con el régimen recién
                // creado o renombrado, para que quede seleccionado.
                if (isNew) {
                    form.setData('regimen', nombre);
                } else if (previo && form.data.regimen === previo) {
                    form.setData('regimen', nombre);
                }
                resetRegimenForm();
            },
        };
        if (regimenEditingId) {
            regimenForm.put(
                `/tools/gestion-regimen/${regimenEditingId}`,
                options,
            );
        } else {
            regimenForm.post('/tools/gestion-regimen', options);
        }
    };

    const deleteRegimen = (id: number) => {
        router.delete(`/tools/gestion-regimen/${id}`, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                if (regimenEditingId === id) resetRegimenForm();
                setRegimenDeleteId(null);
            },
        });
    };

    const regimenEditando = regimenEditingId !== null;
    const activeRegimenes = regimenes.filter((r) => r.estado);
    // Si el convenio en edición tiene un régimen que ya no existe o está
    // inactivo, se incluye como opción para no perder el valor actual.
    const regimenOptions =
        form.data.regimen &&
        !activeRegimenes.some((r) => r.nombre === form.data.regimen)
            ? [
                  {
                      id: -1,
                      nombre: form.data.regimen,
                      descripcion: null,
                      estado: true,
                  },
                  ...activeRegimenes,
              ]
            : activeRegimenes;

    const isEditing = editingId !== null;
    const statCards = [
        {
            label: 'Total Convenios',
            value: stats.total,
            icon: ListChecks,
            color: 'text-[#2d3e83] bg-[#2d3e83]/10 dark:bg-white/10 dark:text-white',
        },
        {
            label: 'Activos',
            value: stats.activos,
            icon: ShieldCheck,
            color: 'text-green-700 bg-green-100 dark:bg-green-950 dark:text-green-300',
        },
        {
            label: 'Inactivos',
            value: stats.inactivos,
            icon: Ban,
            color: 'text-amber-700 bg-amber-100 dark:bg-amber-950 dark:text-amber-300',
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Gestión Convenios" />

            <div className="flex h-full flex-1 flex-col gap-6 p-4 md:p-6">
                {/* Encabezado */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex size-11 items-center justify-center rounded-xl bg-[#2d3e83]/10 text-[#2d3e83] dark:bg-white/10 dark:text-white">
                            <Handshake className="size-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">
                                Gestión Convenios
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                Administra los convenios asociados a las EPS del
                                sistema.
                            </p>
                        </div>
                    </div>
                    {acciones.crear && (
                        <Button onClick={openCreate} className="gap-2">
                            <Plus className="size-4" />
                            Crear Convenio
                        </Button>
                    )}
                </div>

                {/* Estadísticas */}
                <div className="grid gap-4 sm:grid-cols-3">
                    {statCards.map((card) => (
                        <div
                            key={card.label}
                            className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm"
                        >
                            <div
                                className={`flex size-12 items-center justify-center rounded-xl ${card.color}`}
                            >
                                <card.icon className="size-6" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-foreground">
                                    {card.value}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    {card.label}
                                </div>
                            </div>
                        </div>
                    ))}
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
                    <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center">
                        <div className="relative w-full sm:max-w-xs">
                            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Buscar por nombre, NIT o régimen…"
                                className="pl-9"
                            />
                        </div>
                        <div className="w-full sm:max-w-xs">
                            <Select
                                value={epsFilter || 'all'}
                                onValueChange={(v) =>
                                    setEpsFilter(v === 'all' ? '' : v)
                                }
                            >
                                <SelectTrigger aria-label="Filtrar por EPS">
                                    <SelectValue placeholder="Todas las EPS" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        Todas las EPS
                                    </SelectItem>
                                    {epsOptions.map((eps) => (
                                        <SelectItem
                                            key={eps.id}
                                            value={eps.nit_empresa}
                                        >
                                            {eps.Nombre}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
                                <tr>
                                    <th className="px-4 py-3 font-medium">
                                        Nombre
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        NIT Convenio
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        EPS
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Régimen
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Tarifa
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Vigencia
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
                                {convenios.data.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={8}
                                            className="px-4 py-12 text-center text-muted-foreground"
                                        >
                                            No se encontraron convenios.
                                        </td>
                                    </tr>
                                )}
                                {convenios.data.map((row) => (
                                    <tr
                                        key={row.id}
                                        className="transition-colors hover:bg-muted/40"
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#2d3e83]/10 text-[#2d3e83] dark:bg-white/10 dark:text-white">
                                                    <Handshake className="size-4" />
                                                </div>
                                                <span className="font-medium text-foreground">
                                                    {row.nombre}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {row.nit_Convenio}
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {row.eps?.Nombre ?? row.nit_empresa}
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {row.regimen}
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {row.tarifa}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                                            {formatVigencia(row)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <Switch
                                                    checked={row.Estado}
                                                    disabled={!acciones.editar}
                                                    onCheckedChange={() =>
                                                        toggleEstado(row)
                                                    }
                                                    aria-label="Cambiar estado"
                                                />
                                                <span
                                                    className={`text-xs font-medium ${
                                                        row.Estado
                                                            ? 'text-green-600 dark:text-green-400'
                                                            : 'text-muted-foreground'
                                                    }`}
                                                >
                                                    {row.Estado
                                                        ? 'Activo'
                                                        : 'Inactivo'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="size-8 text-muted-foreground hover:text-[#2d3e83] dark:hover:text-white"
                                                    title="Ver"
                                                    onClick={() =>
                                                        setViewRow(row)
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
                                                            openEdit(row)
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
                                                            setDeleteTarget(
                                                                row,
                                                            )
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
                            {convenios.total > 0
                                ? `Mostrando ${convenios.from}–${convenios.to} de ${convenios.total}`
                                : 'Sin registros'}
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                disabled={convenios.current_page <= 1}
                                onClick={() =>
                                    goToPage(convenios.current_page - 1)
                                }
                            >
                                <ChevronLeft className="size-4" />
                                Anterior
                            </Button>
                            <span className="px-1 text-sm text-muted-foreground">
                                Página {convenios.current_page} de{' '}
                                {convenios.last_page}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                disabled={
                                    convenios.current_page >=
                                    convenios.last_page
                                }
                                onClick={() =>
                                    goToPage(convenios.current_page + 1)
                                }
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
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {isEditing ? 'Editar Convenio' : 'Crear Convenio'}
                        </DialogTitle>
                        <DialogDescription>
                            {isEditing
                                ? 'Actualiza la información del convenio.'
                                : 'Registra un nuevo convenio asociado a una EPS.'}
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={submit} className="grid gap-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <Label htmlFor="nit_Convenio">
                                    NIT Convenio *
                                </Label>
                                <Input
                                    id="nit_Convenio"
                                    value={form.data.nit_Convenio}
                                    onChange={(e) =>
                                        form.setData(
                                            'nit_Convenio',
                                            e.target.value,
                                        )
                                    }
                                    maxLength={25}
                                    placeholder="Ej: 900123456-7"
                                    autoFocus
                                />
                                <InputError
                                    message={form.errors.nit_Convenio}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="tarifa">Tarifa *</Label>
                                <Input
                                    id="tarifa"
                                    value={form.data.tarifa}
                                    onChange={(e) =>
                                        form.setData('tarifa', e.target.value)
                                    }
                                    maxLength={5}
                                />
                                <InputError message={form.errors.tarifa} />
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="nombre">Nombre *</Label>
                            <Input
                                id="nombre"
                                value={form.data.nombre}
                                onChange={(e) =>
                                    form.setData('nombre', e.target.value)
                                }
                                maxLength={120}
                            />
                            <InputError message={form.errors.nombre} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="nit_empresa">EPS *</Label>
                            <Select
                                value={form.data.nit_empresa}
                                onValueChange={(v) =>
                                    form.setData('nit_empresa', v)
                                }
                            >
                                <SelectTrigger id="nit_empresa">
                                    <SelectValue placeholder="Seleccione una EPS" />
                                </SelectTrigger>
                                <SelectContent>
                                    {epsOptions.map((eps) => (
                                        <SelectItem
                                            key={eps.id}
                                            value={eps.nit_empresa}
                                        >
                                            {eps.Nombre} — {eps.nit_empresa}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <InputError message={form.errors.nit_empresa} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="regimen">Régimen *</Label>
                            <div className="flex gap-2">
                                <Select
                                    value={form.data.regimen}
                                    onValueChange={(v) =>
                                        form.setData('regimen', v)
                                    }
                                >
                                    <SelectTrigger
                                        id="regimen"
                                        className="flex-1"
                                    >
                                        <SelectValue placeholder="Seleccione un régimen" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {regimenOptions.map((r) => (
                                            <SelectItem
                                                key={r.id}
                                                value={r.nombre}
                                            >
                                                {r.nombre}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {(accionesRegimen.crear ||
                                    accionesRegimen.editar ||
                                    accionesRegimen.borrar) && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        title="Gestionar regímenes"
                                        onClick={() => setRegimenOpen(true)}
                                    >
                                        <Plus className="size-4" />
                                    </Button>
                                )}
                            </div>
                            <InputError message={form.errors.regimen} />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <Label htmlFor="vigencia_inicio">
                                    Vigencia desde
                                </Label>
                                <Input
                                    id="vigencia_inicio"
                                    type="date"
                                    value={form.data.vigencia_inicio}
                                    onChange={(e) =>
                                        form.setData(
                                            'vigencia_inicio',
                                            e.target.value,
                                        )
                                    }
                                />
                                <InputError
                                    message={form.errors.vigencia_inicio}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="vigencia_fin">
                                    Vigencia hasta
                                </Label>
                                <Input
                                    id="vigencia_fin"
                                    type="date"
                                    value={form.data.vigencia_fin}
                                    onChange={(e) =>
                                        form.setData(
                                            'vigencia_fin',
                                            e.target.value,
                                        )
                                    }
                                />
                                <InputError
                                    message={form.errors.vigencia_fin}
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                                <Label htmlFor="Estado">Estado</Label>
                                <p className="text-xs text-muted-foreground">
                                    {form.data.Estado
                                        ? 'El convenio está activo.'
                                        : 'El convenio está inactivo.'}
                                </p>
                            </div>
                            <Switch
                                id="Estado"
                                checked={form.data.Estado}
                                onCheckedChange={(v) =>
                                    form.setData('Estado', v)
                                }
                            />
                        </div>

                        <DialogFooter>
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
                                    : 'Crear Convenio'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Diálogo mini CRUD de Régimen */}
            <Dialog
                open={regimenOpen}
                onOpenChange={(open) => {
                    setRegimenOpen(open);
                    if (!open) resetRegimenForm();
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Gestión de Régimen</DialogTitle>
                        <DialogDescription>
                            Crea, edita o elimina los regímenes disponibles
                            para los convenios.
                        </DialogDescription>
                    </DialogHeader>

                    {(accionesRegimen.crear || accionesRegimen.editar) && (
                        <form
                            onSubmit={submitRegimen}
                            className="grid gap-3"
                        >
                            <div className="grid gap-2">
                                <Label htmlFor="regimen_nombre">
                                    {regimenEditando
                                        ? 'Editar régimen *'
                                        : 'Nuevo régimen *'}
                                </Label>
                                <Input
                                    id="regimen_nombre"
                                    value={regimenForm.data.nombre}
                                    onChange={(e) =>
                                        regimenForm.setData(
                                            'nombre',
                                            e.target.value,
                                        )
                                    }
                                    maxLength={120}
                                    placeholder="Ej: Contributivo"
                                />
                                <InputError
                                    message={regimenForm.errors.nombre}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="regimen_descripcion">
                                    Descripción
                                </Label>
                                <Textarea
                                    id="regimen_descripcion"
                                    value={regimenForm.data.descripcion}
                                    onChange={(e) =>
                                        regimenForm.setData(
                                            'descripcion',
                                            e.target.value,
                                        )
                                    }
                                    maxLength={250}
                                    rows={2}
                                    placeholder="Información adicional (opcional)"
                                />
                                <InputError
                                    message={regimenForm.errors.descripcion}
                                />
                            </div>
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <Switch
                                        id="regimen_estado"
                                        checked={regimenForm.data.estado}
                                        onCheckedChange={(v) =>
                                            regimenForm.setData('estado', v)
                                        }
                                    />
                                    <Label
                                        htmlFor="regimen_estado"
                                        className="text-xs text-muted-foreground"
                                    >
                                        {regimenForm.data.estado
                                            ? 'Activo'
                                            : 'Inactivo'}
                                    </Label>
                                </div>
                                <div className="flex gap-2">
                                    {regimenEditando && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={resetRegimenForm}
                                        >
                                            Cancelar
                                        </Button>
                                    )}
                                    <Button
                                        type="submit"
                                        size="sm"
                                        className="gap-1"
                                        disabled={regimenForm.processing}
                                    >
                                        {regimenForm.processing ? (
                                            <LoaderCircle className="size-4 animate-spin" />
                                        ) : (
                                            <Plus className="size-4" />
                                        )}
                                        {regimenEditando
                                            ? 'Guardar cambios'
                                            : 'Agregar'}
                                    </Button>
                                </div>
                            </div>
                        </form>
                    )}

                    {/* Listado de regímenes */}
                    <div className="max-h-64 overflow-y-auto rounded-lg border">
                        {regimenes.length === 0 && (
                            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                                Aún no hay regímenes creados.
                            </p>
                        )}
                        <div className="divide-y">
                            {regimenes.map((r) => (
                                <div
                                    key={r.id}
                                    className={`flex items-center justify-between gap-2 px-3 py-2 ${
                                        regimenEditingId === r.id
                                            ? 'bg-muted/60'
                                            : ''
                                    }`}
                                >
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="truncate text-sm font-medium text-foreground">
                                                {r.nombre}
                                            </span>
                                            <span
                                                className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                                    r.estado
                                                        ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                                                        : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                                }`}
                                            >
                                                {r.estado
                                                    ? 'Activo'
                                                    : 'Inactivo'}
                                            </span>
                                        </div>
                                        {r.descripcion && (
                                            <p className="truncate text-xs text-muted-foreground">
                                                {r.descripcion}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1">
                                        {regimenDeleteId === r.id ? (
                                            <>
                                                <span className="text-xs text-muted-foreground">
                                                    ¿Eliminar?
                                                </span>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="size-7 text-red-600 hover:text-red-700"
                                                    title="Confirmar eliminación"
                                                    onClick={() =>
                                                        deleteRegimen(r.id)
                                                    }
                                                >
                                                    <Check className="size-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="size-7 text-muted-foreground"
                                                    title="Cancelar"
                                                    onClick={() =>
                                                        setRegimenDeleteId(
                                                            null,
                                                        )
                                                    }
                                                >
                                                    <X className="size-4" />
                                                </Button>
                                            </>
                                        ) : (
                                            <>
                                                {accionesRegimen.editar && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="size-7 text-muted-foreground hover:text-[#2d3e83] dark:hover:text-white"
                                                        title="Editar"
                                                        onClick={() =>
                                                            openRegimenEdit(r)
                                                        }
                                                    >
                                                        <Pencil className="size-4" />
                                                    </Button>
                                                )}
                                                {accionesRegimen.borrar && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="size-7 text-muted-foreground hover:text-red-600"
                                                        title="Eliminar"
                                                        onClick={() =>
                                                            setRegimenDeleteId(
                                                                r.id,
                                                            )
                                                        }
                                                    >
                                                        <Trash2 className="size-4" />
                                                    </Button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setRegimenOpen(false);
                                resetRegimenForm();
                            }}
                        >
                            Cerrar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Diálogo Ver */}
            <Dialog
                open={viewRow !== null}
                onOpenChange={(open) => !open && setViewRow(null)}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Detalle del Convenio</DialogTitle>
                    </DialogHeader>
                    {viewRow && (
                        <div className="grid gap-4">
                            <div className="flex items-center gap-3">
                                <div className="flex size-12 items-center justify-center rounded-xl bg-[#2d3e83]/10 text-[#2d3e83] dark:bg-white/10 dark:text-white">
                                    <Handshake className="size-6" />
                                </div>
                                <div>
                                    <div className="font-semibold text-foreground">
                                        {viewRow.nombre}
                                    </div>
                                    <span
                                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                            viewRow.Estado
                                                ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                                                : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                        }`}
                                    >
                                        {viewRow.Estado
                                            ? 'Activo'
                                            : 'Inactivo'}
                                    </span>
                                </div>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                    <div className="text-xs text-muted-foreground">
                                        NIT Convenio
                                    </div>
                                    <p className="text-sm text-foreground">
                                        {viewRow.nit_Convenio}
                                    </p>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">
                                        Tarifa
                                    </div>
                                    <p className="text-sm text-foreground">
                                        {viewRow.tarifa}
                                    </p>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">
                                        EPS
                                    </div>
                                    <p className="text-sm text-foreground">
                                        {viewRow.eps?.Nombre ??
                                            viewRow.nit_empresa}
                                    </p>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">
                                        NIT de la EPS
                                    </div>
                                    <p className="text-sm text-foreground">
                                        {viewRow.nit_empresa}
                                    </p>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">
                                        Régimen
                                    </div>
                                    <p className="text-sm text-foreground">
                                        {viewRow.regimen}
                                    </p>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">
                                        Vigencia
                                    </div>
                                    <p className="text-sm text-foreground">
                                        {formatVigencia(viewRow)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setViewRow(null)}
                        >
                            Cerrar
                        </Button>
                        {viewRow && acciones.editar && (
                            <Button
                                className="gap-2"
                                onClick={() => {
                                    const r = viewRow;
                                    setViewRow(null);
                                    openEdit(r);
                                }}
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
                        <DialogTitle>Eliminar Convenio</DialogTitle>
                        <DialogDescription>
                            Esta acción no se puede deshacer. ¿Deseas eliminar
                            el convenio{' '}
                            <span className="font-semibold text-foreground">
                                {deleteTarget?.nombre}
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
