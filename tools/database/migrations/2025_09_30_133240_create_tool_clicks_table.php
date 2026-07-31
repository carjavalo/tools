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
        Schema::create('tool_clicks', function (Blueprint $table) {
            $table->id();
            $table->string('tool_id')->index(); // ID de la herramienta (ej: 'qr-generator')
            $table->string('ip_address')->nullable(); // IP del usuario (opcional)
            $table->string('user_agent')->nullable(); // User agent (opcional)
            $table->timestamps(); // created_at y updated_at
            
            // Índice para consultas rápidas de popularidad (últimas 24 horas)
            $table->index(['tool_id', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tool_clicks');
    }
};
