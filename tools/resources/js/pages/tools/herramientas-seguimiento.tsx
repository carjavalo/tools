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
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import {
    Activity,
    CalendarClock,
    ChevronLeft,
    ChevronRight,
    Eye,
    History,
    LogIn,
    Search,
    Users,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface RegistroAuditoria {
    id: number;
    usuario: string;
    cuenta: string;
    rol: string;
    fecha: string | null;
    hora: string | null;
    ip: string;
    evento: string;
    eventoClave: string;
    modulo: string;
    descripcion: string;
    registro: string;
    cambios: Record<string, { antes: string; despues: string }> | null;
    navegador: string | null;
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
    registros: Paginated<RegistroAuditoria>;
    filters: {
        search: string;
        evento: string;
        modulo: string;
        rol: string;
        desde: string;
        hasta: string;
        perPage: number;
    };
    eventos: { key: string; label: string }[];
    modulos: string[];
    roles: string[];
    stats: { total: number; hoy: number; sesiones: number; usuarios: number };
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Inicio', href: dashboard().url },
    {
        title: 'Herramientas - Seguimiento',
        href: '/tools/herramientas-seguimiento',
    },
];

const BRAND = '#2d3e83';

/** Valor de los selects para "sin filtro": Select no admite cadena vacía. */
const TODOS = '__todos__';

/** Color del distintivo según el tipo de evento. */
function colorEvento(clave: string): string {
    if (clave === 'sesion_inicio')
        return 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300';
    if (clave === 'sesion_fin')
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    if (clave === 'sesion_fallida')
        return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300';
    if (clave === 'creacion')
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300';
    if (clave === 'modificacion')
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
    if (clave === 'eliminacion')
        return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300';
    return 'bg-muted text-muted-foreground';
}

export default function HerramientasSeguimiento({
    registros,
    filters,
    eventos,
    modulos,
    roles,
    stats,
}: PageProps) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [detalle, setDetalle] = useState<RegistroAuditoria | null>(null);
    const didMount = useRef(false);

    // La búsqueda por texto espera a que el usuario deje de escribir.
    useEffect(() => {
        if (!didMount.current) {
            didMount.current = true;
            return;
        }
        const timer = setTimeout(() => aplicar({ search }), 350);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const aplicar = (cambios: Record<string, string | number>) => {
        const params: Record<string, string | number> = {
            search,
            evento: filters.evento,
            modulo: filters.modulo,
            rol: filters.rol,
            desde: filters.desde,
            hasta: filters.hasta,
            perPage: filters.perPage,
            ...cambios,
        };
        // Los filtros vacíos no ensucian la URL.
        Object.keys(params).forEach((k) => {
            if (params[k] === '' || params[k] === null) delete params[k];
        });

        router.get('/tools/herramientas-seguimiento', params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const irAPagina = (page: number) => aplicar({ page });

    const statCards = [
        {
            label: 'Registros',
            value: stats.total,
            icon: History,
            color: 'text-[#2d3e83] bg-[#2d3e83]/10 dark:bg-white/10 dark:text-white',
        },
        {
            label: 'Hoy',
            value: stats.hoy,
            icon: CalendarClock,
            color: 'text-amber-700 bg-amber-100 dark:bg-amber-950 dark:text-amber-300',
        },
        {
            label: 'Inicios de sesión',
            value: stats.sesiones,
            icon: LogIn,
            color: 'text-green-700 bg-green-100 dark:bg-green-950 dark:text-green-300',
        },
        {
            label: 'Usuarios con actividad',
            value: stats.usuarios,
            icon: Users,
            color: 'text-blue-700 bg-blue-100 dark:bg-blue-950 dark:text-blue-300',
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Herramientas - Seguimiento" />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-[#2d3e83]/10 text-[#2d3e83] dark:bg-white/10 dark:text-white">
                        <Activity className="size-5" />
                    </span>
                    <div>
                        <h1 className="text-lg font-bold tracking-tight text-foreground">
                            Herramientas - Seguimiento
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Actividad de los usuarios en el sistema: qué
                            hicieron, cuándo y desde dónde.
                        </p>
                    </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {statCards.map((c) => (
                        <div
                            key={c.label}
                            className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm"
                        >
                            <span
                                className={`flex size-9 items-center justify-center rounded-lg ${c.color}`}
                            >
                                <c.icon className="size-4" />
                            </span>
                            <div>
                                <div className="text-lg font-bold text-foreground">
                                    {c.value}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {c.label}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Filtros */}
                <div className="rounded-xl border bg-muted/30 p-4">
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                        <div className="grid gap-1.5 xl:col-span-2">
                            <Label className="text-[11px] tracking-wide text-muted-foreground uppercase">
                                Buscar
                            </Label>
                            <div className="relative">
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Nombre, cuenta o descripción…"
                                    className="pr-9"
                                />
                                <Search className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
                            </div>
                        </div>

                        <div className="grid gap-1.5">
                            <Label className="text-[11px] tracking-wide text-muted-foreground uppercase">
                                Estado del registro
                            </Label>
                            <Select
                                value={filters.evento || TODOS}
                                onValueChange={(v) =>
                                    aplicar({
                                        evento: v === TODOS ? '' : v,
                                        page: 1,
                                    })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Todos" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={TODOS}>Todos</SelectItem>
                                    {eventos.map((e) => (
                                        <SelectItem key={e.key} value={e.key}>
                                            {e.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-1.5">
                            <Label className="text-[11px] tracking-wide text-muted-foreground uppercase">
                                Módulo
                            </Label>
                            <Select
                                value={filters.modulo || TODOS}
                                onValueChange={(v) =>
                                    aplicar({
                                        modulo: v === TODOS ? '' : v,
                                        page: 1,
                                    })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Todos" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={TODOS}>Todos</SelectItem>
                                    {modulos.map((m) => (
                                        <SelectItem key={m} value={m}>
                                            {m}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-1.5">
                            <Label className="text-[11px] tracking-wide text-muted-foreground uppercase">
                                Rol
                            </Label>
                            <Select
                                value={filters.rol || TODOS}
                                onValueChange={(v) =>
                                    aplicar({
                                        rol: v === TODOS ? '' : v,
                                        page: 1,
                                    })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Todos" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={TODOS}>Todos</SelectItem>
                                    {roles.map((r) => (
                                        <SelectItem key={r} value={r}>
                                            {r}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-1.5">
                            <Label className="text-[11px] tracking-wide text-muted-foreground uppercase">
                                Desde
                            </Label>
                            <Input
                                type="date"
                                value={filters.desde}
                                onChange={(e) =>
                                    aplicar({ desde: e.target.value, page: 1 })
                                }
                            />
                        </div>

                        <div className="grid gap-1.5">
                            <Label className="text-[11px] tracking-wide text-muted-foreground uppercase">
                                Hasta
                            </Label>
                            <Input
                                type="date"
                                value={filters.hasta}
                                onChange={(e) =>
                                    aplicar({ hasta: e.target.value, page: 1 })
                                }
                            />
                        </div>
                    </div>
                </div>

                {/* Listado */}
                <div className="flex flex-1 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
                                <tr>
                                    <th className="px-3 py-2 font-medium">
                                        Fecha
                                    </th>
                                    <th className="px-3 py-2 font-medium">
                                        Hora
                                    </th>
                                    <th className="px-3 py-2 font-medium">
                                        Usuario
                                    </th>
                                    <th className="px-3 py-2 font-medium">
                                        Cuenta
                                    </th>
                                    <th className="px-3 py-2 font-medium">
                                        Rol
                                    </th>
                                    <th className="px-3 py-2 font-medium">
                                        Estado
                                    </th>
                                    <th className="px-3 py-2 font-medium">
                                        Módulo
                                    </th>
                                    <th className="px-3 py-2 font-medium">
                                        Descripción
                                    </th>
                                    <th className="px-3 py-2 font-medium">
                                        IP
                                    </th>
                                    <th className="px-3 py-2 font-medium">
                                        Detalle
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {registros.data.map((r) => (
                                    <tr
                                        key={r.id}
                                        className="hover:bg-muted/40"
                                    >
                                        <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                                            {r.fecha ?? '—'}
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                                            {r.hora ?? '—'}
                                        </td>
                                        <td className="px-3 py-2 font-medium text-foreground">
                                            {r.usuario}
                                        </td>
                                        <td className="px-3 py-2 text-muted-foreground">
                                            {r.cuenta}
                                        </td>
                                        <td className="px-3 py-2">{r.rol}</td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            <span
                                                className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${colorEvento(r.eventoClave)}`}
                                            >
                                                {r.evento}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2">
                                            {r.modulo}
                                        </td>
                                        <td className="max-w-md px-3 py-2">
                                            {r.descripcion}
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                                            {r.ip}
                                        </td>
                                        <td className="px-3 py-2">
                                            {r.cambios ? (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setDetalle(r)
                                                    }
                                                    title="Ver el detalle del cambio"
                                                    className="inline-flex items-center gap-1 rounded-md bg-[#2d3e83]/10 px-2 py-1 text-xs font-medium text-[#2d3e83] hover:bg-[#2d3e83]/20 dark:bg-white/10 dark:text-white"
                                                >
                                                    <Eye className="size-3.5" />
                                                    Ver
                                                </button>
                                            ) : (
                                                <span className="text-muted-foreground">
                                                    —
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {registros.data.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={10}
                                            className="px-3 py-10 text-center text-muted-foreground"
                                        >
                                            No hay actividad registrada con
                                            estos filtros.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Paginación */}
                    <div className="flex flex-col gap-2 border-t p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-muted-foreground">
                            {registros.total === 0
                                ? 'Sin registros'
                                : `Mostrando ${registros.from}–${registros.to} de ${registros.total}`}
                        </span>
                        <div className="flex items-center gap-2">
                            <Select
                                value={String(filters.perPage)}
                                onValueChange={(v) =>
                                    aplicar({ perPage: Number(v), page: 1 })
                                }
                            >
                                <SelectTrigger className="w-28">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {[25, 50, 100].map((n) => (
                                        <SelectItem key={n} value={String(n)}>
                                            {n} / página
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={registros.current_page <= 1}
                                onClick={() =>
                                    irAPagina(registros.current_page - 1)
                                }
                            >
                                <ChevronLeft className="size-4" />
                            </Button>
                            <span className="text-muted-foreground">
                                {registros.current_page} / {registros.last_page}
                            </span>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={
                                    registros.current_page >=
                                    registros.last_page
                                }
                                onClick={() =>
                                    irAPagina(registros.current_page + 1)
                                }
                            >
                                <ChevronRight className="size-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Detalle del cambio */}
            <Dialog
                open={detalle !== null}
                onOpenChange={(o) => !o && setDetalle(null)}
            >
                <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Detalle de la actividad</DialogTitle>
                        <DialogDescription>
                            {detalle?.descripcion}
                        </DialogDescription>
                    </DialogHeader>

                    {detalle && (
                        <div className="grid gap-4">
                            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                <div>
                                    <dt className="text-xs text-muted-foreground uppercase">
                                        Usuario
                                    </dt>
                                    <dd>{detalle.usuario}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-muted-foreground uppercase">
                                        Cuenta
                                    </dt>
                                    <dd>{detalle.cuenta}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-muted-foreground uppercase">
                                        Rol
                                    </dt>
                                    <dd>{detalle.rol}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-muted-foreground uppercase">
                                        Fecha y hora
                                    </dt>
                                    <dd>
                                        {detalle.fecha} {detalle.hora}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-muted-foreground uppercase">
                                        IP
                                    </dt>
                                    <dd>{detalle.ip}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-muted-foreground uppercase">
                                        Registro
                                    </dt>
                                    <dd>{detalle.registro}</dd>
                                </div>
                            </dl>

                            {detalle.cambios && (
                                <div className="overflow-x-auto rounded-lg border">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
                                            <tr>
                                                <th className="px-3 py-2 font-medium">
                                                    Campo
                                                </th>
                                                <th className="px-3 py-2 font-medium">
                                                    Antes
                                                </th>
                                                <th className="px-3 py-2 font-medium">
                                                    Después
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {Object.entries(
                                                detalle.cambios,
                                            ).map(([campo, par]) => (
                                                <tr key={campo}>
                                                    <td className="px-3 py-2 font-medium">
                                                        {campo}
                                                    </td>
                                                    <td className="px-3 py-2 text-muted-foreground">
                                                        {typeof par === 'object'
                                                            ? par.antes
                                                            : String(par)}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        {typeof par === 'object'
                                                            ? par.despues
                                                            : String(par)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {detalle.navegador && (
                                <p className="text-xs break-all text-muted-foreground">
                                    {detalle.navegador}
                                </p>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDetalle(null)}
                            style={{ borderColor: BRAND }}
                        >
                            Cerrar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
