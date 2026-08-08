<?php

namespace App\Http\Controllers;

use App\Models\Auditoria;
use App\Models\Role;
use App\Models\User;
use App\Support\DescriptorAuditoria;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AuditoriaController extends Controller
{
    /**
     * Módulos que agrupan la actividad. Se declaran aquí para que el Gestor
     * de Permisos pueda ofrecerlos aunque todavía no haya registros de
     * alguno: si se leyeran de la tabla, un módulo sin actividad no se podría
     * configurar.
     */
    public const MODULOS = [
        'Sesión',
        'Radicaciones',
        'Usuarios',
        'Roles y permisos',
        'Catálogos',
    ];

    /** Eventos que pueden filtrarse, con su nombre para la interfaz. */
    public const EVENTOS = [
        'sesion_inicio' => 'Inicio de sesión',
        'sesion_fin' => 'Cierre de sesión',
        'sesion_fallida' => 'Ingreso fallido',
        'creacion' => 'Creación',
        'modificacion' => 'Modificación',
        'eliminacion' => 'Eliminación',
    ];

    /**
     * Bitácora de actividad del sistema.
     */
    public function index(Request $request): Response
    {
        $search = trim((string) $request->query('search', ''));
        $evento = trim((string) $request->query('evento', ''));
        $modulo = trim((string) $request->query('modulo', ''));
        $rol = trim((string) $request->query('rol', ''));
        $desde = trim((string) $request->query('desde', ''));
        $hasta = trim((string) $request->query('hasta', ''));

        $perPage = (int) $request->query('perPage', 25);
        if (! in_array($perPage, [25, 50, 100], true)) {
            $perPage = 25;
        }

        $query = Auditoria::query();

        // Restricciones configuradas para el rol de quien consulta.
        $this->limitarPorConfiguracionDelRol($query, $request);

        $query
            ->when($search !== '', function ($q) use ($search) {
                // Nombre, cuenta o el detalle de lo que hizo.
                $q->where(function ($sub) use ($search) {
                    $sub->where('usuario', 'like', "%{$search}%")
                        ->orWhere('cuenta', 'like', "%{$search}%")
                        ->orWhere('descripcion', 'like', "%{$search}%")
                        ->orWhere('registro_id', 'like', "%{$search}%");
                });
            })
            ->when($evento !== '', fn ($q) => $q->where('evento', $evento))
            ->when($modulo !== '', fn ($q) => $q->where('modulo', $modulo))
            ->when($rol !== '', fn ($q) => $q->where('rol', $rol))
            ->when($desde !== '', fn ($q) => $q->whereDate('created_at', '>=', $desde))
            ->when($hasta !== '', fn ($q) => $q->whereDate('created_at', '<=', $hasta));

        $registros = $query
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate($perPage)
            ->withQueryString()
            ->through(fn (Auditoria $a) => [
                'id' => $a->id,
                'usuario' => $a->usuario ?? '—',
                'cuenta' => $a->cuenta ?? '—',
                'rol' => $a->rol ?? '—',
                'fecha' => optional($a->created_at)->format('Y-m-d'),
                'hora' => optional($a->created_at)->format('H:i:s'),
                'ip' => $a->ip ?? '—',
                'evento' => self::EVENTOS[$a->evento] ?? $a->evento,
                'eventoClave' => $a->evento,
                'modulo' => $a->modulo ?? '—',
                'descripcion' => $a->descripcion,
                'registro' => $a->registro_tipo
                    ? DescriptorAuditoria::etiquetaCampo($a->registro_tipo).' '.$a->registro_id
                    : '—',
                'cambios' => $a->cambios,
                'navegador' => $a->navegador,
            ]);

        return Inertia::render('tools/herramientas-seguimiento', [
            'registros' => $registros,
            'filters' => [
                'search' => $search,
                'evento' => $evento,
                'modulo' => $modulo,
                'rol' => $rol,
                'desde' => $desde,
                'hasta' => $hasta,
                'perPage' => $perPage,
            ],
            'eventos' => collect(self::EVENTOS)
                ->map(fn ($label, $key) => ['key' => $key, 'label' => $label])
                ->values(),
            'modulos' => $this->modulosVisibles($request),
            'roles' => $this->rolesVisibles($request),
            'stats' => $this->estadisticas($request),
        ]);
    }

    /**
     * Aplica lo configurado en el Gestor de Permisos: de qué roles y de qué
     * módulos puede ver actividad quien consulta. Sin configuración, ve todo.
     *
     * @param  \Illuminate\Database\Eloquent\Builder<Auditoria>  $query
     */
    private function limitarPorConfiguracionDelRol($query, Request $request): void
    {
        $user = $request->user();

        if (! $user || $user->isSuperAdmin()) {
            return;
        }

        $role = Role::where('Nombre', $user->rol)->first();

        if (! $role) {
            return;
        }

        $roles = $role->auditoriaRoles()->pluck('roles.Nombre');
        if ($roles->isNotEmpty()) {
            $query->whereIn('rol', $roles->all());
        }

        $modulos = $this->modulosConfigurados($role);
        if ($modulos !== []) {
            $query->whereIn('modulo', $modulos);
        }
    }

    /**
     * Módulos configurados para un rol.
     *
     * @return array<int, string>
     */
    private function modulosConfigurados(Role $role): array
    {
        return \Illuminate\Support\Facades\DB::table('role_auditoria_modulos')
            ->where('role_id', $role->id)
            ->pluck('modulo')
            ->all();
    }

    /**
     * Módulos que ofrece el filtro, ya recortados por la configuración.
     *
     * @return array<int, string>
     */
    private function modulosVisibles(Request $request): array
    {
        $todos = Auditoria::query()
            ->whereNotNull('modulo')
            ->distinct()
            ->orderBy('modulo')
            ->pluck('modulo')
            ->all();

        $user = $request->user();
        if (! $user || $user->isSuperAdmin()) {
            return $todos;
        }

        $role = Role::where('Nombre', $user->rol)->first();
        $configurados = $role ? $this->modulosConfigurados($role) : [];

        return $configurados === []
            ? $todos
            : array_values(array_intersect($todos, $configurados));
    }

    /**
     * Roles que ofrece el filtro, ya recortados por la configuración.
     *
     * @return array<int, string>
     */
    private function rolesVisibles(Request $request): array
    {
        $user = $request->user();

        // La actividad del Super Admin no se registra, así que su rol tampoco
        // se ofrece como filtro.
        $todos = Role::where('Nombre', '!=', User::SUPER_ADMIN)
            ->orderBy('Nombre')
            ->pluck('Nombre')
            ->all();

        if (! $user || $user->isSuperAdmin()) {
            return $todos;
        }

        $role = Role::where('Nombre', $user->rol)->first();
        $configurados = $role ? $role->auditoriaRoles()->pluck('roles.Nombre')->all() : [];

        return $configurados === []
            ? $todos
            : array_values(array_intersect($todos, $configurados));
    }

    /**
     * Resumen de la actividad visible para quien consulta.
     *
     * @return array<string, int>
     */
    private function estadisticas(Request $request): array
    {
        $base = fn () => tap(Auditoria::query(), fn ($q) => $this->limitarPorConfiguracionDelRol($q, $request));

        return [
            'total' => $base()->count(),
            'hoy' => $base()->whereDate('created_at', now()->toDateString())->count(),
            'sesiones' => $base()->where('evento', 'sesion_inicio')->count(),
            'usuarios' => $base()->distinct()->count('user_id'),
        ];
    }
}
