import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import {
    Ban,
    CheckCheck,
    CheckCircle2,
    Eraser,
    Eye,
    Flag,
    KeyRound,
    LoaderCircle,
    Pencil,
    Plus,
    Save,
    Shield,
    Trash2,
    UserCog,
    XCircle,
} from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';

interface RoleOpt {
    id: number;
    Nombre: string;
    Estado: boolean;
}

interface VistaDef {
    key: string;
    titulo: string;
    grupo: string;
    acciones: string[];
}

type Flags = { ver: boolean; crear: boolean; editar: boolean; borrar: boolean };

interface PageProps {
    roles: RoleOpt[];
    vistas: VistaDef[];
    roleId: number;
    permisos: Record<string, Flags>;
    todosLosRoles: { id: number; Nombre: string }[];
    rolesAsignables: number[];
    estadosList: { id: number; Nombre: string }[];
    estadosGrilla: number[];
    estadosSecList: { id: number; Nombre: string }[];
    estadosSecGrilla: number[];
    radicaciones: { total: number; sinEstadoSecundario: number };
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Inicio', href: dashboard().url },
    { title: 'Gestor de Permisos', href: '/tools/gestor-permisos' },
];

const ACCIONES: {
    key: keyof Flags;
    label: string;
    icon: typeof Eye;
}[] = [
    { key: 'ver', label: 'Ver', icon: Eye },
    { key: 'crear', label: 'Crear', icon: Plus },
    { key: 'editar', label: 'Editar', icon: Pencil },
    { key: 'borrar', label: 'Borrar', icon: Trash2 },
];

export default function GestorPermisos({
    roles,
    vistas,
    roleId,
    permisos,
    todosLosRoles,
    rolesAsignables,
    estadosList,
    estadosGrilla,
    estadosSecList,
    estadosSecGrilla,
    radicaciones,
}: PageProps) {
    const { flash } = usePage<SharedData>().props;
    const [matriz, setMatriz] = useState<Record<string, Flags>>(permisos);
    const [asignables, setAsignables] = useState<number[]>(rolesAsignables);
    const [grillaEstados, setGrillaEstados] = useState<number[]>(estadosGrilla);
    const [grillaEstadosSec, setGrillaEstadosSec] =
        useState<number[]>(estadosSecGrilla);
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState<{
        type: 'success' | 'error';
        msg: string;
    } | null>(null);

    // Al cambiar de rol llegan nuevos permisos del servidor.
    useEffect(() => {
        setMatriz(permisos);
        setAsignables(rolesAsignables);
        setGrillaEstados(estadosGrilla);
        setGrillaEstadosSec(estadosSecGrilla);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roleId]);

    useEffect(() => {
        if (flash?.success) setNotice({ type: 'success', msg: flash.success });
        else if (flash?.error) setNotice({ type: 'error', msg: flash.error });
    }, [flash?.success, flash?.error]);

    useEffect(() => {
        if (!notice) return;
        const timer = setTimeout(() => setNotice(null), 4000);
        return () => clearTimeout(timer);
    }, [notice]);

    const rolActivo = roles.find((r) => r.id === roleId);

    // La grilla del Historial es una sub-vista aparte: configurar los estados
    // no sirve de nada si esa sub-vista está apagada, y el efecto solo se nota
    // cuando el usuario entra y no ve nada. Se avisa aquí mismo.
    const grillaVisible = matriz['radicar-solicitud-grilla']?.ver !== false;
    const hayEstadosConfigurados =
        grillaEstados.length > 0 || grillaEstadosSec.length > 0;
    // Un estado secundario marcado esconde toda radicación que no lo tenga, y
    // hoy el estado secundario no se diligencia al radicar: se asigna después
    // desde el seguimiento.
    const secundarioDejaVacio =
        grillaEstadosSec.length > 0 &&
        radicaciones.total > 0 &&
        radicaciones.sinEstadoSecundario === radicaciones.total;
    const grupos = [...new Set(vistas.map((v) => v.grupo))];

    const cambiarRol = (id: number) => {
        router.get(
            '/tools/gestor-permisos',
            { role: id },
            { preserveScroll: true },
        );
    };

    const setFlag = (vista: string, accion: keyof Flags, valor: boolean) =>
        setMatriz((prev) => ({
            ...prev,
            [vista]: { ...prev[vista], [accion]: valor },
        }));

    // Alternar toda una columna: si todas las vistas aplicables la tienen
    // activa, se desactiva; en caso contrario se activa para todas.
    const toggleColumna = (accion: keyof Flags) => {
        const aplicables = vistas.filter((v) => v.acciones.includes(accion));
        const todasActivas = aplicables.every(
            (v) => matriz[v.key]?.[accion] !== false,
        );
        setMatriz((prev) => {
            const copia = { ...prev };
            for (const v of aplicables) {
                copia[v.key] = { ...copia[v.key], [accion]: !todasActivas };
            }
            return copia;
        });
    };

    const toggleAsignable = (id: number) =>
        setAsignables((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        );

    const toggleGrillaEstado = (id: number) =>
        setGrillaEstados((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        );

    const toggleGrillaEstadoSec = (id: number) =>
        setGrillaEstadosSec((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        );

    // Blanquear toda la configuración del rol (matriz y roles asignables)
    // para armarla desde cero. Solo aplica al guardar.
    const limpiarTodo = () => {
        const copia: Record<string, Flags> = {};
        for (const v of vistas) {
            copia[v.key] = {
                ver: false,
                crear: false,
                editar: false,
                borrar: false,
            };
        }
        setMatriz(copia);
        setAsignables([]);
        setGrillaEstados([]);
        setGrillaEstadosSec([]);
    };

    const marcarTodo = () => {
        const copia: Record<string, Flags> = {};
        for (const v of vistas) {
            copia[v.key] = {
                ver: true,
                crear: true,
                editar: true,
                borrar: true,
            };
        }
        setMatriz(copia);
    };

    const guardar = () => {
        setSaving(true);
        router.post(
            `/tools/gestor-permisos/${roleId}`,
            {
                permisos: matriz,
                roles_asignables: asignables,
                estados_grilla: grillaEstados,
                estados_sec_grilla: grillaEstadosSec,
            },
            {
                preserveScroll: true,
                onFinish: () => setSaving(false),
            },
        );
    };

    const conVer = vistas.filter((v) => v.acciones.includes('ver'));
    const visibles = conVer.filter((v) => matriz[v.key]?.ver !== false).length;
    const ocultas = conVer.length - visibles;

    const statCards = [
        {
            label: 'Vistas administradas',
            value: vistas.length,
            icon: KeyRound,
            color: 'text-[#2d3e83] bg-[#2d3e83]/10 dark:bg-white/10 dark:text-white',
        },
        {
            label: `Visibles para ${rolActivo?.Nombre ?? '—'}`,
            value: visibles,
            icon: Eye,
            color: 'text-green-700 bg-green-100 dark:bg-green-950 dark:text-green-300',
        },
        {
            label: 'Ocultas para este rol',
            value: ocultas,
            icon: Ban,
            color: 'text-amber-700 bg-amber-100 dark:bg-amber-950 dark:text-amber-300',
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Gestor de Permisos" />

            <div className="flex h-full flex-1 flex-col gap-6 p-4 md:p-6">
                {/* Encabezado */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex size-11 items-center justify-center rounded-xl bg-[#2d3e83]/10 text-[#2d3e83] dark:bg-white/10 dark:text-white">
                            <KeyRound className="size-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">
                                Gestor de Permisos
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                Controla el acceso de cada rol a las opciones
                                del sistema y sus acciones de crear, editar,
                                borrar y ver.
                            </p>
                        </div>
                    </div>
                    <Button
                        onClick={guardar}
                        disabled={saving || !roleId}
                        className="gap-2"
                    >
                        {saving ? (
                            <LoaderCircle className="size-4 animate-spin" />
                        ) : (
                            <Save className="size-4" />
                        )}
                        Guardar Permisos
                    </Button>
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

                {/* Selector de rol */}
                <div className="rounded-xl border bg-card p-4 shadow-sm">
                    <div className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        Selecciona el rol a configurar
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {roles.map((r) => (
                            <button
                                key={r.id}
                                type="button"
                                onClick={() => cambiarRol(r.id)}
                                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                                    r.id === roleId
                                        ? 'border-[#2d3e83] bg-[#2d3e83] text-white dark:border-white/40 dark:bg-white/15'
                                        : 'bg-card text-foreground hover:bg-muted'
                                }`}
                            >
                                <Shield className="size-4" />
                                {r.Nombre}
                                {!r.Estado && (
                                    <span className="rounded-full bg-amber-100 px-1.5 text-[10px] text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                                        Inactivo
                                    </span>
                                )}
                            </button>
                        ))}
                        {roles.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                                No hay roles para configurar.
                            </p>
                        )}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                        El rol Super Admin siempre tiene acceso total y no se
                        configura aquí. Las vistas sin configuración guardada se
                        permiten por defecto.
                    </p>
                </div>

                {/* Roles asignables al crear/editar usuarios */}
                <div className="rounded-xl border bg-card p-4 shadow-sm">
                    <div className="mb-1 flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        <UserCog className="size-4" />
                        Roles que {rolActivo?.Nombre ?? 'el rol'} puede asignar
                        al crear o editar usuarios
                    </div>
                    <p className="mb-3 text-xs text-muted-foreground">
                        Aplica en Gestión de Usuarios y al crear o editar
                        pacientes desde Radicar Solicitud: el selector de rol
                        solo mostrará los roles marcados. Sin ninguno marcado,
                        el rol puede asignar todos los roles disponibles.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                        {todosLosRoles.map((r) => (
                            <label
                                key={r.id}
                                className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted/60"
                            >
                                <Checkbox
                                    checked={asignables.includes(r.id)}
                                    onCheckedChange={() =>
                                        toggleAsignable(r.id)
                                    }
                                />
                                <span className="truncate text-foreground">
                                    {r.Nombre}
                                </span>
                            </label>
                        ))}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                        {asignables.length === 0
                            ? 'Sin restricción: puede asignar todos los roles.'
                            : `Podrá asignar ${asignables.length} rol(es).`}
                    </p>
                </div>

                {/* Radicaciones visibles en la grilla del Historial (por estado) */}
                <div className="rounded-xl border bg-card p-4 shadow-sm">
                    <div className="mb-1 flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        <Flag className="size-4" />
                        Radicaciones que {rolActivo?.Nombre ?? 'el rol'} puede
                        ver en la grilla del Historial (por estado)
                    </div>
                    <p className="mb-3 text-xs text-muted-foreground">
                        Aplica a la grilla de radicaciones de Radicar Solicitud
                        — Historial: el rol solo verá las radicaciones cuyo
                        estado actual esté marcado. Es independiente de la
                        Asignación de Estados. Sin ninguno marcado, ve todas las
                        radicaciones.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                        {estadosList.map((e) => (
                            <label
                                key={e.id}
                                className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted/60"
                            >
                                <Checkbox
                                    checked={grillaEstados.includes(e.id)}
                                    onCheckedChange={() =>
                                        toggleGrillaEstado(e.id)
                                    }
                                />
                                <span className="truncate text-foreground">
                                    {e.Nombre}
                                </span>
                            </label>
                        ))}
                        {estadosList.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                                No hay estados creados.
                            </p>
                        )}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                        {grillaEstados.length === 0
                            ? 'Sin restricción: ve las radicaciones de todos los estados.'
                            : `Verá solo las radicaciones en ${grillaEstados.length} estado(s).`}
                    </p>

                    {hayEstadosConfigurados && !grillaVisible && (
                        <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                            <strong>
                                Esta configuración no tendrá efecto.
                            </strong>{' '}
                            La grilla del Historial está desactivada para este
                            rol, así que no verá ninguna radicación por más
                            estados que marques aquí. Actívala en la matriz de
                            permisos de abajo, en{' '}
                            <em>Grilla de Radicaciones (Historial)</em>, y
                            guarda.
                        </p>
                    )}
                </div>

                {/* Radicaciones visibles en la grilla del Historial (por estado secundario) */}
                <div className="rounded-xl border bg-card p-4 shadow-sm">
                    <div className="mb-1 flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        <Flag className="size-4" />
                        Radicaciones que {rolActivo?.Nombre ?? 'el rol'} puede
                        ver en la grilla del Historial (por estado secundario)
                    </div>
                    <p className="mb-3 text-xs text-muted-foreground">
                        Aplica a la grilla de radicaciones de Radicar Solicitud
                        — Historial: el rol solo verá las radicaciones cuyo
                        estado secundario esté marcado. Es independiente de la
                        Asignación de Estados y del filtro por estado actual (si
                        ambos tienen marcas, se aplican juntos). Sin ninguno
                        marcado, ve todas las radicaciones.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                        {estadosSecList.map((e) => (
                            <label
                                key={e.id}
                                className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted/60"
                            >
                                <Checkbox
                                    checked={grillaEstadosSec.includes(e.id)}
                                    onCheckedChange={() =>
                                        toggleGrillaEstadoSec(e.id)
                                    }
                                />
                                <span className="truncate text-foreground">
                                    {e.Nombre}
                                </span>
                            </label>
                        ))}
                        {estadosSecList.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                                No hay estados secundarios creados.
                            </p>
                        )}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                        {grillaEstadosSec.length === 0
                            ? 'Sin restricción: ve las radicaciones de todos los estados secundarios.'
                            : `Verá solo las radicaciones en ${grillaEstadosSec.length} estado(s) secundario(s).`}
                    </p>

                    {secundarioDejaVacio && (
                        <p className="mt-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                            <strong>
                                Con esto el rol no verá ninguna radicación.
                            </strong>{' '}
                            Las {radicaciones.total} radicaciones registradas
                            aún no tienen estado secundario: ese dato no se
                            diligencia al radicar, se asigna después desde el
                            seguimiento del caso. Mientras sea así, marcar
                            estados secundarios aquí deja la grilla vacía.
                            Déjalos todos sin marcar para no filtrar por este
                            criterio.
                        </p>
                    )}
                </div>

                {/* Matriz de permisos */}
                <div className="flex flex-1 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
                    <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                            Matriz de permisos
                            {rolActivo ? ` — ${rolActivo.Nombre}` : ''}
                        </span>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                onClick={marcarTodo}
                                title="Activar todas las vistas y acciones"
                            >
                                <CheckCheck className="size-4" />
                                Marcar todo
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-1 text-amber-700 hover:text-amber-800 dark:text-amber-400"
                                onClick={limpiarTodo}
                                title="Blanquear toda la configuración del rol (matriz y roles asignables)"
                            >
                                <Eraser className="size-4" />
                                Limpiar todo
                            </Button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
                                <tr>
                                    <th className="px-4 py-3 font-medium">
                                        Opción / Vista
                                    </th>
                                    {ACCIONES.map((a) => (
                                        <th
                                            key={a.key}
                                            className="px-4 py-3 text-center font-medium"
                                        >
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    toggleColumna(a.key)
                                                }
                                                title={`Alternar ${a.label} en todas las vistas`}
                                                className="inline-flex items-center gap-1 rounded-md px-2 py-1 uppercase transition-colors hover:bg-muted hover:text-foreground"
                                            >
                                                <a.icon className="size-3.5" />
                                                {a.label}
                                            </button>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {grupos.map((grupo) => (
                                    <Fragment key={grupo}>
                                        <tr className="bg-muted/30">
                                            <td
                                                colSpan={5}
                                                className="px-4 py-2 text-xs font-bold tracking-wide text-[#2d3e83] uppercase dark:text-white"
                                            >
                                                {grupo}
                                            </td>
                                        </tr>
                                        {vistas
                                            .filter((v) => v.grupo === grupo)
                                            .map((v) => {
                                                const flags = matriz[v.key];
                                                const verApagado =
                                                    v.acciones.includes(
                                                        'ver',
                                                    ) && flags?.ver === false;
                                                return (
                                                    <tr
                                                        key={v.key}
                                                        className={`transition-colors hover:bg-muted/40 ${
                                                            verApagado
                                                                ? 'opacity-60'
                                                                : ''
                                                        }`}
                                                    >
                                                        <td className="px-4 py-3">
                                                            <div className="font-medium text-foreground">
                                                                {v.titulo}
                                                            </div>
                                                            <div className="font-mono text-xs text-muted-foreground">
                                                                /tools/{v.key}
                                                            </div>
                                                        </td>
                                                        {ACCIONES.map((a) => (
                                                            <td
                                                                key={a.key}
                                                                className="px-4 py-3 text-center"
                                                            >
                                                                {v.acciones.includes(
                                                                    a.key,
                                                                ) ? (
                                                                    <Switch
                                                                        checked={
                                                                            flags?.[
                                                                                a
                                                                                    .key
                                                                            ] !==
                                                                            false
                                                                        }
                                                                        disabled={
                                                                            a.key !==
                                                                                'ver' &&
                                                                            verApagado
                                                                        }
                                                                        onCheckedChange={(
                                                                            val,
                                                                        ) =>
                                                                            setFlag(
                                                                                v.key,
                                                                                a.key,
                                                                                val,
                                                                            )
                                                                        }
                                                                        aria-label={`${a.label} en ${v.titulo}`}
                                                                    />
                                                                ) : (
                                                                    <span className="text-muted-foreground">
                                                                        —
                                                                    </span>
                                                                )}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                );
                                            })}
                                    </Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex flex-col items-center justify-between gap-3 border-t p-4 sm:flex-row">
                        <p className="text-xs text-muted-foreground">
                            Si «Ver» está apagado, el rol no ve la opción en el
                            menú ni puede abrir la vista, y sus demás acciones
                            quedan bloqueadas.
                        </p>
                        <Button
                            onClick={guardar}
                            disabled={saving || !roleId}
                            className="gap-2"
                        >
                            {saving ? (
                                <LoaderCircle className="size-4 animate-spin" />
                            ) : (
                                <Save className="size-4" />
                            )}
                            Guardar Permisos
                        </Button>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
