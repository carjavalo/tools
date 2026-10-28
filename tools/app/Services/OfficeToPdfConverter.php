<?php

namespace App\Services;

use Illuminate\Http\Client\Response;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Convierte documentos de Office a PDF con servicios externos: CloudConvert,
 * ConvertAPI y PDF.co, en ese orden. Se salta el que no tenga clave y, si uno
 * falla (caído, sin cupo...), se intenta con el siguiente.
 */
class OfficeToPdfConverter
{
    // Firma de los archivos: los formatos nuevos (.xlsx, .pptx, .docx) son ZIP
    // y los antiguos (.xls, .ppt, .doc) documentos OLE. Se valida por firma
    // porque el tipo MIME que detecta el servidor falla con archivos que no
    // vienen de Office (Google, LibreOffice, Canva...).
    private const ZIP_SIGNATURE = "PK\x03\x04";

    private const OLE_SIGNATURE = "\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1";

    private const LEGACY_EXTENSIONS = ['xls', 'ppt', 'doc'];

    // PDF.co tiene un endpoint para hojas de cálculo y otro para el resto.
    private const PDFCO_SPREADSHEETS = ['xls', 'xlsx', 'csv'];

    private bool $quotaExhausted = false;

    /**
     * Verifica que el archivo sea del formato que dice su extensión.
     *
     * @param  string  $label  Cómo nombrarlo en el mensaje: «un archivo de Excel».
     */
    public function assertOfficeFile(UploadedFile $file, string $label): void
    {
        $extension = strtolower($file->getClientOriginalExtension());
        $head = (string) file_get_contents($file->getRealPath(), false, null, 0, 8);
        $isOle = $head === self::OLE_SIGNATURE;
        $isZip = str_starts_with($head, self::ZIP_SIGNATURE);

        if (in_array($extension, self::LEGACY_EXTENSIONS, true) ? $isOle : $isZip) {
            return;
        }

        // Un .xlsx, .pptx o .docx con contraseña se guarda cifrado dentro de un
        // contenedor OLE: no es que esté dañado.
        if ($isOle) {
            throw new OfficeConversionException('El archivo está protegido con contraseña. Quítale la contraseña e inténtalo de nuevo.', 422);
        }

        throw new OfficeConversionException("El archivo no parece {$label} válido o está dañado.", 422);
    }

    /**
     * @return string El PDF generado.
     */
    public function convert(UploadedFile $file, string $label): string
    {
        $this->assertOfficeFile($file, $label);

        $path = $file->getRealPath();
        $extension = strtolower($file->getClientOriginalExtension());

        $providers = array_filter([
            'CloudConvert' => config('services.cloudconvert.key') ? $this->cloudConvert(...) : null,
            'ConvertAPI' => config('services.convertapi.token') ? $this->convertApi(...) : null,
            'PDF.co' => config('services.pdfco.key') ? $this->pdfCo(...) : null,
        ]);

        if ($providers === []) {
            Log::error('Conversión a PDF: no hay ninguna clave de CloudConvert, ConvertAPI ni PDF.co configurada.');
            throw new OfficeConversionException('La conversión a PDF no está configurada en el servidor. Contacta al administrador del sistema.', 503);
        }

        $this->quotaExhausted = false;
        foreach ($providers as $name => $provider) {
            try {
                $pdf = $provider($path, $extension);
            } catch (Throwable $e) {
                Log::warning("{$name}: error durante la conversión: ".$e->getMessage());

                continue;
            }

            if ($pdf !== null && str_starts_with($pdf, '%PDF')) {
                Log::info("{$name}: conversión de .{$extension} a PDF exitosa.");

                return $pdf;
            }

            if ($pdf !== null) {
                Log::warning("{$name}: la respuesta no es un PDF.");
            }
        }

        throw $this->quotaExhausted
            ? new OfficeConversionException('Los servicios de conversión alcanzaron su límite de uso. Intenta de nuevo más tarde.', 503)
            : new OfficeConversionException('No se pudo convertir el archivo a PDF. Verifica que no esté dañado e inténtalo de nuevo.', 502);
    }

    private function cloudConvert(string $path, string $extension): ?string
    {
        $key = (string) config('services.cloudconvert.key');

        $job = Http::withToken($key)->acceptJson()->timeout(30)->post('https://api.cloudconvert.com/v2/jobs', [
            'tasks' => [
                'subir' => ['operation' => 'import/upload'],
                'convertir' => ['operation' => 'convert', 'input' => 'subir', 'output_format' => 'pdf'],
                'exportar' => ['operation' => 'export/url', 'input' => 'convertir'],
            ],
        ]);
        if (! $this->succeeded('CloudConvert', $job)) {
            return null;
        }

        // Las tareas se buscan por nombre: CloudConvert no garantiza su orden.
        $form = $this->cloudConvertTask($job, 'subir')['result']['form'] ?? null;
        if (! isset($form['url'])) {
            Log::warning('CloudConvert: la respuesta no trae el formulario de subida.');

            return null;
        }

        $upload = Http::timeout(120)
            ->attach('file', (string) file_get_contents($path), "documento.{$extension}")
            ->post($form['url'], $form['parameters'] ?? []);
        if (! $this->succeeded('CloudConvert (subida)', $upload)) {
            return null;
        }

        // Este endpoint responde cuando el trabajo termina.
        $finished = Http::withToken($key)->acceptJson()->timeout(150)
            ->get('https://sync.api.cloudconvert.com/v2/jobs/'.$job->json('data.id'));
        if (! $this->succeeded('CloudConvert (espera)', $finished)) {
            return null;
        }

        if ($finished->json('data.status') !== 'finished') {
            Log::warning('CloudConvert: el trabajo terminó con estado '.$finished->json('data.status').': '
                .($this->cloudConvertTask($finished, 'convertir')['message'] ?? 'sin detalle'));

            return null;
        }

        $url = $this->cloudConvertTask($finished, 'exportar')['result']['files'][0]['url'] ?? null;

        return $url ? $this->download('CloudConvert', $url) : null;
    }

    private function cloudConvertTask(Response $job, string $name): array
    {
        return collect($job->json('data.tasks', []))->firstWhere('name', $name) ?? [];
    }

    private function convertApi(string $path, string $extension): ?string
    {
        // La URL lleva el formato de origen real: no es lo mismo xls que xlsx.
        $response = Http::withToken((string) config('services.convertapi.token'))
            ->acceptJson()
            ->timeout(150)
            ->attach('File', (string) file_get_contents($path), "documento.{$extension}")
            ->post("https://v2.convertapi.com/convert/{$extension}/to/pdf", ['StoreFile' => 'false']);
        if (! $this->succeeded('ConvertAPI', $response)) {
            return null;
        }

        $data = $response->json('Files.0.FileData');
        if (! is_string($data)) {
            Log::warning('ConvertAPI: la respuesta no trae el PDF.');

            return null;
        }

        return base64_decode($data, true) ?: null;
    }

    private function pdfCo(string $path, string $extension): ?string
    {
        $headers = ['x-api-key' => (string) config('services.pdfco.key')];

        $presigned = Http::withHeaders($headers)->acceptJson()->timeout(30)
            ->get('https://api.pdf.co/v1/file/upload/get-presigned-url', [
                'name' => "documento.{$extension}",
                'contenttype' => 'application/octet-stream',
            ]);
        if (! $this->succeeded('PDF.co', $presigned) || ! $presigned->json('presignedUrl')) {
            return null;
        }

        $upload = Http::withBody((string) file_get_contents($path), 'application/octet-stream')
            ->timeout(120)
            ->put($presigned->json('presignedUrl'));
        if (! $this->succeeded('PDF.co (subida)', $upload)) {
            return null;
        }

        $endpoint = in_array($extension, self::PDFCO_SPREADSHEETS, true)
            ? 'https://api.pdf.co/v1/xls/convert/to/pdf'
            : 'https://api.pdf.co/v1/pdf/convert/from/doc';

        $converted = Http::withHeaders($headers)->acceptJson()->timeout(150)->post($endpoint, [
            'url' => $presigned->json('url'),
            'name' => 'documento.pdf',
            'async' => false,
        ]);
        if (! $this->succeeded('PDF.co (conversión)', $converted) || ! $converted->json('url')) {
            return null;
        }

        return $this->download('PDF.co', $converted->json('url'));
    }

    private function download(string $provider, string $url): ?string
    {
        $response = Http::timeout(120)->get($url);

        return $this->succeeded("{$provider} (descarga)", $response, json: false) ? $response->body() : null;
    }

    /**
     * ¿Respondió bien el servicio? Si no, deja el motivo en el log y anota si
     * fue por falta de cupo (402/429), para avisarle eso al usuario.
     */
    private function succeeded(string $provider, Response $response, bool $json = true): bool
    {
        // PDF.co responde 200 con «error: true» y el código real en «status».
        $reportedStatus = $json ? (int) ($response->json('status') ?? 0) : 0;
        $failed = $response->failed() || ($json && $response->json('error') === true);

        if (! $failed) {
            return true;
        }

        if (in_array($response->status(), [402, 429], true) || in_array($reportedStatus, [402, 429], true)) {
            $this->quotaExhausted = true;
        }

        Log::warning("{$provider}: respondió {$response->status()}: ".mb_substr($response->body(), 0, 500));

        return false;
    }
}
