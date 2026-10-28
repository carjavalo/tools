<?php

namespace App\Http\Controllers;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

/**
 * Extrae texto de una imagen con OCR.space. El navegador ya la reduce y la
 * convierte a JPG (los PDF se envían página por página como imágenes), así
 * que aquí solo llegan imágenes livianas.
 */
class OCRController extends Controller
{
    private const LANGUAGES = ['spa', 'eng'];

    public function extract(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'file' => ['required', 'file', 'max:5120', 'extensions:jpg,jpeg,png'],
            'language' => ['nullable', 'string', 'in:'.implode(',', self::LANGUAGES)],
        ]);

        if ($validator->fails()) {
            return $this->error('Envía una imagen JPG o PNG de máximo 5MB.', 422);
        }

        $key = config('ocr-space.api_key');
        if (! $key) {
            return $this->error('El servicio de OCR no está configurado en el servidor. Contacta al administrador del sistema.', 503);
        }

        set_time_limit(150);
        $file = $request->file('file');

        try {
            $response = Http::asMultipart()
                ->timeout((int) config('ocr-space.timeout', 120))
                ->withHeaders(['apikey' => $key])
                ->attach('file', (string) file_get_contents($file->getRealPath()), 'imagen.'.strtolower($file->getClientOriginalExtension()))
                ->post(config('ocr-space.api_url'), [
                    'language' => $request->input('language', 'spa'),
                    // El motor 2 lee mejor el español y los textos con poco contraste.
                    'OCREngine' => '2',
                    'scale' => 'true',
                    'detectOrientation' => 'true',
                    'isOverlayRequired' => 'false',
                ]);
        } catch (ConnectionException $e) {
            Log::warning('OCR.space no respondió: '.$e->getMessage());

            return $this->error('El servicio de OCR no respondió a tiempo. Intenta de nuevo en unos minutos.', 504);
        }

        return $this->handleResponse($response);
    }

    private function handleResponse(Response $response): JsonResponse
    {
        $data = $response->json();

        // Al agotar el cupo, OCR.space responde 403 con un texto plano.
        if ($response->status() === 403 || $response->status() === 429) {
            Log::warning('OCR.space rechazó la petición', ['status' => $response->status(), 'body' => substr($response->body(), 0, 200)]);

            return $this->error('El servicio de OCR alcanzó su límite de uso. Intenta de nuevo más tarde.', 503);
        }

        if (! is_array($data)) {
            Log::error('Respuesta inesperada de OCR.space', ['status' => $response->status(), 'body' => substr($response->body(), 0, 200)]);

            return $this->error('El servicio de OCR devolvió un error. Intenta de nuevo.', 502);
        }

        if (! empty($data['IsErroredOnProcessing'])) {
            $message = implode(' ', (array) ($data['ErrorMessage'] ?? []));
            Log::warning('OCR.space no pudo procesar la imagen: '.$message);

            if (stripos($message, 'file size') !== false) {
                return $this->error('La imagen es demasiado pesada para el servicio de OCR.', 413);
            }
            if (stripos($message, 'timed out') !== false || stripos($message, 'timeout') !== false) {
                return $this->error('La imagen tardó demasiado en procesarse. Intenta con una imagen más pequeña.', 504);
            }

            return $this->error('El servicio de OCR no pudo leer esta imagen.', 422);
        }

        $text = collect($data['ParsedResults'] ?? [])
            ->pluck('ParsedText')
            ->filter()
            ->implode("\n");

        return response()->json([
            'success' => true,
            'text' => trim(str_replace("\r\n", "\n", $text)),
            'processing_time' => (int) ($data['ProcessingTimeInMilliseconds'] ?? 0),
        ]);
    }

    private function error(string $message, int $status): JsonResponse
    {
        return response()->json(['success' => false, 'error' => $message], $status);
    }
}
