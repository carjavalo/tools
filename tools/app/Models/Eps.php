<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Eps extends Model
{
    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'eps';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'Nombre',
        'nit_empresa',
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
     * Convenios asociados a la EPS (por NIT).
     */
    public function convenios(): HasMany
    {
        return $this->hasMany(Convenio::class, 'nit_empresa', 'nit_empresa');
    }
}
