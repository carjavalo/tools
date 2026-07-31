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
        Schema::create('EstRadisecundario', function (Blueprint $table) {
            $table->id();
            $table->string('Nombre', 120);
            $table->boolean('Estado')->default(true);
            $table->string('Observacion', 300)->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('EstRadisecundario');
    }
};
