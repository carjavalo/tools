<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserHasRole
{
    /**
     * Permite el paso solo a usuarios cuyo rol esté entre los indicados.
     * Los demás (p. ej. pacientes) son redirigidos al dashboard. El Super
     * Admin siempre pasa, aunque no se le haya incluido en la lista: tiene
     * acceso total a todas las vistas y acciones del sistema.
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if ($user && $user->isSuperAdmin()) {
            return $next($request);
        }

        if (! $user || ! in_array($user->rol, $roles, true)) {
            if ($request->expectsJson()) {
                abort(403, 'No tienes permisos para acceder a esta sección.');
            }

            return redirect()
                ->route('dashboard')
                ->with('error', 'No tienes permisos para acceder a esa sección.');
        }

        return $next($request);
    }
}
