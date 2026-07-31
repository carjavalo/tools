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
        Schema::table('especialidad', function (Blueprint $table) {
            $table->string('espcodser', 10)->nullable()->after('codesp');
            $table->string('codminsal', 10)->nullable()->after('espcodser');
        });

        Schema::table('subespecialidad', function (Blueprint $table) {
            $table->string('espcodser', 10)->nullable()->after('cod_SubEspecialidad');
            $table->string('codminsal', 10)->nullable()->after('espcodser');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('especialidad', function (Blueprint $table) {
            $table->dropColumn(['espcodser', 'codminsal']);
        });

        Schema::table('subespecialidad', function (Blueprint $table) {
            $table->dropColumn(['espcodser', 'codminsal']);
        });
    }
};
