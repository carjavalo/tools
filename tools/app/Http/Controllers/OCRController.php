<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Codesmiths\LaravelOcrSpace\Facades\OcrSpace;
use Codesmiths\LaravelOcrSpace\OcrSpaceOptions;
use Codesmiths\LaravelOcrSpace\Enums\Language;
use Codesmiths\LaravelOcrSpace\Enums\OcrSpaceEngine;
use Exception;

class OCRController extends Controller
{
    /**
     * Extract text from image or PDF using OCR.space API
     */
    public function extract(Request $request)
    {
        // Increase max execution time for OCR processing (3 minutes)
        // OCR.space API can take time with large/complex images
        set_time_limit(180);
        
        try {
            $request->validate([
                'file' => 'required|file|mimes:jpg,jpeg,png,gif,bmp,pdf|max:10240', // Max 10MB
                'language' => 'nullable|string|in:spa,eng,spa+eng',
            ]);

            $file = $request->file('file');
            $languageCode = $request->input('language', 'spa');
            
            Log::info('OCR extraction started', [
                'filename' => $file->getClientOriginalName(),
                'language' => $languageCode,
                'size' => $file->getSize()
            ]);
            
            // Map language codes to OCR.space Language enum
            $languageMap = [
                'spa' => Language::Spanish,
                'eng' => Language::English,
                'spa+eng' => Language::Spanish, // Use Spanish as default for mixed
            ];
            
            $language = $languageMap[$languageCode] ?? Language::Spanish;
            
            // Get file extension
            $extension = $file->getClientOriginalExtension();
            $mimeType = $file->getMimeType();
            
            // Configure OCR options
            // Note: HTTP timeout is configured in config/ocr-space.php
            $options = OcrSpaceOptions::make()
                ->language($language)
                ->detectOrientation(true)
                ->scale(true)
                ->fileType($mimeType)
                ->OCREngine(OcrSpaceEngine::Engine2); // Engine 2 is better for non-English
            
            // Process the file using binary content
            $binaryContent = file_get_contents($file->getRealPath());
            $response = OcrSpace::parseBinaryImage($binaryContent, $options);
            
            // Check for errors
            if ($response->hasError()) {
                $errorMessage = $response->getErrorMessage();
                Log::error('OCR extraction failed', ['error' => $errorMessage]);
                
                return response()->json([
                    'success' => false,
                    'error' => $errorMessage ?: 'Error al procesar la imagen'
                ], 422);
            }
            
            // Check if we have parsed results
            if (!$response->hasParsedResults()) {
                Log::error('OCR extraction returned no results');
                
                return response()->json([
                    'success' => false,
                    'error' => 'No se pudo extraer texto de la imagen'
                ], 422);
            }
            
            // Get all parsed text from all pages
            $parsedResults = $response->getParsedResults();
            $allText = '';
            $pageCount = $parsedResults->count();
            
            foreach ($parsedResults as $result) {
                $allText .= $result->getParsedText();
            }
            
            // Calculate confidence (estimate since OCR.space doesn't always provide it)
            $confidence = !empty($allText) ? 85 : 0;
            
            $processingTime = $response->getProcessingTimeInMilliseconds();
            
            Log::info('OCR extraction successful', [
                'confidence' => $confidence,
                'text_length' => strlen($allText),
                'pages' => $pageCount,
                'processing_time' => $processingTime
            ]);
            
            return response()->json([
                'success' => true,
                'text' => $allText,
                'confidence' => $confidence,
                'processing_time' => $processingTime,
                'pages' => $pageCount
            ]);

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'error' => 'Archivo inválido. Solo se permiten imágenes (JPG, PNG, GIF, BMP) o PDFs de máximo 10MB.'
            ], 422);
            
        } catch (Exception $e) {
            Log::error('OCR extraction error: ' . $e->getMessage());
            Log::error('Stack trace: ' . $e->getTraceAsString());
            
            return response()->json([
                'success' => false,
                'error' => 'Error al procesar el archivo. Por favor intenta de nuevo.'
            ], 500);
        }
    }
}
