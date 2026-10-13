<?php

namespace App\Http\Middleware;

use App\Support\MenuUsuario;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckMenuUsuario
{
    /**
     * Niega las rutas de la cuenta (perfil, contraseña, dos pasos, eliminar
     * cuenta) a los roles que no tienen la opción en el menú de usuario del
     * Gestor de Permisos. Va en el grupo web para alcanzar también las rutas de Fortify,
     * y se reconoce cada ruta por su nombre.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $opcion = MenuUsuario::RUTAS[$request->route()?->getName() ?? ''] ?? null;

        if ($opcion === null || ! $request->user() || MenuUsuario::permite($request->user(), $opcion)) {
            return $next($request);
        }

        if ($request->expectsJson()) {
            abort(403, 'No tienes permiso para modificar tu cuenta.');
        }

        return redirect()
            ->route('dashboard')
            ->with('error', 'No tienes permiso para acceder a esa opción de tu cuenta.');
    }
}
