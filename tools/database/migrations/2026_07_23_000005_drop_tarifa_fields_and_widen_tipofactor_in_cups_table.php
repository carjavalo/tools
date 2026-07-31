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
            $table->dropColumn(['descrip_Normativa', 'TarifaVig', 'TarEPSUVB']);
        });

        Schema::table('cups', function (Blueprint $table) {
            $table->string('tipofactor', 30)->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('cups', function (Blueprint $table) {
            $table->string('tipofactor', 10)->nullable()->change();
        });

        Schema::table('cups', function (Blueprint $table) {
            $table->string('descrip_Normativa', 1200)->nullable();
            $table->decimal('TarifaVig', 14, 4)->nullable();
            $table->string('TarEPSUVB', 10)->nullable();
        });
    }
};
