<?php

namespace App\Http\Controllers;

use App\Models\EstRadicado;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class EstRadicadoController extends Controller
{
    /**
     * Listado paginado de Estados con búsqueda y estadísticas.
     */
    public function index(Request $request): Response
    {
        $search = trim((string) $request->query('search', ''));

        $estados = EstRadicado::query()
            ->when($search !== '', function ($query) use ($search) {
                $query->where('Nombre', 'like', "%{$search}%")
                    ->orWhere('Observacion', 'like', "%{$search}%");
            })
            ->orderBy('Nombre')
            ->paginate(8)
            ->withQueryString();

        return Inertia::render('tools/gestion-estado', [
            'estados' => $estados,
            'filters' => [
                'search' => $search,
            ],
            'stats' => [
                'total' => EstRadicado::count(),
                'activas' => EstRadicado::where('Estado', true)->count(),
                'inactivas' => EstRadicado::where('Estado', false)->count(),
            ],
        ]);
    }

    /**
     * Crear un Estado.
     */
    public function store(Request $request): RedirectResponse
    {
        EstRadicado::create($request->validate($this->rules()));

        return to_route('tools.gestion-estado')
            ->with('success', 'Estado creado correctamente.');
    }

    /**
     * Actualizar un Estado.
     */
    public function update(Request $request, EstRadicado $estado): RedirectResponse
    {
        $estado->update($request->validate($this->rules()));

        return to_route('tools.gestion-estado')
            ->with('success', 'Estado actualizado correctamente.');
    }

    /**
     * Eliminar un Estado.
     */
    public function destroy(EstRadicado $estado): RedirectResponse
    {
        $estado->delete();

        return to_route('tools.gestion-estado')
            ->with('success', 'Estado eliminado correctamente.');
    }

    /**
     * Reglas de validación.
     *
     * @return array<string, mixed>
     */
    private function rules(): array
    {
        return [
            'Nombre' => ['required', 'string', 'max:120'],
            'Estado' => ['required', 'boolean'],
            'Observacion' => ['nullable', 'string', 'max:300'],
        ];
    }
}
