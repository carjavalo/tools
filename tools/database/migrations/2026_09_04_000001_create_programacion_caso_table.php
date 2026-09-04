<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Control de radicaciones programadas para cirugía. Se diligencia desde el
     * formulario "Aplicar Modificaciones al Caso" (Historial) cuando el Estado
     * QX se pone en "Programados". Vive aparte del caso y del seguimiento: es
     * una bitácora de programaciones, así que cada vez que un caso pasa a
     * Programados queda una fila con quién y cuándo la registró.
     */
    public function up(): void
    {
        Schema::create('programacion_caso', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('codrad');
            // Fecha y hora de la cirugía programada: lleva hora, no solo fecha.
            $table->dateTime('fecha_programacion')->nullable();
            // Especialista que hará la cirugía: apunta al banco de médicos
            // (users con rol Medico), no a un texto suelto.
            $table->unsignedBigInteger('especialista_medico_id')->nullable();
            $table->text('observaciones_prg')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->timestamps();
            $table->index('codrad');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('programacion_caso');
    }
};
