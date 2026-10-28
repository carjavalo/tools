<?php

use App\Services\PdfCertificateSigner;
use Illuminate\Http\UploadedFile;

const CERT_PASSWORD = 'clave-de-prueba';

// Configuración mínima de OpenSSL: en Windows PHP no siempre encuentra openssl.cnf.
function opensslConfig(): array
{
    static $path = null;
    if ($path === null) {
        $path = tempnam(sys_get_temp_dir(), 'ossl');
        file_put_contents($path, "[ req ]\ndistinguished_name = dn\n[ dn ]\n");
    }

    return ['config' => $path, 'digest_alg' => 'sha256', 'private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA];
}

/** Certificado autofirmado ficticio: [certificado, clave]. */
function fakeCertificate(string $name = 'Persona Ficticia', int $days = 30): array
{
    $key = openssl_pkey_new(opensslConfig());
    $csr = openssl_csr_new(['commonName' => $name, 'organizationName' => 'Pruebas HUV'], $key, opensslConfig());
    $cert = openssl_csr_sign($csr, null, $key, $days, opensslConfig());

    return [$cert, $key];
}

function pfxUpload(array $credentials, string $password = CERT_PASSWORD, string $name = 'firma.pfx'): UploadedFile
{
    openssl_pkcs12_export($credentials[0], $pfx, $credentials[1], $password, opensslConfig());

    // Sin tipo MIME, como llega desde Windows.
    return UploadedFile::fake()->createWithContent($name, $pfx);
}

function pemUpload(array $credentials): UploadedFile
{
    openssl_x509_export($credentials[0], $cert);
    openssl_pkey_export($credentials[1], $key, null, opensslConfig());

    return UploadedFile::fake()->createWithContent('firma.pem', $cert.$key);
}

/** PDF mínimo con el campo de firma preparado como lo deja el navegador. */
function preparedPdf(int $contentsBytes = 8192): string
{
    return "%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n"
        ."5 0 obj\n<<\n/Type /Sig\n/Filter /Adobe.PPKLite\n/SubFilter /adbe.pkcs7.detached\n"
        .PdfCertificateSigner::BYTE_RANGE_PLACEHOLDER."\n/Contents <".str_repeat('0', $contentsBytes * 2).">\n>>\nendobj\n"
        ."trailer\n<< /Root 1 0 R >>\n%%EOF\n";
}

/** Verifica la firma CMS del PDF firmado sobre los rangos que indica /ByteRange. */
function verifySignedPdf(string $pdf): bool
{
    preg_match('/\/ByteRange \[(\d+) (\d+) (\d+) (\d+)\]/', $pdf, $range);
    [, $offset1, $length1, $offset2, $length2] = array_map('intval', $range);

    // El relleno de ceros tras la firma DER se ignora al leerla.
    $signature = hex2bin(substr($pdf, $length1 + 1, $offset2 - $length1 - 2));
    $content = tempnam(sys_get_temp_dir(), 'pdf');
    $sigFile = tempnam(sys_get_temp_dir(), 'sig');
    file_put_contents($content, substr($pdf, $offset1, $length1).substr($pdf, $offset2, $length2));
    file_put_contents($sigFile, $signature);

    try {
        // Firma separada: el primer archivo es el contenido y la firma va en $sigfile.
        return openssl_cms_verify($content, OPENSSL_CMS_BINARY | OPENSSL_CMS_NOVERIFY | OPENSSL_CMS_DETACHED, null, [], null, null, null, $sigFile, OPENSSL_ENCODING_DER);
    } finally {
        @unlink($content);
        @unlink($sigFile);
    }
}

beforeEach(function () {
    $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class);
});

test('muestra los datos de un certificado .pfx aunque llegue sin tipo MIME', function () {
    $response = $this->postJson('/tools/sign-pdf/certificate', [
        'certificate' => pfxUpload(fakeCertificate('Ana Gómez')),
        'password' => CERT_PASSWORD,
    ]);

    $response->assertOk()->assertJson([
        'name' => 'Ana Gómez',
        'organization' => 'Pruebas HUV',
        'issuer' => 'Ana Gómez',
        'selfSigned' => true,
    ]);
});

test('rechaza una contraseña incorrecta con un mensaje claro', function () {
    $this->postJson('/tools/sign-pdf/certificate', [
        'certificate' => pfxUpload(fakeCertificate()),
        'password' => 'otra-clave',
    ])->assertStatus(422)->assertJson(['error' => 'Contraseña incorrecta o el archivo no es un certificado válido.']);
});

test('rechaza un certificado vencido', function () {
    $this->postJson('/tools/sign-pdf/certificate', [
        'certificate' => pfxUpload(fakeCertificate(days: -1)),
        'password' => CERT_PASSWORD,
    ])->assertStatus(422)->assertJsonPath('error', fn (string $error) => str_starts_with($error, 'El certificado venció'));
});

test('acepta un .pem con el certificado y la clave', function () {
    $this->postJson('/tools/sign-pdf/certificate', [
        'certificate' => pemUpload(fakeCertificate('Carlos Ruiz')),
    ])->assertOk()->assertJson(['name' => 'Carlos Ruiz']);
});

test('rechaza archivos que no son certificados por su extensión', function () {
    $this->postJson('/tools/sign-pdf/certificate', [
        'certificate' => UploadedFile::fake()->createWithContent('firma.txt', 'hola'),
        'password' => CERT_PASSWORD,
    ])->assertStatus(422)->assertJson(['error' => 'Selecciona un certificado .pfx, .p12 o .pem de máximo 5MB.']);
});

test('firma el PDF preparado y la firma se puede verificar', function () {
    $prepared = preparedPdf();

    $response = $this->post('/tools/sign-pdf/sign', [
        'pdf' => UploadedFile::fake()->createWithContent('documento.pdf', $prepared),
        'certificate' => pfxUpload(fakeCertificate()),
        'password' => CERT_PASSWORD,
    ]);

    $response->assertOk()->assertHeader('Content-Type', 'application/pdf');
    $signed = $response->getContent();

    // Mismo tamaño: solo se rellenan el /ByteRange y el /Contents.
    expect(strlen($signed))->toBe(strlen($prepared))
        ->and($signed)->not->toContain(PdfCertificateSigner::BYTE_RANGE_PLACEHOLDER)
        ->and(verifySignedPdf($signed))->toBeTrue();

    // Si se cambia un byte firmado, la verificación falla.
    $tampered = substr_replace($signed, 'X', 12, 1);
    expect(verifySignedPdf($tampered))->toBeFalse();
});

test('incluye la cadena del certificado en la firma', function () {
    [$caCert, $caKey] = fakeCertificate('Entidad Ficticia');
    $key = openssl_pkey_new(opensslConfig());
    $csr = openssl_csr_new(['commonName' => 'Firmante Ficticio'], $key, opensslConfig());
    $cert = openssl_csr_sign($csr, $caCert, $caKey, 30, opensslConfig());
    openssl_x509_export($caCert, $caPem);
    openssl_pkcs12_export($cert, $pfx, $key, CERT_PASSWORD, ['extracerts' => [$caPem]] + opensslConfig());

    $response = $this->post('/tools/sign-pdf/sign', [
        'pdf' => UploadedFile::fake()->createWithContent('documento.pdf', preparedPdf()),
        'certificate' => UploadedFile::fake()->createWithContent('firma.p12', $pfx),
        'password' => CERT_PASSWORD,
    ]);

    $response->assertOk();
    $signed = $response->getContent();
    expect(verifySignedPdf($signed))->toBeTrue();

    // El certificado de la entidad va dentro de la firma (DER en hexadecimal).
    openssl_x509_export($caCert, $caPem);
    $caDer = base64_decode(preg_replace('/-----[^-]+-----|\s/', '', $caPem));
    expect(stripos($signed, bin2hex($caDer)))->not->toBeFalse();
});

test('rechaza un PDF que no se preparó para firmar', function () {
    $this->post('/tools/sign-pdf/sign', [
        'pdf' => UploadedFile::fake()->createWithContent('documento.pdf', "%PDF-1.7\n%%EOF\n"),
        'certificate' => pfxUpload(fakeCertificate()),
        'password' => CERT_PASSWORD,
    ], ['Accept' => 'application/json'])
        ->assertStatus(422)
        ->assertJson(['error' => 'El documento no se preparó para firmar. Recarga la página e intenta de nuevo.']);
});

test('avisa si la firma no cabe en el espacio reservado', function () {
    $this->post('/tools/sign-pdf/sign', [
        'pdf' => UploadedFile::fake()->createWithContent('documento.pdf', preparedPdf(contentsBytes: 64)),
        'certificate' => pfxUpload(fakeCertificate()),
        'password' => CERT_PASSWORD,
    ], ['Accept' => 'application/json'])->assertStatus(500)->assertJsonPath('error', fn (string $error) => str_contains($error, 'demasiado grande'));
});

test('rechaza archivos que no son PDF', function () {
    $this->post('/tools/sign-pdf/sign', [
        'pdf' => UploadedFile::fake()->createWithContent('documento.pdf', 'no soy un pdf'),
        'certificate' => pfxUpload(fakeCertificate()),
        'password' => CERT_PASSWORD,
    ], ['Accept' => 'application/json'])->assertStatus(422)->assertJson(['error' => 'El archivo no es un PDF válido.']);
});
