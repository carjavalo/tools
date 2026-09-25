<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Permiso extends Model
{
    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'permisos';

    /**
     * Catálogo de vistas administrables por el Gestor de Permisos.
     * La clave coincide con el segmento de URL bajo /tools/.
     *
     * @var array<int, array{key: string, titulo: string, grupo: string, acciones: array<int, string>}>
     */
    public const VISTAS = [
        // Página de inicio del módulo. A qué sede entra cada rol no se decide
        // aquí sino en la sección Sedes del Gestor de Permisos.
        ['key' => 'programacion-cirugia', 'titulo' => 'Programación de Cirugía', 'grupo' => 'Principal', 'acciones' => ['ver']],
        ['key' => 'radicar-solicitud', 'titulo' => 'Radicar Solicitud', 'grupo' => 'Principal', 'acciones' => ['ver', 'crear', 'editar', 'borrar']],
        ['key' => 'radicar-solicitud-nueva', 'titulo' => 'Pestaña Nueva Radicación', 'grupo' => 'Radicar Solicitud — Pestañas', 'acciones' => ['ver']],
        ['key' => 'radicar-solicitud-historial', 'titulo' => 'Pestaña Historial / Búsqueda', 'grupo' => 'Radicar Solicitud — Pestañas', 'acciones' => ['ver']],
        ['key' => 'radicar-solicitud-informes', 'titulo' => 'Pestaña Informes', 'grupo' => 'Radicar Solicitud — Pestañas', 'acciones' => ['ver']],
        // Réplica de Nueva Radicación con su propio permiso. Viene apagada:
        // el Super Admin la asigna a los roles que la necesiten.
        ['key' => 'radicar-solicitud-hospitalario', 'titulo' => 'Pestaña Radicado Hospitalario', 'grupo' => 'Radicar Solicitud — Pestañas', 'acciones' => ['ver']],
        ['key' => 'radicar-solicitud-modificar', 'titulo' => 'Botón Modificar Radicado (Historial)', 'grupo' => 'Radicar Solicitud — Pestañas', 'acciones' => ['ver']],
        ['key' => 'radicar-solicitud-cotizaciones', 'titulo' => 'Formulario Cotizaciones de Conceptos No Convenidos (Historial)', 'grupo' => 'Radicar Solicitud — Pestañas', 'acciones' => ['ver']],
        // Versión reducida del formulario Aplicar Modificaciones: solo Estado
        // Actual, Fecha Recibido Serv y Observaciones CCX. Es para los perfiles
        // del servicio, que únicamente registran la recepción del caso. Guarda
        // en el mismo sitio que el completo. A diferencia del resto de
        // sub-vistas, viene apagada: hay que asignarla al rol para que aparezca.
        ['key' => 'radicar-solicitud-seguimiento-basico', 'titulo' => 'Formulario básico Cotizaciones de Conceptos No Convenidos (Historial)', 'grupo' => 'Radicar Solicitud — Pestañas', 'acciones' => ['ver']],
        // Copia del formulario básico para Hemodinamia: mismos campos, mismo
        // endpoint y, como aquel, apagada hasta que se asigne al rol.
        ['key' => 'radicar-solicitud-seguimiento-hemo', 'titulo' => 'Formulario Aplicar Modificaciones (Historial) Hemo', 'grupo' => 'Radicar Solicitud — Pestañas', 'acciones' => ['ver']],
        ['key' => 'radicar-solicitud-seguimiento', 'titulo' => 'Formulario Aplicar Modificaciones (Historial)', 'grupo' => 'Radicar Solicitud — Pestañas', 'acciones' => ['ver']],
        ['key' => 'radicar-solicitud-grilla', 'titulo' => 'Grilla de Radicaciones (Historial)', 'grupo' => 'Radicar Solicitud — Pestañas', 'acciones' => ['ver']],
        // Botones por fila del modal "Radicaciones programadas para cirugía".
        // Cada acción manda sobre su propio botón: ver = Ver radicado,
        // editar = Editar programación, borrar = Borrar programación. Como el
        // formulario básico, viene apagada: sin asignarla al rol solo el Super
        // Admin ve los botones.
        ['key' => 'radicar-solicitud-programados', 'titulo' => 'Grilla ver programados', 'grupo' => 'Radicar Solicitud — Pestañas', 'acciones' => ['ver', 'editar', 'borrar']],
        // Botones "Ver programados" sueltos, en la barra de pestañas: dan la
        // consulta de cada grilla a quien no tiene el formulario que la lleva.
        // Vienen apagados; los botones de cada fila siguen rigiéndose por
        // "Grilla ver programados".
        ['key' => 'radicar-solicitud-ver-programados', 'titulo' => 'Botón Ver programados (Formulario Aplicar Modificaciones)', 'grupo' => 'Radicar Solicitud — Pestañas', 'acciones' => ['ver']],
        ['key' => 'radicar-solicitud-ver-programados-hemo', 'titulo' => 'Botón Ver programados Hemo (Formulario Aplicar Modificaciones Hemo)', 'grupo' => 'Radicar Solicitud — Pestañas', 'acciones' => ['ver']],
        ['key' => 'gestion-usuarios', 'titulo' => 'Gestión de Usuarios', 'grupo' => 'Herramientas', 'acciones' => ['ver', 'crear', 'editar', 'borrar']],
        ['key' => 'gestion-servicios', 'titulo' => 'Gestión Servicios', 'grupo' => 'Herramientas', 'acciones' => ['ver', 'crear', 'editar', 'borrar']],
        ['key' => 'gestion-roles', 'titulo' => 'Gestión de Roles', 'grupo' => 'Herramientas', 'acciones' => ['ver', 'crear', 'editar', 'borrar']],
        ['key' => 'gestion-eps', 'titulo' => 'Gestión de EPS', 'grupo' => 'Herramientas', 'acciones' => ['ver', 'crear', 'editar', 'borrar']],
        ['key' => 'gestion-convenios', 'titulo' => 'Gestión Convenios', 'grupo' => 'Herramientas', 'acciones' => ['ver', 'crear', 'editar', 'borrar']],
        ['key' => 'gestion-regimen', 'titulo' => 'Gestión de Régimen', 'grupo' => 'Herramientas', 'acciones' => ['crear', 'editar', 'borrar']],
        ['key' => 'gestion-especialidades', 'titulo' => 'Gestión de Especialidades', 'grupo' => 'Herramientas', 'acciones' => ['ver', 'crear', 'editar', 'borrar']],
        ['key' => 'gestion-subespecialidades', 'titulo' => 'Gestión de Sub Especialidades', 'grupo' => 'Herramientas', 'acciones' => ['ver', 'crear', 'editar', 'borrar']],
        ['key' => 'gestion-tipo-documento', 'titulo' => 'Gestión Tipo Documento', 'grupo' => 'Herramientas', 'acciones' => ['ver', 'crear', 'editar', 'borrar']],
        ['key' => 'gestion-cups', 'titulo' => 'Gestión de CUPS', 'grupo' => 'Herramientas', 'acciones' => ['ver', 'crear', 'editar', 'borrar']],
        ['key' => 'gestion-cups-eps', 'titulo' => 'Gestión CUPS / EPS', 'grupo' => 'Herramientas', 'acciones' => ['ver', 'crear', 'editar', 'borrar']],
        ['key' => 'gestion-motivo', 'titulo' => 'Gestión de Motivo', 'grupo' => 'Herramientas', 'acciones' => ['ver', 'crear', 'editar', 'borrar']],
        ['key' => 'gestion-estado', 'titulo' => 'Gestión Estado', 'grupo' => 'Herramientas', 'acciones' => ['ver', 'crear', 'editar', 'borrar']],
        ['key' => 'gestion-estado-secundario', 'titulo' => 'Gestión Estado QX', 'grupo' => 'Herramientas', 'acciones' => ['ver', 'crear', 'editar', 'borrar']],
        ['key' => 'asignacion-estados', 'titulo' => 'Asignación Estados', 'grupo' => 'Herramientas', 'acciones' => ['ver', 'crear', 'editar', 'borrar']],
        // Bitácora de actividad. Solo se consulta: nadie la edita ni la borra
        // desde la interfaz, porque un registro de auditoría alterable no
        // sirve como evidencia.
        ['key' => 'herramientas-seguimiento', 'titulo' => 'Herramientas - Seguimiento', 'grupo' => 'Herramientas', 'acciones' => ['ver']],
    ];

    /**
     * Vistas que no se activan solas: mientras el rol no tenga fila guardada,
     * se dan por negadas. El resto conserva la regla histórica —sin
     * configurar, se permite—, que no puede aplicarse a una opción nueva sin
     * repartirla de golpe entre todos los roles.
     *
     * @var list<string>
     */
    public const VISTAS_OPT_IN = [
        'radicar-solicitud-hospitalario',
        'radicar-solicitud-programados',
        'radicar-solicitud-ver-programados',
        'radicar-solicitud-ver-programados-hemo',
    ];

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'role_id',
        'vista',
        'ver',
        'crear',
        'editar',
        'borrar',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'ver' => 'boolean',
            'crear' => 'boolean',
            'editar' => 'boolean',
            'borrar' => 'boolean',
        ];
    }

    /**
     * Rol al que pertenece el permiso.
     */
    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    /**
     * Claves de vistas administrables.
     *
     * @return array<int, string>
     */
    public static function vistasKeys(): array
    {
        return array_column(self::VISTAS, 'key');
    }

    /**
     * Nombres de roles que el usuario puede asignar al crear/editar usuarios.
     * Devuelve null cuando no hay restricción (Super Admin, o rol sin
     * configuración de roles asignables).
     *
     * @return array<int, string>|null
     */
    public static function rolesAsignablesPara(?User $user): ?array
    {
        if (! $user || $user->rol === User::SUPER_ADMIN) {
            return null;
        }

        $role = Role::where('Nombre', $user->rol)->first();

        if (! $role) {
            return [];
        }

        $nombres = $role->rolesAsignables()->pluck('Nombre')->all();

        return $nombres === [] ? null : $nombres;
    }
}
