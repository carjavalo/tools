<?php

namespace App\Http\Controllers;

use App\Models\Eps;
use App\Models\Especialidad;
use App\Models\Permiso;
use App\Models\Role;
use App\Models\TipoDocumento;
use App\Models\User;
use App\Support\EmparejadorEps;
use App\Support\MenuUsuario;
use Closure;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class UserManagementController extends Controller
{
    /** Filas del Censo Hospitalario que se procesan por petición. */
    public const LOTE_CENSO = 100;

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

        // Filtro "Usuarios por rol": cuántos usuarios hay por rol. Solo se
        // calcula si el rol tiene asignada la opción en el Gestor de Permisos
        // (el Super Admin siempre). Respeta la invisibilidad del Super Admin.
        $conteoRoles = null;
        if ($this->puedeVerVista($request->user(), 'gestion-usuarios-conteo-roles')) {
            $conteoRoles = User::query()
                ->when(! $viewerIsSuperAdmin, fn ($query) => $query->where('rol', '!=', User::SUPER_ADMIN))
                ->selectRaw('rol, COUNT(*) as total')
                ->groupBy('rol')
                ->orderByDesc('total')
                ->get()
                ->map(fn ($fila) => ['rol' => $fila->rol ?: 'paciente', 'total' => (int) $fila->total])
                ->values();
        }

        return Inertia::render('tools/gestion-usuarios', [
            'users' => $users,
            'filters' => ['search' => $search, 'rol' => $rol, 'perPage' => $perPage],
            // Conteo de usuarios por rol (null cuando el rol no tiene la opción).
            'conteoRoles' => $conteoRoles,
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
     * Importa un lote de pacientes del Censo Hospitalario.
     *
     * El navegador lee el Excel (hojas Hospitalización, Urgencias, Extensión
     * y Egresados) y manda en lotes las columnas Nombre, Identificación,
     * Documento y Responsable; las reglas de negocio se aplican aquí:
     *  - "HUV EVARISTO" no es un paciente y se omite, igual que la fila sin
     *    nombre o sin documento.
     *  - Nombre: 1.ª palabra → Apellido1, 2.ª → apellido2, el resto → name.
     *  - rol paciente, email {documento}@notiene.com y contraseña = documento.
     *  - Responsable → la EPS de la tabla eps que le corresponde aunque esté
     *    escrita distinto (EmparejadorEps): la radicación busca la EPS por su
     *    nombre exacto. Sin coincidencia se guarda el texto del archivo.
     *  - El paciente cuyo documento (o correo) ya está en users se ignora, así
     *    que el censo se puede cargar a diario sin duplicar a nadie. Solo se le
     *    corrige la EPS cuando la que tiene no está en la tabla y el archivo
     *    trae una que sí: así quedan vinculados los cargados antes.
     */
    public function importarCenso(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'filas' => ['required', 'array', 'max:'.self::LOTE_CENSO],
            'filas.*.nombre' => ['nullable', 'string', 'max:1000'],
            'filas.*.identificacion' => ['nullable', 'string', 'max:1000'],
            'filas.*.documento' => ['nullable', 'string', 'max:1000'],
            'filas.*.responsable' => ['nullable', 'string', 'max:1000'],
        ]);

        $resumen = [
            'creados' => 0,
            'existentes' => 0,
            'omitidos' => 0,
            // Pacientes ya registrados a los que se les vinculó la EPS.
            'epsCorregidas' => 0,
            // Responsable sin EPS equivalente en la tabla.
            'epsSinVincular' => 0,
        ];

        // Resultado de cada fila, en el mismo orden del lote: con él el
        // navegador exporta a Excel cuáles se crearon, cuáles ya existían y
        // cuáles se omitieron.
        $resultados = [];

        // Filas válidas del lote, una por documento.
        $pacientes = [];
        foreach ($validated['filas'] as $i => $fila) {
            $nombre = $this->normalizarEspacios((string) ($fila['nombre'] ?? ''));
            $documento = trim((string) ($fila['documento'] ?? ''));

            $motivo = match (true) {
                $nombre === '' => 'Sin nombre',
                mb_strtolower($nombre) === 'huv evaristo' => 'HUV EVARISTO',
                $documento === '' => 'Sin documento',
                mb_strlen($documento) > 20 => 'Documento de más de 20 caracteres',
                default => null,
            };

            if ($motivo !== null) {
                $resumen['omitidos']++;
                $resultados[$i] = ['estado' => 'omitido', 'motivo' => $motivo];

                continue;
            }

            if (isset($pacientes[$documento])) {
                $resumen['existentes']++;
                $resultados[$i] = ['estado' => 'existente', 'motivo' => 'Repetido en el archivo'];

                continue;
            }

            $pacientes[$documento] = [
                'indice' => $i,
                'nombre' => $nombre,
                'tipo' => trim((string) ($fila['identificacion'] ?? '')),
                'eps' => trim((string) ($fila['responsable'] ?? '')),
            ];
        }

        if ($pacientes !== []) {
            $documentos = array_map('strval', array_keys($pacientes));
            $correos = array_map(fn ($d) => mb_strtolower("{$d}@notiene.com"), $documentos);

            // Usuarios que ya tienen el documento o el correo, para decir a
            // quién pertenecen en la exportación.
            $existentes = User::query()
                ->whereIn(DB::raw('TRIM(Numero_D)'), $documentos)
                ->orWhereIn(DB::raw('LOWER(email)'), $correos)
                ->get(['id', 'name', 'Apellido1', 'apellido2', 'rol', 'Numero_D', 'email', 'Eps']);
            $emparejador = new EmparejadorEps;
            $porDocumento = $existentes->keyBy(fn (User $u) => trim((string) $u->Numero_D));
            $porCorreo = $existentes->keyBy(fn (User $u) => mb_strtolower((string) $u->email));

            // Un Super Admin no existe para quien no lo es: no se revela su nombre.
            $viewerIsSuperAdmin = $request->user()?->isSuperAdmin() ?? false;
            $registradoComo = fn (User $u) => ! $viewerIsSuperAdmin && $u->isSuperAdmin()
                ? ['registrado' => 'Usuario del sistema', 'rol' => null]
                : ['registrado' => trim("{$u->name} {$u->Apellido1} {$u->apellido2}"), 'rol' => $u->rol];

            // La contraseña es el propio documento, así que un costo de bcrypt
            // alto no la protege más y solo hace lenta la primera carga (miles
            // de pacientes). Laravel la vuelve a cifrar con el costo normal si
            // el paciente llega a iniciar sesión.
            $costo = min(10, (int) config('hashing.bcrypt.rounds', 12));

            foreach ($pacientes as $documento => $p) {
                $documento = (string) $documento;
                $email = "{$documento}@notiene.com";

                $existente = $porDocumento->get($documento);
                $motivo = 'Documento ya registrado';
                if (! $existente) {
                    $existente = $porCorreo->get(mb_strtolower($email));
                    $motivo = 'Correo ya registrado';
                }

                $epsTabla = $emparejador->buscar($p['eps']);

                if ($existente) {
                    $resumen['existentes']++;
                    $resultado = ['estado' => 'existente', 'motivo' => $motivo, ...$registradoComo($existente)];

                    // Solo la EPS, solo de un paciente con ese documento y
                    // solo si la que tiene no está en la tabla: nunca se pisa
                    // una EPS ya vinculada ni se toca a otro tipo de usuario.
                    if ($motivo === 'Documento ya registrado'
                        && MenuUsuario::esPaciente($existente->rol)
                        && $epsTabla !== null
                        && ! $emparejador->esDeLaTabla($existente->Eps)) {
                        $resultado['epsCorregida'] = ['anterior' => $existente->Eps, 'nueva' => $epsTabla];
                        $existente->update(['Eps' => $epsTabla]);
                        $resumen['epsCorregidas']++;
                    }

                    $resultados[$p['indice']] = $resultado;

                    continue;
                }

                [$apellido1, $apellido2, $name] = $this->partirNombreCenso($p['nombre']);

                $usuario = User::create([
                    'name' => mb_substr($name, 0, 255),
                    'Apellido1' => $apellido1 !== null ? mb_substr($apellido1, 0, 50) : null,
                    'apellido2' => $apellido2 !== null ? mb_substr($apellido2, 0, 50) : null,
                    'tipo_Docu' => $p['tipo'] !== '' ? mb_substr($p['tipo'], 0, 120) : null,
                    'Numero_D' => $documento,
                    // La EPS de la tabla; sin equivalente, el texto del archivo.
                    'Eps' => $epsTabla ?? ($p['eps'] !== '' ? mb_substr($p['eps'], 0, 120) : null),
                    'rol' => 'paciente',
                    'email' => $email,
                    'password' => Hash::make($documento, ['rounds' => $costo]),
                ]);
                $resumen['creados']++;
                $sinVincular = $epsTabla === null && $p['eps'] !== '';
                if ($sinVincular) {
                    $resumen['epsSinVincular']++;
                }
                $resultados[$p['indice']] = [
                    'estado' => 'creado',
                    'usuario' => $usuario->only(['id', 'Apellido1', 'apellido2', 'name', 'tipo_Docu', 'Numero_D', 'Eps', 'email']),
                    // Responsable tal como venía y si quedó vinculado a la tabla.
                    'responsable' => $p['eps'],
                    'epsVinculada' => ! $sinVincular,
                ];
            }
        }

        ksort($resultados);

        return response()->json([...$resumen, 'resultados' => array_values($resultados)]);
    }

    /**
     * Reparte el Nombre del censo: 1.ª palabra → Apellido1, 2.ª → apellido2,
     * de la 3.ª en adelante → name. Con solo dos palabras ("BONILLA AMPARO")
     * son apellido y nombre; con una sola, va al nombre (name es obligatorio).
     *
     * @return array{0: ?string, 1: ?string, 2: string}
     */
    private function partirNombreCenso(string $nombre): array
    {
        $palabras = explode(' ', $nombre);

        return match (count($palabras)) {
            1 => [null, null, $palabras[0]],
            2 => [$palabras[0], null, $palabras[1]],
            default => [$palabras[0], $palabras[1], implode(' ', array_slice($palabras, 2))],
        };
    }

    private function normalizarEspacios(string $texto): string
    {
        return trim((string) preg_replace('/\s+/u', ' ', $texto));
    }

    /**
     * ¿El rol del usuario puede ver la opción (sub-vista) indicada? El Super
     * Admin siempre; el resto, solo con la fila guardada y "ver" en true.
     */
    private function puedeVerVista(?User $user, string $vista): bool
    {
        if ($user?->isSuperAdmin() ?? false) {
            return true;
        }

        $role = Role::where('Nombre', $user?->rol)->first();

        return $role !== null
            && (bool) Permiso::where('role_id', $role->id)
                ->where('vista', $vista)
                ->value('ver');
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
            // Se busca palabra por palabra: nombre y apellidos están en campos
            // distintos, así que "MARIA CAMILA PEREZ" completo no coincide con
            // ninguno. Cada palabra debe aparecer en alguno de los campos.
            ->when($search !== '', function ($query) use ($search) {
                foreach (preg_split('/\s+/u', $search, -1, PREG_SPLIT_NO_EMPTY) as $palabra) {
                    $like = '%'.addcslashes($palabra, '\\%_').'%';
                    $query->where(function ($sub) use ($like) {
                        $sub->where('name', 'like', $like)
                            ->orWhere('Apellido1', 'like', $like)
                            ->orWhere('apellido2', 'like', $like)
                            ->orWhere('email', 'like', $like)
                            ->orWhere('Numero_D', 'like', $like);
                    });
                }
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

        // Gestor de Permisos (menú de usuario): sin "Cambiar cuenta" o sin
        // "Cambiar contraseña", esa acción solo vale sobre pacientes.
        $rolNuevo = $request->filled('rol') ? (string) $request->input('rol') : null;
        if (! MenuUsuario::permiteSobre($request->user(), $user, MenuUsuario::PERFIL, $rolNuevo)) {
            return to_route('tools.gestion-usuarios')
                ->with('error', 'Tu rol no tiene permitido cambiar la cuenta de este usuario: solo puedes editar pacientes.');
        }
        if ($request->filled('password')
            && ! MenuUsuario::permiteSobre($request->user(), $user, MenuUsuario::PASSWORD, $rolNuevo)) {
            throw ValidationException::withMessages([
                'password' => 'Tu rol no tiene permitido cambiar contraseñas: solo puedes hacerlo con pacientes.',
            ]);
        }

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

        // Sin "Eliminar cuenta" en el Gestor de Permisos, solo pacientes.
        if (! MenuUsuario::permiteSobre($request->user(), $user, MenuUsuario::ELIMINAR)) {
            return to_route('tools.gestion-usuarios')
                ->with('error', 'Tu rol no tiene permitido eliminar cuentas: solo puedes eliminar pacientes.');
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
