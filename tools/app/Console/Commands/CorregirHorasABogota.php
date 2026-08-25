<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Diagnostica y corrige las horas que quedaron guardadas en UTC.
 *
 * Existe porque la migración equivalente puede haber quedado registrada como
 * ejecutada sin haber cambiado nada —una migración no informa cuántas filas
 * tocó— y entonces no hay forma de volver a intentarlo ni de saber qué pasó.
 * Este comando dice exactamente qué encuentra, cuántas filas modifica y por
 * qué, y sin la bandera --aplicar no escribe absolutamente nada.
 */
class CorregirHorasABogota extends Command
{
    protected $signature = 'horas:corregir-bogota
                            {--aplicar : Escribe los cambios. Sin esta bandera solo diagnostica}
                            {--forzar : Aplica aunque la corrección ya figure como hecha}';

    protected $description = 'Diagnostica y corrige a hora de Colombia las fechas guardadas en UTC';

    /** Colombia es UTC-5 permanente: no hay horario de verano que considerar. */
    private const HORAS = 5;

    /**
     * Marca que se deja en la tabla de migraciones al aplicar la corrección.
     * Es lo que impide repetirla: una segunda pasada restaría diez horas.
     */
    private const MARCA = 'zona_horaria_bogota__correccion_de_datos';

    /**
     * Tablas de infraestructura de Laravel: sus fechas son control interno
     * (vencimientos, reintentos, caducidad de caché), no actividad del
     * hospital, y moverlas solo alteraría esos vencimientos.
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

    public function handle(): int
    {
        $this->contexto();

        $objetivos = $this->columnasDeFechaYHora();

        if ($objetivos === []) {
            $this->error('No se encontró ninguna columna de fecha y hora.');
            $this->line('Eso explicaría que la migración no cambiara nada. Revisa que la');
            $this->line('conexión apunte a la base correcta (arriba sale cuál).');

            return self::FAILURE;
        }

        $this->inventario($objetivos);

        if (! $this->option('aplicar')) {
            $this->newLine();
            $this->comment('Diagnóstico solamente: no se escribió nada.');
            $this->line('Para corregir:  php artisan horas:corregir-bogota --aplicar');

            return self::SUCCESS;
        }

        if ($this->yaAplicada() && ! $this->option('forzar')) {
            $this->newLine();
            $this->error('La corrección ya figura como aplicada; no se repite.');
            $this->line('Repetirla restaría otras '.self::HORAS.' horas. Si estás seguro de que');
            $this->line('hace falta, agrega --forzar.');

            return self::FAILURE;
        }

        return $this->aplicar($objetivos);
    }

    /**
     * Datos de entorno. Si algo no cuadra —la zona sigue en UTC, la conexión
     * apunta a otra base—, se ve aquí antes de tocar nada.
     */
    private function contexto(): void
    {
        $conexion = config('database.default');

        $this->info('Contexto');
        $this->line('  zona de la aplicación : '.config('app.timezone'));
        $this->line('  hora de la aplicación : '.now()->format('Y-m-d H:i:s P'));
        $this->line('  la misma en UTC       : '.now()->utc()->format('Y-m-d H:i:s'));
        $this->line('  conexión              : '.$conexion.' → '.config("database.connections.{$conexion}.database"));
        $this->line('  corrección ya aplicada: '.($this->yaAplicada() ? 'sí' : 'no'));
        $this->newLine();

        if (config('app.timezone') !== 'America/Bogota') {
            $this->warn('  ! La zona no es America/Bogota. Falta desplegar el código o');
            $this->warn('    ejecutar php artisan config:clear.');
            $this->newLine();
        }
    }

    /**
     * Columnas de tipo fecha y hora de toda la base.
     *
     * Se descubren del esquema para que no se quede ninguna por fuera. Solo se
     * consideran datetime y timestamp: a las de tipo date —fecha de
     * autorización, de cotización, vencimiento de anestesia— restarles horas
     * las correría al día anterior.
     *
     * @return array<int, array{tabla: string, columna: string, tipo: string}>
     */
    private function columnasDeFechaYHora(): array
    {
        // En MySQL, getTables() lista las tablas de TODAS las bases a las que
        // alcanza el usuario, no solo la nuestra, y devuelve el nombre sin
        // calificar. En un hosting compartido con varias bases, eso hace que
        // 'users' aparezca una vez por base — y como el UPDATE va contra la
        // base por defecto de la conexión, la misma tabla se actualizaría
        // tantas veces como repeticiones haya. Cinco horas por cada una.
        //
        // De ahí los dos filtros: quedarse con el esquema propio y, por si
        // acaso, no repetir ningún par tabla/columna.
        $esquemaPropio = DB::getDatabaseName();
        $filtraEsquema = in_array(DB::getDriverName(), ['mysql', 'mariadb', 'pgsql'], true);

        $objetivos = [];
        $vistos = [];

        foreach (Schema::getTables() as $tabla) {
            $nombre = $tabla['name'];
            $esquema = $tabla['schema'] ?? null;

            if (in_array($nombre, self::EXCLUIDAS, true)) {
                continue;
            }

            if ($filtraEsquema && $esquema !== null && $esquema !== $esquemaPropio) {
                continue;
            }

            foreach (Schema::getColumns($nombre) as $columna) {
                $tipo = strtolower((string) ($columna['type_name'] ?? ''));

                if (! in_array($tipo, ['datetime', 'timestamp'], true)) {
                    continue;
                }

                $clave = $nombre.'.'.$columna['name'];

                if (isset($vistos[$clave])) {
                    continue;
                }

                $vistos[$clave] = true;
                $objetivos[] = ['tabla' => $nombre, 'columna' => $columna['name'], 'tipo' => $tipo];
            }
        }

        return $objetivos;
    }

    /**
     * Qué hay hoy en cada columna. La cuenta de "futuras" es la señal de que
     * los datos siguen en UTC: con el reloj en Bogotá, un registro guardado en
     * UTC aparece hasta cinco horas adelantado, es decir, en el futuro.
     *
     * @param  array<int, array{tabla: string, columna: string, tipo: string}>  $objetivos
     */
    private function inventario(array $objetivos): void
    {
        $filas = [];
        $futurasTotal = 0;

        foreach ($objetivos as $o) {
            $q = DB::table($o['tabla'])->whereNotNull($o['columna']);
            $con = (clone $q)->count();

            if ($con === 0) {
                continue;
            }

            $futuras = (clone $q)->where($o['columna'], '>', now())->count();
            $futurasTotal += $futuras;

            $filas[] = [
                $o['tabla'],
                $o['columna'],
                $con,
                (string) (clone $q)->min($o['columna']),
                (string) (clone $q)->max($o['columna']),
                $futuras ?: '',
            ];
        }

        $this->info('Columnas de fecha y hora con datos');
        $this->table(['Tabla', 'Columna', 'Filas', 'Más antigua', 'Más reciente', 'En el futuro'], $filas);

        $this->newLine();
        if ($futurasTotal > 0) {
            $this->warn("Hay {$futurasTotal} valor(es) con fecha futura: es la huella de que");
            $this->warn('siguen guardados en UTC. La corrección los baja '.self::HORAS.' horas.');
        } else {
            $this->line('No hay valores en el futuro. O ya están corregidos, o hace más de');
            $this->line(self::HORAS.' horas que no se registra actividad; mira las horas de arriba');
            $this->line('y compáralas con la hora de la aplicación antes de aplicar.');
        }
    }

    /**
     * @param  array<int, array{tabla: string, columna: string, tipo: string}>  $objetivos
     */
    private function aplicar(array $objetivos): int
    {
        $gramatica = DB::getQueryGrammar();
        $sqlite = DB::getDriverName() === 'sqlite';
        $horas = -self::HORAS;
        $total = 0;

        $this->newLine();
        $this->info('Aplicando');

        foreach ($objetivos as $o) {
            $t = $gramatica->wrap($o['tabla']);
            $c = $gramatica->wrap($o['columna']);

            $expresion = $sqlite
                ? sprintf("datetime(%s, '%+d hours')", $c, $horas)
                : sprintf('DATE_ADD(%s, INTERVAL %d HOUR)', $c, $horas);

            // DB::update devuelve las filas afectadas: es la prueba de que el
            // cambio ocurrió, que es justamente lo que una migración no da.
            $filas = DB::update("UPDATE {$t} SET {$c} = {$expresion} WHERE {$c} IS NOT NULL");
            $total += $filas;

            if ($filas > 0) {
                $this->line(sprintf('  ✓ %-28s %-18s %d fila(s)', $o['tabla'], $o['columna'], $filas));
            }
        }

        $this->marcarAplicada();

        $this->newLine();
        $this->info("Listo: {$total} valor(es) corregidos a hora de Colombia.");
        $this->line('Recarga Herramientas - Seguimiento para verlo.');

        return self::SUCCESS;
    }

    private function yaAplicada(): bool
    {
        return DB::table('migrations')->where('migration', self::MARCA)->exists();
    }

    /**
     * La marca se guarda en la tabla de migraciones para que quede a la vista
     * y sobreviva a los despliegues, sin necesidad de crear una tabla aparte.
     */
    private function marcarAplicada(): void
    {
        if ($this->yaAplicada()) {
            return;
        }

        DB::table('migrations')->insert([
            'migration' => self::MARCA,
            'batch' => (int) DB::table('migrations')->max('batch') + 1,
        ]);
    }
}
