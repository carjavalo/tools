import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { dashboard } from '@/routes';
import { type NavItem, type SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import {
    Building2,
    CalendarClock,
    ClipboardCheck,
    ClipboardList,
    FilePlus2,
    Flag,
    FlagTriangleRight,
    Handshake,
    IdCard,
    KeyRound,
    Layers,
    LayoutGrid,
    Link2,
    MessageSquareText,
    Shield,
    Stethoscope,
    Users,
    Wrench,
} from 'lucide-react';
import AppLogo from './app-logo';

// La visibilidad de las opciones de gestión la gobierna el Gestor de
// Permisos: Operador y Super Admin las ven por defecto; los demás roles solo
// las que tengan permitidas con "ver".
const mainNavItems: NavItem[] = [
    {
        title: 'Inicio',
        href: dashboard(),
        icon: LayoutGrid,
    },
    {
        title: 'Programación de Cirugía',
        href: '/tools/programacion-cirugia',
        icon: CalendarClock,
    },
    {
        title: 'Radicar Solicitud',
        href: '/tools/radicar-solicitud',
        icon: FilePlus2,
    },
    {
        title: 'Herramientas',
        icon: Wrench,
        items: [
            {
                title: 'Gestión de Usuarios',
                href: '/tools/gestion-usuarios',
                icon: Users,
            },
            {
                title: 'Gestión de Roles',
                href: '/tools/gestion-roles',
                icon: Shield,
            },
            {
                title: 'Gestión de EPS',
                href: '/tools/gestion-eps',
                icon: Building2,
            },
            {
                title: 'Gestión Convenios',
                href: '/tools/gestion-convenios',
                icon: Handshake,
            },
            {
                title: 'Gestión de Especialidades',
                href: '/tools/gestion-especialidades',
                icon: Stethoscope,
            },
            {
                title: 'Gestión de Sub Especialidades',
                href: '/tools/gestion-subespecialidades',
                icon: Layers,
            },
            {
                title: 'Gestión Tipo Documento',
                href: '/tools/gestion-tipo-documento',
                icon: IdCard,
            },
            {
                title: 'Gestión de CUPS',
                href: '/tools/gestion-cups',
                icon: ClipboardList,
            },
            {
                title: 'Gestión CUPS / EPS',
                href: '/tools/gestion-cups-eps',
                icon: Link2,
            },
            {
                title: 'Gestión de Motivo',
                href: '/tools/gestion-motivo',
                icon: MessageSquareText,
            },
            {
                title: 'Gestión Estado',
                href: '/tools/gestion-estado',
                icon: Flag,
            },
            {
                title: 'Gestión Estado QX',
                href: '/tools/gestion-estado-secundario',
                icon: FlagTriangleRight,
            },
            {
                title: 'Asignación Estados',
                href: '/tools/asignacion-estados',
                icon: ClipboardCheck,
            },
            {
                title: 'Gestor de Permisos',
                href: '/tools/gestor-permisos',
                icon: KeyRound,
                roles: ['Super Admin'],
            },
        ],
    },
];

export function AppSidebar() {
    const { auth } = usePage<SharedData>().props;
    const rol = auth.user?.rol;
    const permisos = auth.permisos ?? {};
    const esSuperAdmin = rol === 'Super Admin';
    const esOperador = rol === 'Operador';

    // Visibilidad según el Gestor de Permisos (solo aplica a rutas /tools/):
    // Super Admin ve todo; una vista configurada manda; sin configurar, solo
    // el Operador conserva el acceso por defecto.
    const permiteVer = (href?: NavItem['href']) => {
        if (!href) return true;
        const url = typeof href === 'string' ? href : href.url;
        if (!url.startsWith('/tools/')) return true;
        if (esSuperAdmin) return true;
        const key = url.split('/').filter(Boolean).pop() ?? '';
        const p = permisos[key];
        if (p) return p.ver;
        return esOperador;
    };

    const permiteRol = (item: NavItem) =>
        !item.roles || (rol ? item.roles.includes(rol) : false);

    const visibleNavItems = mainNavItems
        .filter((item) => permiteRol(item) && permiteVer(item.href))
        .map((item) =>
            item.items
                ? {
                      ...item,
                      items: item.items.filter(
                          (sub) => permiteRol(sub) && permiteVer(sub.href),
                      ),
                  }
                : item,
        )
        .filter((item) => !item.items || item.items.length > 0);

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            size="lg"
                            asChild
                            className="hover:bg-white/10 data-[state=open]:bg-white/10"
                        >
                            <Link href={dashboard()} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={visibleNavItems} />
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
