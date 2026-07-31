<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // El tipo de documento pasa a alimentarse desde la tabla tipo_documento
            // (Nombre varchar 120), por lo que ampliamos la columna.
            $table->string('tipo_Docu', 120)->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('tipo_Docu', 10)->nullable()->change();
        });
    }
};
