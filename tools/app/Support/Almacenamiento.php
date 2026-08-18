<?php

namespace App\Support;

use Carbon\Carbon;
use DateTimeInterface;
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
     * Guarda un archivo con un nombre legible en lugar del hash aleatorio que
     * pone store() por omisión, para poder identificarlo desde la consola de
     * S3 sin tener que cruzarlo contra la base de datos.
     *
     * Quien llama arma el nombre; aquí solo se sanea y se le pega la extensión
     * original. El nombre debe seguir siendo único por subida: el flujo de
     * reemplazo depende de que el archivo nuevo no pise al anterior antes de
     * que la transacción confirme (ver guardarPaquete en RadicarCasoController).
     */
    public static function guardarComo(UploadedFile $archivo, string $carpeta, string $nombreBase): string
    {
        $extension = strtolower($archivo->getClientOriginalExtension() ?: (string) $archivo->guessExtension());
        $extension = preg_replace('/[^a-z0-9]/', '', $extension) ?: 'bin';

        return self::disco()->putFileAs(
            trim($carpeta, '/'),
            $archivo,
            self::componenteSeguro($nombreBase).'.'.$extension,
        );
    }

    /**
     * Copia un objeto dentro del mismo disco. Se usa al renombrar: primero se
     * copia, luego la fila pasa a apuntar a la copia y solo entonces se borra
     * el original, de modo que en ningún momento la base referencie algo que
     * no existe.
     */
    public static function copiar(string $origen, string $destino): void
    {
        self::disco()->copy($origen, ltrim($destino, '/'));
    }

    /**
     * Nombre con el que se guardan los documentos de una radicación.
     *
     * Lleva el consecutivo del radicado y la identificación del paciente para
     * poder reconocer cada archivo desde la consola de S3 sin cruzarlo contra
     * la base de datos.
     *
     * La marca de tiempo y los cuatro caracteres al azar no son decoración: el
     * reemplazo de un documento depende de que el archivo nuevo NO pise al
     * anterior hasta que la transacción confirme. Con un nombre fijo por
     * radicado, subir un reemplazo sobrescribiría el original de inmediato y,
     * si el guardado fallara después, la fila quedaría apuntando a un archivo
     * ya destruido.
     */
    public static function nombreDocumento(?int $codrad, ?string $documento, ?DateTimeInterface $momento = null): string
    {
        $doc = preg_replace('/[^A-Za-z0-9]/', '', (string) $documento);
        $momento = $momento ? Carbon::instance($momento) : Carbon::now();

        return implode('_', [
            $codrad ? 'rad-'.$codrad : 'rad-nuevo',
            'doc-'.($doc !== '' ? $doc : 'sin-documento'),
            $momento->format('Ymd-His').'-'.strtolower(Str::random(4)),
        ]);
    }

    /**
     * Indica si un archivo ya está guardado con el nombre legible. Lo usa el
     * comando de renombrado para no volver a mover lo que ya está bien.
     */
    public static function tieneNombreLegible(?string $ruta): bool
    {
        return (bool) preg_match('/^rad-[^_]+_doc-[^_]+_\d{8}-\d{6}-[a-z0-9]{4}\./', basename((string) $ruta));
    }

    /**
     * Deja un texto en forma apta para una clave de S3: sin espacios, acentos
     * ni caracteres que obliguen a escapar la URL.
     */
    public static function componenteSeguro(string $texto, string $porDefecto = 'archivo'): string
    {
        $limpio = preg_replace('/[^A-Za-z0-9._-]+/', '-', $texto);
        $limpio = trim((string) $limpio, '-._');

        return $limpio !== '' ? $limpio : $porDefecto;
    }
}
