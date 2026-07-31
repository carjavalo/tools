<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Código de especialidad asociado al usuario cuando su rol es "Medico".
     * Referencia (por código) a especialidad.espcodser, igual que radicar_caso.Codesp.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('codesp', 10)->nullable()->after('Eps');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('codesp');
        });
    }
};
