<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Estado del servicio: activo o inactivo. Los servicios que ya existían
     * quedan activos por el valor por defecto.
     */
    public function up(): void
    {
        Schema::table('serasignado', function (Blueprint $table) {
            $table->boolean('estado')->default(true)->after('descripcion');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('serasignado', function (Blueprint $table) {
            $table->dropColumn('estado');
        });
    }
};
