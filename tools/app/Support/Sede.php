<?php

namespace App\Support;

use App\Models\Role;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Sedes del hospital donde se programa cirugía: Cali y Cartago.
 *
 * Cada radicación pertenece a la sede de la opción por la que entró quien la
 * creó ("Programación de Cirugía Sede Cali" o "… Sede Cartago"). Esa opción
 * queda en la sesión como la sede activa y, mientras dure, el sistema solo
 * muestra y deja operar las radicaciones de esa sede. Para trabajar en la
 * otra hay que entrar por su opción.
 *
 * A qué sedes puede entrar cada rol se configura en el Gestor de Permisos; un
 * rol sin configurar entra solo a Cali, donde operaban todos antes de existir
 * Cartago. El Super Admin entra a las dos. Pacientes y médicos también: no
 * operan el sistema, son el banco de personas que comparten ambas sedes.
 */
class Sede
{
    public const CALI = 'cali';

    public const CARTAGO = 'cartago';

    /** Sedes con su nombre para la interfaz, en el orden en que se ofrecen. */
    public const NOMBRES = [
        self::CALI => 'Sede Cali',
        self::CARTAGO => 'Sede Cartago',
    ];

    /** Clave de la sesión donde vive la sede activa. */
    private const SESION = 'sede';

    /** Atributo de la petición que memoriza la sede ya resuelta. */
    private const ATRIBUTO = 'sede.activa';

    /**
     * @return list<string>
     */
    public static function claves(): array
    {
        return array_keys(self::NOMBRES);
    }

    public static function nombre(?string $sede): string
    {
        return self::NOMBRES[$sede] ?? '—';
    }

    /**
     * ¿El rol entra a las dos sedes sin configurarse? El Super Admin por ser
     * quien administra todo; pacientes y médicos porque son personas que
     * atienden o se atienden en cualquiera de las dos. El nombre se compara
     * sin tildes ni mayúsculas: en la base el rol es "paciente" y "Medico".
     */
    public static function rolSinRestriccion(?string $rol): bool
    {
        if ($rol === User::SUPER_ADMIN) {
            return true;
        }

        return in_array(Str::lower(Str::ascii(trim((string) $rol))), ['paciente', 'medico'], true);
    }

    /**
     * Sedes a las que entra un rol según el Gestor de Permisos.
     *
     * @return list<string>
     */
    public static function delRol(Role $role): array
    {
        if (self::rolSinRestriccion($role->Nombre)) {
            return self::claves();
        }

        $guardadas = DB::table('role_sedes')->where('role_id', $role->id)->pluck('sede')->all();
        $sedes = array_values(array_intersect(self::claves(), $guardadas));

        return $sedes === [] ? [self::CALI] : $sedes;
    }

    /**
     * Sedes a las que puede entrar el usuario. Un rol que no está en la tabla
     * de roles se trata como uno sin configurar: solo Cali.
     *
     * @return list<string>
     */
    public static function permitidasPara(?User $user): array
    {
        if (! $user) {
            return [];
        }

        if (self::rolSinRestriccion($user->rol)) {
            return self::claves();
        }

        $role = Role::where('Nombre', $user->rol)->first();

        return $role ? self::delRol($role) : [self::CALI];
    }

    public static function puedeIngresar(?User $user, string $sede): bool
    {
        return in_array($sede, self::permitidasPara($user), true);
    }

    /**
     * Sede activa de la petición en curso, o null si no hay usuario con
     * sesión (consola, colas, visitantes): ahí nada se limita por sede.
     *
     * Si la sesión no trae sede —se inició antes de existir las sedes o la
     * restauró el "Recordarme"— o trae una que el rol ya no tiene, se toma la
     * primera permitida y se deja guardada.
     */
    public static function activa(): ?string
    {
        $request = app()->bound('request') ? app('request') : null;

        if (! $request instanceof Request || ! $request->hasSession()) {
            return null;
        }

        if ($request->attributes->has(self::ATRIBUTO)) {
            return $request->attributes->get(self::ATRIBUTO);
        }

        $user = $request->user();

        if (! $user instanceof User) {
            return null;
        }

        $permitidas = self::permitidasPara($user);
        $sede = $request->session()->get(self::SESION);

        if (! in_array($sede, $permitidas, true)) {
            $sede = $permitidas[0];
            $request->session()->put(self::SESION, $sede);
        }

        $request->attributes->set(self::ATRIBUTO, $sede);

        return $sede;
    }

    /**
     * Fija la sede activa de la sesión. Quien llama ya comprobó que el
     * usuario puede entrar a ella.
     */
    public static function establecer(Request $request, string $sede): void
    {
        $request->session()->put(self::SESION, $sede);
        $request->attributes->set(self::ATRIBUTO, $sede);
    }
}
