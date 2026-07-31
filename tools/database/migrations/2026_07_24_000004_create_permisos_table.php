<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Permisos por rol y vista: acceso (ver) y acciones (crear, editar,
     * borrar). Si un rol no tiene fila para una vista, se le permite
     * (compatibilidad hasta que el Super Admin configure).
     */
    public function up(): void
    {
        Schema::create('permisos', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('role_id');
            $table->string('vista', 60);
            $table->boolean('ver')->default(true);
            $table->boolean('crear')->default(true);
            $table->boolean('editar')->default(true);
            $table->boolean('borrar')->default(true);
            $table->timestamps();

            $table->unique(['role_id', 'vista']);
            $table->foreign('role_id')->references('id')->on('roles')->cascadeOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('permisos');
    }
};
