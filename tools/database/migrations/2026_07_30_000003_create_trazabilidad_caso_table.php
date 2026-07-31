<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Bitácora de cambios de una radicación: una fila por cada campo que
     * cambia, con el valor anterior y el nuevo ya resueltos a texto legible
     * (nombre del estado, del médico, etc.), más el usuario y la hora.
     *
     * Complementa a seguimiento_caso, que guarda la foto del formulario
     * "Aplicar Modificaciones"; aquí queda el detalle campo por campo de
     * cualquier punto que altere el caso.
     */
    public function up(): void
    {
        Schema::create('trazabilidad_caso', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('codrad')->index();
            $table->unsignedBigInteger('user_id')->nullable();
            // creacion | modificacion | seguimiento | cotizacion | eliminacion
            $table->string('evento', 20)->index();
            // Columna técnica de RadicarCaso (null en el evento de creación).
            $table->string('campo', 40)->nullable();
            // Nombre del campo como se ve en la vista: "Estado Actual", etc.
            $table->string('etiqueta', 80)->nullable();
            // Valores ya legibles. Se congelan al momento del cambio para que
            // renombrar un estado después no reescriba la historia.
            $table->string('anterior', 500)->nullable();
            $table->string('nuevo', 500)->nullable();
            $table->timestamps();

            $table->index(['codrad', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('trazabilidad_caso');
    }
};
