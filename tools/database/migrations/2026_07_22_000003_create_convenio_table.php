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
        Schema::create('convenio', function (Blueprint $table) {
            $table->id();
            $table->string('nit_Convenio', 25)->unique();
            $table->string('nombre', 120);
            $table->string('regimen', 120);
            $table->string('tarifa', 5);
            $table->string('nit_empresa', 25);
            $table->timestamps();

            $table->foreign('nit_empresa')
                ->references('nit_empresa')
                ->on('eps')
                ->cascadeOnUpdate()
                ->restrictOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('convenio');
    }
};
