<?php

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class);
    config(['ocr-space.api_key' => 'ocr-key', 'ocr-space.api_url' => 'https://api.ocr.space/parse/image']);
});

function ocrImage(string $name = 'pagina.jpg'): UploadedFile
{
    return UploadedFile::fake()->createWithContent($name, "\xFF\xD8\xFF\xE0".str_repeat("\0", 100));
}

test('devuelve el texto de todas las partes que lee OCR.space', function () {
    Http::fake(['api.ocr.space/*' => Http::response([
        'IsErroredOnProcessing' => false,
        'ProcessingTimeInMilliseconds' => '850',
        'ParsedResults' => [['ParsedText' => "Historia clínica\r\nPaciente ficticio"], ['ParsedText' => 'Segunda parte']],
    ])]);

    $this->postJson('/tools/ocr-extract/extract', ['file' => ocrImage(), 'language' => 'spa'])
        ->assertOk()
        ->assertJson(['success' => true, 'text' => "Historia clínica\nPaciente ficticio\nSegunda parte", 'processing_time' => 850]);

    Http::assertSent(fn (Request $request) => $request->hasHeader('apikey', 'ocr-key')
        && collect($request->data())->contains(fn ($part) => $part['name'] === 'OCREngine' && $part['contents'] === '2'));
});

test('explica cuando se agota el cupo de OCR.space', function () {
    Http::fake(['api.ocr.space/*' => Http::response('You may only perform this action upto maximum 500 number of times within 86400 seconds', 403)]);

    $this->postJson('/tools/ocr-extract/extract', ['file' => ocrImage()])
        ->assertStatus(503)
        ->assertJson(['error' => 'El servicio de OCR alcanzó su límite de uso. Intenta de nuevo más tarde.']);
});

test('traduce el error de tamaño de OCR.space', function () {
    Http::fake(['api.ocr.space/*' => Http::response([
        'IsErroredOnProcessing' => true,
        'ErrorMessage' => ['File size exceeds the maximum permissible file size limit of 1024 KB'],
    ])]);

    $this->postJson('/tools/ocr-extract/extract', ['file' => ocrImage()])
        ->assertStatus(413)
        ->assertJson(['error' => 'La imagen es demasiado pesada para el servicio de OCR.']);
});

test('avisa si OCR.space no responde', function () {
    Http::fake(fn () => throw new ConnectionException('cURL error 28: timed out'));

    $this->postJson('/tools/ocr-extract/extract', ['file' => ocrImage()])
        ->assertStatus(504)
        ->assertJsonPath('error', fn (string $error) => str_contains($error, 'no respondió'));
});

test('no rompe con una respuesta que no es JSON', function () {
    Http::fake(['api.ocr.space/*' => Http::response('<html>Bad gateway</html>', 502)]);

    $this->postJson('/tools/ocr-extract/extract', ['file' => ocrImage()])
        ->assertStatus(502)
        ->assertJson(['error' => 'El servicio de OCR devolvió un error. Intenta de nuevo.']);
});

test('avisa si falta la clave de OCR.space', function () {
    config(['ocr-space.api_key' => null]);
    Http::fake();

    $this->postJson('/tools/ocr-extract/extract', ['file' => ocrImage()])->assertStatus(503);
    Http::assertNothingSent();
});

test('solo acepta imágenes JPG o PNG', function () {
    Http::fake();

    $this->postJson('/tools/ocr-extract/extract', ['file' => UploadedFile::fake()->createWithContent('escaneo.tif', 'II*')])
        ->assertStatus(422)
        ->assertJson(['error' => 'Envía una imagen JPG o PNG de máximo 5MB.']);
    Http::assertNothingSent();
});
