<?php

namespace App\Http\Controllers;

use App\Models\Eps;
use App\Models\Especialidad;
use App\Models\Permiso;
use App\Models\Role;
use App\Models\TipoDocumento;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class UserManagementController extends Controller
{
    /**
     * Listado de usuarios.
     */
    public function index(Request $request): Response
    {
        $search = trim((string) $request->query('search', ''));
        $perPage = (int) $request->query('perPage', 12);
        if (! in_array($perPage, [12, 24, 36], true)) {
            $perPage = 12;
        }

        // Los usuarios Super Admin (y su rol) solo son visibles para otro Super
        // Admin. Para cualquier otro rol es como si no existieran.
        $viewerIsSuperAdmin = $request->user()?->isSuperAdmin() ?? false;

        $users = User::query()
            ->when(! $viewerIsSuperAdmin, fn ($query) => $query->where('rol', '!=', User::SUPER_ADMIN))
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($sub) use ($search) {
                    $sub->where('name', 'like', "%{$search}%")
                        ->orWhere('Apellido1', 'like', "%{$search}%")
                        ->orWhere('apellido2', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('Numero_D', 'like', "%{$search}%");
                });
            })
            ->orderByDesc('created_at')
            ->paginate($perPage, [
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
            ])
            ->withQueryString();

        return Inertia::render('tools/gestion-usuarios', [
            'users' => $users,
            'filters' => ['search' => $search, 'perPage' => $perPage],
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
     * Crear un nuevo usuario.
     */
    public function store(Request $request): RedirectResponse
    {
        $viewerIsSuperAdmin = $request->user()?->isSuperAdmin() ?? false;
        $validated = $request->validate($this->rules(
            null,
            $viewerIsSuperAdmin,
            Permiso::rolesAsignablesPara($request->user()),
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

        $validated = $request->validate($this->rules($user, $viewerIsSuperAdmin, $asignables));

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
    private function rules(?User $user = null, bool $canAssignSuperAdmin = true, ?array $rolesPermitidos = null): array
    {
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
            'name' => ['required', 'string', 'max:255'],
            'rol' => $rolRules,
            'Apellido1' => ['nullable', 'string', 'max:50'],
            'apellido2' => ['nullable', 'string', 'max:50'],
            'tipo_Docu' => ['nullable', 'string', 'max:120'],
            'Numero_D' => ['nullable', 'string', 'max:20'],
            // El médico no inicia sesión: el correo es opcional para ese rol y
            // obligatorio para todos los demás, paciente incluido.
            'email' => [
                'required_unless:rol,Medico',
                'nullable',
                'string',
                'email',
                'max:255',
                Rule::unique('users', 'email')->ignore($user?->id),
            ],
            'Telefono1' => ['nullable', 'string', 'max:50'],
            'telefono2' => ['nullable', 'string', 'max:50'],
            'Direccion' => ['nullable', 'string', 'max:80'],
            'Eps' => ['nullable', 'string', 'max:120'],
            // Especialidad del médico: obligatoria solo cuando el rol es "Medico".
            'codesp' => [
                'nullable',
                'exclude_unless:rol,Medico',
                'required_if:rol,Medico',
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
}
