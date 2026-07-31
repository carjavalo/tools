<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ExcelToPDFController extends Controller
{
    /**
     * Convert uploaded Excel spreadsheet to PDF
     * Uses multiple free APIs with automatic rotation
     */
    public function convert(Request $request)
    {
        try {
            // Validate the uploaded file
            $request->validate([
                'file' => 'required|mimes:xls,xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet|max:25600', // Max 25MB
            ]);

            // Get the uploaded file
            $file = $request->file('file');
            $originalName = pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME);
            
            // Generate unique filename
            $fileName = 'excel_' . time() . '_' . uniqid() . '.' . $file->getClientOriginalExtension();
            
            // Store the uploaded file temporarily
            $file->move(storage_path('app/temp'), $fileName);
            $excelFilePath = storage_path('app/temp/' . $fileName);

            // Generate PDF filename
            $pdfFileName = $originalName . '_converted.pdf';
            $pdfFilePath = storage_path('app/temp/' . $pdfFileName);
            
            // Try to convert using multiple APIs with automatic fallback
            $success = $this->convertWithAutoRotation($excelFilePath, $pdfFilePath);
            
            // Delete the original Excel file
            if (file_exists($excelFilePath)) {
                unlink($excelFilePath);
            }
            
            if ($success && file_exists($pdfFilePath)) {
                return response()->download($pdfFilePath, $pdfFileName)->deleteFileAfterSend(true);
            }
            
            return response()->json([
                'error' => 'No se pudo convertir el archivo Excel a PDF. Verifica que el archivo no esté corrupto o intenta de nuevo.'
            ], 500);

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'error' => 'Archivo inválido. Solo se permiten archivos Excel (.xls o .xlsx) de máximo 25MB.'
            ], 422);
            
        } catch (\Exception $e) {
            Log::error('Excel to PDF conversion error: ' . $e->getMessage());
            Log::error('Stack trace: ' . $e->getTraceAsString());
            
            // Clean up temporary files if they exist
            if (isset($excelFilePath) && file_exists($excelFilePath)) {
                unlink($excelFilePath);
            }
            if (isset($pdfFilePath) && file_exists($pdfFilePath)) {
                unlink($pdfFilePath);
            }
            
            return response()->json([
                'error' => 'Error al convertir la hoja de cálculo. Por favor intenta de nuevo.'
            ], 500);
        }
    }
    
    /**
     * Convert Excel to PDF with automatic API rotation
     * Tries multiple APIs in order until one succeeds
     */
    private function convertWithAutoRotation($inputPath, $outputPath)
    {
        // Try CloudConvert first (750/month free)
        if ($this->convertWithCloudConvert($inputPath, $outputPath)) {
            return true;
        }
        
        // Fallback to ConvertAPI (250/month free)
        if ($this->convertWithConvertAPI($inputPath, $outputPath)) {
            return true;
        }
        
        // Fallback to PDF.co (300/month free)
        if ($this->convertWithPDFco($inputPath, $outputPath)) {
            return true;
        }
        
        // All APIs failed
        Log::error('All Excel conversion APIs failed');
        return false;
    }
    
    /**
     * Method 1: CloudConvert API (750 conversions/month free)
     */
    private function convertWithCloudConvert($inputPath, $outputPath)
    {
        try {
            $apiKey = env('CLOUDCONVERT_API_KEY');
            
            if (empty($apiKey)) {
                Log::info('CloudConvert: No API key configured, skipping');
                return false;
            }
            
            $curl = curl_init();
            
            // Step 1: Create a job
            $jobData = json_encode([
                'tasks' => [
                    'import-my-file' => [
                        'operation' => 'import/upload'
                    ],
                    'convert-my-file' => [
                        'operation' => 'convert',
                        'input' => 'import-my-file',
                        'output_format' => 'pdf'
                    ],
                    'export-my-file' => [
                        'operation' => 'export/url',
                        'input' => 'convert-my-file'
                    ]
                ]
            ]);
            
            curl_setopt_array($curl, [
                CURLOPT_URL => 'https://api.cloudconvert.com/v2/jobs',
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => $jobData,
                CURLOPT_HTTPHEADER => [
                    'Authorization: Bearer ' . $apiKey,
                    'Content-Type: application/json'
                ],
                CURLOPT_TIMEOUT => 120
            ]);
            
            $response = curl_exec($curl);
            $httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
            curl_close($curl);
            
            if ($httpCode !== 200 && $httpCode !== 201) {
                Log::warning('CloudConvert: Job creation failed with status ' . $httpCode);
                return false;
            }
            
            $jobResult = json_decode($response, true);
            $uploadTask = $jobResult['data']['tasks'][0] ?? null;
            
            if (!$uploadTask || !isset($uploadTask['result']['form']['url'])) {
                Log::warning('CloudConvert: No upload URL received');
                return false;
            }
            
            // Step 2: Upload the file
            $uploadUrl = $uploadTask['result']['form']['url'];
            $uploadParameters = $uploadTask['result']['form']['parameters'] ?? [];
            
            $postFields = $uploadParameters;
            $postFields['file'] = new \CURLFile($inputPath, mime_content_type($inputPath), basename($inputPath));
            
            $curl = curl_init();
            curl_setopt_array($curl, [
                CURLOPT_URL => $uploadUrl,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => $postFields,
                CURLOPT_TIMEOUT => 120
            ]);
            
            curl_exec($curl);
            $uploadCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
            curl_close($curl);
            
            if ($uploadCode !== 200 && $uploadCode !== 201) {
                Log::warning('CloudConvert: File upload failed');
                return false;
            }
            
            // Step 3: Wait for job completion and download
            $jobId = $jobResult['data']['id'];
            $maxAttempts = 30;
            $attempt = 0;
            
            while ($attempt < $maxAttempts) {
                sleep(2);
                $attempt++;
                
                $curl = curl_init();
                curl_setopt_array($curl, [
                    CURLOPT_URL => "https://api.cloudconvert.com/v2/jobs/{$jobId}",
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_HTTPHEADER => [
                        'Authorization: Bearer ' . $apiKey
                    ],
                    CURLOPT_TIMEOUT => 30
                ]);
                
                $statusResponse = curl_exec($curl);
                curl_close($curl);
                
                $statusData = json_decode($statusResponse, true);
                
                if ($statusData['data']['status'] === 'finished') {
                    // Find export task
                    foreach ($statusData['data']['tasks'] as $task) {
                        if ($task['name'] === 'export-my-file' && isset($task['result']['files'][0]['url'])) {
                            $pdfUrl = $task['result']['files'][0]['url'];
                            $pdfContent = file_get_contents($pdfUrl);
                            
                            if ($pdfContent && file_put_contents($outputPath, $pdfContent)) {
                                Log::info('CloudConvert: Excel conversion successful');
                                return true;
                            }
                        }
                    }
                }
                
                if ($statusData['data']['status'] === 'error') {
                    Log::warning('CloudConvert: Job failed');
                    return false;
                }
            }
            
            Log::warning('CloudConvert: Timeout waiting for conversion');
            return false;
            
        } catch (\Exception $e) {
            Log::warning('CloudConvert: Exception - ' . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Method 2: ConvertAPI (250 conversions/month free)
     */
    private function convertWithConvertAPI($inputPath, $outputPath)
    {
        try {
            $apiSecret = env('CONVERTAPI_SECRET');
            
            if (empty($apiSecret)) {
                Log::info('ConvertAPI: No API key configured, skipping');
                return false;
            }
            
            $curl = curl_init();
            
            $fileContent = file_get_contents($inputPath);
            $base64Content = base64_encode($fileContent);
            $fileName = basename($inputPath);
            
            $postData = json_encode([
                'Parameters' => [
                    [
                        'Name' => 'File',
                        'FileValue' => [
                            'Name' => $fileName,
                            'Data' => $base64Content
                        ]
                    ],
                    [
                        'Name' => 'StoreFile',
                        'Value' => 'true'
                    ]
                ]
            ]);
            
            curl_setopt_array($curl, [
                CURLOPT_URL => "https://v2.convertapi.com/convert/xlsx/to/pdf?Secret={$apiSecret}",
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => $postData,
                CURLOPT_HTTPHEADER => [
                    'Content-Type: application/json',
                    'Accept: application/json'
                ],
                CURLOPT_TIMEOUT => 120
            ]);
            
            $response = curl_exec($curl);
            $httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
            curl_close($curl);
            
            if ($httpCode !== 200) {
                Log::warning('ConvertAPI: Failed with status ' . $httpCode);
                return false;
            }
            
            $result = json_decode($response, true);
            
            if (!isset($result['Files'][0]['Url'])) {
                Log::warning('ConvertAPI: No download URL in response');
                return false;
            }
            
            $pdfUrl = $result['Files'][0]['Url'];
            $pdfContent = file_get_contents($pdfUrl);
            
            if ($pdfContent && file_put_contents($outputPath, $pdfContent)) {
                Log::info('ConvertAPI: Excel conversion successful');
                return true;
            }
            
            return false;
            
        } catch (\Exception $e) {
            Log::warning('ConvertAPI: Exception - ' . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Method 3: PDF.co API (300 conversions/month free)
     */
    private function convertWithPDFco($inputPath, $outputPath)
    {
        try {
            $apiKey = env('PDFCO_API_KEY');
            
            if (empty($apiKey)) {
                Log::info('PDF.co: No API key configured, skipping');
                return false;
            }
            
            // Step 1: Get presigned URL for upload
            $curl = curl_init();
            curl_setopt_array($curl, [
                CURLOPT_URL => 'https://api.pdf.co/v1/file/upload/get-presigned-url?name=' . urlencode(basename($inputPath)),
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER => [
                    'x-api-key: ' . $apiKey
                ],
                CURLOPT_TIMEOUT => 30
            ]);
            
            $response = curl_exec($curl);
            $httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
            curl_close($curl);
            
            if ($httpCode !== 200) {
                Log::warning('PDF.co: Failed to get upload URL');
                return false;
            }
            
            $uploadData = json_decode($response, true);
            
            if (!isset($uploadData['presignedUrl']) || !isset($uploadData['url'])) {
                Log::warning('PDF.co: Invalid upload response');
                return false;
            }
            
            // Step 2: Upload file
            $fileContent = file_get_contents($inputPath);
            
            $curl = curl_init();
            curl_setopt_array($curl, [
                CURLOPT_URL => $uploadData['presignedUrl'],
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_CUSTOMREQUEST => 'PUT',
                CURLOPT_POSTFIELDS => $fileContent,
                CURLOPT_HTTPHEADER => [
                    'Content-Type: application/octet-stream'
                ],
                CURLOPT_TIMEOUT => 120
            ]);
            
            curl_exec($curl);
            $uploadCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
            curl_close($curl);
            
            if ($uploadCode !== 200) {
                Log::warning('PDF.co: File upload failed');
                return false;
            }
            
            // Step 3: Convert to PDF
            $convertData = json_encode([
                'url' => $uploadData['url'],
                'async' => false
            ]);
            
            $curl = curl_init();
            curl_setopt_array($curl, [
                CURLOPT_URL => 'https://api.pdf.co/v1/pdf/convert/from/xlsx',
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => $convertData,
                CURLOPT_HTTPHEADER => [
                    'x-api-key: ' . $apiKey,
                    'Content-Type: application/json'
                ],
                CURLOPT_TIMEOUT => 120
            ]);
            
            $response = curl_exec($curl);
            $httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
            curl_close($curl);
            
            if ($httpCode !== 200) {
                Log::warning('PDF.co: Conversion failed');
                return false;
            }
            
            $result = json_decode($response, true);
            
            if (!isset($result['url'])) {
                Log::warning('PDF.co: No PDF URL in response');
                return false;
            }
            
            // Step 4: Download converted PDF
            $pdfContent = file_get_contents($result['url']);
            
            if ($pdfContent && file_put_contents($outputPath, $pdfContent)) {
                Log::info('PDF.co: Excel conversion successful');
                return true;
            }
            
            return false;
            
        } catch (\Exception $e) {
            Log::warning('PDF.co: Exception - ' . $e->getMessage());
            return false;
        }
    }
}

