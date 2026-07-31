<?php

namespace App\Http\Controllers;

use App\Models\EstRadicado;
use App\Models\EstRadisecundario;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class RoleManagementController extends Controller
{
    /**
     * Listado paginado de Roles con búsqueda y estadísticas.
     */
    public function index(Request $request): Response
    {
        $search = trim((string) $request->query('search', ''));

        // El rol Super Admin solo es visible para un Super Admin.
        $viewerIsSuperAdmin = $request->user()?->isSuperAdmin() ?? false;
        $hideSuperAdmin = fn ($query) => $query->where('Nombre', '!=', User::SUPER_ADMIN);

        $roles = Role::query()
            ->with(['estadosRadicado:id', 'estadosSecundarios:id'])
            ->when(! $viewerIsSuperAdmin, $hideSuperAdmin)
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($sub) use ($search) {
                    $sub->where('Nombre', 'like', "%{$search}%")
                        ->orWhere('Observacion', 'like', "%{$search}%");
                });
            })
            ->orderBy('Nombre')
            ->paginate(8)
            ->withQueryString()
            ->through(fn (Role $role) => [
                'id' => $role->id,
                'Nombre' => $role->Nombre,
                'Estado' => $role->Estado,
                'Observacion' => $role->Observacion,
                'created_at' => $role->created_at,
                'est_radicado_ids' => $role->estadosRadicado->pluck('id'),
                'est_radisecundario_ids' => $role->estadosSecundarios->pluck('id'),
            ]);

        return Inertia::render('tools/gestion-roles', [
            'roles' => $roles,
            'filters' => [
                'search' => $search,
            ],
            'stats' => [
                'total' => Role::query()->when(! $viewerIsSuperAdmin, $hideSuperAdmin)->count(),
                'activas' => Role::query()->when(! $viewerIsSuperAdmin, $hideSuperAdmin)->where('Estado', true)->count(),
                'inactivas' => Role::query()->when(! $viewerIsSuperAdmin, $hideSuperAdmin)->where('Estado', false)->count(),
            ],
            'estadosRadicado' => EstRadicado::orderBy('Nombre')->get(['id', 'Nombre']),
            'estadosSecundarios' => EstRadisecundario::orderBy('Nombre')->get(['id', 'Nombre']),
        ]);
    }

    /**
     * Crear un Rol.
     */
    public function store(Request $request): RedirectResponse
    {
        $viewerIsSuperAdmin = $request->user()?->isSuperAdmin() ?? false;
        $data = $request->validate($this->rules($viewerIsSuperAdmin));

        $role = Role::create(Arr::only($data, ['Nombre', 'Estado', 'Observacion']));
        $this->syncEstados($request, $role);

        return to_route('tools.gestion-roles')
            ->with('success', 'Rol creado correctamente.');
    }

    /**
     * Actualizar un Rol.
     */
    public function update(Request $request, Role $role): RedirectResponse
    {
        $viewerIsSuperAdmin = $request->user()?->isSuperAdmin() ?? false;

        // Para un no-Super-Admin, el rol Super Admin no existe: 404.
        abort_if(! $viewerIsSuperAdmin && $role->Nombre === User::SUPER_ADMIN, 404);

        $data = $request->validate($this->rules($viewerIsSuperAdmin));

        $role->update(Arr::only($data, ['Nombre', 'Estado', 'Observacion']));
        $this->syncEstados($request, $role);

        return to_route('tools.gestion-roles')
            ->with('success', 'Rol actualizado correctamente.');
    }

    /**
     * Sincroniza los estados asignados al rol. Solo toca cada relación si el
     * request incluye el campo correspondiente, de modo que acciones parciales
     * (como alternar el estado del rol) no borren las asignaciones existentes.
     */
    private function syncEstados(Request $request, Role $role): void
    {
        if ($request->has('est_radicado_ids')) {
            $role->estadosRadicado()->sync($request->input('est_radicado_ids', []));
        }

        if ($request->has('est_radisecundario_ids')) {
            $role->estadosSecundarios()->sync($request->input('est_radisecundario_ids', []));
        }
    }

    /**
     * Eliminar un Rol.
     */
    public function destroy(Request $request, Role $role): RedirectResponse
    {
        // Para un no-Super-Admin, el rol Super Admin no existe: 404.
        abort_if(! ($request->user()?->isSuperAdmin() ?? false) && $role->Nombre === User::SUPER_ADMIN, 404);

        $role->delete();

        return to_route('tools.gestion-roles')
            ->with('success', 'Rol eliminado correctamente.');
    }

    /**
     * Reglas de validación.
     *
     * @return array<string, mixed>
     */
    private function rules(bool $canManageSuperAdmin = true): array
    {
        $nombreRules = ['required', 'string', 'max:120'];

        // Un no-Super-Admin no puede crear ni renombrar un rol como Super Admin.
        if (! $canManageSuperAdmin) {
            $nombreRules[] = Rule::notIn([User::SUPER_ADMIN]);
        }

        return [
            'Nombre' => $nombreRules,
            'Estado' => ['required', 'boolean'],
            'Observacion' => ['nullable', 'string', 'max:300'],
            'est_radicado_ids' => ['array'],
            'est_radicado_ids.*' => ['integer', 'exists:EstRadicado,id'],
            'est_radisecundario_ids' => ['array'],
            'est_radisecundario_ids.*' => ['integer', 'exists:EstRadisecundario,id'],
        ];
    }
}
