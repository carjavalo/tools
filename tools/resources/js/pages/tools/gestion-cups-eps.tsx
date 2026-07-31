import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
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
    Building2,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    Eye,
    Link2,
    LoaderCircle,
    Pencil,
    Plus,
    Search,
    Trash2,
    X,
    XCircle,
} from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';

interface EpsOption {
    id: number;
    Nombre: string;
}

interface CupsLite {
    id: number;
    CodCupsHuv: string | null;
    CodCupsHo: string | null;
    Nombre: string;
    descrip_Normativa: string | null;
    tipofactor: string | null;
}

interface AssocRow {
    id: number;
    Estado: boolean;
    Observacion: string | null;
    eps: { id: number; Nombre: string } | null;
    cups: CupsLite | null;
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
    asociaciones: Paginated<AssocRow>;
    epsList: EpsOption[];
    filters: { search: string };
    stats: { total: number; eps: number; cups: number };
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Inicio', href: dashboard().url },
    { title: 'Gestión CUPS / EPS', href: '/tools/gestion-cups-eps' },
];

const cupsCode = (c: CupsLite | null) =>
    c ? (c.CodCupsHuv || c.CodCupsHo || '—') : '—';

export default function GestionCupsEps({
    asociaciones,
    epsList,
    filters,
    stats,
}: PageProps) {
    const { flash } = usePage<SharedData>().props;
    const acciones = usePermisosVista('gestion-cups-eps');
    const [search, setSearch] = useState(filters.search ?? '');
    const [notice, setNotice] = useState<{
        type: 'success' | 'error';
        msg: string;
    } | null>(null);

    // Crear
    const [formOpen, setFormOpen] = useState(false);
    const [epsSearch, setEpsSearch] = useState('');
    const [cupsQuery, setCupsQuery] = useState('');
    const [cupsResults, setCupsResults] = useState<CupsLite[]>([]);
    const [cupsSearching, setCupsSearching] = useState(false);
    const [cupsObjs, setCupsObjs] = useState<CupsLite[]>([]);

    // Editar
    const [editOpen, setEditOpen] = useState(false);
    const [editRow, setEditRow] = useState<AssocRow | null>(null);

    // Ver / Eliminar
    const [viewRow, setViewRow] = useState<AssocRow | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<AssocRow | null>(null);
    const [deleting, setDeleting] = useState(false);

    const form = useForm<{
        eps_ids: number[];
        cuvs_ids: number[];
        Estado: boolean;
        Observacion: string;
    }>({ eps_ids: [], cuvs_ids: [], Estado: true, Observacion: '' });

    const editForm = useForm<{
        eps_id: number;
        cuvs_id: number;
        Estado: boolean;
        Observacion: string;
    }>({ eps_id: 0, cuvs_id: 0, Estado: true, Observacion: '' });

    const didMount = useRef(false);

    useEffect(() => {
        if (flash?.success) setNotice({ type: 'success', msg: flash.success });
        else if (flash?.error) setNotice({ type: 'error', msg: flash.error });
    }, [flash?.success, flash?.error]);

    useEffect(() => {
        if (!notice) return;
        const timer = setTimeout(() => setNotice(null), 4500);
        return () => clearTimeout(timer);
    }, [notice]);

    // Búsqueda en la tabla
    useEffect(() => {
        if (!didMount.current) {
            didMount.current = true;
            return;
        }
        const timer = setTimeout(() => {
            router.get('/tools/gestion-cups-eps', search ? { search } : {}, {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            });
        }, 350);
        return () => clearTimeout(timer);
    }, [search]);

    // Búsqueda asíncrona de CUPS
    useEffect(() => {
        const q = cupsQuery.trim();
        if (q.length < 2) {
            setCupsResults([]);
            setCupsSearching(false);
            return;
        }
        let active = true;
        setCupsSearching(true);
        const t = setTimeout(async () => {
            try {
                const res = await fetch(
                    `/tools/gestion-cups-eps/buscar-cups?q=${encodeURIComponent(q)}`,
                    {
                        headers: {
                            Accept: 'application/json',
                            'X-Requested-With': 'XMLHttpRequest',
                        },
                        credentials: 'same-origin',
                    },
                );
                const data = await res.json();
                if (active) setCupsResults(Array.isArray(data) ? data : []);
            } catch {
                if (active) setCupsResults([]);
            } finally {
                if (active) setCupsSearching(false);
            }
        }, 300);
        return () => {
            active = false;
            clearTimeout(t);
        };
    }, [cupsQuery]);

    const goToPage = (page: number) => {
        router.get(
            '/tools/gestion-cups-eps',
            { ...(search ? { search } : {}), page },
            { preserveState: true, preserveScroll: true },
        );
    };

    const filteredEps = epsList.filter((e) =>
        e.Nombre.toLowerCase().includes(epsSearch.trim().toLowerCase()),
    );

    const toggleEps = (id: number) => {
        const ids = form.data.eps_ids;
        form.setData(
            'eps_ids',
            ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
        );
    };

    const addCups = (c: CupsLite) => {
        if (cupsObjs.some((x) => x.id === c.id)) return;
        const next = [...cupsObjs, c];
        setCupsObjs(next);
        form.setData(
            'cuvs_ids',
            next.map((x) => x.id),
        );
    };

    const removeCups = (id: number) => {
        const next = cupsObjs.filter((x) => x.id !== id);
        setCupsObjs(next);
        form.setData(
            'cuvs_ids',
            next.map((x) => x.id),
        );
    };

    const openCreate = () => {
        form.reset();
        form.clearErrors();
        setCupsObjs([]);
        setEpsSearch('');
        setCupsQuery('');
        setCupsResults([]);
        setFormOpen(true);
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post('/tools/gestion-cups-eps', {
            preserveScroll: true,
            onSuccess: () => {
                setFormOpen(false);
                form.reset();
                setCupsObjs([]);
            },
        });
    };

    const openEdit = (row: AssocRow) => {
        editForm.clearErrors();
        editForm.setData({
            eps_id: row.eps?.id ?? 0,
            cuvs_id: row.cups?.id ?? 0,
            Estado: row.Estado,
            Observacion: row.Observacion ?? '',
        });
        setEditRow(row);
        setEditOpen(true);
    };

    const submitEdit = (e: FormEvent) => {
        e.preventDefault();
        if (!editRow) return;
        editForm.put(`/tools/gestion-cups-eps/${editRow.id}`, {
            preserveScroll: true,
            onSuccess: () => setEditOpen(false),
        });
    };

    const toggleEstado = (row: AssocRow) => {
        router.put(
            `/tools/gestion-cups-eps/${row.id}`,
            {
                eps_id: row.eps?.id,
                cuvs_id: row.cups?.id,
                Estado: !row.Estado,
                Observacion: row.Observacion ?? '',
            },
            { preserveScroll: true, preserveState: true },
        );
    };

    const confirmDelete = () => {
        if (!deleteTarget) return;
        router.delete(`/tools/gestion-cups-eps/${deleteTarget.id}`, {
            preserveScroll: true,
            onStart: () => setDeleting(true),
            onFinish: () => setDeleting(false),
            onSuccess: () => setDeleteTarget(null),
        });
    };

    const statCards = [
        {
            label: 'Asociaciones',
            value: stats.total,
            icon: Link2,
            color: 'text-[#2d3e83] bg-[#2d3e83]/10 dark:bg-white/10 dark:text-white',
        },
        {
            label: 'EPS con acuerdos',
            value: stats.eps,
            icon: Building2,
            color: 'text-green-700 bg-green-100 dark:bg-green-950 dark:text-green-300',
        },
        {
            label: 'CUPS asociados',
            value: stats.cups,
            icon: ClipboardList,
            color: 'text-amber-700 bg-amber-100 dark:bg-amber-950 dark:text-amber-300',
        },
    ];

    const canSubmit =
        form.data.eps_ids.length > 0 && form.data.cuvs_ids.length > 0;
    const combos = form.data.eps_ids.length * form.data.cuvs_ids.length;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Gestión CUPS / EPS" />

            <div className="flex h-full flex-1 flex-col gap-6 p-4 md:p-6">
                {/* Encabezado */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex size-11 items-center justify-center rounded-xl bg-[#2d3e83]/10 text-[#2d3e83] dark:bg-white/10 dark:text-white">
                            <Link2 className="size-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">
                                Gestión CUPS / EPS
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                Asocia las EPS con los CUPS / tipos de acuerdo.
                            </p>
                        </div>
                    </div>
                    {acciones.crear && (
                        <Button onClick={openCreate} className="gap-2">
                            <Plus className="size-4" />
                            Nueva asociación
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

                {/* Tabla */}
                <div className="flex flex-1 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
                    <div className="border-b p-4">
                        <div className="relative w-full sm:max-w-md">
                            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Buscar por EPS, código o nombre de CUPS…"
                                className="pl-9"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
                                <tr>
                                    <th className="px-4 py-3 font-medium">EPS</th>
                                    <th className="px-4 py-3 font-medium">
                                        CUPS / Tipo de acuerdo
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
                                {asociaciones.data.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="px-4 py-12 text-center text-muted-foreground"
                                        >
                                            No hay asociaciones. Crea la primera
                                            con “Nueva asociación”.
                                        </td>
                                    </tr>
                                )}
                                {asociaciones.data.map((row) => (
                                    <tr
                                        key={row.id}
                                        className="transition-colors hover:bg-muted/40"
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#2d3e83]/10 text-[#2d3e83] dark:bg-white/10 dark:text-white">
                                                    <Building2 className="size-4" />
                                                </div>
                                                <span className="font-medium text-foreground">
                                                    {row.eps?.Nombre ?? '—'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <span className="inline-flex shrink-0 rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-medium text-foreground">
                                                    {cupsCode(row.cups)}
                                                </span>
                                                <span className="line-clamp-1 max-w-xs text-foreground">
                                                    {row.cups?.Nombre ?? '—'}
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
                            {asociaciones.total > 0
                                ? `Mostrando ${asociaciones.from}–${asociaciones.to} de ${asociaciones.total}`
                                : 'Sin registros'}
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                disabled={asociaciones.current_page <= 1}
                                onClick={() =>
                                    goToPage(asociaciones.current_page - 1)
                                }
                            >
                                <ChevronLeft className="size-4" />
                                Anterior
                            </Button>
                            <span className="px-1 text-sm text-muted-foreground">
                                Página {asociaciones.current_page} de{' '}
                                {asociaciones.last_page}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                disabled={
                                    asociaciones.current_page >=
                                    asociaciones.last_page
                                }
                                onClick={() =>
                                    goToPage(asociaciones.current_page + 1)
                                }
                            >
                                Siguiente
                                <ChevronRight className="size-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Diálogo Crear */}
            <Dialog
                open={formOpen}
                onOpenChange={(open) => {
                    setFormOpen(open);
                    if (!open) form.clearErrors();
                }}
            >
                <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Nueva asociación CUPS / EPS</DialogTitle>
                        <DialogDescription>
                            Selecciona una o varias EPS y uno o varios CUPS. Se
                            crearán todas las combinaciones.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={submit} className="grid gap-5">
                        {/* EPS */}
                        <div className="grid gap-2">
                            <div className="flex items-center justify-between">
                                <Label>
                                    EPS *{' '}
                                    <span className="text-xs font-normal text-muted-foreground">
                                        ({form.data.eps_ids.length}{' '}
                                        seleccionada
                                        {form.data.eps_ids.length === 1
                                            ? ''
                                            : 's'}
                                        )
                                    </span>
                                </Label>
                                {form.data.eps_ids.length > 0 && (
                                    <button
                                        type="button"
                                        className="text-xs text-muted-foreground hover:text-foreground"
                                        onClick={() =>
                                            form.setData('eps_ids', [])
                                        }
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
                                            value={epsSearch}
                                            onChange={(e) =>
                                                setEpsSearch(e.target.value)
                                            }
                                            placeholder="Filtrar EPS…"
                                            className="h-8 pl-8 text-sm"
                                        />
                                    </div>
                                </div>
                                <div className="max-h-44 overflow-y-auto p-1">
                                    {filteredEps.length === 0 && (
                                        <p className="px-2 py-3 text-sm text-muted-foreground">
                                            Sin resultados.
                                        </p>
                                    )}
                                    {filteredEps.map((e) => (
                                        <label
                                            key={e.id}
                                            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
                                        >
                                            <Checkbox
                                                checked={form.data.eps_ids.includes(
                                                    e.id,
                                                )}
                                                onCheckedChange={() =>
                                                    toggleEps(e.id)
                                                }
                                            />
                                            <span className="text-sm text-foreground">
                                                {e.Nombre}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <InputError message={form.errors.eps_ids} />
                        </div>

                        {/* CUPS */}
                        <div className="grid gap-2">
                            <Label>
                                CUPS / Tipos de acuerdo *{' '}
                                <span className="text-xs font-normal text-muted-foreground">
                                    ({cupsObjs.length} seleccionado
                                    {cupsObjs.length === 1 ? '' : 's'})
                                </span>
                            </Label>
                            <div className="relative">
                                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={cupsQuery}
                                    onChange={(e) =>
                                        setCupsQuery(e.target.value)
                                    }
                                    placeholder="Buscar CUPS por código o nombre…"
                                    className="pl-9"
                                />
                                {cupsSearching && (
                                    <LoaderCircle className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                                )}
                            </div>
                            {cupsResults.length > 0 && (
                                <div className="max-h-56 overflow-y-auto rounded-lg border">
                                    {cupsResults.map((c) => {
                                        const added = cupsObjs.some(
                                            (x) => x.id === c.id,
                                        );
                                        return (
                                            <button
                                                type="button"
                                                key={c.id}
                                                onClick={() => addCups(c)}
                                                disabled={added}
                                                className="flex w-full items-start gap-2 border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted disabled:opacity-50"
                                            >
                                                <span className="mt-0.5 inline-flex shrink-0 rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-medium text-foreground">
                                                    {cupsCode(c)}
                                                </span>
                                                <span className="flex flex-col">
                                                    <span className="text-sm text-foreground">
                                                        {c.Nombre}
                                                    </span>
                                                    {c.tipofactor && (
                                                        <span className="text-xs text-muted-foreground">
                                                            {`Factor: ${c.tipofactor}`}
                                                        </span>
                                                    )}
                                                </span>
                                                {added && (
                                                    <CheckCircle2 className="ml-auto size-4 shrink-0 text-green-600" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                            {cupsQuery.trim().length >= 2 &&
                                !cupsSearching &&
                                cupsResults.length === 0 && (
                                    <p className="text-xs text-muted-foreground">
                                        Sin coincidencias para “{cupsQuery}”.
                                    </p>
                                )}

                            {cupsObjs.length > 0 && (
                                <div className="flex flex-wrap gap-2 rounded-lg border bg-muted/30 p-2">
                                    {cupsObjs.map((c) => (
                                        <Badge
                                            key={c.id}
                                            variant="secondary"
                                            className="gap-1 py-1 pr-1"
                                        >
                                            <span className="font-mono">
                                                {cupsCode(c)}
                                            </span>
                                            <span className="max-w-[160px] truncate">
                                                {c.Nombre}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => removeCups(c.id)}
                                                className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10"
                                                aria-label="Quitar"
                                            >
                                                <X className="size-3" />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                            )}
                            <InputError message={form.errors.cuvs_ids} />
                        </div>

                        {/* Observación */}
                        <div className="grid gap-2">
                            <Label htmlFor="Observacion">Observación</Label>
                            <Textarea
                                id="Observacion"
                                value={form.data.Observacion}
                                onChange={(e) =>
                                    form.setData('Observacion', e.target.value)
                                }
                                maxLength={300}
                                rows={2}
                                placeholder="Aplica a todas las asociaciones creadas (opcional)"
                            />
                            <InputError message={form.errors.Observacion} />
                        </div>

                        {/* Estado */}
                        <div className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                                <Label htmlFor="Estado">Estado</Label>
                                <p className="text-xs text-muted-foreground">
                                    {form.data.Estado
                                        ? 'Las asociaciones quedarán activas.'
                                        : 'Las asociaciones quedarán inactivas.'}
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

                        <DialogFooter className="items-center gap-2 sm:justify-between">
                            <span className="text-xs text-muted-foreground">
                                {canSubmit
                                    ? `Se crearán hasta ${combos} asociación${combos === 1 ? '' : 'es'}.`
                                    : 'Selecciona al menos una EPS y un CUPS.'}
                            </span>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setFormOpen(false)}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={form.processing || !canSubmit}
                                >
                                    {form.processing && (
                                        <LoaderCircle className="size-4 animate-spin" />
                                    )}
                                    Crear asociaciones
                                </Button>
                            </div>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Diálogo Editar */}
            <Dialog
                open={editOpen}
                onOpenChange={(open) => {
                    setEditOpen(open);
                    if (!open) editForm.clearErrors();
                }}
            >
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Editar asociación</DialogTitle>
                        <DialogDescription>
                            Actualiza la EPS, el estado o la observación.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={submitEdit} className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="edit-eps">EPS *</Label>
                            <select
                                id="edit-eps"
                                value={editForm.data.eps_id}
                                onChange={(e) =>
                                    editForm.setData(
                                        'eps_id',
                                        Number(e.target.value),
                                    )
                                }
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                            >
                                {epsList.map((e) => (
                                    <option key={e.id} value={e.id}>
                                        {e.Nombre}
                                    </option>
                                ))}
                            </select>
                            <InputError message={editForm.errors.eps_id} />
                        </div>

                        <div className="grid gap-2">
                            <Label>CUPS / Tipo de acuerdo</Label>
                            <div className="grid gap-1 rounded-md border bg-muted/40 px-3 py-2">
                                <div className="flex items-center gap-2">
                                    <span className="inline-flex shrink-0 rounded-md bg-background px-2 py-0.5 font-mono text-xs font-medium text-foreground">
                                        {cupsCode(editRow?.cups ?? null)}
                                    </span>
                                    <span className="line-clamp-1 text-sm text-foreground">
                                        {editRow?.cups?.Nombre ?? '—'}
                                    </span>
                                </div>
                                {editRow?.cups?.tipofactor && (
                                    <span className="text-xs text-muted-foreground">
                                        {`Factor: ${editRow.cups.tipofactor}`}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Para cambiar el CUPS, elimina esta asociación y
                                crea una nueva.
                            </p>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="edit-obs">Observación</Label>
                            <Textarea
                                id="edit-obs"
                                value={editForm.data.Observacion}
                                onChange={(e) =>
                                    editForm.setData(
                                        'Observacion',
                                        e.target.value,
                                    )
                                }
                                maxLength={300}
                                rows={2}
                                placeholder="Información adicional (opcional)"
                            />
                            <InputError message={editForm.errors.Observacion} />
                        </div>

                        <div className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                                <Label htmlFor="edit-estado">Estado</Label>
                                <p className="text-xs text-muted-foreground">
                                    {editForm.data.Estado
                                        ? 'La asociación está activa.'
                                        : 'La asociación está inactiva.'}
                                </p>
                            </div>
                            <Switch
                                id="edit-estado"
                                checked={editForm.data.Estado}
                                onCheckedChange={(v) =>
                                    editForm.setData('Estado', v)
                                }
                            />
                        </div>

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setEditOpen(false)}
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={editForm.processing}
                            >
                                {editForm.processing && (
                                    <LoaderCircle className="size-4 animate-spin" />
                                )}
                                Guardar cambios
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
                        <DialogTitle>Detalle de la asociación</DialogTitle>
                    </DialogHeader>
                    {viewRow && (
                        <div className="grid gap-4">
                            <div className="grid gap-1">
                                <span className="text-xs text-muted-foreground">
                                    EPS
                                </span>
                                <div className="flex items-center gap-2">
                                    <Building2 className="size-4 text-[#2d3e83] dark:text-white" />
                                    <span className="font-medium text-foreground">
                                        {viewRow.eps?.Nombre ?? '—'}
                                    </span>
                                </div>
                            </div>
                            <div className="grid gap-1">
                                <span className="text-xs text-muted-foreground">
                                    CUPS / Tipo de acuerdo
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className="inline-flex shrink-0 rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-medium text-foreground">
                                        {cupsCode(viewRow.cups)}
                                    </span>
                                    <span className="text-sm text-foreground">
                                        {viewRow.cups?.Nombre ?? '—'}
                                    </span>
                                </div>
                                {viewRow.cups?.descrip_Normativa && (
                                    <p className="text-xs text-muted-foreground">
                                        {viewRow.cups.descrip_Normativa}
                                    </p>
                                )}
                            </div>
                            {viewRow.cups && (
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
                                    <div>
                                        <span className="block text-xs text-muted-foreground">
                                            Tipo de factor
                                        </span>
                                        <span className="font-medium text-foreground">
                                            {viewRow.cups.tipofactor || '—'}
                                        </span>
                                    </div>
                                </div>
                            )}
                            <div className="grid gap-1">
                                <span className="text-xs text-muted-foreground">
                                    Estado
                                </span>
                                <span
                                    className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                        viewRow.Estado
                                            ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                    }`}
                                >
                                    {viewRow.Estado ? 'Activo' : 'Inactivo'}
                                </span>
                            </div>
                            <div className="grid gap-1">
                                <span className="text-xs text-muted-foreground">
                                    Observación
                                </span>
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
                        <DialogTitle>Eliminar asociación</DialogTitle>
                        <DialogDescription>
                            Esta acción no se puede deshacer. ¿Deseas eliminar la
                            asociación entre{' '}
                            <span className="font-semibold text-foreground">
                                {deleteTarget?.eps?.Nombre}
                            </span>{' '}
                            y{' '}
                            <span className="font-semibold text-foreground">
                                {cupsCode(deleteTarget?.cups ?? null)}
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
