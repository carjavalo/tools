<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Observaciones de la Revisión Clínica Hemodinamia: las diligencia el
     * formulario Aplicar Modificaciones (Historial) Hemo cuando el Estado QX
     * es "Revisión Clínica Hemodinamia". Como Observaciones CCX, solo crece:
     * cada observación se anexa al final, firmada con su autor y la fecha.
     */
    public function up(): void
    {
        Schema::table('RadicarCaso', function (Blueprint $table) {
            $table->text('obs_revision_hemo')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('RadicarCaso', function (Blueprint $table) {
            $table->dropColumn('obs_revision_hemo');
        });
    }
};
