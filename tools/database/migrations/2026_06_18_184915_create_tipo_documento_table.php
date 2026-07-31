<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('tipo_documento', function (Blueprint $table) {
            $table->id();
            $table->string('Nombre', 120);
            $table->boolean('Estado')->default(true);
            $table->string('Observacion', 300)->nullable();
            $table->timestamps();
        });

        // Carga inicial con los tipos que ya usaban los selects de los modales.
        $now = now();
        $tipos = [
            'Cédula de Ciudadanía',
            'Tarjeta de Identidad',
            'Cédula de Extranjería',
            'Pasaporte',
            'Registro Civil',
            'NIT',
        ];

        DB::table('tipo_documento')->insert(array_map(fn ($nombre) => [
            'Nombre' => $nombre,
            'Estado' => true,
            'Observacion' => null,
            'created_at' => $now,
            'updated_at' => $now,
        ], $tipos));
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tipo_documento');
    }
};
