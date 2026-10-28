<?php

use Illuminate\Http\Client\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use PhpOffice\PhpWord\IOFactory;
use PhpOffice\PhpWord\PhpWord;

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

beforeEach(function () {
    config([
        'services.groq.key' => 'gsk_test',
        'services.groq.model' => 'openai/gpt-oss-120b',
        'services.groq.summary_max_chars' => 16000,
    ]);
});

function fakeGroqSummary(string $summary = "## Propósito\nResumen de prueba."): void
{
    Http::fake([
        GROQ_ENDPOINT => Http::response([
            'choices' => [['message' => ['content' => $summary], 'finish_reason' => 'stop']],
        ]),
    ]);
}

function summarize(UploadedFile $file, array $options = [])
{
    return test()->postJson('/tools/resume-document/generate', array_merge([
        'file' => $file,
        'length' => 'medium',
        'language' => 'es',
        'style' => 'paragraphs',
    ], $options));
}

function sentUserPrompt(): string
{
    $prompt = '';
    Http::assertSent(function (Request $request) use (&$prompt) {
        $prompt = $request['messages'][1]['content'];

        return true;
    });

    return $prompt;
}

function pdfWithPages(array $pages): UploadedFile
{
    $pdf = new TCPDF;
    $pdf->setPrintHeader(false);
    $pdf->setPrintFooter(false);
    foreach ($pages as $text) {
        $pdf->AddPage();
        if ($text !== '') {
            $pdf->Write(0, $text);
        }
    }

    return UploadedFile::fake()->createWithContent('documento.pdf', $pdf->Output('', 'S'));
}

test('resume un txt y envía a Groq el modelo, el estilo y el documento', function () {
    fakeGroqSummary('- **Punto** uno');
    $text = 'El comité de calidad revisó los indicadores de oportunidad en cirugía programada durante el trimestre.';

    $response = summarize(UploadedFile::fake()->createWithContent('acta.txt', $text), [
        'style' => 'bullets',
        'length' => 'short',
        'instructions' => 'Enfócate en los plazos',
    ]);

    $response->assertOk()
        ->assertJsonPath('summary', '- **Punto** uno')
        ->assertJsonPath('meta.complete', true)
        ->assertJsonPath('meta.words', 15);

    Http::assertSent(function (Request $request) use ($text) {
        $prompt = $request['messages'][1]['content'];

        return $request->url() === GROQ_ENDPOINT
            && $request->hasHeader('Authorization', 'Bearer gsk_test')
            && $request['model'] === 'openai/gpt-oss-120b'
            && $request['reasoning_effort'] === 'low'
            && $request['include_reasoning'] === false
            && $request['max_completion_tokens'] === 1500
            && str_contains($request['messages'][0]['content'], 'en español')
            && str_contains($prompt, 'entre 5 y 7')
            && str_contains($prompt, 'Enfócate en los plazos')
            && str_contains($prompt, "<documento>\n{$text}\n</documento>");
    });
});

test('sin clave de Groq responde que el servicio no está configurado', function () {
    config(['services.groq.key' => null]);
    Http::fake();

    summarize(UploadedFile::fake()->createWithContent('a.txt', str_repeat('texto de prueba ', 10)))
        ->assertStatus(503)
        ->assertJsonPath('error', 'El servicio de resúmenes no está configurado. Contacta al administrador del sistema.');

    Http::assertNothingSent();
});

test('recorta un texto largo sin partir caracteres y avisa cuánto se resumió', function () {
    config(['services.groq.summary_max_chars' => 1000]);
    fakeGroqSummary();
    $sentence = 'La auditoría médica encontró hallazgos en facturación. ';

    $response = summarize(UploadedFile::fake()->createWithContent('largo.txt', str_repeat($sentence, 100)));

    $response->assertOk()->assertJsonPath('meta.complete', false);
    expect($response->json('meta.percent'))->toBeLessThan(25)->toBeGreaterThan(15);

    $prompt = sentUserPrompt();
    expect($prompt)->toContain('solo recibes una parte del documento (aproximadamente el')
        ->and(mb_check_encoding($prompt, 'UTF-8'))->toBeTrue();
    preg_match('/<documento>\n(.*)\n<\/documento>/s', $prompt, $match);
    expect(mb_strlen($match[1]))->toBeLessThanOrEqual(1000)
        ->and($match[1])->toEndWith('facturación.');
});

test('en un PDF largo resume páginas completas e informa cuáles', function () {
    config(['services.groq.summary_max_chars' => 1000]);
    fakeGroqSummary();
    // ~400 caracteres por página: caben la 1 y la 3 (la 2 está en blanco), no la 4.
    $page = str_repeat('Informe de seguimiento del servicio de urgencias. ', 8);

    $response = summarize(pdfWithPages([$page, '', $page, $page, $page]));

    $response->assertOk()
        ->assertJsonPath('meta.complete', false)
        ->assertJsonPath('meta.pagesUsed', 3)
        ->assertJsonPath('meta.totalPages', 5);
    expect(sentUserPrompt())->toContain('las primeras 3 de 5 páginas');
});

test('un PDF sin texto se reconoce como escaneado y sugiere OCR', function () {
    Http::fake();

    summarize(pdfWithPages(['', '']))
        ->assertStatus(422)
        ->assertJsonPath('error', fn (string $error) => str_contains($error, 'OCR y Extracción de Texto'));

    Http::assertNothingSent();
});

test('de un Word extrae también las tablas', function () {
    fakeGroqSummary();
    $word = new PhpWord;
    $section = $word->addSection();
    $section->addText('Plan de mejoramiento del servicio de cirugía');
    $table = $section->addTable();
    $table->addRow();
    $table->addCell()->addText('Acción');
    $table->addCell()->addText('Responsable');
    $table->addRow();
    $table->addCell()->addText('Reducir cancelaciones');
    $table->addCell()->addText('Coordinación quirúrgica');
    $path = tempnam(sys_get_temp_dir(), 'docx');
    IOFactory::createWriter($word, 'Word2007')->save($path);

    summarize(new UploadedFile($path, 'plan.docx', null, null, true))->assertOk();

    expect(sentUserPrompt())
        ->toContain('Plan de mejoramiento del servicio de cirugía')
        ->toContain('Acción | Responsable')
        ->toContain('Reducir cancelaciones | Coordinación quirúrgica');
});

test('un txt en Windows-1252 se convierte a UTF-8', function () {
    fakeGroqSummary();
    $text = mb_convert_encoding('Revisión de la programación quirúrgica: añadir quirófano.', 'Windows-1252', 'UTF-8');

    summarize(UploadedFile::fake()->createWithContent('acta.txt', $text))->assertOk();

    expect(sentUserPrompt())->toContain('Revisión de la programación quirúrgica: añadir quirófano.');
});

test('traduce los errores de Groq a mensajes para el usuario', function (int $status, array $body, int $expectedStatus, string $expected) {
    Http::fake([GROQ_ENDPOINT => Http::response($body, $status)]);

    summarize(UploadedFile::fake()->createWithContent('a.txt', str_repeat('texto de prueba ', 10)))
        ->assertStatus($expectedStatus)
        ->assertJsonPath('error', fn (string $error) => str_contains($error, $expected));
})->with([
    'clave inválida' => [401, ['error' => ['message' => 'Invalid API Key', 'code' => 'invalid_api_key']], 503, 'clave del servicio de IA no es válida'],
    'modelo retirado' => [404, ['error' => ['message' => 'The model does not exist', 'code' => 'model_not_found']], 503, 'ya no está disponible'],
    'solicitud muy grande' => [413, ['error' => ['message' => 'Request too large for model on tokens per minute (TPM)', 'code' => 'rate_limit_exceeded']], 422, 'demasiado largo'],
    'límite de uso' => [429, ['error' => ['message' => 'Rate limit reached', 'code' => 'rate_limit_exceeded']], 429, 'límite de uso'],
    'caída del servicio' => [500, ['error' => ['message' => 'Internal error']], 502, 'no pudo generar el resumen'],
]);

test('ante un 429 con espera corta reintenta una vez', function () {
    Http::fake([
        GROQ_ENDPOINT => Http::sequence()
            ->push(['error' => ['message' => 'Rate limit reached']], 429, ['retry-after' => '1'])
            ->push(['choices' => [['message' => ['content' => 'Resumen tras reintento'], 'finish_reason' => 'stop']]]),
    ]);

    summarize(UploadedFile::fake()->createWithContent('a.txt', str_repeat('texto de prueba ', 10)))
        ->assertOk()
        ->assertJsonPath('summary', 'Resumen tras reintento');

    Http::assertSentCount(2);
});

test('rechaza un estilo de resumen desconocido', function () {
    Http::fake();

    summarize(UploadedFile::fake()->createWithContent('a.txt', 'texto'), ['style' => 'poema'])
        ->assertStatus(422)
        ->assertJsonValidationErrors('style');
});
