<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Sedes por las que puede ingresar cada rol, configuradas en el Gestor de
     * Permisos. A diferencia de las demás tablas de configuración por rol,
     * aquí la ausencia de filas no significa "todo": un rol sin configurar
     * entra solo a la Sede Cali, que es donde operaban todos los roles antes
     * de existir Cartago. El Super Admin, los pacientes y los médicos no se
     * configuran aquí: siempre tienen las dos sedes.
     */
    public function up(): void
    {
        Schema::create('role_sedes', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('role_id');
            // La sede se guarda por clave (cali, cartago): no hay catálogo,
            // sale del código.
            $table->string('sede', 20);
            $table->timestamps();

            $table->unique(['role_id', 'sede'], 'role_sede_unique');
            $table->foreign('role_id')->references('id')->on('roles')->cascadeOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('role_sedes');
    }
};
