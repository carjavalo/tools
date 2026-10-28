<?php

namespace App\Http\Controllers;

use App\Services\OfficeConversionException;
use App\Services\OfficeToPdfConverter;
use App\Services\WordPdfWriter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use PhpOffice\PhpWord\IOFactory;
use PhpOffice\PhpWord\Settings;

class WordToPDFController extends Controller
{
    /**
     * Convert uploaded Word document to PDF using TCPDF renderer.
     * Se convierte en el propio servidor: el documento no sale del hospital.
     */
    public function convert(Request $request, OfficeToPdfConverter $converter)
    {
        $validator = Validator::make($request->all(), [
            'file' => ['required', 'file', 'max:10240', 'extensions:doc,docx'], // Max 10MB
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Archivo inválido. Solo se permiten documentos Word (.doc o .docx) de máximo 10MB.',
            ], 422);
        }

        $file = $request->file('file');
        $originalName = pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME);

        try {
            $converter->assertOfficeFile($file, 'un documento de Word');
        } catch (OfficeConversionException $e) {
            return response()->json(['error' => $e->getMessage()], $e->status);
        }

        $pdfFilePath = tempnam(sys_get_temp_dir(), 'word_pdf_');

        try {
            // Configure TCPDF renderer for PHPWord
            Settings::setPdfRendererPath(base_path('vendor/tecnickcom/tcpdf'));
            Settings::setPdfRendererName('TCPDF');

            // Load the Word document
            $phpWord = IOFactory::load($file->getRealPath(), strtolower($file->getClientOriginalExtension()) === 'doc' ? 'MsDoc' : 'Word2007');

            // Configure document properties for better rendering
            $properties = $phpWord->getDocInfo();
            $properties->setCreator('Evaristools');
            $properties->setTitle($originalName);

            // Set default font to prevent rendering issues
            $phpWord->setDefaultFontName('Arial');
            $phpWord->setDefaultFontSize(11);

            // Fix margins for all sections to prevent content overflow
            foreach ($phpWord->getSections() as $section) {
                // Set margins in twips (1440 twips = 1 inch, 20mm = ~1134 twips)
                $section->getStyle()->setMarginTop(1134);    // 20mm top margin
                $section->getStyle()->setMarginBottom(1134); // 20mm bottom margin
                $section->getStyle()->setMarginLeft(1134);   // 20mm left margin
                $section->getStyle()->setMarginRight(1134);  // 20mm right margin
            }

            (new WordPdfWriter($phpWord))->save($pdfFilePath);
            $pdf = (string) file_get_contents($pdfFilePath);
        } catch (\Throwable $e) {
            Log::error('Word to PDF conversion error: '.$e->getMessage());
            Log::error('Stack trace: '.$e->getTraceAsString());

            return response()->json([
                'error' => 'No se pudo convertir el documento. Verifica que no esté dañado; si es un .doc antiguo, guárdalo como .docx e inténtalo de nuevo.',
            ], 500);
        } finally {
            @unlink($pdfFilePath);
        }

        return response()->streamDownload(function () use ($pdf) {
            echo $pdf;
        }, $originalName.'_converted.pdf', ['Content-Type' => 'application/pdf']);
    }
}
