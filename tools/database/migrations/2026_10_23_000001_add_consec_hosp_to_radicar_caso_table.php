<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Consecutivo propio de los radicados hospitalarios: 1, 2, 3… Se muestra
     * en la pestaña Radicado Hospitalario con la letra «H» al final (1H, 2H…).
     * El codrad (llave primaria) sigue siendo el mismo autoincremento común a
     * todas las radicaciones; esta columna solo numera las hospitalarias. Las
     * ambulatorias y las hospitalarias anteriores quedan en null.
     */
    public function up(): void
    {
        Schema::table('RadicarCaso', function (Blueprint $table) {
            $table->unsignedInteger('consec_hosp')->nullable()->after('ambito');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('RadicarCaso', function (Blueprint $table) {
            $table->dropColumn('consec_hosp');
        });
    }
};
