<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CupsEps extends Model
{
    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'cuvs_eps';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'eps_id',
        'cuvs_id',
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
     * EPS asociada.
     */
    public function eps(): BelongsTo
    {
        return $this->belongsTo(Eps::class, 'eps_id');
    }

    /**
     * CUPS / tipo de acuerdo asociado.
     */
    public function cups(): BelongsTo
    {
        return $this->belongsTo(Cups::class, 'cuvs_id');
    }
}
