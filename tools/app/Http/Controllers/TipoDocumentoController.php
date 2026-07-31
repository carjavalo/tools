<?php

namespace App\Http\Controllers;

use App\Models\TipoDocumento;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class TipoDocumentoController extends Controller
{
    /**
     * Listado paginado de tipos de documento con búsqueda y estadísticas.
     */
    public function index(Request $request): Response
    {
        $search = trim((string) $request->query('search', ''));

        $tipos = TipoDocumento::query()
            ->when($search !== '', function ($query) use ($search) {
                $query->where('Nombre', 'like', "%{$search}%")
                    ->orWhere('Observacion', 'like', "%{$search}%");
            })
            ->orderBy('Nombre')
            ->paginate(8)
            ->withQueryString();

        return Inertia::render('tools/gestion-tipo-documento', [
            'tipos' => $tipos,
            'filters' => [
                'search' => $search,
            ],
            'stats' => [
                'total' => TipoDocumento::count(),
                'activas' => TipoDocumento::where('Estado', true)->count(),
                'inactivas' => TipoDocumento::where('Estado', false)->count(),
            ],
        ]);
    }

    /**
     * Crear un tipo de documento.
     */
    public function store(Request $request): RedirectResponse
    {
        TipoDocumento::create($request->validate($this->rules()));

        return to_route('tools.gestion-tipo-documento')
            ->with('success', 'Tipo de documento creado correctamente.');
    }

    /**
     * Actualizar un tipo de documento.
     */
    public function update(Request $request, TipoDocumento $tipoDocumento): RedirectResponse
    {
        $tipoDocumento->update($request->validate($this->rules()));

        return to_route('tools.gestion-tipo-documento')
            ->with('success', 'Tipo de documento actualizado correctamente.');
    }

    /**
     * Eliminar un tipo de documento.
     */
    public function destroy(TipoDocumento $tipoDocumento): RedirectResponse
    {
        $tipoDocumento->delete();

        return to_route('tools.gestion-tipo-documento')
            ->with('success', 'Tipo de documento eliminado correctamente.');
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
