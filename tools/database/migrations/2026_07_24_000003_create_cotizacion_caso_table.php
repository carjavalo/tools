<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Cotizaciones de conceptos/productos no convenidos por radicación.
     * Una radicación (RadicarCaso.codrad) puede tener una o más cotizaciones.
     */
    public function up(): void
    {
        Schema::create('cotizacion_caso', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('codrad')->index();
            $table->string('tercero', 200);
            $table->string('estado', 5)->nullable();
            $table->date('fecha_cotizacion');
            $table->decimal('valor', 14, 2)->default(0);
            $table->string('adjunto', 255)->nullable();
            $table->string('observacion', 1200)->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('cotizacion_caso');
    }
};
