<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Los botones "Ver programados" (cirugía, Hemo y Cvascular) ganan las
     * acciones editar y borrar. Hasta ahora esas columnas no significaban nada
     * para ellos y la tabla las crea en 1 por defecto: se apagan para que
     * ningún rol reciba editar o borrar programaciones sin que el Super Admin
     * se las asigne en el Gestor de Permisos.
     */
    public function up(): void
    {
        DB::table('permisos')
            ->whereIn('vista', [
                'radicar-solicitud-ver-programados',
                'radicar-solicitud-ver-programados-hemo',
                'radicar-solicitud-ver-programados-cvascular',
            ])
            ->update(['editar' => false, 'borrar' => false]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Nada que revertir: antes de esta migración las columnas no se usaban.
    }
};
