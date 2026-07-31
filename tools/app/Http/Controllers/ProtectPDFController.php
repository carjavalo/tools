<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use setasign\Fpdi\Tcpdf\Fpdi;
use Exception;

class ProtectPDFController extends Controller
{
    public function protect(Request $request)
    {
        try {
            $request->validate([
                'pdf' => 'required|file|mimes:pdf|max:51200', // 50MB max
                'user_password' => 'required|string|min:4|max:255',
                'owner_password' => 'nullable|string|min:4|max:255'
            ]);

            $pdfFile = $request->file('pdf');
            $userPassword = $request->input('user_password');
            $ownerPassword = $request->input('owner_password', $userPassword);

            // Save uploaded file temporarily
            $pdfPath = $pdfFile->getRealPath();

            // Create FPDI instance
            $pdf = new Fpdi();
            
            // Set document information
            $pdf->SetCreator('Evaristools - Hospital Universitario del Valle');
            $pdf->SetTitle('Documento Protegido');
            
            // Get page count
            $pageCount = $pdf->setSourceFile($pdfPath);
            
            // Import all pages
            for ($i = 1; $i <= $pageCount; $i++) {
                $template = $pdf->importPage($i);
                $size = $pdf->getTemplateSize($template);
                
                $pdf->AddPage($size['orientation'], [$size['width'], $size['height']]);
                $pdf->useTemplate($template);
            }

            // Set protection with passwords
            // Permissions: print, copy text, modify, fill forms, extract, assemble, print high quality
            $permissions = array('print', 'copy', 'modify', 'annot-forms', 'fill-forms', 'extract', 'assemble', 'print-high');
            
            $pdf->SetProtection($permissions, $userPassword, $ownerPassword, 0, null);

            // Output PDF
            $protectedPdf = $pdf->Output('', 'S');

            // Clean up
            @unlink($pdfPath);

            return response($protectedPdf)
                ->header('Content-Type', 'application/pdf')
                ->header('Content-Disposition', 'attachment; filename="documento_protegido.pdf"');

        } catch (Exception $e) {
            \Log::error('Error in ProtectPDFController: ' . $e->getMessage());
            \Log::error('Stack trace: ' . $e->getTraceAsString());
            
            return response()->json([
                'error' => 'Error al proteger el PDF: ' . $e->getMessage()
            ], 500);
        }
    }
}
