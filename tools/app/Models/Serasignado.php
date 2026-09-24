<?php

namespace App\Models;

use App\Support\Sede;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class Serasignado extends Model
{
    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'serasignado';

    /**
     * The primary key associated with the table.
     *
     * @var string
     */
    protected $primaryKey = 'codigo';

    /**
     * La tabla no lleva created_at ni updated_at.
     *
     * @var bool
     */
    public $timestamps = false;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'nombre',
        'descripcion',
        'estado',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'estado' => 'boolean',
        ];
    }

    /**
     * Cada servicio es de una sede y solo se ve desde ella, igual que las
     * radicaciones (ver App\Support\Sede). Como alcance global cubre también
     * la búsqueda por URL ({servicio} en las rutas): desde Cali no se puede
     * editar ni borrar un servicio de Cartago.
     *
     * La sede no es asignable desde la petición: el servicio nace en la sede
     * activa de quien lo crea.
     */
    protected static function booted(): void
    {
        static::addGlobalScope('sede', function (Builder $query) {
            if ($sede = Sede::activa()) {
                $query->where($query->qualifyColumn('sede'), $sede);
            }
        });

        static::creating(function (Serasignado $servicio) {
            $servicio->sede ??= Sede::activa() ?? Sede::CALI;
        });
    }
}
