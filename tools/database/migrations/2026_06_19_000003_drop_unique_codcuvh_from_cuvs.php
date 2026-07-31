<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * CodCuvH NO es único: puede repetirse entre registros (un mismo CUPS puede
     * estar referenciado por varios CodCuvsP, p. ej. paquetes). Solo CodCuvsP
     * permanece único.
     */
    public function up(): void
    {
        Schema::table('cuvs', function (Blueprint $table) {
            $table->dropUnique('cuvs_codcuvh_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('cuvs', function (Blueprint $table) {
            $table->unique('CodCuvH');
        });
    }
};
