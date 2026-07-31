<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Cuatro tablas del proyecto llevan mayúsculas. MySQL en Windows usa
     * lower_case_table_names = 1: guarda los nombres en minúscula y no
     * distingue mayúsculas al consultar, así que allí da igual. En Linux
     * (lower_case_table_names = 0) sí distingue, y un respaldo hecho en
     * Windows llega con los nombres aplanados: la aplicación pide
     * 'EstRadicado', encuentra 'estradicado' y falla con
     * "Base table or view not found: 1146".
     *
     * Esta migración renombra esas tablas al nombre exacto que espera el
     * código. Es idempotente: si el nombre ya está bien, o si el motor no
     * distingue mayúsculas, no hace nada.
     */
    private const TABLAS = [
        'EstRadicado',
        'EstRadisecundario',
        'RadicarCaso',
        'cuvsAnezados',
    ];

    public function up(): void
    {
        // Donde el motor no distingue mayúsculas (Windows), renombrar sobraría
        // y además fallaría: origen y destino serían la misma tabla.
        if ($this->motorIgnoraMayusculas()) {
            return;
        }

        foreach (self::TABLAS as $correcta) {
            $minuscula = strtolower($correcta);

            if ($minuscula === $correcta) {
                continue;
            }

            // Ya está con el nombre correcto: nada que hacer.
            if (Schema::hasTable($correcta)) {
                continue;
            }

            if (! Schema::hasTable($minuscula)) {
                continue;
            }

            Schema::rename($minuscula, $correcta);
        }
    }

    public function down(): void
    {
        if ($this->motorIgnoraMayusculas()) {
            return;
        }

        foreach (self::TABLAS as $correcta) {
            $minuscula = strtolower($correcta);

            if ($minuscula === $correcta || ! Schema::hasTable($correcta)) {
                continue;
            }

            Schema::rename($correcta, $minuscula);
        }
    }

    /**
     * ¿El servidor guarda e interpreta los nombres de tabla sin distinguir
     * mayúsculas? (lower_case_table_names distinto de 0).
     */
    private function motorIgnoraMayusculas(): bool
    {
        try {
            $valor = DB::select("SHOW VARIABLES LIKE 'lower_case_table_names'");

            return isset($valor[0]) && (int) $valor[0]->Value !== 0;
        } catch (\Throwable) {
            // Ante la duda, no tocar nada.
            return true;
        }
    }
};
