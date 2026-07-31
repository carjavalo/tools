<?php

namespace App\Http\Controllers;

use App\Models\Cups;
use App\Models\CupsEps;
use App\Models\Eps;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class CupsEpsController extends Controller
{
    /**
     * Listado de asociaciones EPS ↔ CUPS con búsqueda y estadísticas.
     */
    public function index(Request $request): Response
    {
        $search = trim((string) $request->query('search', ''));

        $asociaciones = CupsEps::query()
            ->with(['eps:id,Nombre', 'cups:id,CodCupsHuv,CodCupsHo,Nombre,descrip_Normativa,tipofactor'])
            ->when($search !== '', function ($query) use ($search) {
                $query->whereHas('eps', fn ($e) => $e->where('Nombre', 'like', "%{$search}%"))
                    ->orWhereHas('cups', fn ($c) => $c
                        ->where('Nombre', 'like', "%{$search}%")
                        ->orWhere('CodCupsHuv', 'like', "%{$search}%")
                        ->orWhere('CodCupsHo', 'like', "%{$search}%"));
            })
            ->orderByDesc('id')
            ->paginate(10)
            ->withQueryString();

        return Inertia::render('tools/gestion-cups-eps', [
            'asociaciones' => $asociaciones,
            'epsList' => Eps::orderBy('Nombre')->get(['id', 'Nombre']),
            'filters' => [
                'search' => $search,
            ],
            'stats' => [
                'total' => CupsEps::count(),
                'eps' => CupsEps::distinct('eps_id')->count('eps_id'),
                'cups' => CupsEps::distinct('cuvs_id')->count('cuvs_id'),
            ],
        ]);
    }

    /**
     * Búsqueda asíncrona de CUPS (para el selector con 6.000+ registros).
     */
    public function buscarCups(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));

        if (mb_strlen($q) < 2) {
            return response()->json([]);
        }

        $items = Cups::query()
            ->where('Nombre', 'like', "%{$q}%")
            ->orWhere('CodCupsHuv', 'like', "%{$q}%")
            ->orWhere('CodCupsHo', 'like', "%{$q}%")
            ->orderBy('Nombre')
            ->limit(20)
            ->get(['id', 'CodCupsHuv', 'CodCupsHo', 'Nombre', 'descrip_Normativa', 'tipofactor']);

        return response()->json($items);
    }

    /**
     * Crear asociaciones masivas: cada EPS seleccionada con cada CUPS seleccionado.
     */
    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'eps_ids' => ['required', 'array', 'min:1'],
            'eps_ids.*' => ['integer', 'exists:eps,id'],
            'cuvs_ids' => ['required', 'array', 'min:1'],
            'cuvs_ids.*' => ['integer', 'exists:cups,id'],
            'Estado' => ['required', 'boolean'],
            'Observacion' => ['nullable', 'string', 'max:300'],
        ], [], [
            'eps_ids' => 'EPS',
            'cuvs_ids' => 'CUPS',
        ]);

        $created = 0;
        $skipped = 0;

        foreach ($data['eps_ids'] as $epsId) {
            foreach ($data['cuvs_ids'] as $cupsId) {
                $assoc = CupsEps::firstOrNew([
                    'eps_id' => $epsId,
                    'cuvs_id' => $cupsId,
                ]);

                if ($assoc->exists) {
                    $skipped++;

                    continue;
                }

                $assoc->Estado = $data['Estado'];
                $assoc->Observacion = $data['Observacion'] ?? null;
                $assoc->save();
                $created++;
            }
        }

        $msg = "Asociaciones creadas: {$created}.";
        if ($skipped > 0) {
            $msg .= " Omitidas porque ya existían: {$skipped}.";
        }

        return to_route('tools.gestion-cups-eps')->with('success', $msg);
    }

    /**
     * Actualizar una asociación.
     */
    public function update(Request $request, CupsEps $cupsEps): RedirectResponse
    {
        $data = $request->validate([
            'eps_id' => [
                'required', 'integer', 'exists:eps,id',
                Rule::unique('cuvs_eps')
                    ->where(fn ($q) => $q->where('cuvs_id', $request->input('cuvs_id')))
                    ->ignore($cupsEps->id),
            ],
            'cuvs_id' => ['required', 'integer', 'exists:cups,id'],
            'Estado' => ['required', 'boolean'],
            'Observacion' => ['nullable', 'string', 'max:300'],
        ], [
            'eps_id.unique' => 'Esa EPS ya está asociada a este CUPS.',
        ]);

        $cupsEps->update($data);

        return to_route('tools.gestion-cups-eps')->with('success', 'Asociación actualizada correctamente.');
    }

    /**
     * Eliminar una asociación.
     */
    public function destroy(CupsEps $cupsEps): RedirectResponse
    {
        $cupsEps->delete();

        return to_route('tools.gestion-cups-eps')->with('success', 'Asociación eliminada correctamente.');
    }
}
