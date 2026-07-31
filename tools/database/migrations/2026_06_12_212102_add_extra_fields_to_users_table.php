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
        Schema::table('users', function (Blueprint $table) {
            $table->string('tipo_Docu', 10)->nullable();
            $table->string('Numero_D', 20)->nullable();
            $table->string('Apellido1', 50)->nullable();
            $table->string('apellido2', 50)->nullable();
            $table->string('Telefono1', 50)->nullable();
            $table->string('telefono2', 50)->nullable();
            $table->string('Direccion', 80)->nullable();
            $table->string('Eps', 50)->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'tipo_Docu',
                'Numero_D',
                'Apellido1',
                'apellido2',
                'Telefono1',
                'telefono2',
                'Direccion',
                'Eps'
            ]);
        });
    }
};
