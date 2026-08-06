<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * MAOS: marca de la radicación que se diligencia desde el formulario
     * Aplicar Modificaciones del Historial. Es sí/no, así que se guarda como
     * booleano con valor por defecto "no" para las radicaciones existentes.
     */
    public function up(): void
    {
        Schema::table('RadicarCaso', function (Blueprint $table) {
            $table->boolean('maos')->default(false)->after('paquete');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('RadicarCaso', function (Blueprint $table) {
            $table->dropColumn('maos');
        });
    }
};
