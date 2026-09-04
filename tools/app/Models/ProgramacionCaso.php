<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProgramacionCaso extends Model
{
    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'programacion_caso';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'codrad',
        'fecha_programacion',
        'especialista_medico',
        'observaciones_prg',
        'user_id',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            // Lleva hora además de la fecha (input datetime-local del formulario).
            'fecha_programacion' => 'datetime:Y-m-d H:i',
        ];
    }

    /**
     * Usuario que registró la programación.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
