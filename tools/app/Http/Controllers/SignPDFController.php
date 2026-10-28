<?php

namespace App\Http\Controllers;

use App\Services\PdfCertificateSigner;
use App\Services\PdfSigningException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Validator;

/**
 * Firma con certificado digital. La firma manuscrita y la preparación del
 * campo de firma se hacen en el navegador; aquí solo llegan el PDF preparado
 * y el certificado, que no se guardan en ningún momento.
 */
class SignPDFController extends Controller
{
    private const CERTIFICATE_RULES = [
        // Se valida la extensión: el tipo MIME de un .pfx casi siempre llega
        // como application/octet-stream y la regla «mimes» lo rechazaba.
        'certificate' => ['required', 'file', 'max:5120', 'extensions:pfx,p12,pem'],
        'password' => ['nullable', 'string', 'max:255'],
    ];

    /** Revisa el certificado y devuelve los datos del titular. */
    public function certificate(Request $request, PdfCertificateSigner $signer): JsonResponse
    {
        if (Validator::make($request->all(), self::CERTIFICATE_RULES)->fails()) {
            return response()->json(['error' => 'Selecciona un certificado .pfx, .p12 o .pem de máximo 5MB.'], 422);
        }

        try {
            $credentials = $signer->loadCredentials($request->file('certificate'), (string) $request->input('password'));
        } catch (PdfSigningException $e) {
            return response()->json(['error' => $e->getMessage()], $e->status);
        }

        return response()->json($signer->describe($credentials));
    }

    public function sign(Request $request, PdfCertificateSigner $signer): JsonResponse|Response
    {
        $validator = Validator::make($request->all(), [
            'pdf' => ['required', 'file', 'max:51200', 'extensions:pdf'],
            ...self::CERTIFICATE_RULES,
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => $validator->errors()->has('pdf')
                    ? 'El PDF no es válido o supera los 50MB.'
                    : 'Selecciona un certificado .pfx, .p12 o .pem de máximo 5MB.',
            ], 422);
        }

        $pdf = (string) file_get_contents($request->file('pdf')->getRealPath());
        if (! str_starts_with($pdf, '%PDF')) {
            return response()->json(['error' => 'El archivo no es un PDF válido.'], 422);
        }

        try {
            $credentials = $signer->loadCredentials($request->file('certificate'), (string) $request->input('password'));
            $signed = $signer->sign($pdf, $credentials);
        } catch (PdfSigningException $e) {
            return response()->json(['error' => $e->getMessage()], $e->status);
        }

        return response($signed, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="documento_firmado.pdf"',
        ]);
    }
}
