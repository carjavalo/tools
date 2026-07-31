<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Cups extends Model
{
    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'cups';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'CodCupsHuv',
        'CodCupsHo',
        'Nombre',
        'descrip_Normativa',
        'Estado',
        'Observacion',
        'tipofactor',
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
}
