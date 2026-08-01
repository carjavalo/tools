<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RadicarCaso extends Model
{
    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'RadicarCaso';

    /**
     * The primary key for the model.
     *
     * @var string
     */
    protected $primaryKey = 'codrad';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'Codesp',
        'codsubesp',
        'codMed',
        'Ndocumento',
        'convenio',
        'copago',
        'valor_copago',
        'estRad',
        'fentregapro',
        'codestsecundario',
        'fecreci',
        'estcod',
        'fecAutorizacion',
        'fechavenautorizacion',
        'ObservacionTFX',
        'ObservacionCCX',
        'venc_anestesia',
        'estado_qx',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'copago' => 'boolean',
            'valor_copago' => 'decimal:2',
            'fentregapro' => 'date:Y-m-d',
            'fecreci' => 'date:Y-m-d',
            'fecAutorizacion' => 'date:Y-m-d',
            'fechavenautorizacion' => 'date:Y-m-d',
            'venc_anestesia' => 'date:Y-m-d',
        ];
    }
}
