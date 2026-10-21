<?php

namespace App\Http\Controllers;

use App\Models\Eps;
use App\Models\Especialidad;
use App\Models\Permiso;
use App\Models\Role;
use App\Models\TipoDocumento;
use App\Models\User;
use Closure;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class UserManagementController extends Controller
{
    /** Columnas del listado y de la exportación a Excel. */
    private const COLUMNAS_LISTADO = [
        'id',
        'name',
        'Apellido1',
        'apellido2',
        'rol',
        'tipo_Docu',
        'Numero_D',
        'email',
        'Telefono1',
        'telefono2',
        'Direccion',
        'Eps',
        'codesp',
        'email_verified_at',
        'created_at',
    ];

    /**
     * Listado de usuarios.
     */
    public function index(Request $request): Response
    {
        $search = trim((string) $request->query('search', ''));
        $rol = trim((string) $request->query('rol', ''));
        $perPage = (int) $request->query('perPage', 12);
        if (! in_array($perPage, [12, 24, 36], true)) {
            $perPage = 12;
        }

        // Los usuarios Super Admin (y su rol) solo son visibles para otro Super
        // Admin. Para cualquier otro rol es como si no existieran.
        $viewerIsSuperAdmin = $request->user()?->isSuperAdmin() ?? false;

        $users = $this->usuariosFiltrados($request)
            ->paginate($perPage, self::COLUMNAS_LISTADO)
            ->withQueryString();

        return Inertia::render('tools/gestion-usuarios', [
            'users' => $users,
            'filters' => ['search' => $search, 'rol' => $rol, 'perPage' => $perPage],
            // Roles del filtro: todos los existentes (no solo los asignables),
            // para poder consultar a cualquier usuario visible.
            'rolesFiltro' => Role::query()
                ->when(! $viewerIsSuperAdmin, fn ($query) => $query->where('Nombre', '!=', User::SUPER_ADMIN))
                ->orderBy('Nombre')
                ->get(['id', 'Nombre']),
            'tiposDocumento' => TipoDocumento::query()
                ->where('Estado', true)
                ->orderBy('Nombre')
                ->get(['id', 'Nombre']),
            'rolesList' => Role::query()
                ->where('Estado', true)
                ->when(! $viewerIsSuperAdmin, fn ($query) => $query->where('Nombre', '!=', User::SUPER_ADMIN))
                // Roles asignables configurados en el Gestor de Permisos.
                ->when(
                    ($asignables = Permiso::rolesAsignablesPara($request->user())) !== null,
                    fn ($query) => $query->whereIn('Nombre', $asignables)
                )
                ->orderBy('Nombre')
                ->get(['id', 'Nombre']),
            'epsList' => Eps::query()
                ->orderBy('Nombre')
                ->get(['id', 'Nombre']),
            'especialidadesList' => Especialidad::query()
                ->where('Estado', true)
                ->whereNotNull('espcodser')
                ->orderBy('Nombre')
                ->get(['id', 'espcodser', 'Nombre']),
        ]);
    }

    /**
     * Todos los usuarios del filtro actual (búsqueda y rol), sin paginar.
     * La usa el botón Exportar a Excel.
     */
    public function exportar(Request $request): JsonResponse
    {
        return response()->json([
            'rows' => $this->usuariosFiltrados($request)->get(self::COLUMNAS_LISTADO),
        ]);
    }

    /**
     * Consulta de usuarios con los filtros del listado (?search= y ?rol=).
     */
    private function usuariosFiltrados(Request $request): Builder
    {
        $search = trim((string) $request->query('search', ''));
        $rol = trim((string) $request->query('rol', ''));
        $viewerIsSuperAdmin = $request->user()?->isSuperAdmin() ?? false;

        return User::query()
            ->when(! $viewerIsSuperAdmin, fn ($query) => $query->where('rol', '!=', User::SUPER_ADMIN))
            ->when($rol !== '', fn ($query) => $query->where('rol', $rol))
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($sub) use ($search) {
                    $sub->where('name', 'like', "%{$search}%")
                        ->orWhere('Apellido1', 'like', "%{$search}%")
                        ->orWhere('apellido2', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('Numero_D', 'like', "%{$search}%");
                });
            })
            ->orderByDesc('created_at');
    }

    /**
     * Crear un nuevo usuario.
     */
    public function store(Request $request): RedirectResponse
    {
        $viewerIsSuperAdmin = $request->user()?->isSuperAdmin() ?? false;
        $validated = $request->validate($this->rules(
            null,
            $viewerIsSuperAdmin,
            Permiso::rolesAsignablesPara($request->user()),
            $request,
        ));

        // Sin contraseña (médicos) el usuario queda sin acceso al sistema.
        $validated['password'] = ! empty($validated['password'])
            ? Hash::make($validated['password'])
            : null;
        // La especialidad solo aplica a médicos; en otros roles no se guarda.
        if (($validated['rol'] ?? null) !== 'Medico') {
            $validated['codesp'] = null;
        }

        $user = User::create($validated);
        if (! empty($user->email)) {
            $user->email_verified_at = now();
            $user->save();
        }

        return to_route('tools.gestion-usuarios')
            ->with('success', 'Usuario creado correctamente.');
    }

    /**
     * Actualizar un usuario existente.
     */
    public function update(Request $request, User $user): RedirectResponse
    {
        $viewerIsSuperAdmin = $request->user()?->isSuperAdmin() ?? false;

        // Para un no-Super-Admin, un usuario Super Admin no existe: 404.
        abort_if(! $viewerIsSuperAdmin && $user->isSuperAdmin(), 404);

        // El rol actual del usuario editado siempre es válido (permite guardar
        // sin cambiar el rol aunque no esté entre los asignables).
        $asignables = Permiso::rolesAsignablesPara($request->user());
        if ($asignables !== null && ! in_array($user->rol, $asignables, true)) {
            $asignables[] = $user->rol;
        }

        $validated = $request->validate($this->rules($user, $viewerIsSuperAdmin, $asignables, $request));

        if (! empty($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        } else {
            unset($validated['password']);
        }

        // La especialidad solo aplica a médicos; en otros roles se limpia.
        if (($validated['rol'] ?? null) !== 'Medico') {
            $validated['codesp'] = null;
        }

        $user->update($validated);

        return to_route('tools.gestion-usuarios')
            ->with('success', 'Usuario actualizado correctamente.');
    }

    /**
     * Eliminar un usuario.
     */
    public function destroy(Request $request, User $user): RedirectResponse
    {
        // Para un no-Super-Admin, un usuario Super Admin no existe: 404.
        abort_if(! ($request->user()?->isSuperAdmin() ?? false) && $user->isSuperAdmin(), 404);

        if ($request->user()->id === $user->id) {
            return to_route('tools.gestion-usuarios')
                ->with('error', 'No puedes eliminar tu propia cuenta.');
        }

        $user->delete();

        return to_route('tools.gestion-usuarios')
            ->with('success', 'Usuario eliminado correctamente.');
    }

    /**
     * Reglas de validación. El password es obligatorio al crear
     * y opcional al actualizar.
     *
     * @return array<string, mixed>
     */
    private function rules(
        ?User $user = null,
        bool $canAssignSuperAdmin = true,
        ?array $rolesPermitidos = null,
        ?Request $request = null,
    ): array {
        $rolRules = ['required', 'string', 'exists:roles,Nombre'];

        // Un no-Super-Admin no puede asignar el rol Super Admin (es como si no existiera).
        if (! $canAssignSuperAdmin) {
            $rolRules[] = Rule::notIn([User::SUPER_ADMIN]);
        }

        // Restricción de roles asignables del Gestor de Permisos.
        if ($rolesPermitidos !== null) {
            $rolRules[] = Rule::in($rolesPermitidos);
        }

        return [
            // Para no repetir usuarios: el nombre completo (nombres + apellidos)
            // no puede repetirse, sin importar mayúsculas ni espacios.
            'name' => [
                'required',
                'string',
                'max:255',
                function (string $attribute, mixed $value, Closure $fail) use ($request, $user) {
                    if ($this->nombreCompletoRepetido(
                        (string) $value,
                        (string) $request?->input('Apellido1', ''),
                        (string) $request?->input('apellido2', ''),
                        $user?->id,
                    )) {
                        $fail('Ya existe un usuario registrado con ese nombre y apellidos.');
                    }
                },
            ],
            'rol' => $rolRules,
            'Apellido1' => ['nullable', 'string', 'max:50'],
            'apellido2' => ['nullable', 'string', 'max:50'],
            'tipo_Docu' => ['nullable', 'string', 'max:120'],
            'Numero_D' => [
                'nullable',
                'string',
                'max:20',
                function (string $attribute, mixed $value, Closure $fail) use ($user) {
                    $repetido = User::query()
                        ->whereRaw('TRIM(Numero_D) = ?', [trim((string) $value)])
                        ->when($user, fn ($query) => $query->whereKeyNot($user->id))
                        ->exists();
                    if ($repetido) {
                        $fail('Ya existe un usuario registrado con ese número de documento.');
                    }
                },
            ],
            // El médico no inicia sesión: el correo es opcional para ese rol y
            // obligatorio para todos los demás, paciente incluido.
            'email' => [
                'required_unless:rol,Medico',
                'nullable',
                'string',
                'email',
                'max:255',
                // Sin importar mayúsculas: Ana@x.com y ana@x.com son el mismo correo.
                function (string $attribute, mixed $value, Closure $fail) use ($user) {
                    $repetido = User::query()
                        ->whereRaw('LOWER(TRIM(email)) = ?', [mb_strtolower(trim((string) $value))])
                        ->when($user, fn ($query) => $query->whereKeyNot($user->id))
                        ->exists();
                    if ($repetido) {
                        $fail('Ya existe un usuario registrado con ese correo electrónico.');
                    }
                },
            ],
            'Telefono1' => ['nullable', 'string', 'max:50'],
            'telefono2' => ['nullable', 'string', 'max:50'],
            'Direccion' => ['nullable', 'string', 'max:80'],
            'Eps' => ['nullable', 'string', 'max:120'],
            // La especialidad ya no se pide en el formulario; se conserva la
            // columna y se acepta si llega, pero nunca es obligatoria.
            'codesp' => [
                'nullable',
                'exclude_unless:rol,Medico',
                'string',
                'max:10',
                'exists:especialidad,espcodser',
            ],
            // Médico y paciente no inician sesión: no se les exige contraseña.
            'password' => $user
                ? ['nullable', 'confirmed', Password::defaults()]
                : ['required_unless:rol,Medico,paciente', 'nullable', 'confirmed', Password::defaults()],
        ];
    }

    /**
     * ¿Hay otro usuario con el mismo nombre completo? Se compara en minúsculas
     * y con los espacios normalizados, sobre el nombre completo y no campo a
     * campo: "Juan Carlos" + "Pérez" es lo mismo que "Juan" + "Carlos Pérez".
     */
    private function nombreCompletoRepetido(string $name, string $apellido1, string $apellido2, ?int $ignorarId): bool
    {
        $buscado = $this->normalizarNombre("{$name} {$apellido1} {$apellido2}");
        if ($buscado === '') {
            return false;
        }

        // Prefiltro en BD por la primera palabra (siempre va en el campo
        // nombres); la comparación exacta se hace en PHP.
        $primera = explode(' ', $buscado)[0];

        return User::query()
            ->where('name', 'like', "%{$primera}%")
            ->when($ignorarId, fn ($query) => $query->whereKeyNot($ignorarId))
            ->get(['id', 'name', 'Apellido1', 'apellido2'])
            ->contains(fn (User $otro) => $this->normalizarNombre(
                "{$otro->name} {$otro->Apellido1} {$otro->apellido2}"
            ) === $buscado);
    }

    private function normalizarNombre(string $nombre): string
    {
        return mb_strtolower(trim((string) preg_replace('/\s+/u', ' ', $nombre)));
    }
}
