<?php

namespace App\Support;

use App\Models\Auditoria;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

/**
 * Escribe la bitácora de actividad.
 *
 * Punto único por el que pasan todos los registros, para que la regla de qué
 * se guarda y qué no viva en un solo sitio.
 */
class RegistroAuditoria
{
    /** Campos que jamás deben quedar escritos en la bitácora. */
    private const CAMPOS_SENSIBLES = [
        'password',
        'password_confirmation',
        'remember_token',
        'two_factor_secret',
        'two_factor_recovery_codes',
    ];

    /** Campos que no aportan nada a una lectura humana. */
    private const CAMPOS_IGNORADOS = [
        'created_at',
        'updated_at',
        'email_verified_at',
    ];

    /**
     * Registra un evento. Nunca lanza: un fallo al auditar no puede tumbar la
     * operación que el usuario estaba haciendo.
     *
     * @param  array<string, mixed>|null  $cambios
     */
    public static function registrar(
        string $evento,
        string $descripcion,
        ?string $modulo = null,
        ?Model $registro = null,
        ?array $cambios = null,
        ?User $actor = null,
    ): void {
        try {
            $usuario = $actor ?? Auth::user();

            // El Super Admin queda fuera de la bitácora por decisión expresa.
            if ($usuario instanceof User && $usuario->isSuperAdmin()) {
                return;
            }

            $peticion = request();

            Auditoria::create([
                'user_id' => $usuario?->id,
                'usuario' => $usuario ? self::nombreCompleto($usuario) : 'Sistema',
                'cuenta' => $usuario?->email ?? $usuario?->Numero_D,
                'rol' => $usuario?->rol,
                'evento' => $evento,
                'modulo' => $modulo,
                'descripcion' => $descripcion,
                'registro_tipo' => $registro ? class_basename($registro) : null,
                'registro_id' => $registro ? (string) $registro->getKey() : null,
                'cambios' => $cambios ?: null,
                'ip' => $peticion?->ip(),
                'navegador' => mb_substr((string) $peticion?->userAgent(), 0, 255) ?: null,
            ]);
        } catch (\Throwable $e) {
            // Se deja constancia en el log de la aplicación y se sigue.
            Log::warning('No se pudo registrar la auditoría: '.$e->getMessage());
        }
    }

    /**
     * Nombre completo del usuario tal como debe leerse en la bitácora.
     */
    public static function nombreCompleto(User $user): string
    {
        $nombre = trim(implode(' ', array_filter([
            $user->name,
            $user->Apellido1,
            $user->apellido2,
        ])));

        return $nombre !== '' ? $nombre : (string) $user->email;
    }

    /**
     * ¿Este campo puede quedar escrito en la bitácora?
     */
    public static function campoAuditable(string $campo): bool
    {
        return ! in_array($campo, self::CAMPOS_SENSIBLES, true)
            && ! in_array($campo, self::CAMPOS_IGNORADOS, true);
    }
}
