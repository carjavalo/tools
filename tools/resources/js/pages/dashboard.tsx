import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { dashboard, home } from '@/routes';
import { edit as editPassword } from '@/routes/password';
import { edit as editProfile } from '@/routes/profile';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    CalendarClock,
    KeyRound,
    Stethoscope,
    UserCog,
    Wrench,
} from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Inicio',
        href: dashboard().url,
    },
];

const STAFF_ROLES = ['Operador', 'Super Admin'];

const accesos = [
    {
        // Su visibilidad la gobierna el Gestor de Permisos (vista
        // programacion-cirugia), no una lista fija de roles.
        title: 'Programación de Cirugía',
        description: 'Gestiona y consulta la programación quirúrgica.',
        href: '/tools/programacion-cirugia',
        icon: CalendarClock,
        roles: undefined as string[] | undefined,
    },
    {
        title: 'Herramientas',
        description: 'Suite de utilidades para documentos y archivos.',
        href: home().url,
        icon: Wrench,
        roles: STAFF_ROLES,
    },
    {
        title: 'Mi cuenta',
        description: 'Actualiza tus datos personales y de acceso.',
        href: editProfile().url,
        icon: UserCog,
        roles: undefined as string[] | undefined,
    },
];

const cuenta = [
    {
        title: 'Cambiar cuenta',
        description: 'Edita tu nombre y correo electrónico.',
        href: editProfile().url,
        icon: UserCog,
    },
    {
        title: 'Cambiar contraseña',
        description: 'Actualiza tu contraseña de acceso.',
        href: editPassword().url,
        icon: KeyRound,
    },
];

function capitalize(text: string) {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function Dashboard() {
    const { auth } = usePage<SharedData>().props;

    const now = new Date();
    const hour = now.getHours();
    const saludo =
        hour < 12
            ? 'Buenos días'
            : hour < 19
              ? 'Buenas tardes'
              : 'Buenas noches';

    const fecha = capitalize(
        new Intl.DateTimeFormat('es-CO', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        }).format(now),
    );

    const firstName = auth.user.name.split(' ')[0];

    const rol = auth.user?.rol;
    const permisos = auth.permisos ?? {};
    const esSuperAdmin = rol === 'Super Admin';
    const esOperador = rol === 'Operador';

    // Misma política del menú lateral: Super Admin ve todo, una vista
    // configurada en el Gestor de Permisos manda y, sin configurar, solo el
    // Operador conserva el acceso por defecto.
    const permiteVer = (href: string) => {
        if (!href.startsWith('/tools/')) return true;
        if (esSuperAdmin) return true;
        const key = href.split('/').filter(Boolean).pop() ?? '';
        const p = permisos[key];
        if (p) return p.ver;
        return esOperador;
    };

    const accesosVisibles = accesos.filter(
        (a) =>
            (!a.roles || (rol ? a.roles.includes(rol) : false)) &&
            permiteVer(a.href),
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Inicio" />

            <div className="flex h-full flex-1 flex-col gap-6 p-4 md:p-6">
                {/* Banner de bienvenida */}
                <section className="hero-gradient relative overflow-hidden rounded-2xl p-6 text-white shadow-lg md:p-8">
                    <div className="relative z-10 flex flex-col gap-2">
                        <span className="text-sm font-medium text-white/80">
                            {fecha}
                        </span>
                        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                            {saludo}, {firstName}
                        </h1>
                        <p className="max-w-2xl text-sm text-white/85 md:text-base">
                            Bienvenido al panel de Programación de Cirugía.
                            Selecciona una opción del menú lateral o usa los
                            accesos rápidos para comenzar.
                        </p>
                    </div>
                    <Stethoscope className="pointer-events-none absolute -right-6 -bottom-6 size-40 text-white/10" />
                </section>

                {/* Accesos rápidos */}
                <section className="flex flex-col gap-3">
                    <h2 className="text-lg font-semibold text-foreground">
                        Accesos rápidos
                    </h2>
                    <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {accesosVisibles.map((item) => (
                            <Link
                                key={item.title}
                                href={item.href}
                                className="group focus-visible:outline-none"
                                prefetch
                            >
                                <Card className="hover-lift h-full transition-colors group-hover:border-[#2d3e83]/40">
                                    <CardHeader>
                                        <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-[#2d3e83]/10 text-[#2d3e83] dark:bg-white/10 dark:text-white">
                                            <item.icon className="size-6" />
                                        </div>
                                        <CardTitle className="flex items-center justify-between">
                                            {item.title}
                                            <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-[#2d3e83] dark:group-hover:text-white" />
                                        </CardTitle>
                                        <CardDescription>
                                            {item.description}
                                        </CardDescription>
                                    </CardHeader>
                                </Card>
                            </Link>
                        ))}
                    </div>
                </section>

                {/* Gestión de cuenta */}
                <section className="flex flex-col gap-3">
                    <h2 className="text-lg font-semibold text-foreground">
                        Mi cuenta
                    </h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                        {cuenta.map((item) => (
                            <Link
                                key={item.title}
                                href={item.href}
                                className="group focus-visible:outline-none"
                                prefetch
                            >
                                <Card className="hover-lift flex h-full flex-row items-center gap-4 p-4 transition-colors group-hover:border-[#2d3e83]/40">
                                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#2d3e83]/10 text-[#2d3e83] dark:bg-white/10 dark:text-white">
                                        <item.icon className="size-6" />
                                    </div>
                                    <CardContent className="flex flex-1 flex-col p-0">
                                        <span className="font-medium text-foreground">
                                            {item.title}
                                        </span>
                                        <span className="text-sm text-muted-foreground">
                                            {item.description}
                                        </span>
                                    </CardContent>
                                    <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-[#2d3e83] dark:group-hover:text-white" />
                                </Card>
                            </Link>
                        ))}
                    </div>
                </section>
            </div>
        </AppLayout>
    );
}
