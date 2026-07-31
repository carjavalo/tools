<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->string('Nombre', 120);
            $table->boolean('Estado')->default(true);
            $table->string('Observacion', 300)->nullable();
            $table->timestamps();
        });

        // Sembrar los roles que el sistema ya utiliza, para no romper la
        // autenticación ni los selects existentes.
        DB::table('roles')->insert([
            ['Nombre' => 'paciente', 'Estado' => true, 'Observacion' => 'Rol por defecto de los pacientes.'],
            ['Nombre' => 'Medico', 'Estado' => true, 'Observacion' => 'Profesional médico.'],
            ['Nombre' => 'Operador', 'Estado' => true, 'Observacion' => 'Personal operativo.'],
            ['Nombre' => 'Super Admin', 'Estado' => true, 'Observacion' => 'Administrador del sistema.'],
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('roles');
    }
};
