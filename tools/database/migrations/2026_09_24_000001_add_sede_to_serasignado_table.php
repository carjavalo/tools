<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Sede a la que pertenece cada servicio: la de la opción por la que entró
     * quien lo creó (Programación de Cirugía Sede Cali o Sede Cartago), igual
     * que las radicaciones. Los servicios que ya existían quedan en Cali.
     *
     * El nombre deja de ser único en toda la tabla y pasa a serlo por sede:
     * las dos sedes pueden tener un servicio con el mismo nombre.
     */
    public function up(): void
    {
        Schema::table('serasignado', function (Blueprint $table) {
            $table->string('sede', 20)->default('cali')->after('codigo');
            $table->index('sede');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('serasignado', function (Blueprint $table) {
            $table->dropIndex(['sede']);
            $table->dropColumn('sede');
        });
    }
};
