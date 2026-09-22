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
     * Estado QX con el que se registró cada programación. Separa las cirugías
     * programadas ("Programados") de las de Hemodinamia ("Programado x
     * Hemodinamia"): cada una tiene su propia grilla "Ver programados".
     *
     * Las filas anteriores se rellenan con el Estado QX del seguimiento que las
     * creó: los dos se escriben en la misma transacción, con el mismo caso y la
     * misma hora. Las que no encuentren pareja quedan nulas y cuentan como
     * cirugía, que era lo único que existía antes.
     */
    public function up(): void
    {
        Schema::table('programacion_caso', function (Blueprint $table) {
            $table->string('codestsecundario', 5)->nullable()->after('codrad');
            $table->index('codestsecundario');
        });

        DB::table('programacion_caso')->orderBy('id')->get(['id', 'codrad', 'created_at'])
            ->each(function (object $prog) {
                $estado = DB::table('seguimiento_caso')
                    ->where('codrad', $prog->codrad)
                    ->where('created_at', $prog->created_at)
                    ->whereNotNull('codestsecundario')
                    ->orderByDesc('id')
                    ->value('codestsecundario');

                if ($estado !== null) {
                    DB::table('programacion_caso')->where('id', $prog->id)
                        ->update(['codestsecundario' => $estado]);
                }
            });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('programacion_caso', function (Blueprint $table) {
            $table->dropIndex(['codestsecundario']);
            $table->dropColumn('codestsecundario');
        });
    }
};
