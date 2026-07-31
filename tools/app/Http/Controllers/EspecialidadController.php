<?php

namespace App\Http\Controllers;

use App\Models\Especialidad;
use App\Models\SubEspecialidad;
use Illuminate\Database\QueryException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class EspecialidadController extends Controller
{
    /**
     * Listado paginado de especialidades con búsqueda y estadísticas.
     */
    public function index(Request $request): Response
    {
        $search = trim((string) $request->query('search', ''));

        $especialidades = Especialidad::query()
            ->when($search !== '', function ($query) use ($search) {
                $query->where('espcodser', 'like', "%{$search}%")
                    ->orWhere('Nombre', 'like', "%{$search}%");
            })
            ->orderBy('Nombre')
            ->paginate(8)
            ->withQueryString();

        return Inertia::render('tools/gestion-especialidades', [
            'especialidades' => $especialidades,
            'filters' => [
                'search' => $search,
            ],
            'stats' => [
                'total' => Especialidad::count(),
                'activas' => Especialidad::where('Estado', true)->count(),
                'inactivas' => Especialidad::where('Estado', false)->count(),
            ],
        ]);
    }

    /**
     * Crear una especialidad.
     */
    public function store(Request $request): RedirectResponse
    {
        $especialidad = Especialidad::create($request->validate($this->rules()));

        return to_route('tools.gestion-especialidades')
            ->with('success', 'Especialidad creada correctamente.')
            ->with('createdEspecialidad', [
                'id' => $especialidad->id,
                'Nombre' => $especialidad->Nombre,
            ]);
    }

    /**
     * Actualizar una especialidad.
     */
    public function update(Request $request, Especialidad $especialidad): RedirectResponse
    {
        $especialidad->update($request->validate($this->rules()));

        return to_route('tools.gestion-especialidades')
            ->with('success', 'Especialidad actualizada correctamente.');
    }

    /**
     * Eliminar una especialidad.
     */
    public function destroy(Especialidad $especialidad): RedirectResponse
    {
        try {
            // Las subespecialidades se relacionan por codespcodser; eliminarlas en cascada.
            if ($especialidad->espcodser) {
                SubEspecialidad::where('codespcodser', $especialidad->espcodser)->delete();
            }

            $especialidad->delete();
        } catch (QueryException) {
            return to_route('tools.gestion-especialidades')
                ->with('error', 'No se puede eliminar la especialidad porque hay subespecialidades vinculadas a su código de servicio.');
        }

        return to_route('tools.gestion-especialidades')
            ->with('success', 'Especialidad eliminada correctamente.');
    }

    /**
     * Reglas de validación.
     *
     * @return array<string, mixed>
     */
    private function rules(): array
    {
        return [
            'espcodser' => ['nullable', 'string', 'max:10'],
            'codminsal' => ['nullable', 'string', 'max:10'],
            'Nombre' => ['required', 'string', 'max:120'],
            'Estado' => ['required', 'boolean'],
            'Observacion' => ['nullable', 'string', 'max:300'],
        ];
    }
}
