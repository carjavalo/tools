<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Catálogo de servicios asignables (Gestión Servicios). Lleva solo los
     * campos pedidos: código, nombre y descripción, sin marcas de tiempo; quién
     * y cuándo cambió cada servicio queda en la bitácora de auditoría.
     */
    public function up(): void
    {
        Schema::create('serasignado', function (Blueprint $table) {
            $table->increments('codigo');
            $table->string('nombre', 120);
            $table->string('descripcion', 120)->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('serasignado');
    }
};
