<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Tabla pivote que asocia EPS con CUVS / tipos de acuerdo (muchos a muchos).
     */
    public function up(): void
    {
        Schema::create('cuvs_eps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('eps_id')->constrained('eps')->cascadeOnDelete();
            $table->foreignId('cuvs_id')->constrained('cuvs')->cascadeOnDelete();
            $table->boolean('Estado')->default(true);
            $table->string('Observacion', 300)->nullable();
            $table->timestamps();

            // Una EPS no puede asociarse dos veces al mismo CUVS.
            $table->unique(['eps_id', 'cuvs_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('cuvs_eps');
    }
};
