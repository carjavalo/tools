<?php

namespace App\Http\Controllers;

use App\Models\Convenio;
use App\Models\Eps;
use App\Models\Regimen;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ConvenioController extends Controller
{
    /**
     * Listado paginado de convenios con búsqueda, filtro por EPS y estadísticas.
     */
    public function index(Request $request): Response
    {
        $search = trim((string) $request->query('search', ''));
        $epsFilter = trim((string) $request->query('eps', ''));

        $convenios = Convenio::query()
            ->with('eps:nit_empresa,Nombre')
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($query) use ($search) {
                    $query->where('nombre', 'like', "%{$search}%")
                        ->orWhere('nit_Convenio', 'like', "%{$search}%")
                        ->orWhere('regimen', 'like', "%{$search}%")
                        ->orWhereHas('eps', function ($query) use ($search) {
                            $query->where('Nombre', 'like', "%{$search}%");
                        });
                });
            })
            ->when($epsFilter !== '', function ($query) use ($epsFilter) {
                $query->where('nit_empresa', $epsFilter);
            })
            ->orderBy('nombre')
            ->paginate(8)
            ->withQueryString();

        return Inertia::render('tools/gestion-convenios', [
            'convenios' => $convenios,
            'filters' => [
                'search' => $search,
                'eps' => $epsFilter,
            ],
            'stats' => [
                'total' => Convenio::count(),
                'activos' => Convenio::where('Estado', true)->count(),
                'inactivos' => Convenio::where('Estado', false)->count(),
            ],
            'epsOptions' => Eps::query()
                ->whereNotNull('nit_empresa')
                ->orderBy('Nombre')
                ->get(['id', 'Nombre', 'nit_empresa']),
            'regimenes' => Regimen::query()
                ->orderBy('nombre')
                ->get(['id', 'nombre', 'descripcion', 'estado']),
        ]);
    }

    /**
     * Crear un convenio.
     */
    public function store(Request $request): RedirectResponse
    {
        Convenio::create($request->validate($this->rules()));

        return to_route('tools.gestion-convenios')
            ->with('success', 'Convenio creado correctamente.');
    }

    /**
     * Actualizar un convenio.
     */
    public function update(Request $request, Convenio $convenio): RedirectResponse
    {
        $convenio->update($request->validate($this->rules($convenio)));

        return to_route('tools.gestion-convenios')
            ->with('success', 'Convenio actualizado correctamente.');
    }

    /**
     * Eliminar un convenio.
     */
    public function destroy(Convenio $convenio): RedirectResponse
    {
        $convenio->delete();

        return to_route('tools.gestion-convenios')
            ->with('success', 'Convenio eliminado correctamente.');
    }

    /**
     * Reglas de validación.
     *
     * @return array<string, mixed>
     */
    private function rules(?Convenio $convenio = null): array
    {
        return [
            'nit_Convenio' => [
                'required',
                'string',
                'max:25',
                Rule::unique('convenio', 'nit_Convenio')->ignore($convenio?->id),
            ],
            'nombre' => ['required', 'string', 'max:120'],
            'regimen' => ['required', 'string', 'max:120'],
            'tarifa' => ['required', 'string', 'max:5'],
            'vigencia_inicio' => ['nullable', 'date'],
            'vigencia_fin' => ['nullable', 'date', 'after_or_equal:vigencia_inicio'],
            'nit_empresa' => ['required', 'string', 'max:25', Rule::exists('eps', 'nit_empresa')],
            'Estado' => ['required', 'boolean'],
        ];
    }
}
