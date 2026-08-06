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
    Ban,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    ClipboardCheck,
    Eye,
    Flag,
    FlagTriangleRight,
    ListChecks,
    LoaderCircle,
    Pencil,
    Plus,
    Search,
    Shield,
    Trash2,
    XCircle,
} from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';

interface EstadoOpt {
    id: number;
    Nombre: string;
}

interface RoleRow {
    id: number;
    Nombre: string;
    Estado: boolean;
    estados_primarios: EstadoOpt[];
    estados_secundarios: EstadoOpt[];
}

interface RoleOption {
    id: number;
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
    roles: Paginated<RoleRow>;
    filters: { search: string; asig: string };
    stats: { total: number; asignados: number; sinAsignar: number };
    estadosRadicado: EstadoOpt[];
    estadosSecundarios: EstadoOpt[];
    rolesOptions: RoleOption[];
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Inicio', href: dashboard().url },
    { title: 'Asignación de Estados', href: '/tools/asignacion-estados' },
];

type AsignacionForm = {
    role_id: string;
    est_radicado_ids: number[];
    est_radisecundario_ids: number[];
};

const emptyForm: AsignacionForm = {
    role_id: '',
    est_radicado_ids: [],
    est_radisecundario_ids: [],
};

function EstadoBadges({ estados }: { estados: EstadoOpt[] }) {
    if (estados.length === 0) {
        return <span className="text-muted-foreground">—</span>;
    }
    const visibles = estados.slice(0, 2);
    const resto = estados.length - visibles.length;
    return (
        <div className="flex flex-wrap items-center gap-1">
            {visibles.map((e) => (
                <span
                    key={e.id}
                    className="inline-flex items-center rounded-full bg-[#2d3e83]/10 px-2 py-0.5 text-xs font-medium text-[#2d3e83] dark:bg-white/10 dark:text-white"
                >
                    {e.Nombre}
                </span>
            ))}
            {resto > 0 && (
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    +{resto}
                </span>
            )}
        </div>
    );
}

export default function GestionAsignacionEstados({
    roles,
    filters,
    stats,
    estadosRadicado,
    estadosSecundarios,
    rolesOptions,
}: PageProps) {
    const { flash } = usePage<SharedData>().props;
    const acciones = usePermisosVista('asignacion-estados');
    const [search, setSearch] = useState(filters.search ?? '');
    const [asigFilter, setAsigFilter] = useState(filters.asig ?? '');
    const [formOpen, setFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingNombre, setEditingNombre] = useState('');
    const [viewRow, setViewRow] = useState<RoleRow | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<RoleRow | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [notice, setNotice] = useState<{
        type: 'success' | 'error';
        msg: string;
    } | null>(null);

    const form = useForm<AsignacionForm>({ ...emptyForm });
    const didMount = useRef(false);

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
                '/tools/asignacion-estados',
                {
                    ...(search ? { search } : {}),
                    ...(asigFilter ? { asig: asigFilter } : {}),
                },
                { preserveState: true, preserveScroll: true, replace: true },
            );
        }, 350);
        return () => clearTimeout(timer);
    }, [search, asigFilter]);

    const goToPage = (page: number) => {
        router.get(
            '/tools/asignacion-estados',
            {
                ...(search ? { search } : {}),
                ...(asigFilter ? { asig: asigFilter } : {}),
                page,
            },
            { preserveState: true, preserveScroll: true },
        );
    };

    const openCreate = () => {
        form.reset();
        form.clearErrors();
        setEditingId(null);
        setEditingNombre('');
        setFormOpen(true);
    };

    const openEdit = (row: RoleRow) => {
        form.clearErrors();
        form.setData({
            role_id: String(row.id),
            est_radicado_ids: row.estados_primarios.map((e) => e.id),
            est_radisecundario_ids: row.estados_secundarios.map((e) => e.id),
        });
        setEditingId(row.id);
        setEditingNombre(row.Nombre);
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
            form.put(`/tools/asignacion-estados/${editingId}`, options);
        } else {
            form.post('/tools/asignacion-estados', options);
        }
    };

    const confirmDelete = () => {
        if (!deleteTarget) return;
        router.delete(`/tools/asignacion-estados/${deleteTarget.id}`, {
            preserveScroll: true,
            onStart: () => setDeleting(true),
            onFinish: () => setDeleting(false),
            onSuccess: () => setDeleteTarget(null),
        });
    };

    const toggleId = (
        key: 'est_radicado_ids' | 'est_radisecundario_ids',
        id: number,
    ) => {
        const actual = form.data[key];
        form.setData(
            key,
            actual.includes(id)
                ? actual.filter((x) => x !== id)
                : [...actual, id],
        );
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
            label: 'Con estados asignados',
            value: stats.asignados,
            icon: ClipboardCheck,
            color: 'text-green-700 bg-green-100 dark:bg-green-950 dark:text-green-300',
        },
        {
            label: 'Sin asignación',
            value: stats.sinAsignar,
            icon: Ban,
            color: 'text-amber-700 bg-amber-100 dark:bg-amber-950 dark:text-amber-300',
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Asignación de Estados" />

            <div className="flex h-full flex-1 flex-col gap-6 p-4 md:p-6">
                {/* Encabezado */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex size-11 items-center justify-center rounded-xl bg-[#2d3e83]/10 text-[#2d3e83] dark:bg-white/10 dark:text-white">
                            <ClipboardCheck className="size-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">
                                Asignación de Estados
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                Asigna a cada rol los estados que puede usar en
                                las vistas del sistema.
                            </p>
                        </div>
                    </div>
                    {acciones.crear && (
                        <Button onClick={openCreate} className="gap-2">
                            <Plus className="size-4" />
                            Asignar Estados
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
                                placeholder="Buscar por rol…"
                                className="pl-9"
                            />
                        </div>
                        <div className="w-full sm:max-w-xs">
                            <Select
                                value={asigFilter || 'all'}
                                onValueChange={(v) =>
                                    setAsigFilter(v === 'all' ? '' : v)
                                }
                            >
                                <SelectTrigger aria-label="Filtrar por asignación">
                                    <SelectValue placeholder="Todos los roles" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        Todos los roles
                                    </SelectItem>
                                    <SelectItem value="con">
                                        Con estados asignados
                                    </SelectItem>
                                    <SelectItem value="sin">
                                        Sin asignación
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
                                <tr>
                                    <th className="px-4 py-3 font-medium">
                                        Rol
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Estados
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Estados QX
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Estado del Rol
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
                                            colSpan={5}
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
                                            <EstadoBadges
                                                estados={row.estados_primarios}
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <EstadoBadges
                                                estados={
                                                    row.estados_secundarios
                                                }
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <span
                                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                                    row.Estado
                                                        ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                                                        : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                                }`}
                                            >
                                                {row.Estado
                                                    ? 'Activo'
                                                    : 'Inactivo'}
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
                                                        title="Editar asignación"
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
                                                        title="Quitar asignación"
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

            {/* Diálogo Crear / Editar asignación */}
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
                                ? `Editar asignación — ${editingNombre}`
                                : 'Asignar Estados'}
                        </DialogTitle>
                        <DialogDescription>
                            {isEditing
                                ? 'Modifica los estados que este rol puede usar.'
                                : 'Selecciona un rol y marca los estados que podrá usar.'}
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={submit} className="grid gap-4">
                        {!isEditing && (
                            <div className="grid gap-2">
                                <Label htmlFor="role_id">Rol *</Label>
                                <Select
                                    value={form.data.role_id}
                                    onValueChange={(v) => {
                                        // Precarga la asignación actual del rol
                                        // si está en la página visible.
                                        const row = roles.data.find(
                                            (r) => String(r.id) === v,
                                        );
                                        form.setData({
                                            role_id: v,
                                            est_radicado_ids:
                                                row?.estados_primarios.map(
                                                    (e) => e.id,
                                                ) ?? [],
                                            est_radisecundario_ids:
                                                row?.estados_secundarios.map(
                                                    (e) => e.id,
                                                ) ?? [],
                                        });
                                    }}
                                >
                                    <SelectTrigger id="role_id">
                                        <SelectValue placeholder="Seleccione un rol" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {rolesOptions.map((r) => (
                                            <SelectItem
                                                key={r.id}
                                                value={String(r.id)}
                                            >
                                                {r.Nombre}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <InputError message={form.errors.role_id} />
                            </div>
                        )}

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <Label className="flex items-center gap-1">
                                    <Flag className="size-3.5" />
                                    Estados
                                </Label>
                                <div className="max-h-52 overflow-y-auto rounded-lg border p-2">
                                    {estadosRadicado.length === 0 && (
                                        <p className="px-1 py-2 text-xs text-muted-foreground">
                                            No hay estados creados.
                                        </p>
                                    )}
                                    {estadosRadicado.map((e) => (
                                        <label
                                            key={e.id}
                                            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60"
                                        >
                                            <Checkbox
                                                checked={form.data.est_radicado_ids.includes(
                                                    e.id,
                                                )}
                                                onCheckedChange={() =>
                                                    toggleId(
                                                        'est_radicado_ids',
                                                        e.id,
                                                    )
                                                }
                                            />
                                            <span className="text-foreground">
                                                {e.Nombre}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label className="flex items-center gap-1">
                                    <FlagTriangleRight className="size-3.5" />
                                    Estados QX
                                </Label>
                                <div className="max-h-52 overflow-y-auto rounded-lg border p-2">
                                    {estadosSecundarios.length === 0 && (
                                        <p className="px-1 py-2 text-xs text-muted-foreground">
                                            No hay estados QX creados.
                                        </p>
                                    )}
                                    {estadosSecundarios.map((e) => (
                                        <label
                                            key={e.id}
                                            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60"
                                        >
                                            <Checkbox
                                                checked={form.data.est_radisecundario_ids.includes(
                                                    e.id,
                                                )}
                                                onCheckedChange={() =>
                                                    toggleId(
                                                        'est_radisecundario_ids',
                                                        e.id,
                                                    )
                                                }
                                            />
                                            <span className="text-foreground">
                                                {e.Nombre}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <p className="text-xs text-muted-foreground">
                            {form.data.est_radicado_ids.length} estado(s) y{' '}
                            {form.data.est_radisecundario_ids.length} estado(s)
                            QX seleccionados.
                        </p>

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
                                    : 'Asignar Estados'}
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
                        <DialogTitle>Detalle de la Asignación</DialogTitle>
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
                                <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                                    <Flag className="size-3.5" />
                                    Estados ({viewRow.estados_primarios.length})
                                </div>
                                <EstadoBadgesCompleto
                                    estados={viewRow.estados_primarios}
                                />
                            </div>
                            <div>
                                <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                                    <FlagTriangleRight className="size-3.5" />
                                    Estados QX (
                                    {viewRow.estados_secundarios.length})
                                </div>
                                <EstadoBadgesCompleto
                                    estados={viewRow.estados_secundarios}
                                />
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

            {/* Diálogo Eliminar asignación */}
            <Dialog
                open={deleteTarget !== null}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Quitar Asignación</DialogTitle>
                        <DialogDescription>
                            Se quitarán todos los estados asignados al rol{' '}
                            <span className="font-semibold text-foreground">
                                {deleteTarget?.Nombre}
                            </span>
                            . El rol no se elimina. ¿Deseas continuar?
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
                            Quitar Asignación
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}

function EstadoBadgesCompleto({ estados }: { estados: EstadoOpt[] }) {
    if (estados.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                Sin estados asignados.
            </p>
        );
    }
    return (
        <div className="flex flex-wrap gap-1">
            {estados.map((e) => (
                <span
                    key={e.id}
                    className="inline-flex items-center rounded-full bg-[#2d3e83]/10 px-2 py-0.5 text-xs font-medium text-[#2d3e83] dark:bg-white/10 dark:text-white"
                >
                    {e.Nombre}
                </span>
            ))}
        </div>
    );
}
