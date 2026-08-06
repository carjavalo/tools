<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Las subespecialidades dejan de depender de una especialidad: se pueden
     * crear libremente, exista o no la especialidad que antes las agrupaba.
     *
     * Se elimina la llave foránea, no la columna: codespcodser conserva lo ya
     * registrado y sigue sirviendo para agrupar en los filtros de Informes.
     * Borrar la columna destruiría esa información sin poder recuperarla.
     */
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'mysql') {
            // Otros motores (SQLite en pruebas): se quita por nombre de
            // columna, que es como se declaró la restricción.
            Schema::table('subespecialidad', function (Blueprint $table) {
                $table->dropForeign(['codespcodser']);
            });

            return;
        }

        foreach ($this->llavesForaneas() as $constraint) {
            Schema::table('subespecialidad', function (Blueprint $table) use ($constraint) {
                $table->dropForeign($constraint->CONSTRAINT_NAME);
            });
        }
    }

    /**
     * Reverse the migrations.
     *
     * Solo se restablece si toda subespecialidad apunta a una especialidad
     * existente. Si alguna quedó sin ella —que es justo lo que este cambio
     * permite—, recrear la llave foránea fallaría, así que se deja como está.
     */
    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'mysql') {
            Schema::table('subespecialidad', function (Blueprint $table) {
                $table->foreign('codespcodser')
                    ->references('espcodser')
                    ->on('especialidad')
                    ->cascadeOnUpdate();
            });

            return;
        }

        if (count($this->llavesForaneas()) > 0) {
            return;
        }

        $sinEspecialidadValida = DB::table('subespecialidad')
            ->where(function ($q) {
                $q->whereNull('codespcodser')
                    ->orWhere('codespcodser', '')
                    ->orWhereNotIn('codespcodser', DB::table('especialidad')->pluck('espcodser'));
            })
            ->count();

        if ($sinEspecialidadValida > 0) {
            return;
        }

        Schema::table('subespecialidad', function (Blueprint $table) {
            $table->foreign('codespcodser')
                ->references('espcodser')
                ->on('especialidad')
                ->cascadeOnUpdate();
        });
    }

    /**
     * Llaves foráneas de subespecialidad que apuntan a especialidad.
     *
     * @return array<int, object>
     */
    private function llavesForaneas(): array
    {
        return DB::select(
            "SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'subespecialidad'
               AND COLUMN_NAME = 'codespcodser'
               AND REFERENCED_TABLE_NAME IS NOT NULL"
        );
    }
};
