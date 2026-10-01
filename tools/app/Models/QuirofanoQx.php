<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class QuirofanoQx extends Model
{
    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'quirofanoQx';

    /**
     * La tabla solo lleva id, nombre y estado: sin created_at / updated_at.
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
