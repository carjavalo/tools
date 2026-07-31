<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Trazabilidad de modificaciones (segmento 5) de la pestaña Historial.
     */
    public function up(): void
    {
        Schema::create('seguimiento_caso', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('codrad');
            $table->string('codestsecundario', 5)->nullable();
            $table->date('fecreci')->nullable();
            $table->string('estcod', 5)->nullable();
            $table->date('venc_anestesia')->nullable();
            $table->string('estado_qx', 120)->nullable();
            $table->text('ObservacionCCX')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->timestamps();
            $table->index('codrad');
        });

        // Campos de seguimiento adicionales en el caso.
        Schema::table('RadicarCaso', function (Blueprint $table) {
            $table->date('venc_anestesia')->nullable();
            $table->string('estado_qx', 120)->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('seguimiento_caso');
        Schema::table('RadicarCaso', function (Blueprint $table) {
            $table->dropColumn(['venc_anestesia', 'estado_qx']);
        });
    }
};
