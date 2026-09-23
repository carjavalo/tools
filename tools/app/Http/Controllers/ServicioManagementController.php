<?php

namespace App\Http\Controllers;

use App\Models\Serasignado;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ServicioManagementController extends Controller
{
    /**
     * Listado paginado de Servicios con búsqueda y estadísticas.
     */
    public function index(Request $request): Response
    {
        $search = trim((string) $request->query('search', ''));

        $servicios = Serasignado::query()
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($query) use ($search) {
                    $query->where('nombre', 'like', "%{$search}%")
                        ->orWhere('descripcion', 'like', "%{$search}%");

                    if (ctype_digit($search)) {
                        $query->orWhere('codigo', (int) $search);
                    }
                });
            })
            ->orderBy('nombre')
            ->paginate(8)
            ->withQueryString();

        return Inertia::render('tools/gestion-servicios', [
            'servicios' => $servicios,
            'filters' => [
                'search' => $search,
            ],
            'stats' => [
                'total' => Serasignado::count(),
                'activos' => Serasignado::where('estado', true)->count(),
                'inactivos' => Serasignado::where('estado', false)->count(),
            ],
        ]);
    }

    /**
     * Crear un Servicio.
     */
    public function store(Request $request): RedirectResponse
    {
        Serasignado::create($request->validate($this->rules()));

        return to_route('tools.gestion-servicios')
            ->with('success', 'Servicio creado correctamente.');
    }

    /**
     * Actualizar un Servicio.
     */
    public function update(Request $request, Serasignado $servicio): RedirectResponse
    {
        $servicio->update($request->validate($this->rules($servicio)));

        return to_route('tools.gestion-servicios')
            ->with('success', 'Servicio actualizado correctamente.');
    }

    /**
     * Eliminar un Servicio.
     */
    public function destroy(Serasignado $servicio): RedirectResponse
    {
        $servicio->delete();

        return to_route('tools.gestion-servicios')
            ->with('success', 'Servicio eliminado correctamente.');
    }

    /**
     * Reglas de validación. El nombre no se repite: dos servicios con el mismo
     * nombre serían indistinguibles al asignarlos.
     *
     * @return array<string, mixed>
     */
    private function rules(?Serasignado $servicio = null): array
    {
        return [
            'nombre' => [
                'required',
                'string',
                'max:120',
                Rule::unique('serasignado', 'nombre')->ignore($servicio?->codigo, 'codigo'),
            ],
            'descripcion' => ['nullable', 'string', 'max:120'],
            'estado' => ['required', 'boolean'],
        ];
    }
}
