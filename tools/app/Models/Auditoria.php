<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Auditoria extends Model
{
    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'auditoria';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'usuario',
        'cuenta',
        'rol',
        'evento',
        'modulo',
        'descripcion',
        'registro_tipo',
        'registro_id',
        'cambios',
        'ip',
        'navegador',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'cambios' => 'array',
        ];
    }

    /**
     * Usuario que ejecutó la acción. Puede no existir si la cuenta se eliminó;
     * los datos copiados en la fila siguen siendo la fuente para mostrarla.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
