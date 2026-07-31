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
    Trash2,
    X,
    XCircle,
} from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';

interface EspecialidadOption {
    id: number;
    espcodser: string | null;
    Nombre: string;
}

interface SubEspecialidadRow {
    id: number;
    cod_SubEspecialidad: string | null;
    codespcodser: string | null;
    codminsal: string | null;
    Nombre: string;
    Estado: boolean;
    Observacion: string | null;
    especialidad: { espcodser: string; Nombre: string } | null;
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
    subespecialidades: Paginated<SubEspecialidadRow>;
    especialidades: EspecialidadOption[];
    filters: { search: string };
    stats: { total: number; activas: number; inactivas: number };
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Inicio', href: dashboard().url },
    {
        title: 'Gestión de Sub Especialidades',
        href: '/tools/gestion-subespecialidades',
    },
];

type SubEspForm = {
    cod_SubEspecialidad: string;
    codespcodser: string;
    codminsal: string;
    Nombre: string;
    Estado: boolean;
    Observacion: string;
};

const emptyForm: SubEspForm = {
    cod_SubEspecialidad: '',
    codespcodser: '',
    codminsal: '',
    Nombre: '',
    Estado: true,
    Observacion: '',
};

export default function GestionSubEspecialidades({
    subespecialidades,
    especialidades,
    filters,
    stats,
}: PageProps) {
    const { flash } = usePage<SharedData>().props;
    const acciones = usePermisosVista('gestion-subespecialidades');
    const [search, setSearch] = useState(filters.search ?? '');
    const [formOpen, setFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [viewRow, setViewRow] = useState<SubEspecialidadRow | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<SubEspecialidadRow | null>(
        null,
    );
    const [deleting, setDeleting] = useState(false);
    const [lastCreated, setLastCreated] = useState<string | null>(null);
    const nombreRef = useRef<HTMLInputElement>(null);
    const [notice, setNotice] = useState<{
        type: 'success' | 'error';
        msg: string;
    } | null>(null);

    const form = useForm<SubEspForm>({ ...emptyForm });
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
                '/tools/gestion-subespecialidades',
                search ? { search } : {},
                { preserveState: true, preserveScroll: true, replace: true },
            );
        }, 350);
        return () => clearTimeout(timer);
    }, [search]);

    // Si llegamos desde Gestión de Especialidades con ?crear_para=<id>,
    // abrimos el modal de creación con la especialidad ya preseleccionada.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (!params.has('crear_para') || especialidades.length === 0) return;
        const crearPara = params.get('crear_para') ?? '';
        // La relación se guarda en codespcodser (espcodser), pero la URL trae el id.
        const esp = especialidades.find((e) => String(e.id) === crearPara);
        form.clearErrors();
        form.setData({
            ...emptyForm,
            codespcodser: esp?.espcodser ? String(esp.espcodser) : '',
        });
        setEditingId(null);
        setLastCreated(null);
        setFormOpen(true);
        // Limpia el parámetro para que el modal no se reabra al recargar o paginar.
        window.history.replaceState(
            window.history.state,
            '',
            '/tools/gestion-subespecialidades',
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const goToPage = (page: number) => {
        router.get(
            '/tools/gestion-subespecialidades',
            { ...(search ? { search } : {}), page },
            { preserveState: true, preserveScroll: true },
        );
    };

    const openCreate = () => {
        form.reset();
        form.clearErrors();
        setEditingId(null);
        setLastCreated(null);
        setFormOpen(true);
    };

    const openEdit = (row: SubEspecialidadRow) => {
        form.clearErrors();
        form.setData({
            cod_SubEspecialidad: row.cod_SubEspecialidad ?? '',
            codespcodser: row.codespcodser ?? '',
            codminsal: row.codminsal ?? '',
            Nombre: row.Nombre,
            Estado: row.Estado,
            Observacion: row.Observacion ?? '',
        });
        setEditingId(row.id);
        setLastCreated(null);
        setFormOpen(true);
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();

        if (editingId) {
            form.put(`/tools/gestion-subespecialidades/${editingId}`, {
                preserveScroll: true,
                onSuccess: () => {
                    setFormOpen(false);
                    form.reset();
                },
            });
            return;
        }

        // Modo creación: mantenemos el modal abierto y la especialidad
        // seleccionada para poder registrar varias subespecialidades seguidas.
        // El modal solo se cierra cuando el usuario pulsa «Salir».
        const especialidadCodigo = form.data.codespcodser;
        const nombreCreado = form.data.Nombre;
        form.post('/tools/gestion-subespecialidades', {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                form.setData({
                    ...emptyForm,
                    codespcodser: especialidadCodigo,
                });
                form.clearErrors();
                setLastCreated(nombreCreado);
                setTimeout(() => nombreRef.current?.focus(), 0);
            },
        });
    };

    const toggleEstado = (row: SubEspecialidadRow) => {
        router.put(
            `/tools/gestion-subespecialidades/${row.id}`,
            {
                cod_SubEspecialidad: row.cod_SubEspecialidad ?? '',
                codespcodser: row.codespcodser ?? '',
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
        router.delete(
            `/tools/gestion-subespecialidades/${deleteTarget.id}`,
            {
                preserveScroll: true,
                onStart: () => setDeleting(true),
                onFinish: () => setDeleting(false),
                onSuccess: () => setDeleteTarget(null),
            },
        );
    };

    const isEditing = editingId !== null;
    const statCards = [
        {
            label: 'Total subespecialidades',
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
            <Head title="Gestión de Sub Especialidades" />

            <div className="flex h-full flex-1 flex-col gap-6 p-4 md:p-6">
                {/* Encabezado */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex size-11 items-center justify-center rounded-xl bg-[#2d3e83]/10 text-[#2d3e83] dark:bg-white/10 dark:text-white">
                            <Layers className="size-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">
                                Gestión de Sub Especialidades
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                Administra las subespecialidades y su
                                especialidad asociada.
                            </p>
                        </div>
                    </div>
                    {acciones.crear && (
                        <Button
                            onClick={openCreate}
                            className="gap-2"
                            disabled={especialidades.length === 0}
                        >
                            <Plus className="size-4" />
                            Crear subespecialidad
                        </Button>
                    )}
                </div>

                {especialidades.length === 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                        Primero debes crear al menos una{' '}
                        <span className="font-semibold">Especialidad activa</span>{' '}
                        para poder registrar subespecialidades.
                    </div>
                )}

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
                                        Cód. Servinte
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Nombre
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Cód. Minsal
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Especialidad
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
                                {subespecialidades.data.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={7}
                                            className="px-4 py-12 text-center text-muted-foreground"
                                        >
                                            No se encontraron subespecialidades.
                                        </td>
                                    </tr>
                                )}
                                {subespecialidades.data.map((row) => (
                                    <tr
                                        key={row.id}
                                        className="transition-colors hover:bg-muted/40"
                                    >
                                        <td className="px-4 py-3">
                                            {row.cod_SubEspecialidad ? (
                                                <span className="inline-flex rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-medium text-foreground">
                                                    {row.cod_SubEspecialidad}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground">
                                                    —
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#2d3e83]/10 text-[#2d3e83] dark:bg-white/10 dark:text-white">
                                                    <Layers className="size-4" />
                                                </div>
                                                <span className="font-medium text-foreground">
                                                    {row.Nombre}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {row.codminsal || '—'}
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {row.especialidad?.Nombre ?? '—'}
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
                            {subespecialidades.total > 0
                                ? `Mostrando ${subespecialidades.from}–${subespecialidades.to} de ${subespecialidades.total}`
                                : 'Sin registros'}
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                disabled={subespecialidades.current_page <= 1}
                                onClick={() =>
                                    goToPage(subespecialidades.current_page - 1)
                                }
                            >
                                <ChevronLeft className="size-4" />
                                Anterior
                            </Button>
                            <span className="px-1 text-sm text-muted-foreground">
                                Página {subespecialidades.current_page} de{' '}
                                {subespecialidades.last_page}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                disabled={
                                    subespecialidades.current_page >=
                                    subespecialidades.last_page
                                }
                                onClick={() =>
                                    goToPage(subespecialidades.current_page + 1)
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
                    if (!open) {
                        form.clearErrors();
                        setLastCreated(null);
                    }
                }}
            >
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {isEditing
                                ? 'Editar subespecialidad'
                                : 'Crear subespecialidad'}
                        </DialogTitle>
                        <DialogDescription>
                            {isEditing
                                ? 'Actualiza la información de la subespecialidad.'
                                : 'Registra una nueva subespecialidad asociada a una especialidad.'}
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={submit} className="grid gap-4">
                        {!isEditing && lastCreated && (
                            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
                                <CheckCircle2 className="size-4 shrink-0" />
                                <span>
                                    «{lastCreated}» creada. Puedes registrar otra
                                    para la misma especialidad o pulsar «Salir».
                                </span>
                            </div>
                        )}
                        <div className="grid gap-2">
                            <Label htmlFor="codespcodser">Especialidad *</Label>
                            <Select
                                value={form.data.codespcodser}
                                onValueChange={(v) =>
                                    form.setData('codespcodser', v)
                                }
                            >
                                <SelectTrigger id="codespcodser">
                                    <SelectValue placeholder="Seleccione una especialidad" />
                                </SelectTrigger>
                                <SelectContent>
                                    {especialidades
                                        .filter((esp) => esp.espcodser)
                                        .map((esp) => (
                                        <SelectItem
                                            key={esp.id}
                                            value={String(esp.espcodser)}
                                        >
                                            {esp.Nombre}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <InputError message={form.errors.codespcodser} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="Nombre">Nombre *</Label>
                            <Input
                                id="Nombre"
                                ref={nombreRef}
                                value={form.data.Nombre}
                                onChange={(e) =>
                                    form.setData('Nombre', e.target.value)
                                }
                                maxLength={120}
                            />
                            <InputError message={form.errors.Nombre} />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <Label htmlFor="cod_SubEspecialidad">
                                    Código Servinte
                                </Label>
                                <Input
                                    id="cod_SubEspecialidad"
                                    value={form.data.cod_SubEspecialidad}
                                    onChange={(e) =>
                                        form.setData(
                                            'cod_SubEspecialidad',
                                            e.target.value,
                                        )
                                    }
                                    maxLength={10}
                                    placeholder="Ej: CARDP"
                                />
                                <InputError
                                    message={form.errors.cod_SubEspecialidad}
                                />
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
                                        ? 'La subespecialidad está activa.'
                                        : 'La subespecialidad está inactiva.'}
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
                                {isEditing ? 'Cancelar' : 'Salir'}
                            </Button>
                            <Button type="submit" disabled={form.processing}>
                                {form.processing && (
                                    <LoaderCircle className="size-4 animate-spin" />
                                )}
                                {isEditing
                                    ? 'Guardar cambios'
                                    : 'Crear subespecialidad'}
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
                        <DialogTitle>Detalle de la subespecialidad</DialogTitle>
                    </DialogHeader>
                    {viewRow && (
                        <div className="grid gap-4">
                            <div className="flex items-center gap-3">
                                <div className="flex size-12 items-center justify-center rounded-xl bg-[#2d3e83]/10 text-[#2d3e83] dark:bg-white/10 dark:text-white">
                                    <Layers className="size-6" />
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
                            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                                <div>
                                    <dt className="text-xs text-muted-foreground">
                                        Especialidad
                                    </dt>
                                    <dd className="font-medium text-foreground">
                                        {viewRow.especialidad?.Nombre ?? '—'}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-muted-foreground">
                                        Código Servinte
                                    </dt>
                                    <dd className="font-medium text-foreground">
                                        {viewRow.cod_SubEspecialidad || '—'}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-muted-foreground">
                                        Código Minsal
                                    </dt>
                                    <dd className="font-medium text-foreground">
                                        {viewRow.codminsal || '—'}
                                    </dd>
                                </div>
                            </dl>
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
                        <DialogTitle>Eliminar subespecialidad</DialogTitle>
                        <DialogDescription>
                            Esta acción no se puede deshacer. ¿Deseas eliminar la
                            subespecialidad{' '}
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
