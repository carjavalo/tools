<?php

namespace App\Http\Controllers;

use App\Models\Cups;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class CupsManagementController extends Controller
{
    /**
     * Listado paginado de CUPS con búsqueda y estadísticas.
     */
    public function index(Request $request): Response
    {
        $search = trim((string) $request->query('search', ''));

        $cups = Cups::query()
            ->when($search !== '', function ($query) use ($search) {
                $query->where('Nombre', 'like', "%{$search}%")
                    ->orWhere('descrip_Normativa', 'like', "%{$search}%")
                    ->orWhere('CodCupsHuv', 'like', "%{$search}%")
                    ->orWhere('CodCupsHo', 'like', "%{$search}%")
                    ->orWhere('Observacion', 'like', "%{$search}%");
            })
            ->orderBy('Nombre')
            ->paginate(8)
            ->withQueryString();

        return Inertia::render('tools/gestion-cups', [
            'cups' => $cups,
            'filters' => [
                'search' => $search,
            ],
            'stats' => [
                'total' => Cups::count(),
                'activas' => Cups::where('Estado', true)->count(),
                'inactivas' => Cups::where('Estado', false)->count(),
            ],
        ]);
    }

    /**
     * Crear un CUPS.
     */
    public function store(Request $request): RedirectResponse
    {
        Cups::create($request->validate($this->rules()));

        return to_route('tools.gestion-cups')
            ->with('success', 'CUPS creado correctamente.');
    }

    /**
     * Actualizar un CUPS.
     */
    public function update(Request $request, Cups $cups): RedirectResponse
    {
        $cups->update($request->validate($this->rules($cups)));

        return to_route('tools.gestion-cups')
            ->with('success', 'CUPS actualizado correctamente.');
    }

    /**
     * Eliminar un CUPS.
     */
    public function destroy(Cups $cups): RedirectResponse
    {
        $cups->delete();

        return to_route('tools.gestion-cups')
            ->with('success', 'CUPS eliminado correctamente.');
    }

    /**
     * Reglas de validación.
     *
     * @return array<string, mixed>
     */
    private function rules(?Cups $cups = null): array
    {
        $id = $cups?->id;

        return [
            'CodCupsHuv' => ['nullable', 'string', 'max:10', Rule::unique('cups', 'CodCupsHuv')->ignore($id)],
            'CodCupsHo' => ['nullable', 'string', 'max:10'],
            'Nombre' => ['required', 'string', 'max:800'],
            'descrip_Normativa' => ['nullable', 'string', 'max:1200'],
            'Estado' => ['required', 'boolean'],
            'Observacion' => ['nullable', 'string', 'max:1200'],
            'tipofactor' => ['nullable', 'string', 'max:30'],
        ];
    }
}
