<?php

namespace App\Http\Controllers;

use App\Models\Motivo;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class MotivoManagementController extends Controller
{
    /**
     * Listado paginado de Motivos con búsqueda y estadísticas.
     */
    public function index(Request $request): Response
    {
        $search = trim((string) $request->query('search', ''));

        $motivos = Motivo::query()
            ->when($search !== '', function ($query) use ($search) {
                $query->where('Nombre', 'like', "%{$search}%")
                    ->orWhere('Observacion', 'like', "%{$search}%");
            })
            ->orderBy('Nombre')
            ->paginate(8)
            ->withQueryString();

        return Inertia::render('tools/gestion-motivo', [
            'motivos' => $motivos,
            'filters' => [
                'search' => $search,
            ],
            'stats' => [
                'total' => Motivo::count(),
                'activas' => Motivo::where('Estado', true)->count(),
                'inactivas' => Motivo::where('Estado', false)->count(),
            ],
        ]);
    }

    /**
     * Crear un Motivo.
     */
    public function store(Request $request): RedirectResponse
    {
        Motivo::create($request->validate($this->rules()));

        return to_route('tools.gestion-motivo')
            ->with('success', 'Motivo creado correctamente.');
    }

    /**
     * Actualizar un Motivo.
     */
    public function update(Request $request, Motivo $motivo): RedirectResponse
    {
        $motivo->update($request->validate($this->rules()));

        return to_route('tools.gestion-motivo')
            ->with('success', 'Motivo actualizado correctamente.');
    }

    /**
     * Eliminar un Motivo.
     */
    public function destroy(Motivo $motivo): RedirectResponse
    {
        $motivo->delete();

        return to_route('tools.gestion-motivo')
            ->with('success', 'Motivo eliminado correctamente.');
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
