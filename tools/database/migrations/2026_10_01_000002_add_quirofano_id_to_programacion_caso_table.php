<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Quirófano en el que se atenderá la cirugía programada (catálogo
     * quirofanoQx). Opcional, como el resto de datos de la programación: las
     * programaciones anteriores quedan sin quirófano.
     */
    public function up(): void
    {
        Schema::table('programacion_caso', function (Blueprint $table) {
            $table->unsignedInteger('quirofano_id')->nullable()->after('especialista_medico_id');
            $table->index('quirofano_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('programacion_caso', function (Blueprint $table) {
            $table->dropIndex(['quirofano_id']);
            $table->dropColumn('quirofano_id');
        });
    }
};
