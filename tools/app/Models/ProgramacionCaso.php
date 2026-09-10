<?php

namespace App\Models;

use App\Support\Sede;
use Illuminate\Database\Eloquent\Builder;
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
        'especialista_medico_id',
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
     * Una programación es de la sede de su radicación. Se filtra igual que
     * RadicarCaso para que la grilla "Ver programados" y los botones que la
     * editan o borran por id no alcancen las cirugías de la otra sede.
     */
    protected static function booted(): void
    {
        static::addGlobalScope('sede', function (Builder $query) {
            if ($sede = Sede::activa()) {
                $query->whereIn(
                    $query->qualifyColumn('codrad'),
                    RadicarCaso::withoutGlobalScope('sede')->where('sede', $sede)->select('codrad'),
                );
            }
        });
    }

    /**
     * Usuario que registró la programación.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Especialista (médico) que realizará la cirugía programada.
     */
    public function especialista(): BelongsTo
    {
        return $this->belongsTo(User::class, 'especialista_medico_id');
    }
}
