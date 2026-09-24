<?php

namespace App\Http\Controllers;

use App\Models\Serasignado;
use App\Support\Sede;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ServicioManagementController extends Controller
{
    /**
     * Listado paginado de Servicios con búsqueda y estadísticas.
     *
     * Para los roles normales todo —la lista, la búsqueda y los conteos— es de
     * la sede activa: el modelo filtra por ella. El Super Admin ve las dos
     * sedes y puede acotar a una con el filtro de sede.
     */
    public function index(Request $request): Response
    {
        $search = trim((string) $request->query('search', ''));
        $esSuperAdmin = (bool) $request->user()?->isSuperAdmin();
        $sedeFiltro = $esSuperAdmin && in_array($request->query('sede'), Sede::claves(), true)
            ? $request->query('sede')
            : null;

        $servicios = $this->base($request)
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($query) use ($search) {
                    $query->where('nombre', 'like', "%{$search}%")
                        ->orWhere('descripcion', 'like', "%{$search}%");

                    if (ctype_digit($search)) {
                        $query->orWhere('codigo', (int) $search);
                    }
                });
            })
            ->when($sedeFiltro, fn ($query) => $query->where('sede', $sedeFiltro))
            ->orderBy('nombre')
            ->paginate(8)
            ->withQueryString();

        $conteo = fn () => $this->base($request)
            ->when($sedeFiltro, fn ($query) => $query->where('sede', $sedeFiltro));

        return Inertia::render('tools/gestion-servicios', [
            'servicios' => $servicios,
            'filters' => [
                'search' => $search,
                'sede' => $sedeFiltro ?? '',
            ],
            'stats' => [
                'total' => $conteo()->count(),
                'activos' => $conteo()->where('estado', true)->count(),
                'inactivos' => $conteo()->where('estado', false)->count(),
            ],
            'puedeEscogerSede' => $esSuperAdmin,
            'sedes' => collect(Sede::NOMBRES)
                ->map(fn (string $nombre, string $clave) => ['clave' => $clave, 'nombre' => $nombre])
                ->values(),
        ]);
    }

    /**
     * Crear un Servicio. Nace en la sede activa; el Super Admin puede
     * escoger otra.
     */
    public function store(Request $request): RedirectResponse
    {
        $sede = $this->sedeDestino($request);
        $data = $request->validate($this->rules($request, $sede));

        $servicio = new Serasignado(collect($data)->except('sede')->all());
        $servicio->sede = $sede;
        $servicio->save();

        return to_route('tools.gestion-servicios')
            ->with('success', 'Servicio creado correctamente.');
    }

    /**
     * Actualizar un Servicio. Solo el Super Admin puede moverlo de sede.
     */
    public function update(Request $request, int $servicio): RedirectResponse
    {
        $servicio = $this->base($request)->findOrFail($servicio);
        $sede = $this->sedeDestino($request, $servicio);
        $data = $request->validate($this->rules($request, $sede, $servicio));

        $servicio->fill(collect($data)->except('sede')->all());
        $servicio->sede = $sede;
        $servicio->save();

        return to_route('tools.gestion-servicios')
            ->with('success', 'Servicio actualizado correctamente.');
    }

    /**
     * Eliminar un Servicio.
     */
    public function destroy(Request $request, int $servicio): RedirectResponse
    {
        $this->base($request)->findOrFail($servicio)->delete();

        return to_route('tools.gestion-servicios')
            ->with('success', 'Servicio eliminado correctamente.');
    }

    /**
     * Servicios que el usuario puede ver y operar: los de su sede activa, o
     * los de las dos sedes si es Super Admin. Por eso las rutas reciben el
     * código y no el modelo: el enlace automático aplicaría siempre el filtro
     * de la sede activa y el Super Admin no alcanzaría los de la otra.
     *
     * @return Builder<Serasignado>
     */
    private function base(Request $request): Builder
    {
        return $request->user()?->isSuperAdmin()
            ? Serasignado::withoutGlobalScope('sede')
            : Serasignado::query();
    }

    /**
     * Sede en la que queda el servicio. Para los roles normales es siempre la
     * sede activa (o la que ya tiene, al editar): lo que mande la petición se
     * ignora. El Super Admin la escoge; si no la envía, se conserva la actual
     * o se usa la activa.
     */
    private function sedeDestino(Request $request, ?Serasignado $servicio = null): string
    {
        $actual = $servicio?->sede ?? Sede::activa() ?? Sede::CALI;

        if (! $request->user()?->isSuperAdmin()) {
            return $actual;
        }

        return $request->filled('sede') ? (string) $request->input('sede') : $actual;
    }

    /**
     * Reglas de validación. El nombre no se repite dentro de una sede: dos
     * servicios con el mismo nombre serían indistinguibles al asignarlos. Entre
     * sedes sí puede repetirse (Cali y Cartago pueden tener cada una su
     * "Hemodinamia").
     *
     * @return array<string, mixed>
     */
    private function rules(Request $request, string $sede, ?Serasignado $servicio = null): array
    {
        $rules = [
            'nombre' => [
                'required',
                'string',
                'max:120',
                Rule::unique('serasignado', 'nombre')
                    ->where('sede', $sede)
                    ->ignore($servicio?->codigo, 'codigo'),
            ],
            'descripcion' => ['nullable', 'string', 'max:120'],
            'estado' => ['required', 'boolean'],
        ];

        if ($request->user()?->isSuperAdmin()) {
            $rules['sede'] = ['nullable', Rule::in(Sede::claves())];
        }

        return $rules;
    }
}
