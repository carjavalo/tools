<?php

namespace App\Http\Controllers;

use App\Models\Eps;
use Illuminate\Database\QueryException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class EpsController extends Controller
{
    /**
     * Listado paginado de EPS con búsqueda y estadísticas.
     */
    public function index(Request $request): Response
    {
        $search = trim((string) $request->query('search', ''));

        $eps = Eps::query()
            ->when($search !== '', function ($query) use ($search) {
                $query->where('Nombre', 'like', "%{$search}%")
                    ->orWhere('nit_empresa', 'like', "%{$search}%")
                    ->orWhere('Observacion', 'like', "%{$search}%");
            })
            ->orderBy('Nombre')
            ->paginate(8)
            ->withQueryString();

        return Inertia::render('tools/gestion-eps', [
            'eps' => $eps,
            'filters' => [
                'search' => $search,
            ],
            'stats' => [
                'total' => Eps::count(),
                'activas' => Eps::where('Estado', true)->count(),
                'inactivas' => Eps::where('Estado', false)->count(),
            ],
        ]);
    }

    /**
     * Crear una EPS.
     */
    public function store(Request $request): RedirectResponse
    {
        Eps::create($request->validate($this->rules()));

        return to_route('tools.gestion-eps')
            ->with('success', 'EPS creada correctamente.');
    }

    /**
     * Actualizar una EPS.
     */
    public function update(Request $request, Eps $eps): RedirectResponse
    {
        $eps->update($request->validate($this->rules($eps)));

        return to_route('tools.gestion-eps')
            ->with('success', 'EPS actualizada correctamente.');
    }

    /**
     * Eliminar una EPS.
     */
    public function destroy(Eps $eps): RedirectResponse
    {
        try {
            $eps->delete();
        } catch (QueryException) {
            return to_route('tools.gestion-eps')
                ->with('error', 'No se puede eliminar la EPS porque tiene convenios asociados.');
        }

        return to_route('tools.gestion-eps')
            ->with('success', 'EPS eliminada correctamente.');
    }

    /**
     * Reglas de validación.
     *
     * @return array<string, mixed>
     */
    private function rules(?Eps $eps = null): array
    {
        return [
            'Nombre' => ['required', 'string', 'max:120'],
            'nit_empresa' => [
                'nullable',
                'string',
                'max:25',
                Rule::unique('eps', 'nit_empresa')->ignore($eps?->id),
            ],
            'Estado' => ['required', 'boolean'],
            'Observacion' => ['nullable', 'string', 'max:300'],
        ];
    }
}
