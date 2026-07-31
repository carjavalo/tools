<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('subespecialidad', function (Blueprint $table) {
            $table->id();
            $table->string('cod_SubEspecialidad', 10)->nullable();
            $table->string('Nombre', 120);
            $table->boolean('Estado')->default(true);
            $table->string('Observacion', 300)->nullable();
            // Relación: cada subespecialidad pertenece a una especialidad
            $table->foreignId('especialidad_id')
                ->constrained('especialidad')
                ->cascadeOnDelete();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('subespecialidad');
    }
};
