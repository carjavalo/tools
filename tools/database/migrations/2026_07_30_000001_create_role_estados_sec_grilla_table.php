<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Estados secundarios cuyas radicaciones puede ver cada rol en la grilla
     * del Historial (Radicar Solicitud). Independiente de la Asignación de
     * Estados y del filtro por estado actual. Sin filas para un rol, ve todas.
     */
    public function up(): void
    {
        Schema::create('role_estados_sec_grilla', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('role_id');
            $table->unsignedBigInteger('est_radisecundario_id');
            $table->timestamps();

            $table->unique(['role_id', 'est_radisecundario_id'], 'role_estado_sec_grilla_unique');
            $table->foreign('role_id')->references('id')->on('roles')->cascadeOnDelete();
            $table->foreign('est_radisecundario_id')->references('id')->on('EstRadisecundario')->cascadeOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('role_estados_sec_grilla');
    }
};
