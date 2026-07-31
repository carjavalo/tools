<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Convenio extends Model
{
    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'convenio';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'nit_Convenio',
        'nombre',
        'regimen',
        'tarifa',
        'vigencia_inicio',
        'vigencia_fin',
        'nit_empresa',
        'Estado',
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
            'vigencia_inicio' => 'date:Y-m-d',
            'vigencia_fin' => 'date:Y-m-d',
        ];
    }

    /**
     * EPS a la que pertenece el convenio (por NIT).
     */
    public function eps(): BelongsTo
    {
        return $this->belongsTo(Eps::class, 'nit_empresa', 'nit_empresa');
    }
}
