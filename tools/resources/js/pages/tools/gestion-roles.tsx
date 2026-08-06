import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
    ListChecks,
    LoaderCircle,
    Pencil,
    Plus,
    Search,
    Shield,
    ShieldCheck,
    Trash2,
    X,
    XCircle,
} from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';

interface EstadoLite {
    id: number;
    Nombre: string;
}

interface RolRow {
    id: number;
    Nombre: string;
    Estado: boolean;
    Observacion: string | null;
    created_at: string | null;
    est_radicado_ids: number[];
    est_radisecundario_ids: number[];
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
    roles: Paginated<RolRow>;
    filters: { search: string };
    stats: { total: number; activas: number; inactivas: number };
    estadosRadicado: EstadoLite[];
    estadosSecundarios: EstadoLite[];
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Inicio', href: dashboard().url },
    { title: 'Gestión de Roles', href: '/tools/gestion-roles' },
];

type RolForm = {
    Nombre: string;
    Estado: boolean;
    Observacion: string;
    est_radicado_ids: number[];
    est_radisecundario_ids: number[];
};

const emptyForm: RolForm = {
    Nombre: '',
    Estado: true,
    Observacion: '',
    est_radicado_ids: [],
    est_radisecundario_ids: [],
};

/**
 * Lista de estados con checkboxes y un filtro de búsqueda, para asignar
 * estados a un rol dentro del modal Crear/Editar.
 */
function EstadoChecklist({
    label,
    items,
    selected,
    onToggle,
    onClear,
}: {
    label: string;
    items: EstadoLite[];
    selected: number[];
    onToggle: (id: number) => void;
    onClear: () => void;
}) {
    const [filter, setFilter] = useState('');
    const visible = items.filter((i) =>
        i.Nombre.toLowerCase().includes(filter.trim().toLowerCase()),
    );

    return (
        <div className="grid gap-2">
            <div className="flex items-center justify-between">
                <Label>
                    {label}{' '}
                    <span className="text-xs font-normal text-muted-foreground">
                        ({selected.length} seleccionado
                        {selected.length === 1 ? '' : 's'})
                    </span>
                </Label>
                {selected.length > 0 && (
                    <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={onClear}
                    >
                        Limpiar
                    </button>
                )}
            </div>
            <div className="rounded-lg border">
                <div className="border-b p-2">
                    <div className="relative">
                        <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            placeholder="Filtrar estados…"
                            className="h-8 pl-8 text-sm"
                        />
                    </div>
                </div>
                <div className="max-h-44 overflow-y-auto p-1">
                    {items.length === 0 && (
                        <p className="px-2 py-3 text-sm text-muted-foreground">
                            No hay estados creados.
                        </p>
                    )}
                    {items.length > 0 && visible.length === 0 && (
                        <p className="px-2 py-3 text-sm text-muted-foreground">
                            Sin resultados.
                        </p>
                    )}
                    {visible.map((item) => (
                        <label
                            key={item.id}
                            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
                        >
                            <Checkbox
                                checked={selected.includes(item.id)}
                                onCheckedChange={() => onToggle(item.id)}
                            />
                            <span className="text-sm text-foreground">
                                {item.Nombre}
                            </span>
                        </label>
                    ))}
                </div>
            </div>
        </div>
    );
}

/**
 * Muestra como badges los estados asignados (por id) a partir del catálogo.
 */
function EstadoBadges({ items, ids }: { items: EstadoLite[]; ids: number[] }) {
    const asignados = items.filter((i) => (ids ?? []).includes(i.id));

    if (asignados.length === 0) {
        return <p className="mt-1 text-sm text-muted-foreground">— Ninguno</p>;
    }

    return (
        <div className="mt-1 flex flex-wrap gap-1">
            {asignados.map((estado) => (
                <span
                    key={estado.id}
                    className="inline-flex rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground"
                >
                    {estado.Nombre}
                </span>
            ))}
        </div>
    );
}

export default function GestionRoles({
    roles,
    filters,
    stats,
    estadosRadicado,
    estadosSecundarios,
}: PageProps) {
    const { flash } = usePage<SharedData>().props;
    const acciones = usePermisosVista('gestion-roles');
    const [search, setSearch] = useState(filters.search ?? '');
    const [formOpen, setFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [viewRow, setViewRow] = useState<RolRow | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<RolRow | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [notice, setNotice] = useState<{
        type: 'success' | 'error';
        msg: string;
    } | null>(null);

    const form = useForm<RolForm>({ ...emptyForm });
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
            router.get('/tools/gestion-roles', search ? { search } : {}, {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            });
        }, 350);
        return () => clearTimeout(timer);
    }, [search]);

    const goToPage = (page: number) => {
        router.get(
            '/tools/gestion-roles',
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

    const openEdit = (row: RolRow) => {
        form.clearErrors();
        form.setData({
            Nombre: row.Nombre,
            Estado: row.Estado,
            Observacion: row.Observacion ?? '',
            est_radicado_ids: row.est_radicado_ids ?? [],
            est_radisecundario_ids: row.est_radisecundario_ids ?? [],
        });
        setEditingId(row.id);
        setFormOpen(true);
    };

    const toggleEstadoId = (
        field: 'est_radicado_ids' | 'est_radisecundario_ids',
        id: number,
    ) => {
        const current = form.data[field];
        form.setData(
            field,
            current.includes(id)
                ? current.filter((x) => x !== id)
                : [...current, id],
        );
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
            form.put(`/tools/gestion-roles/${editingId}`, options);
        } else {
            form.post('/tools/gestion-roles', options);
        }
    };

    const toggleEstado = (row: RolRow) => {
        router.put(
            `/tools/gestion-roles/${row.id}`,
            {
                Nombre: row.Nombre,
                Estado: !row.Estado,
                Observacion: row.Observacion ?? '',
            },
            { preserveScroll: true, preserveState: true },
        );
    };

    const confirmDelete = () => {
        if (!deleteTarget) return;
        router.delete(`/tools/gestion-roles/${deleteTarget.id}`, {
            preserveScroll: true,
            onStart: () => setDeleting(true),
            onFinish: () => setDeleting(false),
            onSuccess: () => setDeleteTarget(null),
        });
    };

    const isEditing = editingId !== null;
    const statCards = [
        {
            label: 'Total Roles',
            value: stats.total,
            icon: ListChecks,
            color: 'text-[#2d3e83] bg-[#2d3e83]/10 dark:bg-white/10 dark:text-white',
        },
        {
            label: 'Activos',
            value: stats.activas,
            icon: ShieldCheck,
            color: 'text-green-700 bg-green-100 dark:bg-green-950 dark:text-green-300',
        },
        {
            label: 'Inactivos',
            value: stats.inactivas,
            icon: Ban,
            color: 'text-amber-700 bg-amber-100 dark:bg-amber-950 dark:text-amber-300',
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Gestión de Roles" />

            <div className="flex h-full flex-1 flex-col gap-6 p-4 md:p-6">
                {/* Encabezado */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex size-11 items-center justify-center rounded-xl bg-[#2d3e83]/10 text-[#2d3e83] dark:bg-white/10 dark:text-white">
                            <Shield className="size-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">
                                Gestión de Roles
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                Administra los roles de los usuarios del
                                sistema.
                            </p>
                        </div>
                    </div>
                    {acciones.crear && (
                        <Button onClick={openCreate} className="gap-2">
                            <Plus className="size-4" />
                            Nuevo Rol
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
                                placeholder="Buscar por nombre u observación…"
                                className="pr-9 pl-9"
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
                                {roles.data.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={4}
                                            className="px-4 py-12 text-center text-muted-foreground"
                                        >
                                            No se encontraron roles.
                                        </td>
                                    </tr>
                                )}
                                {roles.data.map((row) => (
                                    <tr
                                        key={row.id}
                                        className="transition-colors hover:bg-muted/40"
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#2d3e83]/10 text-[#2d3e83] dark:bg-white/10 dark:text-white">
                                                    <Shield className="size-4" />
                                                </div>
                                                <span className="font-medium text-foreground">
                                                    {row.Nombre}
                                                </span>
                                            </div>
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
                                        <td className="max-w-xs px-4 py-3 text-muted-foreground">
                                            <span className="line-clamp-1">
                                                {row.Observacion || '—'}
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
                            {roles.total > 0
                                ? `Mostrando ${roles.from}–${roles.to} de ${roles.total}`
                                : 'Sin registros'}
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                disabled={roles.current_page <= 1}
                                onClick={() => goToPage(roles.current_page - 1)}
                            >
                                <ChevronLeft className="size-4" />
                                Anterior
                            </Button>
                            <span className="px-1 text-sm text-muted-foreground">
                                Página {roles.current_page} de {roles.last_page}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                disabled={roles.current_page >= roles.last_page}
                                onClick={() => goToPage(roles.current_page + 1)}
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
                            {isEditing ? 'Editar Rol' : 'Nuevo Rol'}
                        </DialogTitle>
                        <DialogDescription>
                            {isEditing
                                ? 'Actualiza la información del rol.'
                                : 'Registra un nuevo rol de usuario.'}
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

                        {/* Estados asignados al rol */}
                        <div className="grid gap-1">
                            <p className="text-sm font-medium text-foreground">
                                Estados asignados
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Los usuarios con este rol solo verán, en los
                                selects de estado de la aplicación, los estados
                                que marques aquí.
                            </p>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <EstadoChecklist
                                label="Estado Actual (primario)"
                                items={estadosRadicado}
                                selected={form.data.est_radicado_ids}
                                onToggle={(id) =>
                                    toggleEstadoId('est_radicado_ids', id)
                                }
                                onClear={() =>
                                    form.setData('est_radicado_ids', [])
                                }
                            />
                            <EstadoChecklist
                                label="Estado QX"
                                items={estadosSecundarios}
                                selected={form.data.est_radisecundario_ids}
                                onToggle={(id) =>
                                    toggleEstadoId('est_radisecundario_ids', id)
                                }
                                onClear={() =>
                                    form.setData('est_radisecundario_ids', [])
                                }
                            />
                        </div>

                        <div className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                                <Label htmlFor="Estado">Estado</Label>
                                <p className="text-xs text-muted-foreground">
                                    {form.data.Estado
                                        ? 'El rol está activo.'
                                        : 'El rol está inactivo.'}
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
                                {isEditing ? 'Guardar cambios' : 'Crear Rol'}
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
                        <DialogTitle>Detalle del Rol</DialogTitle>
                    </DialogHeader>
                    {viewRow && (
                        <div className="grid gap-4">
                            <div className="flex items-center gap-3">
                                <div className="flex size-12 items-center justify-center rounded-xl bg-[#2d3e83]/10 text-[#2d3e83] dark:bg-white/10 dark:text-white">
                                    <Shield className="size-6" />
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
                                        {viewRow.Estado ? 'Activo' : 'Inactivo'}
                                    </span>
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground">
                                    Observación
                                </div>
                                <p className="text-sm text-foreground">
                                    {viewRow.Observacion || '—'}
                                </p>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                    <div className="text-xs text-muted-foreground">
                                        Estado Actual (primario)
                                    </div>
                                    <EstadoBadges
                                        items={estadosRadicado}
                                        ids={viewRow.est_radicado_ids}
                                    />
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">
                                        Estado QX
                                    </div>
                                    <EstadoBadges
                                        items={estadosSecundarios}
                                        ids={viewRow.est_radisecundario_ids}
                                    />
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
                        <DialogTitle>Eliminar Rol</DialogTitle>
                        <DialogDescription>
                            Esta acción no se puede deshacer. ¿Deseas eliminar
                            el rol{' '}
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
        </AppLayout>
    );
}
