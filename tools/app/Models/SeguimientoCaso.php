<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SeguimientoCaso extends Model
{
    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'seguimiento_caso';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'codrad',
        'codestsecundario',
        'codsubesp',
        'fecreci',
        'estcod',
        'venc_anestesia',
        'ObservacionCCX',
        'user_id',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'fecreci' => 'date:Y-m-d',
            'venc_anestesia' => 'date:Y-m-d',
        ];
    }

    /**
     * Usuario que realizó la modificación.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
