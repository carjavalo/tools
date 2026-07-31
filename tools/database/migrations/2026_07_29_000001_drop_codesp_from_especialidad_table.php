<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Elimina especialidad.codesp. La llave de relación definitiva es
     * especialidad.espcodser (única y referenciada por
     * subespecialidad.codespcodser), por lo que codesp queda obsoleto.
     */
    public function up(): void
    {
        if (! Schema::hasColumn('especialidad', 'codesp')) {
            return;
        }

        Schema::table('especialidad', function (Blueprint $table) {
            $table->dropColumn('codesp');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('especialidad', 'codesp')) {
            return;
        }

        Schema::table('especialidad', function (Blueprint $table) {
            $table->string('codesp', 10)->nullable();
        });
    }
};
