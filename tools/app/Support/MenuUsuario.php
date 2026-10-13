<?php

namespace App\Support;

use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Opciones del menú de usuario (la cuenta de cada quien) que el Super Admin
 * habilita o niega por rol en el Gestor de Permisos (menú de usuario).
 *
 * Una opción sin configurar para el rol se permite; el Super Admin siempre
 * las tiene todas.
 */
class MenuUsuario
{
    public const PERFIL = 'perfil';

    public const PASSWORD = 'password';

    public const DOS_PASOS = 'two-factor';

    public const ELIMINAR = 'eliminar-cuenta';

    /**
     * Opciones administradas, en el orden en que se muestran.
     *
     * @var list<array{key: string, titulo: string, descripcion: string}>
     */
    public const OPCIONES = [
        [
            'key' => self::PERFIL,
            'titulo' => 'Cambiar cuenta',
            'descripcion' => 'Editar su nombre y correo electrónico.',
        ],
        [
            'key' => self::PASSWORD,
            'titulo' => 'Cambiar contraseña',
            'descripcion' => 'Actualizar su contraseña de acceso.',
        ],
        [
            'key' => self::DOS_PASOS,
            'titulo' => 'Autenticación en dos pasos',
            'descripcion' => 'Activar, desactivar o regenerar los códigos de la verificación en dos pasos.',
        ],
        [
            'key' => self::ELIMINAR,
            'titulo' => 'Eliminar cuenta',
            'descripcion' => 'Borrar su propia cuenta desde la pantalla de perfil.',
        ],
    ];

    /**
     * Rutas que pertenecen a cada opción. El reto de dos pasos del inicio de
     * sesión (two-factor.login) no está: negarlo dejaría al usuario por fuera.
     *
     * @var array<string, string>
     */
    public const RUTAS = [
        'profile.edit' => self::PERFIL,
        'profile.update' => self::PERFIL,
        'profile.destroy' => self::ELIMINAR,
        'password.edit' => self::PASSWORD,
        'password.update' => self::PASSWORD,
        'two-factor.show' => self::DOS_PASOS,
        'two-factor.enable' => self::DOS_PASOS,
        'two-factor.confirm' => self::DOS_PASOS,
        'two-factor.disable' => self::DOS_PASOS,
        'two-factor.qr-code' => self::DOS_PASOS,
        'two-factor.secret-key' => self::DOS_PASOS,
        'two-factor.recovery-codes' => self::DOS_PASOS,
        'two-factor.regenerate-recovery-codes' => self::DOS_PASOS,
    ];

    /**
     * @return list<string>
     */
    public static function claves(): array
    {
        return array_column(self::OPCIONES, 'key');
    }

    /**
     * Opción => permitida, para el rol dado.
     *
     * @return array<string, bool>
     */
    public static function delRol(Role $role): array
    {
        $guardadas = DB::table('role_menu_usuario')
            ->where('role_id', $role->id)
            ->pluck('permitido', 'opcion');

        $opciones = [];
        foreach (self::claves() as $clave) {
            $opciones[$clave] = (bool) ($guardadas[$clave] ?? true);
        }

        return $opciones;
    }

    /**
     * Opción => permitida, para el usuario. Sin rol en la tabla de roles se
     * conserva el comportamiento de siempre (todo permitido).
     *
     * @return array<string, bool>
     */
    public static function permitidasPara(?User $user): array
    {
        $todas = array_fill_keys(self::claves(), true);

        if (! $user || $user->rol === User::SUPER_ADMIN) {
            return $todas;
        }

        $role = Role::where('Nombre', $user->rol)->first();

        return $role ? self::delRol($role) : $todas;
    }

    public static function permite(?User $user, string $opcion): bool
    {
        return self::permitidasPara($user)[$opcion] ?? true;
    }
}
