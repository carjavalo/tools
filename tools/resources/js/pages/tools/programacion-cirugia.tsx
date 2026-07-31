import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { CalendarClock } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Inicio',
        href: dashboard().url,
    },
    {
        title: 'Programación de Cirugía',
        href: '/tools/programacion-cirugia',
    },
];

export default function ProgramacionCirugia() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Programación de Cirugía" />

            <div className="flex h-full flex-1 flex-col gap-6 p-4 md:p-6">
                <div className="flex items-center gap-3">
                    <div className="flex size-11 items-center justify-center rounded-xl bg-[#2d3e83]/10 text-[#2d3e83] dark:bg-white/10 dark:text-white">
                        <CalendarClock className="size-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">
                            Programación de Cirugía
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Gestión y consulta de la programación quirúrgica.
                        </p>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Módulo en construcción</CardTitle>
                        <CardDescription>
                            Aquí se mostrará la programación de cirugías. El
                            contenido y las funcionalidades de este módulo se
                            irán incorporando.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">
                            Usa el menú lateral para navegar entre las
                            diferentes secciones de la aplicación.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
