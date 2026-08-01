<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Paquete: documento PDF que se adjunta a la radicación. Se guarda la
     * ruta relativa dentro del disco 'public' (p. ej. paquetes/abc123.pdf);
     * el archivo en sí vive en storage/app/public/paquetes.
     */
    public function up(): void
    {
        Schema::table('RadicarCaso', function (Blueprint $table) {
            $table->string('paquete', 255)->nullable()->after('valor_copago');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('RadicarCaso', function (Blueprint $table) {
            $table->dropColumn('paquete');
        });
    }
};
