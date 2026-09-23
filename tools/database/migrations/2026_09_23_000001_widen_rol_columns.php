<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * users.rol y auditoria.rol guardan el nombre del rol, que en la tabla
     * roles admite 120 caracteres; aquí solo cabían 30. Un rol de nombre largo
     * ("Operador Cirugia CardioVascular", 31) se creaba sin problema pero al
     * asignarlo a un usuario la base lo rechazaba con un error 500.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('rol', 120)->default('paciente')->change();
        });

        Schema::table('auditoria', function (Blueprint $table) {
            $table->string('rol', 120)->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('rol', 30)->default('paciente')->change();
        });

        Schema::table('auditoria', function (Blueprint $table) {
            $table->string('rol', 30)->nullable()->change();
        });
    }
};
