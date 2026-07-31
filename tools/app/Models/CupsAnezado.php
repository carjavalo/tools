<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CupsAnezado extends Model
{
    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'cuvsAnezados';

    /**
     * Indicates if the model should be timestamped.
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
        'codRadicado',
        'cusv_id',
        'N_Autorizacion',
    ];
}
