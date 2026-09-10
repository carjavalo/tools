<?php

namespace App\Models;

use App\Support\Sede;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class CotizacionCaso extends Model
{
    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'cotizacion_caso';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'codrad',
        'tercero',
        'estado',
        'fecha_cotizacion',
        'valor',
        'adjunto',
        'observacion',
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
            'fecha_cotizacion' => 'date:Y-m-d',
            'valor' => 'decimal:2',
        ];
    }

    /**
     * Una cotización es de la sede de su radicación. Su PDF se abre por id
     * (/cotizacion/{id}/adjunto), así que sin este filtro se podría leer el
     * de una radicación de la otra sede.
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
}
