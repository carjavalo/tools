<?php

namespace App\Listeners;

use App\Models\User;
use App\Support\RegistroAuditoria;
use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Events\Lockout;
use Illuminate\Auth\Events\Login;
use Illuminate\Auth\Events\Logout;

/**
 * Deja en la bitácora la entrada y la salida del sistema.
 *
 * Se engancha a los eventos de autenticación de Laravel en vez de a los
 * controladores de login, que son de Fortify y no conviene tocar.
 */
class RegistrarSesionAuditoria
{
    public function login(Login $event): void
    {
        $user = $event->user;

        if (! $user instanceof User) {
            return;
        }

        RegistroAuditoria::registrar(
            'sesion_inicio',
            'Inició sesión en el sistema',
            'Sesión',
            null,
            null,
            $user,
        );
    }

    public function logout(Logout $event): void
    {
        $user = $event->user;

        if (! $user instanceof User) {
            return;
        }

        RegistroAuditoria::registrar(
            'sesion_fin',
            'Cerró sesión',
            'Sesión',
            null,
            null,
            // El usuario ya no está autenticado cuando llega este evento: se
            // pasa explícitamente para no perder de quién era la sesión.
            $user,
        );
    }

    /**
     * Intento fallido. Se guarda la cuenta tecleada, nunca la contraseña.
     */
    public function failed(Failed $event): void
    {
        $cuenta = $event->credentials['email'] ?? '(sin cuenta)';
        $user = $event->user instanceof User ? $event->user : null;

        // Un intento contra una cuenta de Super Admin tampoco se registra.
        if ($user && $user->isSuperAdmin()) {
            return;
        }

        RegistroAuditoria::registrar(
            'sesion_fallida',
            'Intento de ingreso fallido con la cuenta '.$cuenta,
            'Sesión',
            null,
            null,
            $user,
        );
    }

    /**
     * Bloqueo por demasiados intentos.
     */
    public function lockout(Lockout $event): void
    {
        $cuenta = $event->request->input('email', '(sin cuenta)');

        RegistroAuditoria::registrar(
            'sesion_fallida',
            'Cuenta bloqueada temporalmente por exceso de intentos: '.$cuenta,
            'Sesión',
        );
    }
}
