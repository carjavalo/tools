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
