<?php

namespace App\Console\Commands;

use App\Models\CotizacionCaso;
use App\Models\RadicarCaso;
use App\Support\Almacenamiento;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

/**
 * Renombra en el almacenamiento los documentos que quedaron con el nombre
 * aleatorio que ponía Laravel antes de este cambio, para que en la consola de
 * S3 se pueda identificar a qué radicado y a qué paciente pertenece cada uno.
 *
 * Se ejecuta una sola vez por entorno. Los archivos nuevos ya nacen con el
 * nombre correcto.
 */
class RenombrarArchivosLegibles extends Command
{
    protected $signature = 'archivos:renombrar-legibles
                            {--simular : Muestra lo que haría sin escribir nada}';

    protected $description = 'Renombra los documentos ya almacenados para que incluyan el radicado y el documento del paciente';

    public function handle(): int
    {
        $simular = (bool) $this->option('simular');

        $this->info("Disco: '".Almacenamiento::nombreDisco()."'");
        if ($simular) {
            $this->comment('Modo simulación: no se escribe nada.');
        }

        $total = ['renombrados' => 0, 'omitidos' => 0, 'faltantes' => 0, 'fallidos' => 0];

        $this->line('· Paquetes de radicaciones');
        foreach (RadicarCaso::whereNotNull('paquete')->cursor() as $caso) {
            $this->procesar($caso, 'paquete', 'paquetes', $caso->codrad, $caso->Ndocumento, $simular, $total);
        }

        $this->line('· Adjuntos de cotizaciones');
        foreach (CotizacionCaso::whereNotNull('adjunto')->cursor() as $cot) {
            // La identificación del paciente vive en la radicación, no en la
            // cotización: se toma de allí para que ambos archivos del mismo
            // caso queden con el mismo nombre.
            $documento = RadicarCaso::where('codrad', $cot->codrad)->value('Ndocumento');
            $this->procesar($cot, 'adjunto', 'cotizaciones', $cot->codrad, $documento, $simular, $total);
        }

        $this->newLine();
        $this->info(sprintf(
            'Renombrados: %d   Ya estaban bien: %d   Sin archivo: %d   Fallidos: %d',
            $total['renombrados'], $total['omitidos'], $total['faltantes'], $total['fallidos'],
        ));

        return $total['fallidos'] === 0 ? self::SUCCESS : self::FAILURE;
    }

    /**
     * Renombra el documento de una fila y deja la columna apuntando al nombre
     * nuevo.
     *
     * El orden importa: se copia primero, se apunta la fila a la copia y solo
     * al final se borra el original. Así, si algo se interrumpe a mitad de
     * camino, en el peor caso queda un objeto de más en el bucket — nunca una
     * fila apuntando a un archivo que ya no existe.
     *
     * @param  array<string, int>  $total
     */
    private function procesar(
        Model $fila,
        string $columna,
        string $carpeta,
        ?int $codrad,
        ?string $documento,
        bool $simular,
        array &$total,
    ): void {
        $actual = (string) $fila->{$columna};

        if (Almacenamiento::tieneNombreLegible($actual)) {
            $total['omitidos']++;

            return;
        }

        try {
            if (! Almacenamiento::existe($actual)) {
                $this->warn("  ! {$actual}: la fila lo referencia pero no está en el almacenamiento.");
                $total['faltantes']++;

                return;
            }

            // La marca de tiempo sale de la fila y no del reloj de hoy: así el
            // nombre refleja cuándo se guardó el documento realmente.
            $momento = $fila->updated_at ?? $fila->created_at ?? null;
            $momento = $momento instanceof \DateTimeInterface ? $momento : null;
            $extension = pathinfo($actual, PATHINFO_EXTENSION);
            $destino = $carpeta.'/'
                .Almacenamiento::nombreDocumento($codrad, $documento, $momento)
                .($extension !== '' ? '.'.$extension : '');

            if ($simular) {
                $this->line("  → {$actual}");
                $this->line("    quedaría como {$destino}");
                $total['renombrados']++;

                return;
            }

            Almacenamiento::copiar($actual, $destino);

            if (! Almacenamiento::existe($destino)) {
                throw new \RuntimeException('la copia no quedó en el almacenamiento');
            }

            // Por constructor de consultas: renombrar un archivo no es un cambio
            // hecho por el usuario, así que no debe disparar el AuditoriaObserver
            // ni mover updated_at.
            DB::table($fila->getTable())
                ->where($fila->getKeyName(), $fila->getKey())
                ->update([$columna => $destino]);

            Almacenamiento::eliminar($actual);

            $this->line("  ✓ {$destino}");
            $total['renombrados']++;
        } catch (\Throwable $e) {
            $this->error("  ✗ {$actual}: ".$e->getMessage());
            $total['fallidos']++;
        }
    }
}
