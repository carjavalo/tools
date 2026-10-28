<?php

use Illuminate\Http\Client\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use PhpOffice\PhpPresentation\IOFactory as PresentationIOFactory;
use PhpOffice\PhpPresentation\PhpPresentation;
use PhpOffice\PhpWord\IOFactory as WordIOFactory;
use PhpOffice\PhpWord\PhpWord;
use Smalot\PdfParser\Parser as PdfParser;

const FAKE_PDF = "%PDF-1.7\n% documento de prueba";

beforeEach(function () {
    config([
        'services.cloudconvert.key' => null,
        'services.convertapi.token' => null,
        'services.pdfco.key' => null,
    ]);
});

function officeFile(string $name, string $signature = "PK\x03\x04"): UploadedFile
{
    return UploadedFile::fake()->createWithContent($name, $signature.str_repeat("\0", 200));
}

// Presentación real generada con PhpPresentation: el servidor la detecta como
// application/octet-stream, igual que las que no vienen de PowerPoint.
function generatedPresentation(): UploadedFile
{
    $path = tempnam(sys_get_temp_dir(), 'pptx');
    $presentation = new PhpPresentation;
    $presentation->getActiveSlide()->createRichTextShape()->createTextRun('Presentación de prueba');
    PresentationIOFactory::createWriter($presentation, 'PowerPoint2007')->save($path);

    return new UploadedFile($path, 'presentacion.pptx', null, null, true);
}

function fakeCloudConvert(): void
{
    Http::fake([
        // Las tareas llegan desordenadas a propósito: se buscan por nombre.
        'api.cloudconvert.com/v2/jobs' => Http::response(['data' => ['id' => 'job-1', 'tasks' => [
            ['name' => 'convertir', 'operation' => 'convert'],
            ['name' => 'exportar', 'operation' => 'export/url'],
            ['name' => 'subir', 'operation' => 'import/upload', 'result' => ['form' => [
                'url' => 'https://upload.cloudconvert.test/form',
                'parameters' => ['expires' => '123', 'signature' => 'abc'],
            ]]],
        ]]], 201),
        'upload.cloudconvert.test/*' => Http::response('', 201),
        'sync.api.cloudconvert.com/v2/jobs/job-1' => Http::response(['data' => ['id' => 'job-1', 'status' => 'finished', 'tasks' => [
            ['name' => 'exportar', 'result' => ['files' => [['url' => 'https://storage.cloudconvert.test/documento.pdf']]]],
        ]]]),
        'storage.cloudconvert.test/*' => Http::response(FAKE_PDF, 200, ['Content-Type' => 'application/pdf']),
    ]);
}

test('convierte un Excel con CloudConvert buscando las tareas por nombre', function () {
    config(['services.cloudconvert.key' => 'cc-key']);
    fakeCloudConvert();

    $response = $this->post('/tools/excel-to-pdf/convert', ['file' => officeFile('informe.xlsx')]);

    $response->assertOk()->assertHeader('Content-Type', 'application/pdf');
    expect($response->streamedContent())->toBe(FAKE_PDF);

    Http::assertSent(fn (Request $request) => $request->url() === 'https://upload.cloudconvert.test/form'
        && str_contains($request->body(), 'name="signature"')
        && str_contains($request->body(), 'filename="documento.xlsx"'));
    Http::assertSent(fn (Request $request) => $request->url() === 'https://api.cloudconvert.com/v2/jobs'
        && $request->hasHeader('Authorization', 'Bearer cc-key'));
});

test('acepta un .pptx que el servidor detecta como octet-stream', function () {
    config(['services.cloudconvert.key' => 'cc-key']);
    fakeCloudConvert();
    $presentation = generatedPresentation();
    expect($presentation->getMimeType())->toBe('application/octet-stream');

    $response = $this->post('/tools/powerpoint-to-pdf/convert', ['file' => $presentation]);

    $response->assertOk();
    expect($response->streamedContent())->toBe(FAKE_PDF);
});

test('si CloudConvert se queda sin cupo usa ConvertAPI con el formato real del archivo', function () {
    config(['services.cloudconvert.key' => 'cc-key', 'services.convertapi.token' => 'ca-token']);
    Http::fake([
        'api.cloudconvert.com/*' => Http::response(['message' => 'Credits exceeded'], 402),
        'v2.convertapi.com/*' => Http::response(['Files' => [['FileName' => 'documento.pdf', 'FileData' => base64_encode(FAKE_PDF)]]]),
    ]);

    $response = $this->post('/tools/excel-to-pdf/convert', ['file' => officeFile('antiguo.xls', "\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1")]);

    $response->assertOk();
    expect($response->streamedContent())->toBe(FAKE_PDF);
    Http::assertSent(fn (Request $request) => $request->url() === 'https://v2.convertapi.com/convert/xls/to/pdf'
        && $request->hasHeader('Authorization', 'Bearer ca-token')
        && ! str_contains($request->url(), 'Secret='));
});

test('PDF.co usa el endpoint de hojas de cálculo o el de documentos según el archivo', function (string $route, string $file, string $endpoint) {
    config(['services.pdfco.key' => 'pdfco-key']);
    Http::fake([
        'api.pdf.co/v1/file/upload/get-presigned-url*' => Http::response(['presignedUrl' => 'https://s3.pdfco.test/subida', 'url' => 'https://s3.pdfco.test/archivo', 'error' => false]),
        's3.pdfco.test/subida' => Http::response('', 200),
        'api.pdf.co/v1/*' => Http::response(['url' => 'https://s3.pdfco.test/resultado.pdf', 'error' => false, 'status' => 200]),
        's3.pdfco.test/resultado.pdf' => Http::response(FAKE_PDF),
    ]);

    $this->post($route, ['file' => officeFile($file)])->assertOk();

    Http::assertSent(fn (Request $request) => $request->url() === $endpoint && $request->hasHeader('x-api-key', 'pdfco-key'));
})->with([
    'excel' => ['/tools/excel-to-pdf/convert', 'hoja.xlsx', 'https://api.pdf.co/v1/xls/convert/to/pdf'],
    'powerpoint' => ['/tools/powerpoint-to-pdf/convert', 'diapositivas.pptx', 'https://api.pdf.co/v1/pdf/convert/from/doc'],
]);

test('avisa cuando todos los servicios se quedaron sin cupo', function () {
    config(['services.cloudconvert.key' => 'cc-key', 'services.pdfco.key' => 'pdfco-key']);
    Http::fake([
        'api.cloudconvert.com/*' => Http::response(['message' => 'Too many requests'], 429),
        // PDF.co responde 200 con el error dentro.
        'api.pdf.co/*' => Http::response(['error' => true, 'status' => 402, 'message' => 'Not enough credits']),
    ]);

    $this->post('/tools/excel-to-pdf/convert', ['file' => officeFile('hoja.xlsx')])
        ->assertStatus(503)
        ->assertJsonPath('error', 'Los servicios de conversión alcanzaron su límite de uso. Intenta de nuevo más tarde.');
});

test('sin claves configuradas responde que la conversión no está configurada', function () {
    Http::fake();

    $this->post('/tools/powerpoint-to-pdf/convert', ['file' => officeFile('diapositivas.pptx')])
        ->assertStatus(503)
        ->assertJsonPath('error', 'La conversión a PDF no está configurada en el servidor. Contacta al administrador del sistema.');

    Http::assertNothingSent();
});

test('rechaza archivos que no son del formato de su extensión', function (UploadedFile $file, string $expected) {
    config(['services.cloudconvert.key' => 'cc-key']);
    Http::fake();

    $this->post('/tools/excel-to-pdf/convert', ['file' => $file])
        ->assertStatus(422)
        ->assertJsonPath('error', $expected);

    Http::assertNothingSent();
})->with([
    'no es Excel' => [fn () => officeFile('falso.xlsx', '%PDF-'), 'El archivo no parece un archivo de Excel válido o está dañado.'],
    'protegido con contraseña' => [fn () => officeFile('cifrado.xlsx', "\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1"), 'El archivo está protegido con contraseña. Quítale la contraseña e inténtalo de nuevo.'],
    'otra extensión' => [fn () => officeFile('documento.pdf'), 'Archivo inválido. Solo se permiten archivos Excel (.xls o .xlsx) de máximo 25MB.'],
]);

test('Word se convierte en el servidor sin la línea «Powered by TCPDF»', function () {
    Http::fake();
    $word = new PhpWord;
    $word->addSection()->addText('Acta de prueba del comité');
    $path = tempnam(sys_get_temp_dir(), 'docx');
    WordIOFactory::createWriter($word, 'Word2007')->save($path);

    $response = $this->post('/tools/word-to-pdf/convert', ['file' => new UploadedFile($path, 'acta.docx', null, null, true)]);

    $response->assertOk()->assertHeader('Content-Type', 'application/pdf');
    $text = (new PdfParser)->parseContent($response->streamedContent())->getText();
    expect($text)->toContain('Acta de prueba del comité')->not->toContain('Powered by TCPDF');
    Http::assertNothingSent();
});

test('Word rechaza un .docx que no es un documento de Word', function () {
    $this->post('/tools/word-to-pdf/convert', ['file' => officeFile('falso.docx', 'texto')])
        ->assertStatus(422)
        ->assertJsonPath('error', 'El archivo no parece un documento de Word válido o está dañado.');
});
