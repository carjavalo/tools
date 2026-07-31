<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use setasign\Fpdi\Tcpdf\Fpdi;
use Exception;

class SignPDFController extends Controller
{
    public function sign(Request $request)
    {
        try {
            $request->validate([
                'pdf' => 'required|file|mimes:pdf|max:51200', // 50MB max
                'certificate' => 'required|file|mimes:pfx,p12,pem|max:5120', // 5MB max
                'password' => 'required|string',
                'signer_name' => 'nullable|string|max:255',
                'reason' => 'nullable|string|max:255'
            ]);

            $pdfFile = $request->file('pdf');
            $certificateFile = $request->file('certificate');
            $password = $request->input('password');
            $signerName = $request->input('signer_name', 'Firmante');
            $reason = $request->input('reason', 'Firma digital');

            // Save uploaded files temporarily
            $pdfPath = $pdfFile->getRealPath();
            $certPath = $certificateFile->getRealPath();

            // Get certificate info
            $certificateInfo = $this->getCertificateInfo($certPath, $password);
            
            if (!$certificateInfo) {
                return response()->json([
                    'error' => 'Contraseña incorrecta o certificado inválido. Verifica tus credenciales.'
                ], 400);
            }

            // Create FPDI instance
            $pdf = new Fpdi();
            
            // Set document information
            $pdf->SetCreator('Evaristools - Hospital Universitario del Valle');
            $pdf->SetAuthor($signerName);
            $pdf->SetTitle('Documento Firmado Digitalmente');
            
            // Get page count
            $pageCount = $pdf->setSourceFile($pdfPath);
            
            // Import all pages
            for ($i = 1; $i <= $pageCount; $i++) {
                $template = $pdf->importPage($i);
                $size = $pdf->getTemplateSize($template);
                
                $pdf->AddPage($size['orientation'], [$size['width'], $size['height']]);
                $pdf->useTemplate($template);
            }

            // Set signature
            $this->setDigitalSignature($pdf, $certPath, $password, $signerName, $reason, $certificateInfo);

            // Output PDF
            $signedPdf = $pdf->Output('', 'S');

            // Clean up temporary files (they're auto-deleted by Laravel, but just to be safe)
            @unlink($pdfPath);
            @unlink($certPath);

            return response($signedPdf)
                ->header('Content-Type', 'application/pdf')
                ->header('Content-Disposition', 'attachment; filename="documento_firmado.pdf"');

        } catch (Exception $e) {
            \Log::error('Error in SignPDFController: ' . $e->getMessage());
            \Log::error('Stack trace: ' . $e->getTraceAsString());
            
            return response()->json([
                'error' => 'Error al firmar el PDF: ' . $e->getMessage()
            ], 500);
        }
    }

    private function getCertificateInfo($certPath, $password)
    {
        try {
            // Read certificate file
            $certContent = file_get_contents($certPath);
            
            // Try to parse as PKCS#12 (.pfx/.p12)
            $certs = [];
            if (openssl_pkcs12_read($certContent, $certs, $password)) {
                return [
                    'cert' => $certs['cert'],
                    'pkey' => $certs['pkey'],
                    'extracerts' => $certs['extracerts'] ?? []
                ];
            }
            
            // If PKCS#12 fails, try as PEM
            $certInfo = openssl_x509_parse($certContent);
            if ($certInfo !== false) {
                return [
                    'cert' => $certContent,
                    'pkey' => $certContent, // For PEM, cert and key might be in same file
                    'extracerts' => []
                ];
            }
            
            return null;
            
        } catch (Exception $e) {
            \Log::error('Error parsing certificate: ' . $e->getMessage());
            return null;
        }
    }

    private function setDigitalSignature($pdf, $certPath, $password, $signerName, $reason, $certInfo)
    {
        try {
            // Read certificate
            $certificate = file_get_contents($certPath);
            
            // Set signature appearance
            $info = [
                'Name' => $signerName,
                'Location' => 'Hospital Universitario del Valle',
                'Reason' => $reason,
                'ContactInfo' => 'info@huv.gov.co'
            ];

            // Set signature
            $pdf->setSignature(
                $certInfo['cert'],
                $certInfo['pkey'],
                $password,
                '',
                2,
                $info
            );

            // Set signature appearance on the document
            $pdf->setSignatureAppearance(
                10,
                10,
                50,
                20,
                1,
                [
                    'ForeColor' => [0, 0, 0],
                    'Border' => true
                ]
            );

        } catch (Exception $e) {
            \Log::error('Error setting digital signature: ' . $e->getMessage());
            throw new Exception('Error al configurar la firma digital: ' . $e->getMessage());
        }
    }
}
