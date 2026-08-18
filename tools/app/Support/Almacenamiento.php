<?php

namespace App\Support;

use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Punto único por donde pasa todo archivo que la aplicación conserva más
 * allá de la petición que lo creó: los PDF de las radicaciones, los adjuntos
 * de las cotizaciones, los paquetes de CUPS procesados y las transferencias
 * de Evarisdrop.
 *
 * El disco no se nombra en los controladores sino que sale de
 * filesystems.default (FILESYSTEM_DISK), de modo que pasar la aplicación a S3
 * —o devolverla al disco local— es cambiar una variable de entorno y no
 * repartir 'public'/'local' por el código.
 *
 * Lo que NO pasa por aquí, y es deliberado: los archivos de trabajo de los
 * conversores (Word/Excel/PowerPoint a PDF, firma y protección de PDF, el
 * árbol temporal de CUPS). Esos los abren librerías nativas —TCPDF, PhpWord,
 * ZipArchive, PharData— que exigen una ruta real en disco y se borran dentro
 * de la misma petición: subirlos a S3 solo agregaría latencia y un objeto que
 * habría que borrar enseguida.
 */
class Almacenamiento
{
    /**
     * Disco configurado para los archivos que la aplicación conserva.
     */
    public static function disco(): FilesystemAdapter
    {
        /** @var FilesystemAdapter $disco */
        $disco = Storage::disk(self::nombreDisco());

        return $disco;
    }

    public static function nombreDisco(): string
    {
        return (string) config('filesystems.default', 'local');
    }

    /**
     * Indica si el disco vigente es un bucket S3. Sirve para las decisiones
     * que solo tienen sentido en la nube (URL temporales firmadas) y para que
     * el comando de migración sepa hacia dónde está copiando.
     */
    public static function esNube(): bool
    {
        return config('filesystems.disks.'.self::nombreDisco().'.driver') === 's3';
    }

    /**
     * Guarda un archivo recibido en el formulario y devuelve su ruta relativa
     * dentro del disco, que es lo que se persiste en base de datos.
     *
     * La ruta se guarda sin el nombre del disco a propósito: si mañana el
     * bucket cambia, las filas siguen siendo válidas.
     */
    public static function guardar(UploadedFile $archivo, string $carpeta): string
    {
        return $archivo->store(trim($carpeta, '/'), self::nombreDisco());
    }

    /**
     * Sube al disco un archivo que ya existe en el sistema de ficheros local
     * (el ZIP que arma CUPS, por ejemplo) y devuelve la ruta destino.
     *
     * Se transmite con un manejador abierto y no con file_get_contents() para
     * no cargar en memoria paquetes que pueden pesar cientos de megabytes.
     */
    public static function subirDesdeRuta(string $rutaLocal, string $destino): string
    {
        $destino = ltrim($destino, '/');
        $manejador = fopen($rutaLocal, 'rb');

        if ($manejador === false) {
            throw new \RuntimeException("No se pudo abrir el archivo local: {$rutaLocal}");
        }

        try {
            self::disco()->put($destino, $manejador);
        } finally {
            fclose($manejador);
        }

        return $destino;
    }

    /**
     * Sube contenido en memoria y devuelve la ruta destino.
     */
    public static function subirContenido(string $contenido, string $destino): string
    {
        $destino = ltrim($destino, '/');
        self::disco()->put($destino, $contenido);

        return $destino;
    }

    public static function existe(?string $ruta): bool
    {
        return $ruta !== null && $ruta !== '' && self::disco()->exists($ruta);
    }

    /**
     * Borra un archivo del disco. Nunca interrumpe el flujo que la llama:
     * un objeto huérfano en el bucket es un problema menor que dejar a medias
     * la operación de negocio que estaba en curso.
     */
    public static function eliminar(?string $ruta): void
    {
        if ($ruta === null || $ruta === '') {
            return;
        }

        try {
            self::disco()->delete($ruta);
        } catch (\Throwable $e) {
            Log::warning('No se pudo eliminar el archivo del almacenamiento', [
                'ruta' => $ruta,
                'disco' => self::nombreDisco(),
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Respuesta que entrega el archivo al navegador leyéndolo por streaming
     * desde el disco.
     *
     * No se usa response()->file() porque necesita una ruta en el sistema de
     * ficheros local y en S3 no existe tal cosa; además, transmitir evita
     * cargar el archivo completo en memoria.
     */
    public static function respuesta(
        string $ruta,
        ?string $nombre = null,
        ?string $mime = null,
        string $disposicion = 'inline',
    ): StreamedResponse {
        $nombre ??= basename($ruta);
        $cabeceras = $mime ? ['Content-Type' => $mime] : [];

        return self::disco()->response($ruta, $nombre, $cabeceras, $disposicion);
    }

    /**
     * Descarga forzada (Content-Disposition: attachment).
     */
    public static function descarga(string $ruta, ?string $nombre = null, ?string $mime = null): StreamedResponse
    {
        return self::respuesta($ruta, $nombre, $mime, 'attachment');
    }

    /**
     * URL directa al archivo.
     *
     * En S3 se devuelve una URL firmada de vigencia corta, porque el bucket de
     * una institución de salud no debe ser público: los enlaces caducan y no
     * quedan sirviendo historia clínica a quien conserve el enlace. Si el
     * bucket sí es público y se configuró AWS_URL, esa URL se usa tal cual.
     *
     * Preferir siempre las rutas del controlador (verPaquete y similares)
     * cuando el archivo deba quedar sujeto a los permisos de la vista.
     */
    public static function url(string $ruta, int $minutos = 15): ?string
    {
        $disco = self::disco();

        try {
            if (self::esNube() && ! config('filesystems.disks.'.self::nombreDisco().'.url')) {
                return $disco->temporaryUrl($ruta, now()->addMinutes($minutos));
            }

            return $disco->url($ruta);
        } catch (\Throwable $e) {
            Log::warning('No se pudo generar la URL del archivo', [
                'ruta' => $ruta,
                'disco' => self::nombreDisco(),
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Nombre de objeto único para un archivo generado por la aplicación,
     * conservando la extensión original.
     */
    public static function nombreUnico(string $nombreBase, string $extension = ''): string
    {
        $extension = ltrim($extension, '.');
        $slug = Str::slug(pathinfo($nombreBase, PATHINFO_FILENAME)) ?: 'archivo';

        return $slug.'_'.Str::random(12).($extension !== '' ? '.'.$extension : '');
    }
}
