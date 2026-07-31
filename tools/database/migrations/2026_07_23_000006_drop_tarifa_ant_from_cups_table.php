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
            $table->dropColumn('TarifaAnt');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('cups', function (Blueprint $table) {
            $table->decimal('TarifaAnt', 14, 4)->nullable();
        });
    }
};
