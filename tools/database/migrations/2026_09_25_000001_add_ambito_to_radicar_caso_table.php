<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Ámbito de la radicación: 'ambulatorio' (pestaña Nueva Radicación) u
     * 'hospitalario' (pestaña Radicado Hospitalario, de extrema prioridad).
     * Operativamente se manejan igual; el ámbito solo las distingue en las
     * grillas y los filtros. Las radicaciones que ya existían se hicieron
     * todas desde Nueva Radicación, así que quedan como ambulatorias.
     */
    public function up(): void
    {
        Schema::table('RadicarCaso', function (Blueprint $table) {
            $table->string('ambito', 20)->default('ambulatorio')->after('sede');
            $table->index('ambito');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('RadicarCaso', function (Blueprint $table) {
            $table->dropIndex(['ambito']);
            $table->dropColumn('ambito');
        });
    }
};
