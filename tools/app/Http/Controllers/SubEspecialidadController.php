<?php

namespace App\Http\Controllers;

use App\Models\Especialidad;
use App\Models\SubEspecialidad;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SubEspecialidadController extends Controller
{
    /**
     * Listado paginado de subespecialidades con búsqueda y estadísticas.
     */
    public function index(Request $request): Response
    {
        $search = trim((string) $request->query('search', ''));

        $subespecialidades = SubEspecialidad::query()
            ->with('especialidad:espcodser,Nombre')
            ->when($search !== '', function ($query) use ($search) {
                $query->where('cod_SubEspecialidad', 'like', "%{$search}%")
                    ->orWhere('Nombre', 'like', "%{$search}%");
            })
            ->orderBy('Nombre')
            ->paginate(8)
            ->withQueryString();

        return Inertia::render('tools/gestion-subespecialidades', [
            'subespecialidades' => $subespecialidades,
            'especialidades' => Especialidad::query()
                ->where('Estado', true)
                ->whereNotNull('espcodser')
                ->orderBy('Nombre')
                ->get(['id', 'espcodser', 'Nombre']),
            'filters' => [
                'search' => $search,
            ],
            'stats' => [
                'total' => SubEspecialidad::count(),
                'activas' => SubEspecialidad::where('Estado', true)->count(),
                'inactivas' => SubEspecialidad::where('Estado', false)->count(),
            ],
        ]);
    }

    /**
     * Crear una subespecialidad.
     */
    public function store(Request $request): RedirectResponse
    {
        SubEspecialidad::create($request->validate($this->rules()));

        return to_route('tools.gestion-subespecialidades')
            ->with('success', 'Subespecialidad creada correctamente.');
    }

    /**
     * Actualizar una subespecialidad.
     */
    public function update(Request $request, SubEspecialidad $subespecialidad): RedirectResponse
    {
        $subespecialidad->update($request->validate($this->rules()));

        return to_route('tools.gestion-subespecialidades')
            ->with('success', 'Subespecialidad actualizada correctamente.');
    }

    /**
     * Eliminar una subespecialidad.
     */
    public function destroy(SubEspecialidad $subespecialidad): RedirectResponse
    {
        $subespecialidad->delete();

        return to_route('tools.gestion-subespecialidades')
            ->with('success', 'Subespecialidad eliminada correctamente.');
    }

    /**
     * Reglas de validación.
     *
     * @return array<string, mixed>
     */
    private function rules(): array
    {
        return [
            // Código servinte de la subespecialidad, digitado por el usuario.
            'cod_SubEspecialidad' => ['nullable', 'string', 'max:10'],
            // Especialidad a la que pertenece: llave foránea a especialidad.espcodser.
            'codespcodser' => ['required', 'string', 'max:10', 'exists:especialidad,espcodser'],
            'codminsal' => ['nullable', 'string', 'max:10'],
            'Nombre' => ['required', 'string', 'max:120'],
            'Estado' => ['required', 'boolean'],
            'Observacion' => ['nullable', 'string', 'max:300'],
        ];
    }
}
