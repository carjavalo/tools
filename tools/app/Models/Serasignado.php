<?php

namespace App\Models;

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
}
