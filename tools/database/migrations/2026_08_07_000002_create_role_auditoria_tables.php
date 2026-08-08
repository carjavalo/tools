<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Qué puede ver cada rol dentro de Herramientas - Seguimiento:
     *   - role_auditoria_roles:   de qué roles ve la actividad.
     *   - role_auditoria_modulos: qué módulos ve (Radicaciones, Usuarios…).
     *
     * Sin filas para un rol, ve todo. Es el mismo criterio que ya usan
     * role_estados_grilla y role_roles_asignables: la configuración restringe,
     * no habilita, así que nada deja de funcionar por no configurarse.
     */
    public function up(): void
    {
        Schema::create('role_auditoria_roles', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('role_id');
            // Rol cuya actividad puede ver.
            $table->unsignedBigInteger('rol_visible_id');
            $table->timestamps();

            $table->unique(['role_id', 'rol_visible_id'], 'role_auditoria_rol_unique');
            $table->foreign('role_id')->references('id')->on('roles')->cascadeOnDelete();
            $table->foreign('rol_visible_id')->references('id')->on('roles')->cascadeOnDelete();
        });

        Schema::create('role_auditoria_modulos', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('role_id');
            // El módulo se guarda por nombre: no hay catálogo, sale del código.
            $table->string('modulo', 60);
            $table->timestamps();

            $table->unique(['role_id', 'modulo'], 'role_auditoria_modulo_unique');
            $table->foreign('role_id')->references('id')->on('roles')->cascadeOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('role_auditoria_modulos');
        Schema::dropIfExists('role_auditoria_roles');
    }
};
