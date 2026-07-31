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
        Schema::table('cups', function (Blueprint $table) {
            $table->string('nomlarg', 1200)->nullable()->after('Nombre');
            $table->string('tipofactor', 10)->nullable()->after('Observacion');
            $table->decimal('TarifaAnt', 14, 4)->nullable()->after('tipofactor');
            $table->decimal('TarifaVig', 14, 4)->nullable()->after('TarifaAnt');
            $table->string('TarEPSUVB', 10)->nullable()->after('TarifaVig');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('cups', function (Blueprint $table) {
            $table->dropColumn([
                'nomlarg',
                'tipofactor',
                'TarifaAnt',
                'TarifaVig',
                'TarEPSUVB',
            ]);
        });
    }
};
