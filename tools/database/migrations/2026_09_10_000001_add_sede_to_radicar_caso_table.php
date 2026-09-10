<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Sede a la que pertenece cada radicación: la de la opción por la que
     * entró quien la creó (Programación de Cirugía Sede Cali o Sede Cartago).
     * Hasta ahora solo operaba Cali, así que todo lo radicado antes queda en
     * Cali por el valor por defecto. El seguimiento, la bitácora, las
     * cotizaciones y las programaciones no llevan sede propia: la heredan de
     * su radicación por el consecutivo.
     */
    public function up(): void
    {
        Schema::table('RadicarCaso', function (Blueprint $table) {
            $table->string('sede', 20)->default('cali')->after('codrad');
            $table->index('sede');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('RadicarCaso', function (Blueprint $table) {
            $table->dropIndex(['sede']);
            $table->dropColumn('sede');
        });
    }
};
