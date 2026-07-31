import { Stethoscope } from 'lucide-react';

export default function AppLogo() {
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
                    Gestión quirúrgica
                </span>
            </div>
        </>
    );
}
