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
        Schema::create('RadicarCaso', function (Blueprint $table) {
            $table->id('codrad');
            $table->string('Codesp', 10)->nullable();
            $table->string('codsubesp', 10)->nullable();
            $table->string('codMed', 20)->nullable();
            $table->string('Ndocumento', 20)->nullable();
            $table->string('estRad', 5)->nullable();
            $table->date('fentregapro')->nullable();
            $table->string('codestsecundario', 5)->nullable();
            $table->date('fecreci')->nullable();
            $table->string('estcod', 5)->nullable();
            $table->date('fecAutorizacion')->nullable();
            $table->date('fechavenautorizacion')->nullable();
            $table->text('ObservacionTFX')->nullable();
            $table->text('ObservacionCCX')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('RadicarCaso');
    }
};
