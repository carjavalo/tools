import { AppContent } from '@/components/app-content';
import { AppShell } from '@/components/app-shell';
import { AppSidebar } from '@/components/app-sidebar';
import { AppSidebarHeader } from '@/components/app-sidebar-header';
import { type BreadcrumbItem } from '@/types';
import { type PropsWithChildren } from 'react';

export default function AppSidebarLayout({
    children,
    breadcrumbs = [],
}: PropsWithChildren<{ breadcrumbs?: BreadcrumbItem[] }>) {
    return (
        <AppShell variant="sidebar" style={{ backgroundColor: 'transparent' }}>
            <AppSidebar />
            <AppContent
                variant="sidebar"
                className="relative overflow-x-hidden bg-transparent shadow-none md:!m-0 md:!rounded-none"
            >
                {/* Fondo institucional (misma imagen y opacidad que la vista de login) */}
                <div
                    className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
                    style={{ backgroundImage: "url('/images/nuevologo.jpg')" }}
                />
                <div className="pointer-events-none absolute inset-0 z-0 bg-white/60 backdrop-blur-sm dark:bg-black/60" />

                {/* Contenido por encima del fondo */}
                <div className="relative z-10 flex min-h-svh flex-1 flex-col">
                    <AppSidebarHeader breadcrumbs={breadcrumbs} />
                    {children}
                </div>
            </AppContent>
        </AppShell>
    );
}
