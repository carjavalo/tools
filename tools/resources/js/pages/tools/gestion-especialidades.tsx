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
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Eye,
    Layers,
    ListChecks,
    LoaderCircle,
    Pencil,
    Plus,
    Search,
    ShieldCheck,
    Stethoscope,
    Trash2,
    X,
    XCircle,
} from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';

interface EspecialidadRow {
    id: number;
    espcodser: string | null;
    codminsal: string | null;
    Nombre: string;
    Estado: boolean;
    Observacion: string | null;
    created_at: string | null;
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
    especialidades: Paginated<EspecialidadRow>;
    filters: { search: string };
    stats: { total: number; activas: number; inactivas: number };
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Inicio', href: dashboard().url },
    { title: 'Gestión de Especialidades', href: '/tools/gestion-especialidades' },
];

type EspecialidadForm = {
    espcodser: string;
    codminsal: string;
    Nombre: string;
    Estado: boolean;
    Observacion: string;
};

const emptyForm: EspecialidadForm = {
    espcodser: '',
    codminsal: '',
    Nombre: '',
    Estado: true,
    Observacion: '',
};

export default function GestionEspecialidades({
    especialidades,
    filters,
    stats,
}: PageProps) {
    const { flash } = usePage<SharedData>().props;
    const acciones = usePermisosVista('gestion-especialidades');
    const [search, setSearch] = useState(filters.search ?? '');
    const [formOpen, setFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [viewRow, setViewRow] = useState<EspecialidadRow | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<EspecialidadRow | null>(
        null,
    );
    const [deleting, setDeleting] = useState(false);
    const [askSubesp, setAskSubesp] = useState<{
        id: number;
        Nombre: string;
    } | null>(null);
    const [notice, setNotice] = useState<{
        type: 'success' | 'error';
        msg: string;
    } | null>(null);

    const form = useForm<EspecialidadForm>({ ...emptyForm });
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
            router.get(
                '/tools/gestion-especialidades',
                search ? { search } : {},
                { preserveState: true, preserveScroll: true, replace: true },
            );
        }, 350);
        return () => clearTimeout(timer);
    }, [search]);

    const goToPage = (page: number) => {
        router.get(
            '/tools/gestion-especialidades',
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

    // Lleva a Gestión de Sub Especialidades y abre el modal de creación
    // con esta especialidad ya preseleccionada.
    const crearSubespecialidad = (row: EspecialidadRow) => {
        router.get('/tools/gestion-subespecialidades', { crear_para: row.id });
    };

    const openEdit = (row: EspecialidadRow) => {
        form.clearErrors();
        form.setData({
            espcodser: row.espcodser ?? '',
            codminsal: row.codminsal ?? '',
            Nombre: row.Nombre,
            Estado: row.Estado,
            Observacion: row.Observacion ?? '',
        });
        setEditingId(row.id);
        setFormOpen(true);
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();

        if (editingId) {
            form.put(`/tools/gestion-especialidades/${editingId}`, {
                preserveScroll: true,
                onSuccess: () => {
                    setFormOpen(false);
                    form.reset();
                },
            });
            return;
        }

        form.post('/tools/gestion-especialidades', {
            preserveScroll: true,
            onSuccess: (page) => {
                setFormOpen(false);
                form.reset();
                // Tras crear, preguntamos si desea registrar subespecialidades
                // para la especialidad recién creada.
                const created = (page.props.flash as SharedData['flash'])
                    ?.createdEspecialidad;
                if (created) {
                    // Pequeño retraso para que el modal de creación termine de
                    // cerrarse antes de abrir el de confirmación.
                    setTimeout(() => setAskSubesp(created), 250);
                }
            },
        });
    };

    const toggleEstado = (row: EspecialidadRow) => {
        router.put(
            `/tools/gestion-especialidades/${row.id}`,
            {
                espcodser: row.espcodser ?? '',
                codminsal: row.codminsal ?? '',
                Nombre: row.Nombre,
                Estado: !row.Estado,
                Observacion: row.Observacion ?? '',
            },
            { preserveScroll: true, preserveState: true },
        );
    };

    const confirmDelete = () => {
        if (!deleteTarget) return;
        router.delete(`/tools/gestion-especialidades/${deleteTarget.id}`, {
            preserveScroll: true,
            onStart: () => setDeleting(true),
            onFinish: () => setDeleting(false),
            onSuccess: () => setDeleteTarget(null),
        });
    };

    const isEditing = editingId !== null;
    const statCards = [
        {
            label: 'Total especialidades',
            value: stats.total,
            icon: ListChecks,
            color: 'text-[#2d3e83] bg-[#2d3e83]/10 dark:bg-white/10 dark:text-white',
        },
        {
            label: 'Activas',
            value: stats.activas,
            icon: ShieldCheck,
            color: 'text-green-700 bg-green-100 dark:bg-green-950 dark:text-green-300',
        },
        {
            label: 'Inactivas',
            value: stats.inactivas,
            icon: Ban,
            color: 'text-amber-700 bg-amber-100 dark:bg-amber-950 dark:text-amber-300',
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Gestión de Especialidades" />

            <div className="flex h-full flex-1 flex-col gap-6 p-4 md:p-6">
                {/* Encabezado */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex size-11 items-center justify-center rounded-xl bg-[#2d3e83]/10 text-[#2d3e83] dark:bg-white/10 dark:text-white">
                            <Stethoscope className="size-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">
                                Gestión de Especialidades
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                Administra las especialidades médicas del
                                sistema.
                            </p>
                        </div>
                    </div>
                    {acciones.crear && (
                        <Button onClick={openCreate} className="gap-2">
                            <Plus className="size-4" />
                            Crear especialidad
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
                            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Buscar por código servinte o nombre…"
                                className="pl-9 pr-9"
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch('')}
                                    aria-label="Limpiar búsqueda"
                                    className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
                                    <th className="px-4 py-3 font-medium">
                                        Nombre
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Cód. Servinte
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Cód. Minsal
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Estado
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Observación
                                    </th>
                                    <th className="px-4 py-3 text-right font-medium">
                                        Acciones
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {especialidades.data.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={6}
                                            className="px-4 py-12 text-center text-muted-foreground"
                                        >
                                            No se encontraron especialidades.
                                        </td>
                                    </tr>
                                )}
                                {especialidades.data.map((row) => (
                                    <tr
                                        key={row.id}
                                        className="transition-colors hover:bg-muted/40"
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#2d3e83]/10 text-[#2d3e83] dark:bg-white/10 dark:text-white">
                                                    <Stethoscope className="size-4" />
                                                </div>
                                                <span className="font-medium text-foreground">
                                                    {row.Nombre}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {row.espcodser || '—'}
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {row.codminsal || '—'}
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
                                                        ? 'Activa'
                                                        : 'Inactiva'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="max-w-xs px-4 py-3 text-muted-foreground">
                                            <span className="line-clamp-1">
                                                {row.Observacion || '—'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-1">
                                                {acciones.crear && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="size-8 text-[#2d3e83] hover:bg-[#2d3e83]/10 hover:text-[#2d3e83] disabled:opacity-40 dark:text-white dark:hover:bg-white/10"
                                                        title={
                                                            row.Estado
                                                                ? 'Crear subespecialidad'
                                                                : 'Activa la especialidad para crear subespecialidades'
                                                        }
                                                        disabled={!row.Estado}
                                                        onClick={() =>
                                                            crearSubespecialidad(
                                                                row,
                                                            )
                                                        }
                                                    >
                                                        <Layers className="size-4" />
                                                    </Button>
                                                )}
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
                            {especialidades.total > 0
                                ? `Mostrando ${especialidades.from}–${especialidades.to} de ${especialidades.total}`
                                : 'Sin registros'}
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                disabled={especialidades.current_page <= 1}
                                onClick={() =>
                                    goToPage(especialidades.current_page - 1)
                                }
                            >
                                <ChevronLeft className="size-4" />
                                Anterior
                            </Button>
                            <span className="px-1 text-sm text-muted-foreground">
                                Página {especialidades.current_page} de{' '}
                                {especialidades.last_page}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                disabled={
                                    especialidades.current_page >=
                                    especialidades.last_page
                                }
                                onClick={() =>
                                    goToPage(especialidades.current_page + 1)
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
                                ? 'Editar especialidad'
                                : 'Crear especialidad'}
                        </DialogTitle>
                        <DialogDescription>
                            {isEditing
                                ? 'Actualiza la información de la especialidad.'
                                : 'Registra una nueva especialidad médica.'}
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={submit} className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="Nombre">Nombre *</Label>
                            <Input
                                id="Nombre"
                                value={form.data.Nombre}
                                onChange={(e) =>
                                    form.setData('Nombre', e.target.value)
                                }
                                maxLength={120}
                                autoFocus
                            />
                            <InputError message={form.errors.Nombre} />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <Label htmlFor="espcodser">
                                    Código Servinte
                                </Label>
                                <Input
                                    id="espcodser"
                                    value={form.data.espcodser}
                                    onChange={(e) =>
                                        form.setData(
                                            'espcodser',
                                            e.target.value,
                                        )
                                    }
                                    maxLength={10}
                                />
                                <InputError message={form.errors.espcodser} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="codminsal">Código Minsal</Label>
                                <Input
                                    id="codminsal"
                                    value={form.data.codminsal}
                                    onChange={(e) =>
                                        form.setData(
                                            'codminsal',
                                            e.target.value,
                                        )
                                    }
                                    maxLength={10}
                                />
                                <InputError message={form.errors.codminsal} />
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="Observacion">Observación</Label>
                            <Textarea
                                id="Observacion"
                                value={form.data.Observacion}
                                onChange={(e) =>
                                    form.setData('Observacion', e.target.value)
                                }
                                maxLength={300}
                                rows={3}
                                placeholder="Información adicional (opcional)"
                            />
                            <InputError message={form.errors.Observacion} />
                        </div>

                        <div className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                                <Label htmlFor="Estado">Estado</Label>
                                <p className="text-xs text-muted-foreground">
                                    {form.data.Estado
                                        ? 'La especialidad está activa.'
                                        : 'La especialidad está inactiva.'}
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
                                    : 'Crear especialidad'}
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
                        <DialogTitle>Detalle de la especialidad</DialogTitle>
                    </DialogHeader>
                    {viewRow && (
                        <div className="grid gap-4">
                            <div className="flex items-center gap-3">
                                <div className="flex size-12 items-center justify-center rounded-xl bg-[#2d3e83]/10 text-[#2d3e83] dark:bg-white/10 dark:text-white">
                                    <Stethoscope className="size-6" />
                                </div>
                                <div>
                                    <div className="font-semibold text-foreground">
                                        {viewRow.Nombre}
                                    </div>
                                    <span
                                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                            viewRow.Estado
                                                ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                                                : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                        }`}
                                    >
                                        {viewRow.Estado ? 'Activa' : 'Inactiva'}
                                    </span>
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground">
                                    Código Servinte
                                </div>
                                <p className="text-sm text-foreground">
                                    {viewRow.espcodser || '—'}
                                </p>
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground">
                                    Código Minsal
                                </div>
                                <p className="text-sm text-foreground">
                                    {viewRow.codminsal || '—'}
                                </p>
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground">
                                    Observación
                                </div>
                                <p className="text-sm text-foreground">
                                    {viewRow.Observacion || '—'}
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
                        <DialogTitle>Eliminar especialidad</DialogTitle>
                        <DialogDescription>
                            Esta acción no se puede deshacer. ¿Deseas eliminar la
                            especialidad{' '}
                            <span className="font-semibold text-foreground">
                                {deleteTarget?.Nombre}
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

            {/* Diálogo: ¿crear subespecialidades? */}
            <Dialog
                open={askSubesp !== null}
                onOpenChange={(open) => !open && setAskSubesp(null)}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>¿Crear subespecialidades?</DialogTitle>
                        <DialogDescription>
                            La especialidad{' '}
                            <span className="font-semibold text-foreground">
                                {askSubesp?.Nombre}
                            </span>{' '}
                            se creó correctamente. ¿Deseas registrar
                            subespecialidades para ella ahora?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setAskSubesp(null)}
                        >
                            No, volver
                        </Button>
                        <Button
                            className="gap-2"
                            onClick={() => {
                                const target = askSubesp;
                                setAskSubesp(null);
                                if (target) {
                                    router.get(
                                        '/tools/gestion-subespecialidades',
                                        { crear_para: target.id },
                                    );
                                }
                            }}
                        >
                            <Layers className="size-4" />
                            Sí, crear subespecialidad
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
