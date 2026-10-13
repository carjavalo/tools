<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Opciones del menú de usuario (Cambiar cuenta, Cambiar contraseña,
     * autenticación en dos pasos, eliminar cuenta) que cada rol puede usar,
     * configuradas en el Gestor Menú de Usuario. Una opción sin fila para el
     * rol se permite (el comportamiento de siempre). El Super Admin no se
     * configura: siempre las tiene todas.
     */
    public function up(): void
    {
        Schema::create('role_menu_usuario', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('role_id');
            // La opción se guarda por clave: no hay catálogo, sale del código.
            $table->string('opcion', 40);
            $table->boolean('permitido')->default(true);
            $table->timestamps();

            $table->unique(['role_id', 'opcion'], 'role_menu_usuario_unique');
            $table->foreign('role_id')->references('id')->on('roles')->cascadeOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('role_menu_usuario');
    }
};
