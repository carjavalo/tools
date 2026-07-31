<?php

namespace App\Http\Middleware;

use App\Models\Permiso;
use App\Models\Role;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckPermisoVista
{
    /**
     * Verifica el permiso del rol del usuario sobre la vista solicitada,
     * según la configuración del Gestor de Permisos.
     *
     * La vista se deduce del segmento de URL después de /tools/ y la acción
     * del método HTTP: GET = ver, POST = crear, PUT/PATCH = editar,
     * DELETE = borrar. El Super Admin siempre pasa; una vista sin
     * configuración para el rol también (compatibilidad).
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || $user->rol === User::SUPER_ADMIN) {
            return $next($request);
        }

        $vista = $request->segment(2);

        if (! $vista || ! in_array($vista, Permiso::vistasKeys(), true)) {
            return $next($request);
        }

        $role = Role::where('Nombre', $user->rol)->first();

        // Rol inexistente en la tabla de roles: sin acceso a vistas administradas.
        if (! $role) {
            return $this->denegar($request, 'ver');
        }

        // Pestañas de Radicar Solicitud: sus endpoints se rigen además por el
        // permiso "ver" de la pestaña correspondiente.
        if ($vista === 'radicar-solicitud') {
            $sub = $request->segment(3);
            $sub4 = $request->segment(4);
            $tab = match (true) {
                $sub === 'buscar-caso' => 'radicar-solicitud-historial',
                $sub === 'informe' => 'radicar-solicitud-informes',
                $sub === null && $request->isMethod('POST') => 'radicar-solicitud-nueva',
                // PUT /tools/radicar-solicitud/{caso}: botón Modificar Radicado.
                $sub !== null && ctype_digit($sub) && $request->isMethod('PUT') => 'radicar-solicitud-modificar',
                // POST /tools/radicar-solicitud/{caso}/seguimiento: formulario
                // Aplicar Modificaciones del Historial.
                $sub !== null && ctype_digit($sub) && $sub4 === 'seguimiento' => 'radicar-solicitud-seguimiento',
                default => null,
            };

            $permisoTab = null;
            if ($tab !== null) {
                $permisoTab = Permiso::where('role_id', $role->id)
                    ->where('vista', $tab)
                    ->first();

                if ($permisoTab && ! $permisoTab->ver) {
                    return $this->denegar($request, 'ver');
                }
            }

            // Botón Modificar Radicado: si su sub-vista está configurada y
            // permitida, autoriza por sí sola (sin exigir la acción editar de
            // la vista principal). Sin configurar, aplica la regla general.
            if ($tab === 'radicar-solicitud-modificar' && $permisoTab && $permisoTab->ver) {
                return $next($request);
            }

            // El seguimiento se rige solo por su sub-vista, y las cotizaciones
            // tienen su propio control de rol en el controlador: ninguno usa
            // la acción por método de la vista principal.
            if ($sub !== null && ctype_digit($sub)
                && in_array($sub4, ['seguimiento', 'cotizaciones'], true)) {
                return $next($request);
            }
        }

        $permiso = Permiso::where('role_id', $role->id)
            ->where('vista', $vista)
            ->first();

        // Vista sin configurar para el rol: el Operador conserva el acceso
        // histórico; cualquier otro rol requiere permiso explícito.
        if (! $permiso) {
            return $user->rol === 'Operador'
                ? $next($request)
                : $this->denegar($request, 'ver');
        }

        $accion = match ($request->method()) {
            'POST' => 'crear',
            'PUT', 'PATCH' => 'editar',
            'DELETE' => 'borrar',
            default => 'ver',
        };

        $permitido = (bool) $permiso->{$accion};
        if ($accion !== 'ver') {
            $permitido = $permitido && $permiso->ver;
        }

        if (! $permitido) {
            return $this->denegar($request, $accion);
        }

        return $next($request);
    }

    /**
     * Respuesta de acceso denegado según el tipo de petición y la acción.
     */
    private function denegar(Request $request, string $accion): Response
    {
        if ($request->expectsJson()) {
            abort(403, 'No tienes permiso para realizar esta acción.');
        }

        if ($accion === 'ver') {
            return redirect()
                ->route('dashboard')
                ->with('error', 'No tienes permiso para acceder a esa opción.');
        }

        return back()->with('error', 'No tienes permiso para realizar esta acción.');
    }
}
