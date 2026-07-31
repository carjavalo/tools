<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use PhpOffice\PhpWord\Settings;
use PhpOffice\PhpWord\IOFactory;

class WordToPDFController extends Controller
{
    /**
     * Convert uploaded Word document to PDF using TCPDF renderer
     */
    public function convert(Request $request)
    {
        try {
            // Validate the uploaded file
            $request->validate([
                'file' => 'required|mimes:doc,docx|max:10240', // Max 10MB
            ]);

            // Get the uploaded file
            $file = $request->file('file');
            $originalName = pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME);
            
            // Generate unique filename
            $fileName = 'word_' . time() . '_' . uniqid() . '.' . $file->getClientOriginalExtension();
            
            // Store the uploaded file temporarily
            $file->move(storage_path('app/temp'), $fileName);
            $wordFilePath = storage_path('app/temp/' . $fileName);

            // Configure TCPDF renderer for PHPWord
            $tcpdfPath = base_path('vendor/tecnickcom/tcpdf');
            Settings::setPdfRendererPath($tcpdfPath);
            Settings::setPdfRendererName('TCPDF');

            // Load the Word document
            $phpWord = IOFactory::load($wordFilePath);
            
            // Configure document properties for better rendering
            $properties = $phpWord->getDocInfo();
            $properties->setCreator('Evaristools');
            $properties->setTitle($originalName);
            
            // Set default font to prevent rendering issues
            $phpWord->setDefaultFontName('Arial');
            $phpWord->setDefaultFontSize(11);
            
            // Fix margins for all sections to prevent content overflow
            $sections = $phpWord->getSections();
            foreach ($sections as $section) {
                // Set margins in twips (1440 twips = 1 inch, 20mm = ~1134 twips)
                $section->getStyle()->setMarginTop(1134);    // 20mm top margin
                $section->getStyle()->setMarginBottom(1134); // 20mm bottom margin
                $section->getStyle()->setMarginLeft(1134);   // 20mm left margin
                $section->getStyle()->setMarginRight(1134);  // 20mm right margin
            }
            
            // Create PDF writer
            $pdfWriter = IOFactory::createWriter($phpWord, 'PDF');
            
            // Generate PDF filename
            $pdfFileName = $originalName . '_converted.pdf';
            $pdfFilePath = storage_path('app/temp/' . $pdfFileName);
            
            // Save the PDF
            $pdfWriter->save($pdfFilePath);

            // Delete the original Word file
            if (file_exists($wordFilePath)) {
                unlink($wordFilePath);
            }

            // Return the PDF file as download and then delete it
            return response()->download($pdfFilePath, $pdfFileName)->deleteFileAfterSend(true);

        } catch (\Exception $e) {
            Log::error('Word to PDF conversion error: ' . $e->getMessage());
            Log::error('Stack trace: ' . $e->getTraceAsString());
            
            // Clean up temporary files if they exist
            if (isset($wordFilePath) && file_exists($wordFilePath)) {
                unlink($wordFilePath);
            }
            if (isset($pdfFilePath) && file_exists($pdfFilePath)) {
                unlink($pdfFilePath);
            }
            
            return response()->json([
                'error' => 'Error al convertir el documento: ' . $e->getMessage()
            ], 500);
        }
    }
}
