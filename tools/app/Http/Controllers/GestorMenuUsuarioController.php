<?php

namespace App\Http\Controllers;

use App\Models\Role;
use App\Models\User;
use App\Support\MenuUsuario;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class GestorMenuUsuarioController extends Controller
{
    /**
     * Opciones del menú de usuario por rol. Solo accesible para el Super Admin.
     */
    public function index(Request $request): Response
    {
        abort_unless($request->user()?->isSuperAdmin() ?? false, 403);

        // El Super Admin no se configura: siempre tiene todas las opciones.
        $roles = Role::where('Nombre', '!=', User::SUPER_ADMIN)
            ->orderBy('Nombre')
            ->get(['id', 'Nombre', 'Estado']);

        $roleId = (int) $request->query('role', 0);
        if (! $roles->contains('id', $roleId)) {
            $roleId = (int) ($roles->first()->id ?? 0);
        }
        $rolActivo = $roles->firstWhere('id', $roleId);

        return Inertia::render('tools/gestor-menu-usuario', [
            'roles' => $roles,
            'opciones' => MenuUsuario::OPCIONES,
            'roleId' => $roleId,
            'permitidas' => $rolActivo
                ? MenuUsuario::delRol($rolActivo)
                : array_fill_keys(MenuUsuario::claves(), true),
        ]);
    }

    /**
     * Guardar las opciones del menú de usuario de un rol.
     */
    public function guardar(Request $request, Role $role): RedirectResponse
    {
        abort_unless($request->user()?->isSuperAdmin() ?? false, 403);
        abort_if($role->Nombre === User::SUPER_ADMIN, 422);

        $data = $request->validate([
            'opciones' => ['required', 'array'],
            'opciones.*' => ['required', 'boolean'],
        ]);

        foreach ($data['opciones'] as $opcion => $permitido) {
            if (! in_array($opcion, MenuUsuario::claves(), true)) {
                continue;
            }

            DB::table('role_menu_usuario')->updateOrInsert(
                ['role_id' => $role->id, 'opcion' => $opcion],
                ['permitido' => $permitido, 'created_at' => now(), 'updated_at' => now()],
            );
        }

        return to_route('tools.gestor-menu-usuario', ['role' => $role->id])
            ->with('success', "Menú de usuario del rol {$role->Nombre} guardado correctamente.");
    }
}
