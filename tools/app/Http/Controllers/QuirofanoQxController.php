<?php

namespace App\Http\Controllers;

use App\Models\QuirofanoQx;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class QuirofanoQxController extends Controller
{
    /**
     * Listado paginado de quirófanos con búsqueda, filtro por estado y
     * estadísticas.
     */
    public function index(Request $request): Response
    {
        $search = trim((string) $request->query('search', ''));
        // '' = todos, '1' = activos, '0' = inactivos.
        $estado = (string) $request->query('estado', '');
        if (! in_array($estado, ['', '1', '0'], true)) {
            $estado = '';
        }

        $quirofanos = QuirofanoQx::query()
            ->when($search !== '', function ($query) use ($search) {
                $query->where(fn ($q) => $q
                    ->where('nombre', 'like', "%{$search}%")
                    ->orWhere('id', $search));
            })
            ->when($estado !== '', fn ($query) => $query->where('estado', $estado === '1'))
            ->orderBy('nombre')
            ->paginate(8)
            ->withQueryString();

        return Inertia::render('tools/gestion-quirofano-qx', [
            'quirofanos' => $quirofanos,
            'filters' => [
                'search' => $search,
                'estado' => $estado,
            ],
            'stats' => [
                'total' => QuirofanoQx::count(),
                'activos' => QuirofanoQx::where('estado', true)->count(),
                'inactivos' => QuirofanoQx::where('estado', false)->count(),
            ],
        ]);
    }

    /**
     * Crear un quirófano.
     */
    public function store(Request $request): RedirectResponse
    {
        QuirofanoQx::create($request->validate($this->rules(), $this->messages()));

        return to_route('tools.gestion-quirofano-qx')
            ->with('success', 'Quirófano creado correctamente.');
    }

    /**
     * Actualizar un quirófano.
     */
    public function update(Request $request, QuirofanoQx $quirofano): RedirectResponse
    {
        $quirofano->update($request->validate($this->rules($quirofano->id), $this->messages()));

        return to_route('tools.gestion-quirofano-qx')
            ->with('success', 'Quirófano actualizado correctamente.');
    }

    /**
     * Eliminar un quirófano.
     */
    public function destroy(QuirofanoQx $quirofano): RedirectResponse
    {
        $quirofano->delete();

        return to_route('tools.gestion-quirofano-qx')
            ->with('success', 'Quirófano eliminado correctamente.');
    }

    /**
     * Reglas de validación. El nombre no se repite: dos quirófanos con el
     * mismo nombre no se podrían distinguir al escogerlos.
     *
     * @return array<string, mixed>
     */
    private function rules(?int $ignorarId = null): array
    {
        return [
            'nombre' => ['required', 'string', 'max:100', 'unique:quirofanoQx,nombre'.($ignorarId ? ','.$ignorarId : '')],
            'estado' => ['required', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    private function messages(): array
    {
        return [
            'nombre.unique' => 'Ya existe un quirófano con ese nombre.',
        ];
    }
}
