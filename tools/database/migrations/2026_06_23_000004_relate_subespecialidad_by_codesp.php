<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * La relación real es:
     *   subespecialidad.especialidad_id  ->  especialidad.codesp
     * (no contra especialidad.id). Esta migración deja la columna como string y
     * sin la llave foránea a especialidad.id para soportar la relación por código.
     */
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() === 'mysql') {
            // Eliminar cualquier FK a especialidad.id que aún exista.
            foreach (DB::select(
                "SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subespecialidad'
                   AND CONSTRAINT_TYPE = 'FOREIGN KEY'"
            ) as $constraint) {
                Schema::table('subespecialidad', function (Blueprint $table) use ($constraint) {
                    $table->dropForeign($constraint->CONSTRAINT_NAME);
                });
            }

            DB::statement('ALTER TABLE subespecialidad MODIFY especialidad_id VARCHAR(10) NULL');

            return;
        }

        // Otros motores (SQLite en pruebas): la columna se creó con FK a
        // especialidad.id. Eliminamos la FK y la dejamos como string.
        Schema::table('subespecialidad', function (Blueprint $table) {
            $table->dropForeign(['especialidad_id']);
        });
        Schema::table('subespecialidad', function (Blueprint $table) {
            $table->string('especialidad_id', 10)->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No se revierte la estructura; la relación por codesp es la definitiva.
    }
};
