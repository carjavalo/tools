<?php

namespace App\Models;

use App\Support\Sede;
use Illuminate\Database\Eloquent\Builder;
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
        'paquete',
        'maos',
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
            'maos' => 'boolean',
            'valor_copago' => 'decimal:2',
            'fentregapro' => 'date:Y-m-d',
            'fecreci' => 'date:Y-m-d',
            'fecAutorizacion' => 'date:Y-m-d',
            'fechavenautorizacion' => 'date:Y-m-d',
            'venc_anestesia' => 'date:Y-m-d',
        ];
    }

    /**
     * Cada radicación es de una sede y solo se ve desde ella (ver App\Support\Sede).
     *
     * El filtro va como alcance global y no consulta por consulta: así cubre
     * también la búsqueda por URL de un caso ({caso} en las rutas), y una
     * consulta nueva no puede olvidarlo y mostrar radicaciones de la otra
     * sede. Sin usuario con sesión (consola, colas) no filtra. Lo que debe
     * cruzar sedes —un paciente es de ambas— lo quita expresamente con
     * withoutGlobalScope('sede').
     *
     * La sede no es asignable desde la petición: la radicación nace en la sede
     * activa de quien la crea.
     */
    protected static function booted(): void
    {
        static::addGlobalScope('sede', function (Builder $query) {
            if ($sede = Sede::activa()) {
                $query->where($query->qualifyColumn('sede'), $sede);
            }
        });

        static::creating(function (RadicarCaso $caso) {
            $caso->sede ??= Sede::activa() ?? Sede::CALI;
        });
    }
}
