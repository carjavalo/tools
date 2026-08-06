<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * "Estado QX" pasa a ser el nombre del estado secundario, que ya se
     * escoge de un catálogo. La columna estado_qx era un texto libre para lo
     * mismo, así que se elimina para no tener dos campos compitiendo por el
     * mismo significado.
     */
    public function up(): void
    {
        foreach (['RadicarCaso', 'seguimiento_caso'] as $tabla) {
            if (Schema::hasColumn($tabla, 'estado_qx')) {
                Schema::table($tabla, function (Blueprint $table) {
                    $table->dropColumn('estado_qx');
                });
            }
        }
    }

    /**
     * Reverse the migrations.
     *
     * Se recrea la columna vacía: el texto libre que tuviera se pierde al
     * eliminarla, no hay forma de recuperarlo.
     */
    public function down(): void
    {
        foreach (['RadicarCaso', 'seguimiento_caso'] as $tabla) {
            if (! Schema::hasColumn($tabla, 'estado_qx')) {
                Schema::table($tabla, function (Blueprint $table) {
                    $table->string('estado_qx', 120)->nullable();
                });
            }
        }
    }
};
