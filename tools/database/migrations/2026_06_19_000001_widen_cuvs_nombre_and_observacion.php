<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Amplía las columnas de texto de cuvs para alojar el catálogo CUPS/CUVS:
     *  - Nombre:     120  -> 800
     *  - Observacion 300  -> 1200
     */
    public function up(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            Schema::table('cuvs', function (Blueprint $table) {
                $table->string('Nombre', 800)->change();
                $table->string('Observacion', 1200)->nullable()->change();
            });

            return;
        }

        DB::statement('ALTER TABLE `cuvs` MODIFY `Nombre` VARCHAR(800) NOT NULL');
        DB::statement('ALTER TABLE `cuvs` MODIFY `Observacion` VARCHAR(1200) NULL');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            Schema::table('cuvs', function (Blueprint $table) {
                $table->string('Nombre', 120)->change();
                $table->string('Observacion', 300)->nullable()->change();
            });

            return;
        }

        DB::statement('ALTER TABLE `cuvs` MODIFY `Nombre` VARCHAR(120) NOT NULL');
        DB::statement('ALTER TABLE `cuvs` MODIFY `Observacion` VARCHAR(300) NULL');
    }
};
