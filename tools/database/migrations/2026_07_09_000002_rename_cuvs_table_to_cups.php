<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Renombra la tabla `cuvs` a `cups`.
     *
     * La tabla `cuvs_eps` tiene una clave foránea (`cuvs_id`) que referencia a
     * `cuvs`. En SQLite el renombrado actualiza esa referencia automáticamente;
     * en MySQL/MariaDB se quita la FK, se renombra y se vuelve a crear apuntando
     * a `cups`. El nombre de la columna `cuvs_id` se conserva.
     */
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() === 'sqlite') {
            Schema::rename('cuvs', 'cups');

            return;
        }

        Schema::table('cuvs_eps', function (Blueprint $table) {
            $table->dropForeign(['cuvs_id']);
        });

        Schema::rename('cuvs', 'cups');

        Schema::table('cuvs_eps', function (Blueprint $table) {
            $table->foreign('cuvs_id')->references('id')->on('cups')->cascadeOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() === 'sqlite') {
            Schema::rename('cups', 'cuvs');

            return;
        }

        Schema::table('cuvs_eps', function (Blueprint $table) {
            $table->dropForeign(['cuvs_id']);
        });

        Schema::rename('cups', 'cuvs');

        Schema::table('cuvs_eps', function (Blueprint $table) {
            $table->foreign('cuvs_id')->references('id')->on('cuvs')->cascadeOnDelete();
        });
    }
};
