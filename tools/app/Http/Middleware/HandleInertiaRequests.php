<?php

namespace App\Http\Middleware;

use App\Models\Permiso;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Inspiring;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        [$message, $author] = str(Inspiring::quotes()->random())->explode('-');

        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'quote' => ['message' => trim($message), 'author' => trim($author)],
            'auth' => [
                'user' => $request->user(),
                'permisos' => $this->permisosDelUsuario($request),
            ],
            'flash' => [
                'success' => $request->session()->get('success'),
                'error' => $request->session()->get('error'),
                'createdEspecialidad' => $request->session()->get('createdEspecialidad'),
                'casoRadicado' => $request->session()->get('casoRadicado'),
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
        ];
    }

    /**
     * Permisos configurados para el rol del usuario (vista => acciones).
     * El Super Admin no tiene restricciones (mapa vacío = todo permitido,
     * igual que una vista sin configurar).
     *
     * @return array<string, array<string, bool>>
     */
    private function permisosDelUsuario(Request $request): array
    {
        $user = $request->user();

        if (! $user || $user->rol === User::SUPER_ADMIN) {
            return [];
        }

        $role = Role::where('Nombre', $user->rol)->first();

        if (! $role) {
            return [];
        }

        return Permiso::where('role_id', $role->id)
            ->get()
            ->mapWithKeys(fn (Permiso $p) => [
                $p->vista => [
                    'ver' => $p->ver,
                    'crear' => $p->crear,
                    'editar' => $p->editar,
                    'borrar' => $p->borrar,
                ],
            ])
            ->all();
    }
}
