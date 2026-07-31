<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Los usuarios con rol "Medico" se registran solo como directorio de
     * médicos tratantes: no inician sesión, por lo que no se les pide correo
     * ni contraseña. Ambas columnas pasan a ser opcionales.
     *
     * El índice único de email se conserva: MySQL admite varios NULL en un
     * índice UNIQUE, así que pueden coexistir muchos médicos sin correo.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('email')->nullable()->change();
            $table->string('password')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('email')->nullable(false)->change();
            $table->string('password')->nullable(false)->change();
        });
    }
};
