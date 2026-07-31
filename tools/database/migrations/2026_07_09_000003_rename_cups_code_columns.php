<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Renombra las columnas de código de la tabla `cups`:
     *   CodCuvsP -> CodCupsHuv
     *   CodCuvH  -> CodCupsHo
     *
     * En MySQL/MariaDB se usa CHANGE COLUMN (conserva el índice único de
     * CodCuvsP); en SQLite se usa renameColumn.
     */
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() === 'sqlite') {
            Schema::table('cups', function (Blueprint $table) {
                $table->renameColumn('CodCuvsP', 'CodCupsHuv');
                $table->renameColumn('CodCuvH', 'CodCupsHo');
            });

            return;
        }

        DB::statement('ALTER TABLE `cups` CHANGE COLUMN `CodCuvsP` `CodCupsHuv` VARCHAR(10) NULL');
        DB::statement('ALTER TABLE `cups` CHANGE COLUMN `CodCuvH` `CodCupsHo` VARCHAR(10) NULL');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() === 'sqlite') {
            Schema::table('cups', function (Blueprint $table) {
                $table->renameColumn('CodCupsHuv', 'CodCuvsP');
                $table->renameColumn('CodCupsHo', 'CodCuvH');
            });

            return;
        }

        DB::statement('ALTER TABLE `cups` CHANGE COLUMN `CodCupsHuv` `CodCuvsP` VARCHAR(10) NULL');
        DB::statement('ALTER TABLE `cups` CHANGE COLUMN `CodCupsHo` `CodCuvH` VARCHAR(10) NULL');
    }
};
