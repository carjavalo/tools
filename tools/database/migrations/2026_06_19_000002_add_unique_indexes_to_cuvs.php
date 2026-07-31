<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * CodCuvsP y CodCuvH deben ser únicos: ningún otro registro puede repetirlos.
     * (Los valores NULL/vacíos no colisionan entre sí en MySQL/SQLite.)
     */
    public function up(): void
    {
        Schema::table('cuvs', function (Blueprint $table) {
            $table->unique('CodCuvsP');
            $table->unique('CodCuvH');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('cuvs', function (Blueprint $table) {
            $table->dropUnique(['CodCuvsP']);
            $table->dropUnique(['CodCuvH']);
        });
    }
};
