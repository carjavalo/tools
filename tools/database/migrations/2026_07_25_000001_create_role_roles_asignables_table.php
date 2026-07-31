<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Roles que cada rol puede asignar al crear o editar usuarios.
     * Sin filas para un rol, puede asignar todos (comportamiento por defecto).
     */
    public function up(): void
    {
        Schema::create('role_roles_asignables', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('role_id');
            $table->unsignedBigInteger('asignable_role_id');
            $table->timestamps();

            $table->unique(['role_id', 'asignable_role_id'], 'role_asignable_unique');
            $table->foreign('role_id')->references('id')->on('roles')->cascadeOnDelete();
            $table->foreign('asignable_role_id')->references('id')->on('roles')->cascadeOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('role_roles_asignables');
    }
};
