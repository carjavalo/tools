<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Servicio al que se asigna la radicación para su trámite: apunta al
     * catálogo de Gestión Servicios (serasignado.codigo). Queda nulo en las
     * radicaciones anteriores; las nuevas lo exigen desde el formulario.
     */
    public function up(): void
    {
        Schema::table('RadicarCaso', function (Blueprint $table) {
            $table->unsignedInteger('codservicio')->nullable()->after('sede');
            $table->index('codservicio');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('RadicarCaso', function (Blueprint $table) {
            $table->dropIndex(['codservicio']);
            $table->dropColumn('codservicio');
        });
    }
};
