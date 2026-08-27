<?php

namespace App\Http\Controllers;

use App\Models\Convenio;
use App\Models\CotizacionCaso;
use App\Models\Cups;
use App\Models\CupsAnezado;
use App\Models\Eps;
use App\Models\Especialidad;
use App\Models\EstRadicado;
use App\Models\EstRadisecundario;
use App\Models\Motivo;
use App\Models\Permiso;
use App\Models\RadicarCaso;
use App\Models\Role;
use App\Models\SeguimientoCaso;
use App\Models\SubEspecialidad;
use App\Models\TipoDocumento;
use App\Models\TrazabilidadCaso;
use App\Models\User;
use App\Support\Almacenamiento;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class RadicarCasoController extends Controller
{
    /**
     * Campos de la radicación cuyos cambios se registran en la bitácora, con
     * el nombre que llevan en la vista. Lo que no esté aquí (timestamps) no
     * genera registro.
     */
    /** Radicaciones que como máximo entran a un informe. */
    private const TOPE_CASOS_INFORME = 2000;

    /** Filas de trazabilidad que como máximo entran a un informe. */
    private const TOPE_FILAS_INFORME = 5000;

    private const CAMPOS_TRAZABLES = [
        'Codesp' => 'Especialidad',
        'codsubesp' => 'Subespecialidad',
        'codMed' => 'Médico',
        'Ndocumento' => 'Identificación del paciente',
        'convenio' => 'Convenio',
        'copago' => 'Copago',
        'valor_copago' => 'Valor del copago',
        'paquete' => 'Paquete (PDF)',
        'maos' => 'MAOS',
        'estRad' => 'Estado Actual',
        'fentregapro' => 'Entrega al Serv',
        'codestsecundario' => 'Estado QX',
        'fecreci' => 'Fecha Recibido Serv',
        'estcod' => 'Motivo',
        'fecAutorizacion' => 'Fecha Autorización',
        'fechavenautorizacion' => 'Fecha Vencimiento Autorización',
        'ObservacionTFX' => 'OB TFX',
        'ObservacionCCX' => 'Observación CCX',
        'venc_anestesia' => 'Vencimiento Anestesia',
    ];

    /**
     * Vista de radicación de casos. Carga los catálogos para los selects.
     */
    public function index(Request $request): Response
    {
        // Los estados que se muestran dependen del rol del usuario: cada rol solo
        // ve los estados que tenga asignados en "Gestión de Roles". El rol
        // "Super Admin" no se filtra (ve todos los estados existentes).
        [$estados, $estadosSecundarios] = $this->estadosParaUsuario($request);

        $defaultEstadoId = optional(
            $estados->first(fn ($estado) => strtolower($estado->Nombre) === 'recibido')
        )->id;

        return Inertia::render('tools/radicar-solicitud', [
            'especialidades' => Especialidad::orderBy('Nombre')->get(['id', 'espcodser', 'Nombre']),
            'subespecialidades' => SubEspecialidad::orderBy('Nombre')
                ->get(['id', 'cod_SubEspecialidad', 'Nombre', 'codespcodser']),
            'medicos' => User::where('rol', 'Medico')->orderBy('name')
                ->get(['id', 'name', 'Apellido1', 'apellido2']),
            'estados' => $estados,
            'estadosSecundarios' => $estadosSecundarios,
            'tiposDocumento' => TipoDocumento::where('Estado', true)
                ->orderBy('Nombre')->get(['id', 'Nombre']),
            'epsList' => Eps::orderBy('Nombre')->get(['id', 'Nombre']),
            'rolesList' => Role::where('Estado', true)
                ->when(
                    ! ($request->user()?->isSuperAdmin() ?? false),
                    fn ($query) => $query->where('Nombre', '!=', User::SUPER_ADMIN)
                )
                // Roles asignables configurados en el Gestor de Permisos.
                ->when(
                    ($asignables = Permiso::rolesAsignablesPara($request->user())) !== null,
                    fn ($query) => $query->whereIn('Nombre', $asignables)
                )
                ->orderBy('Nombre')->get(['id', 'Nombre']),
            // Catálogos para los filtros de INFORMES: solo lo que existe en casos.
            'especialidadesFiltro' => Especialidad::whereIn(
                'espcodser',
                RadicarCaso::query()->whereNotNull('Codesp')
                    ->where('Codesp', '!=', '')->distinct()->pluck('Codesp')
            )->orderBy('Nombre')->get(['espcodser', 'Nombre']),
            'subespecialidadesFiltro' => SubEspecialidad::whereIn(
                'cod_SubEspecialidad',
                RadicarCaso::query()->whereNotNull('codsubesp')
                    ->where('codsubesp', '!=', '')->distinct()->pluck('codsubesp')
            )->orderBy('Nombre')->get(['cod_SubEspecialidad', 'Nombre', 'codespcodser']),
            'defaultEstadoId' => $defaultEstadoId,
            'today' => now()->toDateString(),
            // Formulario de cotizaciones: administrable por rol en el Gestor de
            // Permisos (sub-vista radicar-solicitud-cotizaciones).
            'puedeGestionarCotizaciones' => $this->puedeGestionarCotizaciones($request),
            // Grilla de radicaciones: administrable por rol en el Gestor de
            // Permisos (sub-vista radicar-solicitud-grilla).
            'muestraGrillaCasos' => $this->muestraGrillaCasos($request),
            'casosLista' => $this->muestraGrillaCasos($request)
                ? $this->listaCasos($request)
                : [],
        ]);
    }

    /**
     * ¿El usuario ve la grilla de radicaciones del Historial? Si su rol tiene
     * configurada la sub-vista en el Gestor de Permisos, esa configuración
     * manda; sin configurar, la ven Gestor Contratación y Super Admin.
     */
    private function muestraGrillaCasos(Request $request): bool
    {
        $user = $request->user();

        if (! $user) {
            return false;
        }

        if ($user->rol === User::SUPER_ADMIN) {
            return true;
        }

        $role = Role::where('Nombre', $user->rol)->first();
        if ($role) {
            $permiso = Permiso::where('role_id', $role->id)
                ->where('vista', 'radicar-solicitud-grilla')
                ->first();

            if ($permiso) {
                return (bool) $permiso->ver;
            }
        }

        return $user->rol === 'Gestor Contratación';
    }

    /**
     * ¿El usuario activo puede gestionar las cotizaciones de conceptos no
     * convenidos? Si su rol tiene configurada la sub-vista en el Gestor de
     * Permisos, esa configuración manda; sin configurar, la ven Gestor
     * Contratación y Super Admin.
     */
    private function puedeGestionarCotizaciones(Request $request): bool
    {
        $user = $request->user();

        if (! $user) {
            return false;
        }

        if ($user->rol === User::SUPER_ADMIN) {
            return true;
        }

        $role = Role::where('Nombre', $user->rol)->first();
        if ($role) {
            $permiso = Permiso::where('role_id', $role->id)
                ->where('vista', 'radicar-solicitud-cotizaciones')
                ->first();

            if ($permiso) {
                return (bool) $permiso->ver;
            }
        }

        return $user->rol === 'Gestor Contratación';
    }

    /**
     * Restringe una consulta de radicaciones a los estados que el rol tiene
     * autorizados en el Gestor de Permisos. Sin configuración, o siendo Super
     * Admin, no limita nada.
     *
     * Solo se filtra por el ESTADO ACTUAL. El estado secundario no interviene:
     * ese campo tiene otras funciones todavía por definir y no se diligencia
     * al radicar, así que filtrar por él dejaba la grilla vacía. Su
     * configuración se conserva en role_estados_sec_grilla para cuando se
     * establezca su uso.
     *
     * Lo usan por igual la grilla del Historial y la pestaña de Informes: un
     * rol ve las mismas radicaciones en los dos lados.
     *
     * @param  \Illuminate\Database\Eloquent\Builder<RadicarCaso>  $query
     */
    private function limitarPorEstadosDelRol($query, Request $request): void
    {
        $user = $request->user();

        if (! $user || $user->rol === User::SUPER_ADMIN) {
            return;
        }

        $role = Role::where('Nombre', $user->rol)->first();

        $estadoIds = $role
            ? $role->estadosGrilla()->pluck('EstRadicado.id')
            : collect();

        if ($estadoIds->isNotEmpty()) {
            $query->whereIn(
                'estRad',
                $estadoIds->map(fn ($id) => (string) $id)->all(),
            );
        }
    }

    /**
     * Grilla de radicaciones del Historial (las más recientes). Las
     * radicaciones se filtran por los estados de grilla configurados para el
     * rol en el Gestor de Permisos: con estados configurados solo ve los
     * casos en esos estados; sin configuración (o Super Admin), los ve todos.
     * Solo interviene el estado actual; el estado secundario no filtra.
     *
     * @return array<int, array<string, mixed>>
     */
    private function listaCasos(Request $request): array
    {
        $query = RadicarCaso::orderByDesc('codrad');
        $this->limitarPorEstadosDelRol($query, $request);

        $casos = $query->limit(200)
            ->get(['codrad', 'Ndocumento', 'estRad', 'convenio', 'created_at']);

        $pacientes = User::whereIn('Numero_D', $casos->pluck('Ndocumento')->filter())
            ->get(['Numero_D', 'name', 'Apellido1', 'apellido2', 'tipo_Docu', 'Eps'])
            ->keyBy('Numero_D');
        $estados = EstRadicado::pluck('Nombre', 'id');
        $convenios = Convenio::pluck('nombre', 'nit_Convenio');

        return $casos->map(function ($caso) use ($pacientes, $estados, $convenios) {
            $p = $pacientes->get($caso->Ndocumento);

            return [
                'codrad' => $caso->codrad,
                'fecha' => optional($caso->created_at)->format('Y-m-d'),
                'paciente' => $p
                    ? trim(implode(' ', array_filter([$p->name, $p->Apellido1, $p->apellido2])))
                    : '—',
                'documento' => $caso->Ndocumento,
                'eps' => $p?->Eps ?? '—',
                'convenio' => $caso->convenio
                    ? ($convenios[$caso->convenio] ?? $caso->convenio)
                    : '—',
                'estado' => $estados[(int) $caso->estRad] ?? '—',
            ];
        })->values()->all();
    }

    /**
     * Devuelve los estados primario y secundario visibles para el usuario actual
     * según su rol. "Super Admin" ve todos; cualquier otro rol solo ve los
     * estados que tenga asignados (lista vacía si no tiene ninguno).
     *
     * @return array{0: \Illuminate\Support\Collection, 1: \Illuminate\Support\Collection}
     */
    private function estadosParaUsuario(Request $request): array
    {
        $user = $request->user();

        if ($user && $user->isSuperAdmin()) {
            return [
                EstRadicado::orderBy('Nombre')->get(['id', 'Nombre']),
                EstRadisecundario::orderBy('Nombre')->get(['id', 'Nombre']),
            ];
        }

        $role = $user ? Role::where('Nombre', $user->rol)->first() : null;

        $primaryIds = $role ? $role->estadosRadicado()->pluck('EstRadicado.id') : collect();
        $secondaryIds = $role ? $role->estadosSecundarios()->pluck('EstRadisecundario.id') : collect();

        return [
            EstRadicado::whereIn('id', $primaryIds)->orderBy('Nombre')->get(['id', 'Nombre']),
            EstRadisecundario::whereIn('id', $secondaryIds)->orderBy('Nombre')->get(['id', 'Nombre']),
        ];
    }

    /**
     * Búsqueda de CUPS (por código o nombre) para el bloque de procedimientos.
     * Consulta directamente la tabla cups (solo activos).
     */
    public function buscarCups(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));

        if (mb_strlen($q) < 2) {
            return response()->json(['cups' => []]);
        }

        $cups = Cups::where('Estado', true)
            ->where(function ($query) use ($q) {
                $query->where('CodCupsHuv', 'like', "%{$q}%")
                    ->orWhere('CodCupsHo', 'like', "%{$q}%")
                    ->orWhere('Nombre', 'like', "%{$q}%")
                    ->orWhere('descrip_Normativa', 'like', "%{$q}%");
            })
            ->orderBy('CodCupsHuv')
            ->limit(50)
            ->get(['id', 'CodCupsHuv', 'Nombre', 'descrip_Normativa', 'tipofactor']);

        return response()->json(['cups' => $cups]);
    }

    /**
     * Búsqueda automática del paciente por número de documento en la tabla users.
     */
    public function buscarPaciente(Request $request): JsonResponse
    {
        $documento = trim((string) $request->query('documento', ''));

        if ($documento === '') {
            return response()->json(['found' => false]);
        }

        $user = User::where('Numero_D', $documento)->first();

        if (! $user) {
            return response()->json(['found' => false]);
        }

        return response()->json($this->pacientePayload($user));
    }

    /**
     * Crear un paciente (usuario) sin salir de la radicación y devolver sus datos.
     */
    public function crearPaciente(Request $request): JsonResponse
    {
        $rolRules = ['required', 'string', 'exists:roles,Nombre'];
        if (($asignables = Permiso::rolesAsignablesPara($request->user())) !== null) {
            $rolRules[] = Rule::in($asignables);
        }

        $validated = $request->validate([
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
                Rule::unique('users', 'email'),
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
            'password' => ['required_unless:rol,Medico,paciente', 'nullable', 'confirmed', Password::defaults()],
        ]);

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

        return response()->json($this->pacientePayload($user));
    }

    /**
     * Crear una especialidad desde el botón + del campo Especialidad de la
     * radicación, sin salir de la vista.
     *
     * El código de servicio (espcodser) es obligatorio aquí porque es la llave
     * que guarda el caso en RadicarCaso.Codesp y lo que lista el combobox: una
     * especialidad sin ese código no se podría seleccionar.
     */
    public function crearEspecialidad(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'espcodser' => [
                'required',
                'string',
                'max:10',
                Rule::unique('especialidad', 'espcodser'),
            ],
            'codminsal' => ['nullable', 'string', 'max:10'],
            'Nombre' => ['required', 'string', 'max:120'],
            'Observacion' => ['nullable', 'string', 'max:300'],
        ], [
            'espcodser.unique' => 'Ya existe una especialidad con ese código Servinte.',
        ], [
            'espcodser' => 'código Servinte',
            'codminsal' => 'código MinSalud',
            'Nombre' => 'nombre',
            'Observacion' => 'observación',
        ]);

        $especialidad = Especialidad::create($validated + ['Estado' => true]);

        return response()->json([
            'found' => true,
            'especialidad' => [
                'id' => $especialidad->id,
                'espcodser' => $especialidad->espcodser,
                'Nombre' => $especialidad->Nombre,
            ],
        ]);
    }

    /**
     * Devolver los datos editables de un paciente existente (buscado por documento)
     * para precargar el modal de edición desde la radicación.
     */
    public function editarPaciente(Request $request): JsonResponse
    {
        $documento = trim((string) $request->query('documento', ''));

        if ($documento === '') {
            return response()->json(['found' => false]);
        }

        $user = User::where('Numero_D', $documento)->first();

        if (! $user) {
            return response()->json(['found' => false]);
        }

        return response()->json([
            'found' => true,
            'usuario' => [
                'id' => $user->id,
                'name' => $user->name,
                'rol' => $user->rol,
                'Apellido1' => $user->Apellido1,
                'apellido2' => $user->apellido2,
                'tipo_Docu' => $user->tipo_Docu,
                'Numero_D' => $user->Numero_D,
                'email' => $user->email,
                'Telefono1' => $user->Telefono1,
                'telefono2' => $user->telefono2,
                'Direccion' => $user->Direccion,
                'Eps' => $user->Eps,
                'codesp' => $user->codesp,
            ],
        ]);
    }

    /**
     * Actualizar un paciente (usuario) existente sin salir de la radicación y
     * devolver sus datos para recargarlo como paciente del caso.
     */
    public function actualizarPaciente(Request $request, User $user): JsonResponse
    {
        // El rol actual del usuario editado siempre es válido (permite guardar
        // sin cambiar el rol aunque no esté entre los asignables).
        $rolRules = ['required', 'string', 'exists:roles,Nombre'];
        if (($asignables = Permiso::rolesAsignablesPara($request->user())) !== null) {
            if (! in_array($user->rol, $asignables, true)) {
                $asignables[] = $user->rol;
            }
            $rolRules[] = Rule::in($asignables);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'rol' => $rolRules,
            'Apellido1' => ['nullable', 'string', 'max:50'],
            'apellido2' => ['nullable', 'string', 'max:50'],
            'tipo_Docu' => ['nullable', 'string', 'max:120'],
            'Numero_D' => ['nullable', 'string', 'max:20'],
            // El médico no inicia sesión: el correo es opcional para ese rol.
            'email' => [
                'required_unless:rol,Medico',
                'nullable',
                'string',
                'email',
                'max:255',
                Rule::unique('users', 'email')->ignore($user->id),
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
            // En edición la contraseña es opcional: solo se cambia si se diligencia.
            'password' => ['nullable', 'confirmed', Password::defaults()],
        ]);

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

        return response()->json($this->pacientePayload($user->fresh()));
    }

    /**
     * Estructura de respuesta con los datos del paciente y los acuerdos de su EPS.
     *
     * @return array<string, mixed>
     */
    private function pacientePayload(User $user): array
    {
        return [
            'found' => true,
            // id y rol permiten que la vista sepa qué acaba de crear: si es un
            // médico, lo agrega al selector de Médico en lugar de cargarlo
            // como paciente de la radicación.
            'id' => $user->id,
            'rol' => $user->rol,
            'nombres' => $user->name,
            'apellido1' => $user->Apellido1,
            'apellido2' => $user->apellido2,
            'documento' => $user->Numero_D,
            'tipo_Docu' => $user->tipo_Docu,
            'nombre' => trim(implode(' ', array_filter([$user->name, $user->Apellido1, $user->apellido2]))),
            'telefonos' => trim(implode(' / ', array_filter([$user->Telefono1, $user->telefono2]))),
            'eps' => $user->Eps,
            'acuerdos' => $this->acuerdosDeEps($user->Eps),
            'convenios' => $this->conveniosDeEps($user->Eps),
        ];
    }

    /**
     * Convenios activos de la EPS del paciente (relación eps.nit_empresa →
     * convenio.nit_empresa; la EPS del usuario se guarda por nombre).
     */
    private function conveniosDeEps(?string $epsNombre)
    {
        $eps = $epsNombre
            ? Eps::where('Nombre', $epsNombre)->first(['nit_empresa'])
            : null;

        if (! $eps || ! $eps->nit_empresa) {
            return collect();
        }

        return Convenio::where('nit_empresa', $eps->nit_empresa)
            ->where('Estado', true)
            ->orderBy('nombre')
            ->get(['id', 'nit_Convenio', 'nombre', 'regimen', 'tarifa']);
    }

    /**
     * CUPS (tipos de acuerdo) asociados a una EPS (por nombre) vía cuvs_eps.
     */
    private function acuerdosDeEps(?string $epsNombre)
    {
        $eps = $epsNombre ? Eps::where('Nombre', $epsNombre)->first(['id']) : null;

        if (! $eps) {
            return collect();
        }

        return Cups::whereIn('id', function ($q) use ($eps) {
            $q->select('cuvs_id')
                ->from('cuvs_eps')
                ->where('eps_id', $eps->id)
                ->where('Estado', true);
        })
            ->where('Estado', true)
            ->orderBy('Nombre')
            ->get(['id', 'CodCupsHuv', 'Nombre', 'descrip_Normativa', 'tipofactor']);
    }

    /**
     * Radicar (guardar) un caso junto con sus procedimientos / autorizaciones EPS.
     */
    public function store(Request $request): RedirectResponse
    {
        $this->normalizarCopago($request);

        // Todos los campos diligenciables de la vista de Nueva Radicación son
        // obligatorios para cualquier rol. Subespecialidad, Motivo, Estado
        // Secundario y Fecha Recibido no se exigen porque no
        // están en la vista.
        $data = $request->validate([
            'Codesp' => ['required', 'string', 'max:10'],
            'codMed' => ['required', 'string', 'max:20'],
            // El paciente debe existir: de él se llenan tipo de documento,
            // nombre, teléfonos y EPS de la vista.
            'Ndocumento' => ['required', 'string', 'max:20', Rule::exists('users', 'Numero_D')],
            'convenio' => ['required', 'string', 'max:25', Rule::exists('convenio', 'nit_Convenio')],
            // Copago: el valor solo se exige (y solo se guarda) si está marcado.
            'copago' => ['boolean'],
            'valor_copago' => [
                'exclude_if:copago,false',
                'required_if:copago,true',
                'numeric',
                'min:0',
                'max:99999999999.99',
            ],
            // Paquete: documento PDF opcional adjunto a la radicación.
            'paquete' => $this->reglasPaquete(),
            'estRad' => ['required', 'string', 'max:5'],
            'fentregapro' => ['required', 'date'],
            // Estado secundario se retiró de la vista de Nueva Radicación: lo
            // diligencia otro rol desde el seguimiento del caso.
            'codestsecundario' => ['nullable', 'string', 'max:5'],
            // Fecha Recibido tampoco está en la vista.
            'fecreci' => ['nullable', 'date'],
            'fecAutorizacion' => ['required', 'date'],
            'fechavenautorizacion' => ['required', 'date'],
            // Subespecialidad y Motivo se excluyeron de la vista: quedan opcionales.
            'codsubesp' => ['nullable', 'string', 'max:10'],
            'estcod' => ['nullable', 'string', 'max:5'],
            'ObservacionTFX' => ['required', 'string', 'max:65535'],
            'ObservacionCCX' => ['required', 'string', 'max:65535'],
            // Debe registrarse al menos un procedimiento (CUPS) con su autorización.
            'procedimientos' => ['required', 'array', 'min:1'],
            'procedimientos.*.cusv_id' => ['required', 'integer', 'exists:cups,id'],
            'procedimientos.*.N_Autorizacion' => ['required', 'string', 'max:20'],
        ], [
            'Ndocumento.exists' => 'El paciente no está registrado. Créelo con el botón + antes de radicar.',
            'procedimientos.required' => 'Debe agregar al menos un procedimiento (CUPS).',
            'procedimientos.min' => 'Debe agregar al menos un procedimiento (CUPS).',
            'procedimientos.*.cusv_id.required' => 'Seleccione el código CUPS.',
            'procedimientos.*.N_Autorizacion.required' => 'Digite el N° de autorización EPS.',
        ], [
            'Codesp' => 'especialidad',
            'codMed' => 'médico',
            'Ndocumento' => 'identificación',
            'convenio' => 'convenio',
            'valor_copago' => 'valor del copago',
            'estRad' => 'estado actual',
            'fentregapro' => 'entrega al servicio',
            'codestsecundario' => 'estado QX',
            'fecreci' => 'fecha recibido serv',
            'fecAutorizacion' => 'fecha autorización',
            'fechavenautorizacion' => 'fecha vencimiento autorización',
            'ObservacionTFX' => 'OB TFX',
            'ObservacionCCX' => 'observación CCX',
        ]);

        // Sin copago no se guarda ningún valor asociado.
        if (! $request->boolean('copago')) {
            $data['copago'] = false;
            $data['valor_copago'] = null;
        }

        // El PDF se guarda en disco y en la columna queda solo su ruta.
        $data['paquete'] = $this->guardarPaquete($request, null, null, $data['Ndocumento'] ?? null);

        // El caso, sus procedimientos y su bitácora se guardan o fallan juntos:
        // una radicación sin su registro de creación quedaría fuera del informe.
        try {
            $caso = DB::transaction(function () use ($data, $request) {
                $caso = RadicarCaso::create(Arr::except($data, ['procedimientos']));

                foreach ($request->input('procedimientos', []) as $proc) {
                    if (empty($proc['cusv_id'])) {
                        continue;
                    }

                    CupsAnezado::create([
                        'codRadicado' => (string) $caso->codrad,
                        'cusv_id' => (int) $proc['cusv_id'],
                        'N_Autorizacion' => $proc['N_Autorizacion'] ?? '',
                    ]);
                }

                // Trazabilidad: deja el evento de creación para que la radicación
                // aparezca en el informe desde el primer día, con o sin cambios.
                $this->registrarEvento(
                    $caso->codrad,
                    $request,
                    'creacion',
                    'Radicación creada',
                    null,
                    'Estado inicial: '.$this->valorLegible('estRad', $caso->estRad),
                );

                return $caso;
            });
        } catch (\Throwable $e) {
            // Radicación fallida: el PDF subido no debe quedar en el disco.
            $this->limpiarPaquete($data['paquete'], null);

            throw $e;
        }

        // Ya existe el consecutivo: el PDF puede tomar su nombre definitivo.
        $this->completarNombrePaquete($caso);

        return to_route('tools.radicar-solicitud')
            ->with('success', "Caso radicado correctamente. Caso N° {$caso->codrad}.")
            ->with('casoRadicado', $caso->codrad);
    }

    /**
     * Modificar los datos principales de un radicado (botón Modificar
     * Radicado del Historial). El permiso lo controla el Gestor de Permisos
     * (acción editar de Radicar Solicitud + sub-vista del botón).
     */
    public function actualizarCaso(Request $request, RadicarCaso $caso): JsonResponse
    {
        $this->normalizarCopago($request);

        $data = $request->validate([
            'codMed' => ['required', 'string', 'max:20'],
            'estRad' => ['required', 'string', 'max:5'],
            // Copago: el valor solo se exige (y solo se guarda) si está marcado.
            'copago' => ['boolean'],
            'valor_copago' => [
                'exclude_if:copago,false',
                'required_if:copago,true',
                'numeric',
                'min:0',
                'max:99999999999.99',
            ],
            // Paquete: si no se sube uno nuevo, se conserva el que ya tenía.
            'paquete' => $this->reglasPaquete(),
            'fentregapro' => ['required', 'date'],
            // Fecha Recibido Serv NO se exige aquí: la diligencia el servicio
            // desde Aplicar Modificaciones, no quien edita la radicación.
            // Exigirla dejaba sin poder guardar (ni subir el PDF) cualquier
            // caso que el servicio todavía no hubiera recibido.
            'fecreci' => ['nullable', 'date'],
            'fecAutorizacion' => ['required', 'date'],
            'fechavenautorizacion' => ['required', 'date'],
            'ObservacionTFX' => ['nullable', 'string', 'max:65535'],
            'procedimientos' => ['required', 'array', 'min:1'],
            'procedimientos.*.cusv_id' => ['required', 'integer', 'exists:cups,id'],
            'procedimientos.*.N_Autorizacion' => ['nullable', 'string', 'max:20'],
        ], [
            'procedimientos.required' => 'Debe conservar al menos un procedimiento (CUPS).',
            'procedimientos.min' => 'Debe conservar al menos un procedimiento (CUPS).',
            'procedimientos.*.cusv_id.required' => 'Seleccione el código CUPS.',
        ], [
            'codMed' => 'médico',
            'estRad' => 'estado actual',
            'valor_copago' => 'valor del copago',
            'fentregapro' => 'entrega al servicio',
            'fecreci' => 'fecha recibido serv',
            'fecAutorizacion' => 'fecha autorización',
            'fechavenautorizacion' => 'fecha vencimiento autorización',
        ]);

        // Sin copago no se conserva un valor viejo: quedaría un monto colgado
        // en un caso que dice no tener copago.
        if (! $request->boolean('copago')) {
            $data['copago'] = false;
            $data['valor_copago'] = null;
        }

        // Sin archivo nuevo se mantiene el que ya estaba.
        $paqueteAnterior = $caso->paquete;
        $data['paquete'] = $this->guardarPaquete($request, $paqueteAnterior, $caso->codrad, $caso->Ndocumento);

        // El cambio y su registro en la bitácora van juntos: si algo falla, no
        // puede quedar un dato modificado sin rastro de quién lo modificó.
        try {
            DB::transaction(function () use ($caso, $data, $request) {
                // Foto previa para poder registrar qué cambió exactamente.
                $antes = $caso->getRawOriginal();
                $procsAntes = $this->firmaProcedimientos($caso->codrad);

                $caso->update(Arr::except($data, ['procedimientos']));
                $this->registrarCambios($caso, $antes, $request, 'modificacion');

                // Reemplazar los procedimientos (CUPS) del caso por los enviados.
                CupsAnezado::where('codRadicado', (string) $caso->codrad)->delete();
                foreach ($data['procedimientos'] as $proc) {
                    CupsAnezado::create([
                        'codRadicado' => (string) $caso->codrad,
                        'cusv_id' => (int) $proc['cusv_id'],
                        'N_Autorizacion' => $proc['N_Autorizacion'] ?? '',
                    ]);
                }

                $procsDespues = $this->firmaProcedimientos($caso->codrad);
                if ($procsAntes !== $procsDespues) {
                    $this->registrarEvento(
                        $caso->codrad,
                        $request,
                        'modificacion',
                        'Procedimientos (CUPS)',
                        $procsAntes,
                        $procsDespues,
                    );
                }
            });
        } catch (\Throwable $e) {
            // El guardado falló: se descarta el PDF recién subido para no
            // dejarlo huérfano, y se conserva intacto el anterior.
            $this->limpiarPaquete($data['paquete'], $paqueteAnterior);

            throw $e;
        }

        // Confirmado el guardado, ya se puede borrar el PDF reemplazado.
        $this->limpiarPaquete($paqueteAnterior, $caso->paquete);

        return response()->json([
            'ok' => true,
            'caso' => $this->casoDetalle($caso->fresh()),
        ]);
    }

    /**
     * Consultar un caso por consecutivo (codrad) o por cédula del paciente.
     */
    public function buscarCaso(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));

        if ($q === '') {
            return response()->json(['found' => false]);
        }

        $caso = null;
        if (ctype_digit($q)) {
            $caso = RadicarCaso::find((int) $q);
        }
        if (! $caso) {
            $caso = RadicarCaso::where('Ndocumento', $q)
                ->orderByDesc('codrad')->first();
        }

        if (! $caso) {
            return response()->json(['found' => false]);
        }

        return response()->json([
            'found' => true,
            'caso' => $this->casoDetalle($caso),
        ]);
    }

    /**
     * Registrar una modificación (segmento 5) y dejar la trazabilidad.
     */
    public function aplicarModificacion(Request $request, RadicarCaso $caso): JsonResponse
    {
        // El estado solo puede cambiarse a uno de los asignados al rol: la
        // vista ya los limita, pero la petición podría traer cualquier otro.
        [$estadosPermitidos] = $this->estadosParaUsuario($request);

        $data = $request->validate([
            'estRad' => [
                'nullable',
                'string',
                'max:5',
                Rule::in($estadosPermitidos->pluck('id')->map(fn ($id) => (string) $id)->all()),
            ],
            'codsubesp' => ['nullable', 'string', 'max:10'],
            // Fecha Recibido Serv: la registra el servicio al diligenciar el
            // seguimiento. No es la fecha de radicación (created_at) que la
            // pestaña Nueva Radicación auto diligencia.
            'fecreci' => ['nullable', 'date'],
            // Motivo se retiró del formulario: ya no se diligencia aquí.
            'maos' => ['boolean'],
            'venc_anestesia' => ['nullable', 'date'],
            // Estado QX: se escoge del catálogo (tabla EstRadisecundario).
            'codestsecundario' => ['nullable', 'string', 'max:5'],
            'ObservacionCCX' => ['nullable', 'string', 'max:65535'],
        ], [
            'estRad.in' => 'El estado seleccionado no está asignado a tu rol.',
        ], [
            'estRad' => 'estado actual',
            'fecreci' => 'fecha recibido serv',
        ]);

        DB::transaction(function () use ($caso, $data, $request) {
            // Foto del seguimiento. Estado y MAOS no se guardan aquí porque
            // seguimiento_caso no tiene esas columnas: sus cambios quedan en
            // la bitácora, que además registra el valor anterior y el nuevo.
            SeguimientoCaso::create(array_merge(Arr::except($data, ['estRad', 'maos']), [
                'codrad' => $caso->codrad,
                'user_id' => $request->user()?->id,
            ]));

            // Aplicar al caso solo los campos diligenciados (no vaciar con blancos).
            $aplicar = array_filter($data, fn ($v) => $v !== null && $v !== '');
            if (! empty($aplicar)) {
                $antes = $caso->getRawOriginal();
                $caso->update($aplicar);
                // Además de la foto en seguimiento_caso, queda el detalle campo
                // a campo con el valor anterior y el nuevo.
                $this->registrarCambios($caso, $antes, $request, 'seguimiento');
            }
        });

        return response()->json([
            'ok' => true,
            'caso' => $this->casoDetalle($caso->fresh()),
        ]);
    }

    /**
     * Eliminar un caso (solo Super Admin). Borra también sus procedimientos
     * y su trazabilidad.
     */
    public function destroyCaso(Request $request, RadicarCaso $caso): JsonResponse
    {
        abort_unless($request->user()?->isSuperAdmin() ?? false, 403);

        // El PDF del paquete se va con el caso: si no, queda ocupando disco
        // sin ninguna fila que lo referencie.
        if ($caso->paquete) {
            Almacenamiento::eliminar($caso->paquete);
        }

        CupsAnezado::where('codRadicado', (string) $caso->codrad)->delete();
        SeguimientoCaso::where('codrad', $caso->codrad)->delete();
        // La bitácora del caso se elimina con él: sin la radicación, sus
        // filas quedarían huérfanas y el informe no podría ubicarlas.
        TrazabilidadCaso::where('codrad', $caso->codrad)->delete();
        CotizacionCaso::where('codrad', $caso->codrad)->each(function ($cot) {
            if ($cot->adjunto) {
                Almacenamiento::eliminar($cot->adjunto);
            }
            $cot->delete();
        });
        $caso->delete();

        return response()->json(['ok' => true]);
    }

    /**
     * Informe de trazabilidad de modificaciones por caso.
     */
    public function informe(Request $request): JsonResponse
    {
        // Las modificaciones hechas por un Super Admin son invisibles para
        // cualquier otro rol: sus filas de trazabilidad se omiten por completo.
        $viewerIsSuperAdmin = $request->user()?->isSuperAdmin() ?? false;

        $medicoF = trim((string) $request->query('medico', ''));
        $espF = trim((string) $request->query('especialidad', ''));
        $subF = trim((string) $request->query('subespecialidad', ''));
        $estadoF = trim((string) $request->query('estado', ''));
        $documentoF = trim((string) $request->query('documento', ''));
        $consecutivoF = trim((string) $request->query('consecutivo', ''));

        // 1) Radicaciones que entran al informe. El filtrado por atributos del
        //    caso (estado, especialidad, subespecialidad, médico, documento)
        //    se hace aquí, en SQL, y no fila por fila después del límite.
        $casos = RadicarCaso::query()
            ->when($consecutivoF !== '', fn ($q) => $q->where('codrad', (int) $consecutivoF))
            ->when($documentoF !== '', fn ($q) => $q->where('Ndocumento', $documentoF))
            ->when($estadoF !== '', fn ($q) => $q->where('estRad', $estadoF))
            ->when($espF !== '', fn ($q) => $q->where('Codesp', $espF))
            ->when($subF !== '', fn ($q) => $q->where('codsubesp', $subF))
            ->when($medicoF !== '', fn ($q) => $q->whereIn(
                'codMed',
                User::where(fn ($u) => $u->where('name', 'like', "%{$medicoF}%")
                    ->orWhere('Apellido1', 'like', "%{$medicoF}%")
                    ->orWhere('apellido2', 'like', "%{$medicoF}%")
                )->pluck('id'),
            ))
            ->orderByDesc('codrad');

        // El informe respeta los estados autorizados al rol en el Gestor de
        // Permisos, igual que la grilla del Historial: "todas las
        // radicaciones" son todas las que ese rol tiene permitido ver.
        $this->limitarPorEstadosDelRol($casos, $request);

        // Tope de seguridad: sin él, un informe sin filtros materializaría en
        // memoria la tabla completa. Se avisa en la respuesta cuando recorta.
        $totalCasos = (clone $casos)->count();
        $casos = $casos->limit(self::TOPE_CASOS_INFORME)->get()->keyBy('codrad');
        $truncado = $totalCasos > self::TOPE_CASOS_INFORME;

        if ($casos->isEmpty()) {
            return response()->json(['rows' => [], 'truncado' => false]);
        }

        $codrads = $casos->keys();

        // 2) Catálogos completos de una sola vez: antes se resolvían con hasta
        //    seis consultas por fila.
        $estados = EstRadicado::pluck('Nombre', 'id');
        $estadosSec = EstRadisecundario::pluck('Nombre', 'id');
        $motivos = Motivo::pluck('Nombre', 'id');
        $subesp = SubEspecialidad::pluck('Nombre', 'cod_SubEspecialidad');
        $especialidades = Especialidad::pluck('Nombre', 'espcodser');
        $pacientes = User::whereIn('Numero_D', $casos->pluck('Ndocumento')->filter()->unique())
            ->get(['Numero_D', 'name', 'Apellido1', 'apellido2'])
            ->keyBy('Numero_D');
        $usuarios = User::whereIn('id', $casos->pluck('codMed')->filter()->unique())
            ->get(['id', 'name', 'Apellido1', 'apellido2'])
            ->keyBy('id');

        $rangoFecha = function ($query) use ($request) {
            return $query
                ->when($request->filled('fechaInicial'), fn ($q) => $q->whereDate('created_at', '>=', $request->query('fechaInicial')))
                ->when($request->filled('fechaFinal'), fn ($q) => $q->whereDate('created_at', '<=', $request->query('fechaFinal')));
        };

        // Lo que hizo un Super Admin es invisible para los demás roles. Se
        // descarta en SQL y no después: si se filtrara en PHP, el tope de
        // filas se consumiría con registros que el usuario no va a ver y el
        // informe podría salir vacío teniendo movimientos visibles más atrás.
        $ocultarSuperAdmin = function ($query) use ($viewerIsSuperAdmin) {
            if ($viewerIsSuperAdmin) {
                return $query;
            }

            return $query->where(fn ($q) => $q
                ->whereNull('user_id')
                ->orWhereDoesntHave('user')
                ->orWhereHas('user', fn ($u) => $u->where('rol', '!=', User::SUPER_ADMIN))
            );
        };

        // 3) Las dos fuentes de trazabilidad: la bitácora campo a campo y las
        //    fotos históricas del formulario Aplicar Modificaciones.
        $bitacora = TrazabilidadCaso::query()
            ->with('user:id,name,Apellido1,apellido2,rol')
            ->whereIn('codrad', $codrads)
            ->tap($rangoFecha)
            ->tap($ocultarSuperAdmin)
            ->orderByDesc('created_at')
            ->limit(self::TOPE_FILAS_INFORME)
            ->get();

        $seguimientos = SeguimientoCaso::query()
            ->with('user:id,name,Apellido1,apellido2,rol')
            ->whereIn('codrad', $codrads)
            ->tap($rangoFecha)
            ->tap($ocultarSuperAdmin)
            ->orderByDesc('created_at')
            ->limit(self::TOPE_FILAS_INFORME)
            ->get();

        // Qué radicaciones tienen realmente algún movimiento visible. Se
        // consulta aparte y SIN tope: decidirlo con las filas ya traídas haría
        // que un caso cuyos cambios quedaron fuera del corte apareciera
        // rotulado como "Sin cambios registrados", que es justo lo contrario
        // de la verdad en un informe de auditoría.
        $conMovimiento = TrazabilidadCaso::query()
            ->whereIn('codrad', $codrads)
            ->tap($rangoFecha)
            ->tap($ocultarSuperAdmin)
            ->distinct()
            ->pluck('codrad')
            ->merge(
                SeguimientoCaso::query()
                    ->whereIn('codrad', $codrads)
                    ->tap($rangoFecha)
                    ->tap($ocultarSuperAdmin)
                    ->distinct()
                    ->pluck('codrad')
            )
            ->unique()
            ->flip();

        $datosCaso = function (RadicarCaso $caso) use ($estados, $usuarios, $subesp, $especialidades, $pacientes) {
            $med = $caso->codMed ? $usuarios->get($caso->codMed) : null;
            $pac = $caso->Ndocumento ? $pacientes->get($caso->Ndocumento) : null;

            return [
                'codrad' => $caso->codrad,
                'fechaRecibido' => optional($caso->created_at)->format('Y-m-d'),
                'documento' => $caso->Ndocumento ?? '—',
                'paciente' => $pac
                    ? trim(implode(' ', array_filter([$pac->name, $pac->Apellido1, $pac->apellido2])))
                    : '—',
                'estado' => $estados[(int) $caso->estRad] ?? '—',
                // Fecha Recibido Serv vigente del caso. Va en el bloque común
                // para que acompañe a TODA fila del informe (cambios de la
                // bitácora incluidos) y no solo a las de seguimiento.
                'fechaRecibidoDev' => optional($caso->fecreci)->format('Y-m-d'),
                'especialidad' => $especialidades[$caso->Codesp] ?? '—',
                'medico' => $this->nombreUsuario($med) ?? '—',
                'subespecialidad' => $subesp[$caso->codsubesp] ?? '—',
                'copago' => (bool) $caso->copago,
                'valorCopago' => $caso->valor_copago,
                'maos' => (bool) $caso->maos,
                'paqueteUrl' => $caso->paquete
                    ? route('tools.radicar-solicitud.paquete', $caso->codrad)
                    : null,
            ];
        };

        $visible = fn (?User $autor) => $viewerIsSuperAdmin || ! $autor || $autor->rol !== User::SUPER_ADMIN;

        $rows = [];
        // Radicaciones que ya aportaron al menos una fila VISIBLE. Se calcula
        // sobre lo realmente emitido y no sobre lo consultado: si todos los
        // movimientos de un caso los hizo un Super Admin y quien consulta no
        // lo es, el caso debe seguir apareciendo como radicación sin cambios
        // en lugar de desaparecer del informe.
        $conFilas = [];

        // 3.a) Una fila por cada cambio registrado en la bitácora.
        foreach ($bitacora as $t) {
            if (! $visible($t->user)) {
                continue;
            }

            $caso = $casos->get($t->codrad);
            if (! $caso) {
                continue;
            }

            $conFilas[$t->codrad] = true;
            $rows[] = array_merge($datosCaso($caso), [
                'id' => 'T'.$t->id,
                'tipo' => $t->evento === 'creacion' ? 'Radicación' : 'Cambio',
                'campo' => $t->etiqueta ?? '—',
                'anterior' => $t->anterior ?? '—',
                'nuevo' => $t->nuevo ?? '—',
                'motivo' => '—',
                'vencAnestesia' => null,
                'observacion' => null,
                'estadoQx' => '—',
                'usuario' => $this->nombreUsuario($t->user) ?? '—',
                'modificadoEn' => optional($t->created_at)->format('Y-m-d H:i'),
            ]);
        }

        // 3.b) Una fila por cada seguimiento aplicado (incluye el histórico
        //      registrado antes de que existiera la bitácora).
        foreach ($seguimientos as $s) {
            if (! $visible($s->user)) {
                continue;
            }

            $caso = $casos->get($s->codrad);
            if (! $caso) {
                continue;
            }

            $base = $datosCaso($caso);
            $conFilas[$s->codrad] = true;

            $rows[] = array_merge($base, [
                'id' => 'S'.$s->id,
                'tipo' => 'Seguimiento',
                'campo' => 'Seguimiento aplicado',
                'anterior' => '—',
                'nuevo' => '—',
                'motivo' => $motivos[(int) $s->estcod] ?? '—',
                // La subespecialidad del seguimiento manda sobre la del caso.
                'subespecialidad' => $subesp[$s->codsubesp] ?? $base['subespecialidad'],
                // Igual que la subespecialidad: la foto del seguimiento manda,
                // y si ese campo se dejó en blanco queda la del caso.
                'fechaRecibidoDev' => optional($s->fecreci)->format('Y-m-d') ?? $base['fechaRecibidoDev'],
                'vencAnestesia' => optional($s->venc_anestesia)->format('Y-m-d'),
                'observacion' => $s->ObservacionCCX,
                // Estado QX es el estado secundario del catálogo.
                'estadoQx' => $estadosSec[(int) $s->codestsecundario] ?? '—',
                'usuario' => $this->nombreUsuario($s->user) ?? '—',
                'modificadoEn' => optional($s->created_at)->format('Y-m-d H:i'),
            ]);
        }

        // 3.c) Toda radicación aparece aunque no tenga ni un solo movimiento:
        //      sin esto, una radicación recién creada sería invisible.
        $desde = $request->filled('fechaInicial') ? $request->query('fechaInicial') : null;
        $hasta = $request->filled('fechaFinal') ? $request->query('fechaFinal') : null;

        foreach ($casos as $caso) {
            // Se usa el conteo real, no las filas que alcanzaron a traerse.
            if ($conMovimiento->has($caso->codrad) || isset($conFilas[$caso->codrad])) {
                continue;
            }

            // Con filtro de fechas se usa la fecha de radicación del caso, para
            // que una radicación creada dentro del rango y todavía sin cambios
            // no quede fuera del informe.
            $fechaCaso = optional($caso->created_at)->format('Y-m-d');
            if ($desde !== null && ($fechaCaso === null || $fechaCaso < $desde)) {
                continue;
            }
            if ($hasta !== null && ($fechaCaso === null || $fechaCaso > $hasta)) {
                continue;
            }

            $rows[] = array_merge($datosCaso($caso), [
                'id' => 'C'.$caso->codrad,
                'tipo' => 'Radicación',
                'campo' => 'Sin cambios registrados',
                'anterior' => '—',
                'nuevo' => '—',
                'motivo' => $motivos[(int) $caso->estcod] ?? '—',
                'vencAnestesia' => optional($caso->venc_anestesia)->format('Y-m-d'),
                'observacion' => $caso->ObservacionCCX,
                'estadoQx' => $estadosSec[(int) $caso->codestsecundario] ?? '—',
                'usuario' => '—',
                'modificadoEn' => optional($caso->created_at)->format('Y-m-d H:i'),
            ]);
        }

        // Más reciente primero; a igual momento, agrupadas por radicación.
        usort($rows, function ($a, $b) {
            $cmp = strcmp((string) $b['modificadoEn'], (string) $a['modificadoEn']);

            return $cmp !== 0 ? $cmp : ($b['codrad'] <=> $a['codrad']);
        });

        return response()->json([
            'rows' => $rows,
            // La vista avisa cuando el informe se recortó, para que nadie lo
            // lea como si fuera el universo completo.
            'truncado' => $truncado
                || $bitacora->count() >= self::TOPE_FILAS_INFORME
                || $seguimientos->count() >= self::TOPE_FILAS_INFORME,
        ]);
    }

    /**
     * Normaliza un valor a texto plano para poder compararlo entre el antes y
     * el después sin que el casteo de fechas produzca falsos cambios.
     */
    private function valorPlano(mixed $valor): string
    {
        if ($valor === null) {
            return '';
        }

        if ($valor instanceof \DateTimeInterface) {
            return $valor->format('Y-m-d');
        }

        $texto = trim((string) $valor);

        // '2026-07-30 00:00:00' y '2026-07-30' son la misma fecha.
        if (preg_match('/^(\d{4}-\d{2}-\d{2})[ T]00:00:00/', $texto, $m)) {
            return $m[1];
        }

        return $texto;
    }

    /**
     * Traduce el valor guardado de un campo al texto que ve el usuario: el
     * nombre del estado, del médico, del convenio, etc. Se congela en la
     * bitácora para que renombrar un catálogo después no altere la historia.
     */
    private function valorLegible(string $campo, mixed $valor): string
    {
        $plano = $this->valorPlano($valor);

        // En un booleano, "No" es un valor con significado y no un vacío: se
        // resuelve antes de tratar la cadena vacía como "sin dato".
        if (in_array($campo, ['copago', 'maos'], true)) {
            return in_array($plano, ['1', 'true'], true) ? 'Sí' : 'No';
        }

        if ($plano === '') {
            return '—';
        }

        $nombre = match ($campo) {
            'valor_copago' => '$'.number_format((float) $plano, 2, ',', '.'),
            // De la ruta guardada solo interesa el nombre del archivo.
            'paquete' => basename($plano),
            'estRad' => EstRadicado::find($plano)?->Nombre,
            'codestsecundario' => EstRadisecundario::find($plano)?->Nombre,
            'estcod' => Motivo::find($plano)?->Nombre,
            'Codesp' => Especialidad::where('espcodser', $plano)->value('Nombre'),
            'codsubesp' => SubEspecialidad::where('cod_SubEspecialidad', $plano)->value('Nombre'),
            'convenio' => Convenio::where('nit_Convenio', $plano)->value('nombre'),
            'codMed' => $this->nombreUsuario(User::find($plano)),
            'Ndocumento' => $this->nombreUsuario(User::where('Numero_D', $plano)->first()),
            default => null,
        };

        return $nombre !== null && $nombre !== '' ? (string) $nombre : $plano;
    }

    /**
     * Nombre completo de un usuario, o null si no existe.
     */
    private function nombreUsuario(?User $user): ?string
    {
        if (! $user) {
            return null;
        }

        $nombre = trim(implode(' ', array_filter([$user->name, $user->Apellido1, $user->apellido2])));

        return $nombre !== '' ? $nombre : null;
    }

    /**
     * Registra en la bitácora cada campo de la radicación que haya cambiado.
     *
     * @param  array<string, mixed>  $antes  valores crudos previos al update
     */
    private function registrarCambios(RadicarCaso $caso, array $antes, Request $request, string $evento): void
    {
        foreach ($caso->getChanges() as $campo => $nuevo) {
            if (! isset(self::CAMPOS_TRAZABLES[$campo])) {
                continue;
            }

            $anterior = $antes[$campo] ?? null;

            // Eloquent puede marcar como cambiado un valor equivalente
            // (fecha con hora vs. sin hora): solo se registra el cambio real.
            if ($this->valorPlano($anterior) === $this->valorPlano($nuevo)) {
                continue;
            }

            TrazabilidadCaso::create([
                'codrad' => $caso->codrad,
                'user_id' => $request->user()?->id,
                'evento' => $evento,
                'campo' => $campo,
                'etiqueta' => self::CAMPOS_TRAZABLES[$campo],
                'anterior' => mb_substr($this->valorLegible($campo, $anterior), 0, 500),
                'nuevo' => mb_substr($this->valorLegible($campo, $nuevo), 0, 500),
            ]);
        }
    }

    /**
     * Registra un evento de la radicación que no corresponde a un campo
     * concreto (creación, cambio de procedimientos, cotizaciones…).
     */
    private function registrarEvento(
        int $codrad,
        Request $request,
        string $evento,
        string $etiqueta,
        ?string $anterior = null,
        ?string $nuevo = null,
    ): void {
        TrazabilidadCaso::create([
            'codrad' => $codrad,
            'user_id' => $request->user()?->id,
            'evento' => $evento,
            'campo' => null,
            'etiqueta' => $etiqueta,
            'anterior' => $anterior !== null ? mb_substr($anterior, 0, 500) : null,
            'nuevo' => $nuevo !== null ? mb_substr($nuevo, 0, 500) : null,
        ]);
    }

    /**
     * Firma legible de los procedimientos (CUPS) de un caso, para poder
     * comparar el antes y el después cuando se reemplazan en bloque.
     */
    private function firmaProcedimientos(int $codrad): string
    {
        $procs = CupsAnezado::where('codRadicado', (string) $codrad)
            ->orderBy('cusv_id')
            ->get(['cusv_id', 'N_Autorizacion']);

        if ($procs->isEmpty()) {
            return '—';
        }

        $nombres = Cups::whereIn('id', $procs->pluck('cusv_id'))->pluck('Nombre', 'id');

        return $procs->map(function ($p) use ($nombres) {
            $etiqueta = $nombres[$p->cusv_id] ?? ('CUPS '.$p->cusv_id);

            return $p->N_Autorizacion
                ? $etiqueta.' (Aut. '.$p->N_Autorizacion.')'
                : $etiqueta;
        })->implode(', ');
    }

    /**
     * Deja 'copago' como booleano real en la petición.
     *
     * El formulario viaja como multipart porque lleva el PDF del paquete, y
     * ahí un booleano llega como '1' o '0'. Las reglas exclude_if/required_if
     * solo convierten sus parámetros a booleano cuando el campo comparado ya
     * lo es: sin esta normalización, 'required_if:copago,true' nunca se
     * dispararía y se podría guardar un copago sin valor.
     */
    private function normalizarCopago(Request $request): void
    {
        $request->merge(['copago' => $request->boolean('copago')]);
    }

    /**
     * Muestra el PDF del paquete dentro del navegador.
     *
     * Se sirve por esta ruta y no por la URL pública de storage para que el
     * archivo quede sujeto a los mismos permisos que la vista: solo lo ve
     * quien puede entrar a Radicar Solicitud. Va con Content-Disposition
     * inline para que el navegador lo muestre en lugar de descargarlo.
     */
    public function verPaquete(Request $request, RadicarCaso $caso)
    {
        abort_unless($caso->paquete, 404);
        abort_unless(Almacenamiento::existe($caso->paquete), 404);

        return Almacenamiento::respuesta(
            $caso->paquete,
            basename($caso->paquete),
            'application/pdf',
            'inline',
        );
    }

    /**
     * Muestra el PDF adjunto a una cotización dentro del navegador.
     *
     * Existe por la misma razón que verPaquete: el adjunto se entrega por una
     * ruta con permisos y no por la URL directa del disco, para que solo lo
     * abra quien tiene habilitada la pestaña de cotizaciones. Con el bucket en
     * S3 esa URL directa además no funcionaría, porque el bucket es privado.
     */
    public function verAdjuntoCotizacion(Request $request, CotizacionCaso $cotizacion)
    {
        abort_unless($this->puedeGestionarCotizaciones($request), 403);
        abort_unless($cotizacion->adjunto, 404);
        abort_unless(Almacenamiento::existe($cotizacion->adjunto), 404);

        return Almacenamiento::respuesta(
            $cotizacion->adjunto,
            basename($cotizacion->adjunto),
            'application/pdf',
            'inline',
        );
    }

    /**
     * Regla de validación del PDF del paquete. 30 MB expresados en kilobytes,
     * que es la unidad que espera la regla 'max' de Laravel para archivos.
     *
     * @return array<int, string>
     */
    private function reglasPaquete(): array
    {
        return ['nullable', 'file', 'mimes:pdf', 'max:'.(30 * 1024)];
    }

    /**
     * Guarda el PDF del paquete si viene en la petición y devuelve su ruta.
     *
     * No borra el archivo anterior: el disco no participa de la transacción
     * de base de datos, así que si el guardado falla después, el PDF viejo ya
     * no existiría y la fila seguiría apuntando a él. El reemplazo se
     * confirma con limpiarPaquete() una vez que el update terminó bien.
     */
    private function guardarPaquete(Request $request, ?string $anterior, ?int $codrad, ?string $documento): ?string
    {
        $archivo = $request->file('paquete');

        if (! $archivo) {
            return $anterior;
        }

        return Almacenamiento::guardarComo($archivo, 'paquetes', Almacenamiento::nombreDocumento($codrad, $documento));
    }


    /**
     * Renombra el PDF de una radicación recién creada para incluir su
     * consecutivo.
     *
     * Al crear el caso el PDF ya está subido pero el consecutivo todavía no
     * existe, así que el archivo nace como 'rad-nuevo_...'. Aquí se corrige.
     *
     * Es un arreglo cosmético y no puede tumbar una radicación ya guardada: si
     * falla, se conserva el nombre original —que es válido y está bien
     * referenciado— y queda la advertencia en el log.
     */
    private function completarNombrePaquete(RadicarCaso $caso): void
    {
        if (! $caso->paquete || ! str_contains(basename($caso->paquete), 'rad-nuevo')) {
            return;
        }

        $anterior = $caso->paquete;
        $extension = pathinfo($anterior, PATHINFO_EXTENSION);
        $destino = 'paquetes/'.Almacenamiento::nombreDocumento($caso->codrad, $caso->Ndocumento)
            .($extension !== '' ? '.'.$extension : '');

        try {
            Almacenamiento::copiar($anterior, $destino);

            // Se escribe por el constructor de consultas y no con $caso->update():
            // así no se dispara el AuditoriaObserver ni se toca updated_at. Es el
            // mismo archivo con otro nombre, no un cambio hecho por el usuario, y
            // no tiene por qué aparecer en la bitácora.
            DB::table($caso->getTable())
                ->where('codrad', $caso->codrad)
                ->update(['paquete' => $destino]);
            $caso->paquete = $destino;
            $caso->syncOriginal();

            // El original se borra solo después de que la fila apunta a la copia.
            Almacenamiento::eliminar($anterior);
        } catch (\Throwable $e) {
            Log::warning('No se pudo renombrar el paquete con su consecutivo', [
                'codrad' => $caso->codrad,
                'ruta' => $anterior,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Borra del disco un PDF que dejó de estar referenciado, sin tocar el que
     * quedó vigente. Se usa tanto para confirmar un reemplazo como para
     * deshacer una subida cuyo guardado falló.
     */
    private function limpiarPaquete(?string $sobrante, ?string $vigente): void
    {
        if ($sobrante && $sobrante !== $vigente) {
            Almacenamiento::eliminar($sobrante);
        }
    }

    /**
     * Firma legible de las cotizaciones de un caso, para comparar el antes y
     * el después cuando se guardan en bloque.
     */
    private function firmaCotizaciones(int $codrad): string
    {
        $cots = CotizacionCaso::where('codrad', $codrad)
            ->orderBy('id')
            ->get(['id', 'tercero', 'valor', 'fecha_cotizacion', 'estado', 'observacion', 'adjunto']);

        if ($cots->isEmpty()) {
            return '—';
        }

        // La firma incluye TODOS los campos auditables y el id de la fila: si
        // solo comparara tercero y valor, cambiar la fecha, el estado, la
        // observación o el PDF adjunto pasaría sin registro, y reemplazar una
        // cotización por otra igual en tercero y valor tampoco se notaría.
        return $cots->map(function ($c) {
            $partes = [
                $c->tercero,
                '$'.number_format((float) $c->valor, 2, ',', '.'),
                optional($c->fecha_cotizacion)->format('Y-m-d') ?? '—',
                $c->estado ?: '—',
                $c->observacion ?: '—',
                $c->adjunto ? 'con adjunto' : 'sin adjunto',
            ];

            return '#'.$c->id.' '.implode(' · ', $partes);
        })->implode(' | ');
    }

    /**
     * Resolver los datos de un caso para mostrarlos en el historial.
     *
     * @return array<string, mixed>
     */
    private function casoDetalle(RadicarCaso $caso): array
    {
        $paciente = $caso->Ndocumento
            ? User::where('Numero_D', $caso->Ndocumento)->first()
            : null;
        $esp = $caso->Codesp ? Especialidad::where('espcodser', $caso->Codesp)->first() : null;
        $sub = $caso->codsubesp ? SubEspecialidad::where('cod_SubEspecialidad', $caso->codsubesp)->first() : null;
        $med = $caso->codMed ? User::find($caso->codMed) : null;
        $estado = $caso->estRad ? EstRadicado::find($caso->estRad) : null;

        // Fecha Recibido Serv. Manda la columna del caso; si está vacía se
        // busca en el último seguimiento que sí la diligenció. Sin ese
        // respaldo, una radicación que el servicio ya recibió pero cuyo dato
        // solo quedó en la foto del seguimiento se consultaría como si nunca
        // hubiera sido recibida.
        $fechaRecibidoServ = $caso->fecreci ?? SeguimientoCaso::where('codrad', $caso->codrad)
            ->whereNotNull('fecreci')
            ->orderByDesc('id')
            ->value('fecreci');

        $procs = CupsAnezado::where('codRadicado', (string) $caso->codrad)->get();
        $procedimientos = $procs->map(function ($p) {
            $cups = Cups::find($p->cusv_id);

            return [
                'cusv_id' => $p->cusv_id,
                'codigo' => $cups?->CodCupsHuv ?? (string) $p->cusv_id,
                'descripcion' => $cups?->Nombre ?? '',
                'encontrada' => (bool) $cups,
                'N_Autorizacion' => $p->N_Autorizacion,
            ];
        })->values();

        return [
            'codrad' => $caso->codrad,
            'paciente' => $paciente
                ? trim(implode(' ', array_filter([$paciente->name, $paciente->Apellido1, $paciente->apellido2])))
                : '—',
            'tipo_Docu' => $paciente?->tipo_Docu ?? '',
            'Ndocumento' => $caso->Ndocumento,
            'telefonos' => $paciente
                ? trim(implode(' / ', array_filter([$paciente->Telefono1, $paciente->telefono2])))
                : '',
            'eps' => $paciente?->Eps ?? '',
            'convenio' => $caso->convenio
                ? (Convenio::where('nit_Convenio', $caso->convenio)->value('nombre') ?? $caso->convenio)
                : '',
            'especialidad' => $esp?->Nombre ?? ($caso->Codesp ?? '—'),
            'subespecialidad' => $sub?->Nombre ?? ($caso->codsubesp ?? '—'),
            'medico' => $med
                ? trim(implode(' ', array_filter([$med->name, $med->Apellido1, $med->apellido2])))
                : '—',
            'fechaRecibido' => optional($caso->created_at)->format('Y-m-d'),
            'estadoActual' => $estado?->Nombre ?? '—',
            'copago' => (bool) $caso->copago,
            'valorCopago' => $caso->valor_copago,
            'maos' => (bool) $caso->maos,
            'paquete' => $caso->paquete ? basename($caso->paquete) : null,
            // Se sirve por la ruta protegida, no por la URL pública del disco.
            'paqueteUrl' => $caso->paquete
                ? route('tools.radicar-solicitud.paquete', $caso->codrad)
                : null,
            // Valores crudos para el modal de Modificar Radicado.
            'codMed' => $caso->codMed,
            'estRad' => $caso->estRad,
            // Se formatean aquí: el casteo 'date:Y-m-d' solo aplica cuando se
            // serializa el modelo entero. Al meter el Carbon suelto en este
            // arreglo saldría como 2026-07-30T00:00:00.000000Z, que además
            // deja vacío el <input type="date"> de Modificar Radicado.
            //
            // 'fecreci' es la Fecha Recibido Serv, la que diligencia el
            // servicio desde Aplicar Modificaciones. No confundirla con
            // 'fechaRecibido' (created_at), la fecha de radicación. Vacía
            // significa que el servicio todavía no ha recibido la radicación.
            'fecreci' => optional($fechaRecibidoServ)->format('Y-m-d'),
            'entregaProg' => optional($caso->fentregapro)->format('Y-m-d'),
            'fechaAutorizacion' => optional($caso->fecAutorizacion)->format('Y-m-d'),
            'vencimientoAut' => optional($caso->fechavenautorizacion)->format('Y-m-d'),
            'ObservacionTFX' => $caso->ObservacionTFX,
            'procedimientos' => $procedimientos,
            'autorizaciones' => $procs->pluck('N_Autorizacion')->filter()->values(),
            'cotizaciones' => $this->cotizacionesDeCaso($caso->codrad),
        ];
    }

    /**
     * Cotizaciones registradas de una radicación, listas para la vista.
     *
     * @return array<int, array<string, mixed>>
     */
    private function cotizacionesDeCaso(int $codrad): array
    {
        return CotizacionCaso::where('codrad', $codrad)
            ->orderBy('id')
            ->get()
            ->map(fn (CotizacionCaso $cot) => [
                'id' => $cot->id,
                'tercero' => $cot->tercero,
                'estado' => $cot->estado ?? '',
                'fecha_cotizacion' => optional($cot->fecha_cotizacion)->format('Y-m-d'),
                'valor' => (string) $cot->valor,
                'observacion' => $cot->observacion ?? '',
                'adjunto_url' => $cot->adjunto
                    ? route('tools.radicar-solicitud.cotizacion-adjunto', $cot->id)
                    : null,
            ])
            ->values()
            ->all();
    }

    /**
     * Guardar (crear/editar/eliminar en bloque) las cotizaciones de una
     * radicación. Solo para los roles habilitados en la sub-vista
     * radicar-solicitud-cotizaciones del Gestor de Permisos.
     */
    public function guardarCotizaciones(Request $request, RadicarCaso $caso): JsonResponse
    {
        abort_unless($this->puedeGestionarCotizaciones($request), 403);

        $data = $request->validate([
            'cotizaciones' => ['required', 'array', 'min:1'],
            'cotizaciones.*.id' => ['nullable', 'integer'],
            'cotizaciones.*.tercero' => ['required', 'string', 'max:200'],
            'cotizaciones.*.estado' => ['nullable', 'string', 'max:5'],
            'cotizaciones.*.fecha_cotizacion' => ['required', 'date'],
            'cotizaciones.*.valor' => ['required', 'numeric', 'min:0'],
            'cotizaciones.*.observacion' => ['nullable', 'string', 'max:1200'],
            'cotizaciones.*.adjunto' => ['nullable', 'file', 'mimes:pdf', 'max:10240'],
        ], [
            'cotizaciones.*.tercero.required' => 'El tercero o proveedor es obligatorio.',
            'cotizaciones.*.valor.required' => 'El valor de la cotización es obligatorio.',
            'cotizaciones.*.adjunto.mimes' => 'El adjunto debe ser un archivo PDF.',
        ]);

        $existentes = CotizacionCaso::where('codrad', $caso->codrad)->get()->keyBy('id');
        $conservados = [];
        $cotizacionesAntes = $this->firmaCotizaciones($caso->codrad);

        foreach ($data['cotizaciones'] as $i => $fila) {
            $id = $fila['id'] ?? null;
            $cot = $id && $existentes->has((int) $id)
                ? $existentes->get((int) $id)
                : new CotizacionCaso([
                    'codrad' => $caso->codrad,
                    'user_id' => $request->user()?->id,
                ]);

            $cot->fill([
                'tercero' => $fila['tercero'],
                'estado' => $fila['estado'] ?? null,
                'fecha_cotizacion' => $fila['fecha_cotizacion'],
                'valor' => $fila['valor'],
                'observacion' => $fila['observacion'] ?? null,
            ]);

            // Adjuntar / reemplazar el PDF de la cotización.
            if ($archivo = $request->file("cotizaciones.{$i}.adjunto")) {
                if ($cot->adjunto) {
                    Almacenamiento::eliminar($cot->adjunto);
                }
                $cot->adjunto = Almacenamiento::guardarComo(
                    $archivo,
                    'cotizaciones',
                    Almacenamiento::nombreDocumento($caso->codrad, $caso->Ndocumento),
                );
            }

            $cot->save();
            $conservados[] = $cot->id;
        }

        // Filas eliminadas en la edición: se borran junto con su PDF.
        foreach ($existentes as $cot) {
            if (! in_array($cot->id, $conservados, true)) {
                if ($cot->adjunto) {
                    Almacenamiento::eliminar($cot->adjunto);
                }
                $cot->delete();
            }
        }

        $cotizacionesDespues = $this->firmaCotizaciones($caso->codrad);
        if ($cotizacionesAntes !== $cotizacionesDespues) {
            $this->registrarEvento(
                $caso->codrad,
                $request,
                'cotizacion',
                'Cotizaciones',
                $cotizacionesAntes,
                $cotizacionesDespues,
            );
        }

        return response()->json([
            'ok' => true,
            'cotizaciones' => $this->cotizacionesDeCaso($caso->codrad),
        ]);
    }
}
