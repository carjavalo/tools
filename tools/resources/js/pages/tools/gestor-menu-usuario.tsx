import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import {
    Ban,
    CheckCircle2,
    KeyRound,
    LoaderCircle,
    Save,
    Shield,
    ShieldCheck,
    Trash2,
    UserCog,
    XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';

interface RoleOpt {
    id: number;
    Nombre: string;
    Estado: boolean;
}

interface OpcionDef {
    key: string;
    titulo: string;
    descripcion: string;
}

interface PageProps {
    roles: RoleOpt[];
    opciones: OpcionDef[];
    roleId: number;
    permitidas: Record<string, boolean>;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Inicio', href: dashboard().url },
    { title: 'Gestor Menú de Usuario', href: '/tools/gestor-menu-usuario' },
];

const ICONOS: Record<string, typeof UserCog> = {
    perfil: UserCog,
    password: KeyRound,
    'two-factor': ShieldCheck,
    'eliminar-cuenta': Trash2,
};

export default function GestorMenuUsuario({
    roles,
    opciones,
    roleId,
    permitidas,
}: PageProps) {
    const { flash } = usePage<SharedData>().props;
    const [estado, setEstado] = useState<Record<string, boolean>>(permitidas);
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState<{
        type: 'success' | 'error';
        msg: string;
    } | null>(null);

    // Al cambiar de rol llega su configuración del servidor.
    useEffect(() => {
        setEstado(permitidas);
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

    const cambiarRol = (id: number) => {
        router.get(
            '/tools/gestor-menu-usuario',
            { role: id },
            { preserveScroll: true },
        );
    };

    const setTodas = (valor: boolean) =>
        setEstado(Object.fromEntries(opciones.map((o) => [o.key, valor])));

    const guardar = () => {
        setSaving(true);
        router.post(
            `/tools/gestor-menu-usuario/${roleId}`,
            { opciones: estado },
            {
                preserveScroll: true,
                onError: (errors) =>
                    setNotice({
                        type: 'error',
                        msg:
                            Object.values(errors)[0] ??
                            'No fue posible guardar el menú de usuario.',
                    }),
                onFinish: () => setSaving(false),
            },
        );
    };

    const habilitadas = opciones.filter((o) => estado[o.key] !== false).length;

    const statCards = [
        {
            label: 'Opciones administradas',
            value: opciones.length,
            icon: UserCog,
            color: 'text-[#2d3e83] bg-[#2d3e83]/10 dark:bg-white/10 dark:text-white',
        },
        {
            label: `Habilitadas para ${rolActivo?.Nombre ?? '—'}`,
            value: habilitadas,
            icon: CheckCircle2,
            color: 'text-green-700 bg-green-100 dark:bg-green-950 dark:text-green-300',
        },
        {
            label: 'Bloqueadas para este rol',
            value: opciones.length - habilitadas,
            icon: Ban,
            color: 'text-amber-700 bg-amber-100 dark:bg-amber-950 dark:text-amber-300',
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Gestor Menú de Usuario" />

            <div className="flex h-full flex-1 flex-col gap-6 p-4 md:p-6">
                {/* Encabezado */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex size-11 items-center justify-center rounded-xl bg-[#2d3e83]/10 text-[#2d3e83] dark:bg-white/10 dark:text-white">
                            <UserCog className="size-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">
                                Gestor Menú de Usuario
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                Define qué opciones de su cuenta puede usar cada
                                rol: cambiar la cuenta, la contraseña, la
                                verificación en dos pasos o eliminar la cuenta.
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
                        Guardar
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
                        El rol Super Admin siempre tiene todas las opciones y no
                        se configura aquí. Las opciones sin configuración
                        guardada se permiten por defecto.
                    </p>
                </div>

                {/* Opciones del menú de usuario */}
                {roleId > 0 && (
                    <div className="rounded-xl border bg-card p-4 shadow-sm">
                        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                <UserCog className="size-4" />
                                Menú de usuario de{' '}
                                {rolActivo?.Nombre ?? 'el rol'}
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setTodas(true)}
                                >
                                    Permitir todas
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setTodas(false)}
                                >
                                    Bloquear todas
                                </Button>
                            </div>
                        </div>
                        <div className="divide-y rounded-lg border">
                            {opciones.map((o) => {
                                const Icono = ICONOS[o.key] ?? UserCog;
                                const activa = estado[o.key] !== false;
                                return (
                                    <label
                                        key={o.key}
                                        className="flex cursor-pointer items-center gap-4 px-4 py-3 hover:bg-muted/50"
                                    >
                                        <div
                                            className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                                                activa
                                                    ? 'bg-[#2d3e83]/10 text-[#2d3e83] dark:bg-white/10 dark:text-white'
                                                    : 'bg-muted text-muted-foreground'
                                            }`}
                                        >
                                            <Icono className="size-5" />
                                        </div>
                                        <div className="flex flex-1 flex-col">
                                            <span className="font-medium text-foreground">
                                                {o.titulo}
                                            </span>
                                            <span className="text-sm text-muted-foreground">
                                                {o.descripcion}
                                            </span>
                                        </div>
                                        <span
                                            className={`hidden text-xs font-medium sm:inline ${
                                                activa
                                                    ? 'text-green-700 dark:text-green-300'
                                                    : 'text-amber-700 dark:text-amber-300'
                                            }`}
                                        >
                                            {activa ? 'Permitida' : 'Bloqueada'}
                                        </span>
                                        <Switch
                                            checked={activa}
                                            onCheckedChange={(v) =>
                                                setEstado((prev) => ({
                                                    ...prev,
                                                    [o.key]: v,
                                                }))
                                            }
                                        />
                                    </label>
                                );
                            })}
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                            Una opción bloqueada desaparece del menú de usuario
                            (arriba a la derecha y abajo en el menú lateral), de
                            la sección Mi cuenta del inicio y de la
                            configuración; si el usuario entra por la dirección,
                            el sistema lo devuelve al inicio.
                        </p>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
