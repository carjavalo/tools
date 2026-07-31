<?php

namespace App\Models;

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
}
