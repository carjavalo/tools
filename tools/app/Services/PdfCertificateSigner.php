<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use OpenSSLAsymmetricKey;
use OpenSSLCertificate;

/**
 * Firma digital con certificado (.pfx/.p12 o .pem) de un PDF que el navegador
 * ya preparó: el campo de firma, con /ByteRange y /Contents de relleno, va al
 * final del archivo como actualización incremental, así no se invalidan las
 * firmas que el documento ya tuviera. Aquí solo se calcula la firma CMS y se
 * escribe en su lugar.
 */
class PdfCertificateSigner
{
    // Debe coincidir con el marcador que escribe resources/js/lib/pdf-signature.ts.
    public const BYTE_RANGE_PLACEHOLDER = '/ByteRange [ 0 /********** /********** /********** ]';

    private const INVALID_CERTIFICATE = 'Contraseña incorrecta o el archivo no es un certificado válido.';

    /**
     * @return array{cert: OpenSSLCertificate, key: OpenSSLAsymmetricKey, chain: string[]}
     */
    public function loadCredentials(UploadedFile $file, string $password): array
    {
        $contents = (string) file_get_contents($file->getRealPath());
        $this->clearOpensslErrors();

        $credentials = strtolower($file->getClientOriginalExtension()) === 'pem'
            ? $this->fromPem($contents, $password)
            : $this->fromPkcs12($contents, $password);

        if (! openssl_x509_check_private_key($credentials['cert'], $credentials['key'])) {
            throw new PdfSigningException('La clave privada no corresponde al certificado.');
        }

        $info = openssl_x509_parse($credentials['cert']);
        if (($info['validTo_time_t'] ?? 0) < time()) {
            throw new PdfSigningException('El certificado venció el '.date('d/m/Y', $info['validTo_time_t'] ?? 0).'. Usa uno vigente.');
        }
        if (($info['validFrom_time_t'] ?? 0) > time()) {
            throw new PdfSigningException('El certificado aún no es válido: empieza a regir el '.date('d/m/Y', $info['validFrom_time_t']).'.');
        }

        return $credentials;
    }

    /**
     * Datos del titular para mostrarlos antes de firmar.
     *
     * @param  array{cert: OpenSSLCertificate}  $credentials
     * @return array{name: string, organization: ?string, issuer: string, validTo: string, selfSigned: bool}
     */
    public function describe(array $credentials): array
    {
        $info = openssl_x509_parse($credentials['cert']);
        $subject = $info['subject'] ?? [];
        $issuer = $info['issuer'] ?? [];

        return [
            'name' => $this->firstValue($subject, ['CN', 'O']) ?? 'Titular sin nombre',
            'organization' => $this->firstValue($subject, ['O']),
            'issuer' => $this->firstValue($issuer, ['CN', 'O']) ?? 'Desconocido',
            'validTo' => date('Y-m-d', $info['validTo_time_t'] ?? 0),
            'selfSigned' => $subject === $issuer,
        ];
    }

    /**
     * @param  array{cert: OpenSSLCertificate, key: OpenSSLAsymmetricKey, chain: string[]}  $credentials
     */
    public function sign(string $pdf, array $credentials): string
    {
        $notPrepared = new PdfSigningException('El documento no se preparó para firmar. Recarga la página e intenta de nuevo.');

        $position = strrpos($pdf, self::BYTE_RANGE_PLACEHOLDER);
        if ($position === false) {
            throw $notPrepared;
        }

        // El /Contents de relleno tiene que estar en el mismo diccionario.
        $objectEnd = strpos($pdf, 'endobj', $position);
        $contentsKey = strpos($pdf, '/Contents <', $position);
        if ($objectEnd === false || $contentsKey === false || $contentsKey > $objectEnd) {
            throw $notPrepared;
        }

        $start = $contentsKey + strlen('/Contents ');
        $end = strpos($pdf, '>', $start);
        $length = $end === false ? 0 : $end - $start - 1;
        if ($length <= 0 || strspn($pdf, '0', $start + 1, $length) !== $length) {
            throw $notPrepared;
        }

        // La firma cubre todo el archivo menos el hueco del /Contents.
        $afterContents = $end + 1;
        $byteRange = sprintf('/ByteRange [0 %d %d %d]', $start, $afterContents, strlen($pdf) - $afterContents);
        $pdf = substr_replace($pdf, str_pad($byteRange, strlen(self::BYTE_RANGE_PLACEHOLDER)), $position, strlen(self::BYTE_RANGE_PLACEHOLDER));

        $signature = bin2hex($this->cmsSign(substr($pdf, 0, $start).substr($pdf, $afterContents), $credentials));
        if (strlen($signature) > $length) {
            throw new PdfSigningException('La cadena del certificado es demasiado grande para el espacio reservado de la firma.', 500);
        }

        return substr_replace($pdf, str_pad($signature, $length, '0'), $start + 1, $length);
    }

    /**
     * @return array{cert: OpenSSLCertificate, key: OpenSSLAsymmetricKey, chain: string[]}
     */
    private function fromPkcs12(string $contents, string $password): array
    {
        $certs = [];
        if (! openssl_pkcs12_read($contents, $certs, $password)) {
            $errors = $this->clearOpensslErrors();
            Log::info('No se pudo leer el certificado PKCS#12: '.$errors);

            // OpenSSL 3 ya no trae los cifrados viejos (RC2) de algunos .pfx.
            if (str_contains($errors, 'unsupported')) {
                throw new PdfSigningException(
                    'El certificado usa un cifrado antiguo que el servidor no admite. Expórtalo de nuevo desde Windows eligiendo el cifrado "AES256-SHA256".'
                );
            }

            throw new PdfSigningException(self::INVALID_CERTIFICATE);
        }

        $cert = openssl_x509_read($certs['cert']);
        $key = openssl_pkey_get_private($certs['pkey']);
        if (! $cert || ! $key) {
            throw new PdfSigningException(self::INVALID_CERTIFICATE);
        }

        return ['cert' => $cert, 'key' => $key, 'chain' => array_values($certs['extracerts'] ?? [])];
    }

    /**
     * @return array{cert: OpenSSLCertificate, key: OpenSSLAsymmetricKey, chain: string[]}
     */
    private function fromPem(string $contents, string $password): array
    {
        preg_match_all('/-----BEGIN CERTIFICATE-----.+?-----END CERTIFICATE-----/s', $contents, $matches);
        if ($matches[0] === []) {
            throw new PdfSigningException('El archivo .pem no contiene ningún certificado.');
        }

        $key = openssl_pkey_get_private($contents, $password);
        if (! $key) {
            throw new PdfSigningException('El archivo .pem debe incluir la clave privada. Si está cifrada, revisa la contraseña.');
        }

        // El del firmante es el que corresponde a la clave; los demás forman la cadena.
        $signer = null;
        $chain = [];
        foreach ($matches[0] as $pem) {
            if ($signer === null && openssl_x509_check_private_key($pem, $key)) {
                $signer = openssl_x509_read($pem);
            } else {
                $chain[] = $pem;
            }
        }

        if (! $signer) {
            throw new PdfSigningException('La clave privada no corresponde a ningún certificado del archivo.');
        }

        return ['cert' => $signer, 'key' => $key, 'chain' => $chain];
    }

    /**
     * Firma CMS separada (adbe.pkcs7.detached) en DER, con la cadena incluida.
     *
     * @param  array{cert: OpenSSLCertificate, key: OpenSSLAsymmetricKey, chain: string[]}  $credentials
     */
    private function cmsSign(string $data, array $credentials): string
    {
        $input = tempnam(sys_get_temp_dir(), 'firma');
        $output = tempnam(sys_get_temp_dir(), 'firma');
        $chainFile = $credentials['chain'] !== [] ? tempnam(sys_get_temp_dir(), 'cadena') : null;

        try {
            file_put_contents($input, $data);
            if ($chainFile) {
                file_put_contents($chainFile, implode("\n", $credentials['chain']));
            }

            $signed = openssl_cms_sign(
                $input,
                $output,
                $credentials['cert'],
                $credentials['key'],
                null,
                OPENSSL_CMS_DETACHED | OPENSSL_CMS_BINARY,
                OPENSSL_ENCODING_DER,
                $chainFile,
            );

            if (! $signed) {
                Log::error('No se pudo calcular la firma CMS: '.$this->clearOpensslErrors());
                throw new PdfSigningException('No se pudo calcular la firma digital.', 500);
            }

            return (string) file_get_contents($output);
        } finally {
            @unlink($input);
            @unlink($output);
            if ($chainFile) {
                @unlink($chainFile);
            }
        }
    }

    /**
     * @param  array<string, string|string[]>  $name
     * @param  string[]  $keys
     */
    private function firstValue(array $name, array $keys): ?string
    {
        foreach ($keys as $key) {
            $value = $name[$key] ?? null;
            if (is_array($value)) {
                $value = $value[0] ?? null;
            }
            if (is_string($value) && $value !== '') {
                return $value;
            }
        }

        return null;
    }

    private function clearOpensslErrors(): string
    {
        $errors = [];
        while (($error = openssl_error_string()) !== false) {
            $errors[] = $error;
        }

        return implode(' ', $errors);
    }
}
