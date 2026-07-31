<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SubEspecialidad extends Model
{
    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'subespecialidad';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'cod_SubEspecialidad',
        'codespcodser',
        'codminsal',
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
     * La especialidad a la que pertenece esta subespecialidad.
     *
     * @return BelongsTo<Especialidad, SubEspecialidad>
     */
    public function especialidad(): BelongsTo
    {
        return $this->belongsTo(Especialidad::class, 'codespcodser', 'espcodser');
    }
}
