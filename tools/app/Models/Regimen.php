<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Regimen extends Model
{
    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'regimen';

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
}
