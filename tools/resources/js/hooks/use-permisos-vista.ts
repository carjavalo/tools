import { type SharedData } from '@/types';
import { usePage } from '@inertiajs/react';

export interface AccionesVista {
    ver: boolean;
    crear: boolean;
    editar: boolean;
    borrar: boolean;
}

/**
 * Acciones permitidas del usuario sobre una vista, según el Gestor de
 * Permisos. Misma política del servidor: Super Admin todo; una vista
 * configurada manda; sin configurar, solo el Operador conserva el acceso.
 */
export function usePermisosVista(vista: string): AccionesVista {
    const { auth } = usePage<SharedData>().props;
    const rol = auth.user?.rol;

    if (rol === 'Super Admin') {
        return { ver: true, crear: true, editar: true, borrar: true };
    }

    const p = auth.permisos?.[vista];
    if (p) {
        return {
            ver: p.ver,
            crear: p.ver && p.crear,
            editar: p.ver && p.editar,
            borrar: p.ver && p.borrar,
        };
    }

    const porDefecto = rol === 'Operador';
    return {
        ver: porDefecto,
        crear: porDefecto,
        editar: porDefecto,
        borrar: porDefecto,
    };
}
