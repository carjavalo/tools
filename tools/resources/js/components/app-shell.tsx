import { SidebarProvider } from '@/components/ui/sidebar';
import { SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import { useState } from 'react';

interface AppShellProps {
    children: React.ReactNode;
    variant?: 'header' | 'sidebar';
    className?: string;
    style?: React.CSSProperties;
    // Vista que abre con el menú contraído (p. ej. 'radicar-solicitud'). El
    // usuario puede expandirlo con el botón del encabezado, y lo que elija se
    // recuerda para esa vista en este navegador.
    contraerMenu?: string;
}

const claveMenu = (vista: string) => `menu-abierto:${vista}`;

/** Preferencia guardada del menú para la vista; null si no hay. */
function leerMenuVista(vista?: string): boolean | null {
    if (!vista) return null;
    try {
        const v = window.localStorage.getItem(claveMenu(vista));
        return v === null ? null : v === '1';
    } catch {
        return null;
    }
}

export function AppShell({
    children,
    variant = 'header',
    className,
    style,
    contraerMenu,
}: AppShellProps) {
    const isOpen = usePage<SharedData>().props.sidebarOpen;
    const [abiertoVista, setAbiertoVista] = useState(
        () => leerMenuVista(contraerMenu) ?? false,
    );

    if (variant === 'header') {
        return (
            <div className="flex min-h-screen w-full flex-col">{children}</div>
        );
    }

    const alCambiarMenuVista = (abierto: boolean) => {
        setAbiertoVista(abierto);
        try {
            window.localStorage.setItem(
                claveMenu(contraerMenu as string),
                abierto ? '1' : '0',
            );
        } catch {
            // Sin almacenamiento (modo privado): vale solo mientras dure la vista.
        }
    };

    const estado = contraerMenu
        ? { open: abiertoVista, onOpenChange: alCambiarMenuVista }
        : { defaultOpen: isOpen };

    return (
        <SidebarProvider {...estado} className={className} style={style}>
            {children}
        </SidebarProvider>
    );
}
