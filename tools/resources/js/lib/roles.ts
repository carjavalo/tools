/**
 * Qué datos se piden según el rol del usuario.
 *
 * Los roles administrativos son personal del hospital que sí entra al sistema:
 * de ellos se registran identificación, contacto básico y credenciales, pero
 * no datos asistenciales como EPS o dirección, que solo tienen sentido en un
 * paciente. El médico es un directorio de tratantes: no inicia sesión y solo
 * lleva nombre y documento.
 *
 * Un rol que no esté en ninguna lista muestra el formulario completo, para no
 * ocultar campos de roles creados después sin que nadie lo decida.
 */

export const ROL_MEDICO = 'Medico';
export const ROL_PACIENTE = 'paciente';

export const ROLES_ADMINISTRATIVOS = [
    'Gestor Ciau',
    'Gestor Contratación',
    'Gestor Hemodinamia',
    'Gestor Programación',
    'Gestor Radicación',
    'Operador Ciau',
    'Operador Contratación',
    'Operador Programador',
    'Operador Radicación',
    'Super Admin',
] as const;

export function esRolAdministrativo(rol: string | null | undefined): boolean {
    return ROLES_ADMINISTRATIVOS.includes(
        (rol ?? '') as (typeof ROLES_ADMINISTRATIVOS)[number],
    );
}

/** Un usuario sin rol se muestra y se trata como paciente. */
export function esRolPaciente(rol: string | null | undefined): boolean {
    const r = (rol ?? '').trim().toLowerCase();
    return r === '' || r === ROL_PACIENTE;
}

/**
 * ¿La opción del menú de usuario (Gestor de Permisos) permite la acción sobre
 * otro usuario? Con la opción deshabilitada para el rol, solo sobre
 * pacientes; pasar a un paciente a otro rol también cuenta como protegido.
 * Es la misma regla que aplica el servidor (MenuUsuario::permiteSobre).
 *
 * - 'perfil' (Cambiar cuenta): editar cualquier dato del usuario.
 * - 'password' (Cambiar contraseña): asignarle una contraseña nueva.
 * - 'eliminar-cuenta' (Eliminar cuenta): borrarlo.
 */
export function permiteSobreUsuario(
    menuUsuario: Record<string, boolean> | undefined,
    opcion: 'perfil' | 'password' | 'eliminar-cuenta',
    rolActual: string | null | undefined,
    rolNuevo?: string | null,
): boolean {
    if (menuUsuario?.[opcion] !== false) return true;
    return (
        esRolPaciente(rolActual) &&
        (rolNuevo === undefined || esRolPaciente(rolNuevo))
    );
}

/** Campos que el formulario pide para un rol dado. */
export interface CamposUsuario {
    correo: boolean;
    telefono1: boolean;
    telefono2: boolean;
    direccion: boolean;
    eps: boolean;
    contrasena: boolean;
}

export function camposParaRol(rol: string | null | undefined): CamposUsuario {
    // Médico: solo nombre y documento.
    if (rol === ROL_MEDICO) {
        return {
            correo: false,
            telefono1: false,
            telefono2: false,
            direccion: false,
            eps: false,
            contrasena: false,
        };
    }

    // Personal administrativo: identificación, contacto y credenciales.
    if (esRolAdministrativo(rol)) {
        return {
            correo: true,
            telefono1: true,
            telefono2: false,
            direccion: false,
            eps: false,
            contrasena: true,
        };
    }

    // Paciente: datos asistenciales, sin credenciales.
    if (rol === ROL_PACIENTE) {
        return {
            correo: true,
            telefono1: true,
            telefono2: true,
            direccion: true,
            eps: true,
            contrasena: false,
        };
    }

    // Rol desconocido: se piden todos los campos.
    return {
        correo: true,
        telefono1: true,
        telefono2: true,
        direccion: true,
        eps: true,
        contrasena: true,
    };
}
