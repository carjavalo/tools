<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Catálogo de quirófanos (Gestión Quirófanos QX). El nombre de la tabla va
     * sin tilde ("quirofanoQx"): una tilde en un identificador de MySQL obliga
     * a citarlo siempre y se rompe con cualquier cotejamiento distinto.
     */
    public function up(): void
    {
        Schema::create('quirofanoQx', function (Blueprint $table) {
            $table->increments('id');
            $table->string('nombre', 100);
            $table->boolean('estado')->default(true);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('quirofanoQx');
    }
};
