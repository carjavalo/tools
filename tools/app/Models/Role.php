<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Role extends Model
{
    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'roles';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'Nombre',
        'Estado',
        'Observacion',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'Estado' => 'boolean',
        ];
    }

    /**
     * Estados primarios (EstRadicado) asignados a este rol.
     */
    public function estadosRadicado(): BelongsToMany
    {
        return $this->belongsToMany(
            EstRadicado::class,
            'role_est_radicado',
            'role_id',
            'est_radicado_id',
        );
    }

    /**
     * Estados secundarios (EstRadisecundario) asignados a este rol.
     */
    public function estadosSecundarios(): BelongsToMany
    {
        return $this->belongsToMany(
            EstRadisecundario::class,
            'role_est_radisecundario',
            'role_id',
            'est_radisecundario_id',
        );
    }

    /**
     * Estados cuyas radicaciones puede ver este rol en la grilla del
     * Historial (configurado en el Gestor de Permisos; sin filas ve todas).
     */
    public function estadosGrilla(): BelongsToMany
    {
        return $this->belongsToMany(
            EstRadicado::class,
            'role_estados_grilla',
            'role_id',
            'est_radicado_id',
        );
    }

    /**
     * Estados secundarios cuyas radicaciones puede ver este rol en la grilla
     * del Historial (configurado en el Gestor de Permisos; sin filas ve
     * todas). Independiente del filtro por estado actual.
     */
    public function estadosSecGrilla(): BelongsToMany
    {
        return $this->belongsToMany(
            EstRadisecundario::class,
            'role_estados_sec_grilla',
            'role_id',
            'est_radisecundario_id',
        );
    }

    /**
     * Roles cuya actividad puede ver este rol en Herramientas - Seguimiento.
     * Sin filas, ve la de todos.
     */
    public function auditoriaRoles(): BelongsToMany
    {
        return $this->belongsToMany(
            Role::class,
            'role_auditoria_roles',
            'role_id',
            'rol_visible_id',
        );
    }

    /**
     * Roles que este rol puede asignar al crear o editar usuarios
     * (configurado en el Gestor de Permisos).
     */
    public function rolesAsignables(): BelongsToMany
    {
        return $this->belongsToMany(
            Role::class,
            'role_roles_asignables',
            'role_id',
            'asignable_role_id',
        );
    }
}
