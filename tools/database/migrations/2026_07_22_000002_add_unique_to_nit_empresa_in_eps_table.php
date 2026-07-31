<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * El índice único es requisito para que otras tablas puedan
     * referenciar eps.nit_empresa como llave foránea.
     */
    public function up(): void
    {
        Schema::table('eps', function (Blueprint $table) {
            $table->unique('nit_empresa');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('eps', function (Blueprint $table) {
            $table->dropUnique(['nit_empresa']);
        });
    }
};
