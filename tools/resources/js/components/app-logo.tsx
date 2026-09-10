import { type SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import { Stethoscope } from 'lucide-react';

export default function AppLogo() {
    // La sede va a la vista en todo momento: lo que se radica queda en ella y
    // solo se ven sus radicaciones.
    const { auth } = usePage<SharedData>().props;

    return (
        <>
            <div className="flex aspect-square size-9 items-center justify-center rounded-lg bg-white text-[#2d3e83] shadow-sm ring-1 ring-white/40">
                <Stethoscope className="size-5" />
            </div>
            <div className="ml-2 grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-semibold">
                    Programación de Cirugía
                </span>
                <span className="truncate text-[11px] text-sidebar-foreground/70">
                    {auth.sede?.nombre ?? 'Gestión quirúrgica'}
                </span>
            </div>
        </>
    );
}
