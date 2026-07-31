<?php

namespace App\Http\Controllers;

use App\Models\EstRadicado;
use App\Models\EstRadisecundario;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AsignacionEstadosController extends Controller
{
    /**
     * Listado paginado de roles con sus estados asignados, búsqueda y filtro
     * por estado de asignación.
     */
    public function index(Request $request): Response
    {
        $search = trim((string) $request->query('search', ''));
        $asig = trim((string) $request->query('asig', ''));

        // El rol Super Admin solo es visible para un Super Admin.
        $viewerIsSuperAdmin = $request->user()?->isSuperAdmin() ?? false;
        $hideSuperAdmin = fn ($query) => $query->where('Nombre', '!=', User::SUPER_ADMIN);

        $conAsignacion = fn ($query) => $query->where(function ($sub) {
            $sub->whereHas('estadosRadicado')->orWhereHas('estadosSecundarios');
        });
        $sinAsignacion = fn ($query) => $query->whereDoesntHave('estadosRadicado')
            ->whereDoesntHave('estadosSecundarios');

        $roles = Role::query()
            ->with(['estadosRadicado:id,Nombre', 'estadosSecundarios:id,Nombre'])
            ->when(! $viewerIsSuperAdmin, $hideSuperAdmin)
            ->when($search !== '', function ($query) use ($search) {
                $query->where('Nombre', 'like', "%{$search}%");
            })
            ->when($asig === 'con', $conAsignacion)
            ->when($asig === 'sin', $sinAsignacion)
            ->orderBy('Nombre')
            ->paginate(8)
            ->withQueryString()
            ->through(fn (Role $role) => [
                'id' => $role->id,
                'Nombre' => $role->Nombre,
                'Estado' => $role->Estado,
                'estados_primarios' => $role->estadosRadicado
                    ->map(fn ($e) => ['id' => $e->id, 'Nombre' => $e->Nombre])->values(),
                'estados_secundarios' => $role->estadosSecundarios
                    ->map(fn ($e) => ['id' => $e->id, 'Nombre' => $e->Nombre])->values(),
            ]);

        $baseStats = fn () => Role::query()->when(! $viewerIsSuperAdmin, $hideSuperAdmin);

        return Inertia::render('tools/gestion-asignacion-estados', [
            'roles' => $roles,
            'filters' => [
                'search' => $search,
                'asig' => $asig,
            ],
            'stats' => [
                'total' => $baseStats()->count(),
                'asignados' => $baseStats()->tap($conAsignacion)->count(),
                'sinAsignar' => $baseStats()->tap($sinAsignacion)->count(),
            ],
            'estadosRadicado' => EstRadicado::orderBy('Nombre')->get(['id', 'Nombre']),
            'estadosSecundarios' => EstRadisecundario::orderBy('Nombre')->get(['id', 'Nombre']),
            'rolesOptions' => Role::query()
                ->when(! $viewerIsSuperAdmin, $hideSuperAdmin)
                ->orderBy('Nombre')
                ->get(['id', 'Nombre']),
        ]);
    }

    /**
     * Crear una asignación: aplicar los estados seleccionados a un rol.
     */
    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate($this->rules(withRole: true));

        $role = Role::findOrFail($data['role_id']);
        $this->authorizeRole($request, $role);
        $this->sync($role, $data);

        return to_route('tools.asignacion-estados')
            ->with('success', "Estados asignados correctamente al rol {$role->Nombre}.");
    }

    /**
     * Actualizar la asignación de estados de un rol.
     */
    public function update(Request $request, Role $role): RedirectResponse
    {
        $this->authorizeRole($request, $role);
        $data = $request->validate($this->rules());
        $this->sync($role, $data);

        return to_route('tools.asignacion-estados')
            ->with('success', "Asignación del rol {$role->Nombre} actualizada correctamente.");
    }

    /**
     * Eliminar la asignación de un rol (quita todos sus estados; el rol no se borra).
     */
    public function destroy(Request $request, Role $role): RedirectResponse
    {
        $this->authorizeRole($request, $role);
        $role->estadosRadicado()->sync([]);
        $role->estadosSecundarios()->sync([]);

        return to_route('tools.asignacion-estados')
            ->with('success', "Asignación del rol {$role->Nombre} eliminada correctamente.");
    }

    /**
     * Para un no-Super-Admin, el rol Super Admin no existe: 404.
     */
    private function authorizeRole(Request $request, Role $role): void
    {
        abort_if(
            ! ($request->user()?->isSuperAdmin() ?? false) && $role->Nombre === User::SUPER_ADMIN,
            404,
        );
    }

    /**
     * Sincronizar ambas relaciones de estados del rol.
     *
     * @param array<string, mixed> $data
     */
    private function sync(Role $role, array $data): void
    {
        $role->estadosRadicado()->sync($data['est_radicado_ids'] ?? []);
        $role->estadosSecundarios()->sync($data['est_radisecundario_ids'] ?? []);
    }

    /**
     * Reglas de validación.
     *
     * @return array<string, mixed>
     */
    private function rules(bool $withRole = false): array
    {
        $rules = [
            'est_radicado_ids' => ['array'],
            'est_radicado_ids.*' => ['integer', 'exists:EstRadicado,id'],
            'est_radisecundario_ids' => ['array'],
            'est_radisecundario_ids.*' => ['integer', 'exists:EstRadisecundario,id'],
        ];

        if ($withRole) {
            $rules['role_id'] = ['required', 'integer', 'exists:roles,id'];
        }

        return $rules;
    }
}
