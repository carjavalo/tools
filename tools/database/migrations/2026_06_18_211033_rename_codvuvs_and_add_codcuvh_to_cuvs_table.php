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
        if (DB::getDriverName() === 'sqlite') {
            Schema::table('cuvs', function (Blueprint $table) {
                $table->renameColumn('CodVuvs', 'CodCuvsP');
            });
            Schema::table('cuvs', function (Blueprint $table) {
                $table->string('CodCuvH', 10)->nullable();
            });

            return;
        }

        // MySQL / MariaDB: CHANGE COLUMN funciona en todas las versiones
        // (incl. MariaDB 10.4, que no soporta RENAME COLUMN).
        DB::statement('ALTER TABLE `cuvs` CHANGE COLUMN `CodVuvs` `CodCuvsP` VARCHAR(10) NULL');
        DB::statement('ALTER TABLE `cuvs` ADD COLUMN `CodCuvH` VARCHAR(10) NULL AFTER `CodCuvsP`');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            Schema::table('cuvs', function (Blueprint $table) {
                $table->dropColumn('CodCuvH');
            });
            Schema::table('cuvs', function (Blueprint $table) {
                $table->renameColumn('CodCuvsP', 'CodVuvs');
            });

            return;
        }

        DB::statement('ALTER TABLE `cuvs` DROP COLUMN `CodCuvH`');
        DB::statement('ALTER TABLE `cuvs` CHANGE COLUMN `CodCuvsP` `CodVuvs` VARCHAR(10) NULL');
    }
};
