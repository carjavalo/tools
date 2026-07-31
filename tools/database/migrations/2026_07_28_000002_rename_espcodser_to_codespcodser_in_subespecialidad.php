<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * especialidad.espcodser pasa a ser llave única (referenciable) y en
     * subespecialidad el campo se renombra a codespcodser y queda como llave
     * foránea hacia especialidad.espcodser.
     */
    public function up(): void
    {
        Schema::table('especialidad', function (Blueprint $table) {
            $table->unique('espcodser');
        });

        Schema::table('subespecialidad', function (Blueprint $table) {
            $table->renameColumn('espcodser', 'codespcodser');
        });

        Schema::table('subespecialidad', function (Blueprint $table) {
            $table->foreign('codespcodser')
                ->references('espcodser')
                ->on('especialidad')
                ->cascadeOnUpdate()
                ->restrictOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('subespecialidad', function (Blueprint $table) {
            $table->dropForeign(['codespcodser']);
        });

        Schema::table('subespecialidad', function (Blueprint $table) {
            $table->renameColumn('codespcodser', 'espcodser');
        });

        Schema::table('especialidad', function (Blueprint $table) {
            $table->dropUnique(['espcodser']);
        });
    }
};
