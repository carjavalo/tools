<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Bitácora de actividad del sistema: qué hizo cada usuario, cuándo y
     * desde dónde, desde que entra hasta que sale.
     *
     * Los datos del usuario (nombre, cuenta y rol) se copian en la fila en vez
     * de resolverse por la relación: si mañana se renombra o se elimina el
     * usuario, el registro debe seguir diciendo quién actuó en ese momento.
     * Un log que cambia con el tiempo no sirve como evidencia.
     */
    public function up(): void
    {
        Schema::create('auditoria', function (Blueprint $table) {
            $table->id();

            // Quién. user_id queda nullable por si la cuenta se elimina.
            $table->unsignedBigInteger('user_id')->nullable()->index();
            $table->string('usuario', 200)->nullable();
            $table->string('cuenta', 255)->nullable();
            $table->string('rol', 30)->nullable()->index();

            // Qué. evento: sesion_inicio, sesion_fin, sesion_fallida, creacion,
            // modificacion, eliminacion.
            $table->string('evento', 20)->index();
            $table->string('modulo', 60)->nullable()->index();
            $table->text('descripcion');

            // Sobre qué registro, para poder rastrearlo después.
            $table->string('registro_tipo', 60)->nullable();
            $table->string('registro_id', 40)->nullable();

            // Detalle campo a campo del cambio (antes/después), sin datos
            // sensibles. Es texto JSON para no atarse a un motor concreto.
            $table->longText('cambios')->nullable();

            // Desde dónde.
            $table->string('ip', 45)->nullable();
            $table->string('navegador', 255)->nullable();

            $table->timestamps();

            // La vista ordena por fecha descendente y filtra por rol y módulo.
            $table->index(['created_at', 'id']);
            $table->index(['registro_tipo', 'registro_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('auditoria');
    }
};
