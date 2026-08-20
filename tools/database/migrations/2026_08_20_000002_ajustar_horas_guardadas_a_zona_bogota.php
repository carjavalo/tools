<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Corrige las horas ya registradas.
 *
 * Hasta ahora config/app.php fijaba la zona horaria en UTC, así que todo lo que
 * la aplicación guardó —bitácora de seguimiento, radicaciones, usuarios— quedó
 * con la hora de UTC y se mostraba cinco horas adelantada. Al pasar la
 * aplicación a America/Bogota los registros nuevos quedan bien, pero los viejos
 * seguirían adelantados: esta migración los baja de una vez.
 *
 * Va como migración y no como comando a propósito. Laravel deja constancia de
 * las migraciones ejecutadas, así que no se puede aplicar dos veces por error;
 * un comando corrido por segunda vez restaría diez horas en lugar de cinco, sin
 * ninguna señal de que algo salió mal.
 *
 * Para ver qué haría antes de ejecutarla:
 *
 *     php artisan migrate --pretend
 *
 * Cuidado al leer el resultado: un registro de las 00:39 del 10 de agosto pasa
 * a las 19:39 del 9 de agosto. No es un error, es la hora en que realmente
 * ocurrió en Colombia.
 */
return new class extends Migration
{
    /**
     * Colombia es UTC-5 de forma permanente: no aplica horario de verano desde
     * 1993, así que el desplazamiento es el mismo para todos los registros sin
     * importar la fecha.
     */
    private const HORAS = 5;

    /**
     * Tablas de infraestructura de Laravel. Sus fechas no son actividad del
     * hospital sino control interno del framework —vencimiento de tokens,
     * reintentos de colas, expiración de caché— y moverlas solo podría alterar
     * esos vencimientos.
     */
    private const EXCLUIDAS = [
        'migrations',
        'sessions',
        'cache',
        'cache_locks',
        'jobs',
        'job_batches',
        'failed_jobs',
        'password_reset_tokens',
        'personal_access_tokens',
    ];

    public function up(): void
    {
        $this->desplazar(-self::HORAS);
    }

    public function down(): void
    {
        $this->desplazar(self::HORAS);
    }

    /**
     * Suma (o resta) horas a toda columna de fecha y hora de la base.
     *
     * Las columnas se descubren del esquema en vez de listarse a mano para que
     * no se quede ninguna por fuera al agregar tablas nuevas. Solo se tocan las
     * de tipo datetime/timestamp: las de tipo date —fecha de autorización,
     * vencimiento de anestesia, fecha de cotización— son fechas sin hora, y
     * restarles cinco horas las correría al día anterior.
     */
    private function desplazar(int $horas): void
    {
        $gramatica = DB::getQueryGrammar();
        $sqlite = DB::getDriverName() === 'sqlite';

        foreach (Schema::getTables() as $tabla) {
            $nombreTabla = $tabla['name'];

            if (in_array($nombreTabla, self::EXCLUIDAS, true)) {
                continue;
            }

            foreach (Schema::getColumns($nombreTabla) as $columna) {
                $tipo = strtolower((string) ($columna['type_name'] ?? ''));

                if (! in_array($tipo, ['datetime', 'timestamp'], true)) {
                    continue;
                }

                $t = $gramatica->wrap($nombreTabla);
                $c = $gramatica->wrap($columna['name']);

                $expresion = $sqlite
                    ? sprintf("datetime(%s, '%+d hours')", $c, $horas)
                    : sprintf('DATE_ADD(%s, INTERVAL %d HOUR)', $c, $horas);

                DB::statement("UPDATE {$t} SET {$c} = {$expresion} WHERE {$c} IS NOT NULL");
            }
        }
    }
};
