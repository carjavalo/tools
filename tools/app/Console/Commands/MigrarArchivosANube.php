<?php

namespace App\Console\Commands;

use App\Support\Almacenamiento;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

/**
 * Sube al almacenamiento configurado los archivos que quedaron en el disco
 * local antes de la migración a S3.
 *
 * Se ejecuta una sola vez, después de poner las credenciales en el .env y
 * FILESYSTEM_DISK=s3. Las rutas guardadas en base de datos no cambian —son
 * relativas al disco— así que basta con que el objeto exista en el bucket con
 * la misma clave para que la aplicación lo encuentre.
 */
class MigrarArchivosANube extends Command
{
    protected $signature = 'archivos:migrar-nube
                            {--eliminar-origen : Borra el archivo local después de verificar que quedó copiado}
                            {--forzar : Vuelve a subir los archivos que ya existen en el destino}
                            {--simular : Muestra lo que haría sin escribir nada}';

    protected $description = 'Copia al almacenamiento configurado (S3) los archivos que aún viven en el disco local';

    /**
     * Carpetas con archivos referenciados desde base de datos, y el disco
     * local donde vivían antes de la migración.
     *
     * No se incluyen las carpetas de trabajo (temp, temp_upload,
     * json_organizados) ni los paquetes de CUPS y las transferencias de
     * Evarisdrop: son efímeros —se regeneran o caducan en menos de una hora—
     * y ninguna fila los referencia de forma permanente.
     *
     * @var array<int, array{disco: string, carpeta: string}>
     */
    private const ORIGENES = [
        ['disco' => 'public', 'carpeta' => 'paquetes'],
        ['disco' => 'public', 'carpeta' => 'cotizaciones'],
    ];

    public function handle(): int
    {
        $destino = Almacenamiento::nombreDisco();

        if (! Almacenamiento::esNube()) {
            $this->error("El disco configurado es '{$destino}', que no es S3.");
            $this->line('Ajusta FILESYSTEM_DISK=s3 en el .env antes de migrar.');

            return self::FAILURE;
        }

        // Comprobación previa: sin bucket o sin credenciales, cada llamada al
        // adaptador revienta con un stack trace de la SDK que no dice cuál de
        // las variables falta.
        foreach (['bucket' => 'AWS_BUCKET', 'key' => 'AWS_ACCESS_KEY_ID', 'secret' => 'AWS_SECRET_ACCESS_KEY'] as $clave => $variable) {
            if (blank(config("filesystems.disks.{$destino}.{$clave}"))) {
                $this->error("Falta {$variable} en el .env.");

                return self::FAILURE;
            }
        }

        $simular = (bool) $this->option('simular');
        $eliminar = (bool) $this->option('eliminar-origen');
        $forzar = (bool) $this->option('forzar');

        $this->info("Destino: disco '{$destino}' (bucket ".config("filesystems.disks.{$destino}.bucket").')');
        if ($simular) {
            $this->comment('Modo simulación: no se escribe nada.');
        }

        $copiados = $omitidos = $fallidos = 0;

        foreach (self::ORIGENES as $origen) {
            $discoOrigen = Storage::disk($origen['disco']);
            $carpeta = $origen['carpeta'];

            if (! $discoOrigen->exists($carpeta)) {
                $this->line("· {$carpeta}: no existe en el disco '{$origen['disco']}', se omite.");

                continue;
            }

            $archivos = $discoOrigen->allFiles($carpeta);
            $this->line("· {$carpeta}: ".count($archivos).' archivo(s) en el disco local.');

            foreach ($archivos as $ruta) {
                try {
                    if (! $forzar && Almacenamiento::existe($ruta)) {
                        $omitidos++;

                        continue;
                    }
                } catch (\Throwable $e) {
                    $this->error("  ✗ {$ruta}: no se pudo consultar el destino — ".$e->getMessage());
                    $fallidos++;

                    continue;
                }

                if ($simular) {
                    $this->line("  → subiría {$ruta}");
                    $copiados++;

                    continue;
                }

                try {
                    // Se transmite con el manejador del origen para no cargar
                    // en memoria PDF que pueden llegar a 30 MB.
                    $manejador = $discoOrigen->readStream($ruta);
                    Almacenamiento::disco()->put($ruta, $manejador);

                    if (is_resource($manejador)) {
                        fclose($manejador);
                    }
                } catch (\Throwable $e) {
                    $this->error("  ✗ {$ruta}: ".$e->getMessage());
                    $fallidos++;

                    continue;
                }

                // El borrado del original solo ocurre tras comprobar que el
                // objeto quedó en el bucket: un fallo silencioso de subida no
                // puede terminar en un archivo perdido.
                if ($eliminar) {
                    try {
                        $verificado = Almacenamiento::existe($ruta);
                    } catch (\Throwable $e) {
                        $verificado = false;
                    }

                    if ($verificado) {
                        $discoOrigen->delete($ruta);
                    } else {
                        $this->warn("  ! {$ruta}: subido pero no verificado; no se borra el original.");
                    }
                }

                $copiados++;
            }
        }

        $this->newLine();
        $this->info("Copiados: {$copiados}   Ya existían: {$omitidos}   Fallidos: {$fallidos}");

        return $fallidos === 0 ? self::SUCCESS : self::FAILURE;
    }
}
