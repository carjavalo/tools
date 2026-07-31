<?php

namespace App\Http\Controllers;

use App\Models\EstRadisecundario;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class EstRadisecundarioController extends Controller
{
    /**
     * Listado paginado de Estados Secundarios con búsqueda y estadísticas.
     */
    public function index(Request $request): Response
    {
        $search = trim((string) $request->query('search', ''));

        $estados = EstRadisecundario::query()
            ->when($search !== '', function ($query) use ($search) {
                $query->where('Nombre', 'like', "%{$search}%")
                    ->orWhere('Observacion', 'like', "%{$search}%");
            })
            ->orderBy('Nombre')
            ->paginate(8)
            ->withQueryString();

        return Inertia::render('tools/gestion-estado-secundario', [
            'estados' => $estados,
            'filters' => [
                'search' => $search,
            ],
            'stats' => [
                'total' => EstRadisecundario::count(),
                'activas' => EstRadisecundario::where('Estado', true)->count(),
                'inactivas' => EstRadisecundario::where('Estado', false)->count(),
            ],
        ]);
    }

    /**
     * Crear un Estado Secundario.
     */
    public function store(Request $request): RedirectResponse
    {
        EstRadisecundario::create($request->validate($this->rules()));

        return to_route('tools.gestion-estado-secundario')
            ->with('success', 'Estado secundario creado correctamente.');
    }

    /**
     * Actualizar un Estado Secundario.
     */
    public function update(Request $request, EstRadisecundario $estado): RedirectResponse
    {
        $estado->update($request->validate($this->rules()));

        return to_route('tools.gestion-estado-secundario')
            ->with('success', 'Estado secundario actualizado correctamente.');
    }

    /**
     * Eliminar un Estado Secundario.
     */
    public function destroy(EstRadisecundario $estado): RedirectResponse
    {
        $estado->delete();

        return to_route('tools.gestion-estado-secundario')
            ->with('success', 'Estado secundario eliminado correctamente.');
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
