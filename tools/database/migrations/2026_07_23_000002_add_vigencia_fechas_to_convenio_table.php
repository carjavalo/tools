<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * La vigencia del convenio se compone de fecha de inicio y fecha final.
     */
    public function up(): void
    {
        Schema::table('convenio', function (Blueprint $table) {
            $table->date('vigencia_inicio')->nullable()->after('tarifa');
            $table->date('vigencia_fin')->nullable()->after('vigencia_inicio');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('convenio', function (Blueprint $table) {
            $table->dropColumn(['vigencia_inicio', 'vigencia_fin']);
        });
    }
};
