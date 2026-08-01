<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Copago de la radicación: si aplica y por cuánto. El valor queda nulo
     * cuando no hay copago, para poder distinguir "no aplica" de "aplica por
     * cero", que no es lo mismo en una consulta posterior.
     */
    public function up(): void
    {
        Schema::table('RadicarCaso', function (Blueprint $table) {
            $table->boolean('copago')->default(false)->after('convenio');
            $table->decimal('valor_copago', 14, 2)->nullable()->after('copago');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('RadicarCaso', function (Blueprint $table) {
            $table->dropColumn(['copago', 'valor_copago']);
        });
    }
};
