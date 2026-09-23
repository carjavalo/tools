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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { usePermisosVista } from '@/hooks/use-permisos-vista';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import {
    Ban,
    BriefcaseMedical,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Eye,
    Hash,
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
import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react';

interface ServicioRow {
    codigo: number;
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
    servicios: Paginated<ServicioRow>;
    filters: { search: string };
    stats: { total: number; activos: number; inactivos: number };
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Inicio', href: dashboard().url },
    { title: 'Gestión Servicios', href: '/tools/gestion-servicios' },
];

const MAX_CAMPO = 120;

type ServicioForm = {
    nombre: string;
    descripcion: string;
    estado: boolean;
};

const emptyForm: ServicioForm = {
    nombre: '',
    descripcion: '',
    estado: true,
};

/**
 * Resalta en el texto lo que se está buscando, para ver de un vistazo por qué
 * aparece cada fila.
 */
function resaltar(texto: string, termino: string): ReactNode {
    const t = termino.trim();
    if (!t) return texto;

    const i = texto.toLowerCase().indexOf(t.toLowerCase());
    if (i === -1) return texto;

    return (
        <>
            {texto.slice(0, i)}
            <mark className="rounded bg-yellow-200 px-0.5 text-foreground dark:bg-yellow-700/60">
                {texto.slice(i, i + t.length)}
            </mark>
            {texto.slice(i + t.length)}
        </>
    );
}

/** Contador de caracteres bajo un campo: se pone ámbar al acercarse al tope. */
function Contador({ valor }: { valor: string }) {
    const n = valor.length;

    return (
        <span
            className={`text-xs tabular-nums ${
                n >= MAX_CAMPO - 10
                    ? 'font-medium text-amber-600 dark:text-amber-400'
                    : 'text-muted-foreground'
            }`}
        >
            {n}/{MAX_CAMPO}
        </span>
    );
}

export default function GestionServicios({
    servicios,
    filters,
    stats,
}: PageProps) {
    const { flash } = usePage<SharedData>().props;
    const acciones = usePermisosVista('gestion-servicios');
    const [search, setSearch] = useState(filters.search ?? '');
    const [formOpen, setFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [viewRow, setViewRow] = useState<ServicioRow | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<ServicioRow | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [notice, setNotice] = useState<{
        type: 'success' | 'error';
        msg: string;
    } | null>(null);

    const form = useForm<ServicioForm>({ ...emptyForm });
    const didMount = useRef(false);

    useEffect(() => {
        if (flash?.success) setNotice({ type: 'success', msg: flash.success });
        else if (flash?.error) setNotice({ type: 'error', msg: flash.error });
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
            router.get('/tools/gestion-servicios', search ? { search } : {}, {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            });
        }, 350);
        return () => clearTimeout(timer);
    }, [search]);

    const goToPage = (page: number) => {
        router.get(
            '/tools/gestion-servicios',
            { ...(search ? { search } : {}), page },
            { preserveState: true, preserveScroll: true },
        );
    };

    const openCreate = () => {
        form.reset();
        form.clearErrors();
        setEditingId(null);
        setFormOpen(true);
    };

    const openEdit = (row: ServicioRow) => {
        form.clearErrors();
        form.setData({
            nombre: row.nombre,
            descripcion: row.descripcion ?? '',
            estado: row.estado,
        });
        setEditingId(row.codigo);
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
            form.put(`/tools/gestion-servicios/${editingId}`, options);
        } else {
            form.post('/tools/gestion-servicios', options);
        }
    };

    const toggleEstado = (row: ServicioRow) => {
        router.put(
            `/tools/gestion-servicios/${row.codigo}`,
            {
                nombre: row.nombre,
                descripcion: row.descripcion ?? '',
                estado: !row.estado,
            },
            { preserveScroll: true, preserveState: true },
        );
    };

    const confirmDelete = () => {
        if (!deleteTarget) return;
        router.delete(`/tools/gestion-servicios/${deleteTarget.codigo}`, {
            preserveScroll: true,
            onStart: () => setDeleting(true),
            onFinish: () => setDeleting(false),
            onSuccess: () => setDeleteTarget(null),
        });
    };

    const isEditing = editingId !== null;
    const statCards = [
        {
            label: 'Total Servicios',
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
            <Head title="Gestión Servicios" />

            <div className="flex h-full flex-1 flex-col gap-6 p-4 md:p-6">
                {/* Encabezado */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex size-11 items-center justify-center rounded-xl bg-[#2d3e83]/10 text-[#2d3e83] dark:bg-white/10 dark:text-white">
                            <BriefcaseMedical className="size-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">
                                Gestión Servicios
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                Administra los servicios asignables del sistema.
                            </p>
                        </div>
                    </div>
                    {acciones.crear && (
                        <Button onClick={openCreate} className="gap-2">
                            <Plus className="size-4" />
                            Nuevo Servicio
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
                    <div className="border-b p-4">
                        <div className="relative w-full sm:max-w-xs">
                            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Buscar por código, nombre o descripción…"
                                className="pr-9 pl-9"
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch('')}
                                    title="Limpiar búsqueda"
                                    className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                                >
                                    <X className="size-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
                                <tr>
                                    <th className="w-24 px-4 py-3 font-medium">
                                        Código
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Nombre
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Estado
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Descripción
                                    </th>
                                    <th className="px-4 py-3 text-right font-medium">
                                        Acciones
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {servicios.data.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="px-4 py-12 text-center text-muted-foreground"
                                        >
                                            <div className="flex flex-col items-center gap-3">
                                                <BriefcaseMedical className="size-8 opacity-40" />
                                                {search
                                                    ? 'Ningún servicio coincide con la búsqueda.'
                                                    : 'Aún no hay servicios registrados.'}
                                                {!search && acciones.crear && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="gap-2"
                                                        onClick={openCreate}
                                                    >
                                                        <Plus className="size-4" />
                                                        Crear el primero
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                                {servicios.data.map((row) => (
                                    <tr
                                        key={row.codigo}
                                        className="transition-colors hover:bg-muted/40"
                                    >
                                        <td className="px-4 py-3">
                                            <span className="inline-flex items-center gap-0.5 rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-foreground">
                                                <Hash className="size-3 text-muted-foreground" />
                                                {row.codigo}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#2d3e83]/10 text-[#2d3e83] dark:bg-white/10 dark:text-white">
                                                    <BriefcaseMedical className="size-4" />
                                                </div>
                                                <span className="font-medium text-foreground">
                                                    {resaltar(
                                                        row.nombre,
                                                        search,
                                                    )}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <Switch
                                                    checked={row.estado}
                                                    disabled={!acciones.editar}
                                                    onCheckedChange={() =>
                                                        toggleEstado(row)
                                                    }
                                                    aria-label="Cambiar estado"
                                                />
                                                <span
                                                    className={`text-xs font-medium ${
                                                        row.estado
                                                            ? 'text-green-600 dark:text-green-400'
                                                            : 'text-muted-foreground'
                                                    }`}
                                                >
                                                    {row.estado
                                                        ? 'Activo'
                                                        : 'Inactivo'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="max-w-md px-4 py-3 text-muted-foreground">
                                            <span className="line-clamp-1">
                                                {row.descripcion
                                                    ? resaltar(
                                                          row.descripcion,
                                                          search,
                                                      )
                                                    : '—'}
                                            </span>
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
                                                            setDeleteTarget(row)
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
                            {servicios.total > 0
                                ? `Mostrando ${servicios.from}–${servicios.to} de ${servicios.total}`
                                : 'Sin registros'}
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                disabled={servicios.current_page <= 1}
                                onClick={() =>
                                    goToPage(servicios.current_page - 1)
                                }
                            >
                                <ChevronLeft className="size-4" />
                                Anterior
                            </Button>
                            <span className="px-1 text-sm text-muted-foreground">
                                Página {servicios.current_page} de{' '}
                                {servicios.last_page}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                disabled={
                                    servicios.current_page >=
                                    servicios.last_page
                                }
                                onClick={() =>
                                    goToPage(servicios.current_page + 1)
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
                            {isEditing
                                ? `Editar Servicio #${editingId}`
                                : 'Nuevo Servicio'}
                        </DialogTitle>
                        <DialogDescription>
                            {isEditing
                                ? 'Actualiza la información del servicio.'
                                : 'Registra un nuevo servicio. El código se asigna automáticamente.'}
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={submit} className="grid gap-4">
                        <div className="grid gap-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="nombre">Nombre *</Label>
                                <Contador valor={form.data.nombre} />
                            </div>
                            <Input
                                id="nombre"
                                value={form.data.nombre}
                                onChange={(e) =>
                                    form.setData('nombre', e.target.value)
                                }
                                maxLength={MAX_CAMPO}
                                placeholder="Ej.: Cirugía Cardiovascular"
                                autoFocus
                            />
                            <InputError message={form.errors.nombre} />
                        </div>

                        <div className="grid gap-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="descripcion">Descripción</Label>
                                <Contador valor={form.data.descripcion} />
                            </div>
                            <Textarea
                                id="descripcion"
                                value={form.data.descripcion}
                                onChange={(e) =>
                                    form.setData('descripcion', e.target.value)
                                }
                                maxLength={MAX_CAMPO}
                                rows={3}
                                placeholder="Información adicional (opcional)"
                            />
                            <InputError message={form.errors.descripcion} />
                        </div>

                        <div className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                                <Label htmlFor="estado">Estado</Label>
                                <p className="text-xs text-muted-foreground">
                                    {form.data.estado
                                        ? 'El servicio está activo.'
                                        : 'El servicio está inactivo.'}
                                </p>
                            </div>
                            <Switch
                                id="estado"
                                checked={form.data.estado}
                                onCheckedChange={(v) =>
                                    form.setData('estado', v)
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
                                    : 'Crear Servicio'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Diálogo Ver */}
            <Dialog
                open={viewRow !== null}
                onOpenChange={(open) => !open && setViewRow(null)}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Detalle del Servicio</DialogTitle>
                    </DialogHeader>
                    {viewRow && (
                        <div className="grid gap-4">
                            <div className="flex items-center gap-3">
                                <div className="flex size-12 items-center justify-center rounded-xl bg-[#2d3e83]/10 text-[#2d3e83] dark:bg-white/10 dark:text-white">
                                    <BriefcaseMedical className="size-6" />
                                </div>
                                <div>
                                    <div className="font-semibold text-foreground">
                                        {viewRow.nombre}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="inline-flex items-center gap-0.5 rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-foreground">
                                            <Hash className="size-3 text-muted-foreground" />
                                            {viewRow.codigo}
                                        </span>
                                        <span
                                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                                viewRow.estado
                                                    ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                            }`}
                                        >
                                            {viewRow.estado
                                                ? 'Activo'
                                                : 'Inactivo'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground">
                                    Descripción
                                </div>
                                <p className="text-sm break-words text-foreground">
                                    {viewRow.descripcion || '—'}
                                </p>
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
                        <DialogTitle>Eliminar Servicio</DialogTitle>
                        <DialogDescription>
                            Esta acción no se puede deshacer. ¿Deseas eliminar
                            el servicio{' '}
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
