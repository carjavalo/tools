<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;

class CupsController extends Controller
{
    /**
     * Verificar si ZipArchive está disponible
     */
    private function isZipAvailable(): bool
    {
        return class_exists('ZipArchive');
    }

    public function processJsonSOS(Request $request)
    {
        // Limpiar cualquier salida previa para evitar HTML en respuesta JSON
        if (ob_get_level()) {
            ob_clean();
        }
        
        // Asegurar content-type JSON
        header('Content-Type: application/json');
        
        try {
            // Configurar límites de PHP programáticamente
            @ini_set('max_file_uploads', '200');
            @ini_set('upload_max_filesize', '100M');
            @ini_set('post_max_size', '500M');
            @ini_set('max_execution_time', '600');
            @ini_set('memory_limit', '512M');
            
            // Deshabilitar display_errors para evitar HTML en respuesta JSON
            @ini_set('display_errors', '0');
            @ini_set('log_errors', '1');
            
            Log::info('Starting processJsonSOS - Exact Python Script Implementation', [
                'zip_available' => $this->isZipAvailable()
            ]);
            
            // 1. Validar que se recibieron archivos
            if (!$request->hasFile('files')) {
                return response()->json([
                    'success' => false,
                    'error' => 'No se recibieron archivos'
                ]);
            }

            // 2. Crear directorios temporales (equivalente a rutas Python)
            $srcBasePath = storage_path('app/temp_upload');  // Equivalente a src_directory
            $destBasePath = storage_path('app/json_organizados');  // Equivalente a dest_directory
            
            // Limpiar y crear directorios
            if (File::exists($srcBasePath)) {
                File::deleteDirectory($srcBasePath);
            }
            if (File::exists($destBasePath)) {
                File::deleteDirectory($destBasePath);
            }
            
            File::makeDirectory($srcBasePath, 0755, true);
            
            $results = [
                'success' => true,
                'copied_folders' => 0,
                'renamed_files' => 0,
                'processed_cuv_files' => 0,
                'errors' => []
            ];
            
            // 3. Guardar archivos subidos manteniendo estructura original
            $this->saveUploadedFiles($request->file('files'), $request->input('file_paths', '{}'), $srcBasePath);
            
            // 4. EJECUTAR EXACTAMENTE EL SCRIPT PYTHON
            // Función 1: rename_and_copy_folders(src_base_path, dest_base_path)
            $this->renameAndCopyFoldersExact($srcBasePath, $destBasePath, $results);
            
            // Función 2: process_json_files(dest_base_path)
            $this->processJsonFilesExact($destBasePath, $results);
            
            // 5. Crear paquete de descarga
            $downloadPath = $this->createDownloadPackage($destBasePath);
            $results['download_url'] = '/api/download-processed/' . basename($downloadPath);
            $results['zip_available'] = $this->isZipAvailable();
            
            // Agregar advertencia si ZIP no está disponible
            if (!$this->isZipAvailable()) {
                $results['warnings'] = ['ZIP no disponible - usando formato alternativo'];
                Log::warning('ZipArchive not available, using directory fallback');
            }
            
            Log::info('Process completed successfully', $results);
            
            return response()->json($results);
            
        } catch (\Exception $e) {
            Log::error('Error in processJsonSOS: ' . $e->getMessage());
            Log::error('Stack trace: ' . $e->getTraceAsString());
            
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
                'debug_info' => [
                    'line' => $e->getLine(),
                    'file' => basename($e->getFile()),
                    'type' => get_class($e)
                ]
            ]);
        }
    }
    
    public function downloadProcessed($filename)
    {
        try {
            $filename = basename($filename);
            $filePath = storage_path('app/downloads/' . $filename);
            
            Log::info('Download request', [
                'filename' => $filename,
                'path' => $filePath,
                'exists' => File::exists($filePath),
                'is_dir' => is_dir($filePath),
                'zip_available' => $this->isZipAvailable()
            ]);
            
            if (!File::exists($filePath)) {
                Log::error('File not found', ['path' => $filePath]);
                abort(404, 'Archivo no encontrado');
            }
            
            // Si es archivo ZIP, descarga directa
            if (str_ends_with($filename, '.zip') && is_file($filePath)) {
                Log::info('Serving ZIP file for download', [
                    'filename' => $filename,
                    'size' => filesize($filePath)
                ]);
                
                return response()->download($filePath, $filename, [
                    'Content-Type' => 'application/zip',
                    'Content-Disposition' => 'attachment; filename="' . $filename . '"'
                ])->deleteFileAfterSend(false);
            }
            
            // Si es directorio, crear ZIP o TAR según disponibilidad
            if (is_dir($filePath)) {
                if ($this->isZipAvailable()) {
                    return $this->downloadDirectoryAsZip($filePath, $filename);
                } else {
                    return $this->downloadDirectoryAsTar($filePath, $filename);
                }
            }
            
            // Archivo individual
            Log::info('Serving individual file for download', [
                'filename' => $filename,
                'size' => filesize($filePath)
            ]);
            
            return response()->download($filePath, $filename);
            
        } catch (\Exception $e) {
            Log::error('Download error', ['error' => $e->getMessage(), 'filename' => $filename]);
            abort(500, 'Error al descargar el archivo: ' . $e->getMessage());
        }
    }
    
    /**
     * Descargar directorio como ZIP
     */
    private function downloadDirectoryAsZip($dirPath, $filename)
    {
        $zipPath = sys_get_temp_dir() . '/' . $filename . '.zip';
        $zip = new \ZipArchive();
        
        if ($zip->open($zipPath, \ZipArchive::CREATE | \ZipArchive::OVERWRITE) === TRUE) {
            $iterator = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator($dirPath, \RecursiveDirectoryIterator::SKIP_DOTS)
            );
            
            foreach ($iterator as $file) {
                if ($file->isFile()) {
                    $relativePath = substr($file->getPathname(), strlen($dirPath) + 1);
                    $zip->addFile($file->getPathname(), $relativePath);
                }
            }
            
            $zip->close();
            
            Log::info('ZIP created for directory download', [
                'dir_path' => $dirPath,
                'zip_path' => $zipPath,
                'size' => filesize($zipPath)
            ]);
            
            return response()->download($zipPath, $filename . '.zip', [
                'Content-Type' => 'application/zip'
            ])->deleteFileAfterSend(true);
        }
        
        throw new \Exception('No se pudo crear el archivo ZIP');
    }
    
    /**
     * Descargar directorio como TAR (fallback)
     */
    private function downloadDirectoryAsTar($dirPath, $filename)
    {
        $tarPath = sys_get_temp_dir() . '/' . $filename . '.tar';
        
        try {
            $phar = new \PharData($tarPath);
            $phar->buildFromDirectory($dirPath);
            
            Log::info('TAR created for directory download', [
                'dir_path' => $dirPath,
                'tar_path' => $tarPath,
                'size' => filesize($tarPath)
            ]);
            
            return response()->download($tarPath, $filename . '.tar', [
                'Content-Type' => 'application/x-tar'
            ])->deleteFileAfterSend(true);
            
        } catch (\Exception $e) {
            Log::error('TAR creation failed', ['error' => $e->getMessage()]);
            throw new \Exception('No se pudo crear el archivo TAR: ' . $e->getMessage());
        }
    }
    
    /**
     * Guardar archivos subidos manteniendo estructura original
     */
    private function saveUploadedFiles($files, $filePathsJson, $srcBasePath)
    {
        $filePaths = json_decode($filePathsJson, true) ?? [];
        
        foreach ($files as $index => $file) {
            $originalName = $file->getClientOriginalName();
            $relativePath = $filePaths[$originalName] ?? $originalName;
            $fullPath = $srcBasePath . '/' . $relativePath;
            
            // Crear directorio si no existe
            $directory = dirname($fullPath);
            if (!File::exists($directory)) {
                File::makeDirectory($directory, 0755, true);
            }
            
            // Mover archivo manteniendo nombre original EXACTO
            $file->move($directory, basename($fullPath));
        }
        
        Log::info('Files saved with original structure', [
            'total_files' => count($files),
            'base_path' => $srcBasePath
        ]);
    }
    
    /**
     * IMPLEMENTACIÓN EXACTA de rename_and_copy_folders() del script Python
     */
    private function renameAndCopyFoldersExact($srcBasePath, $destBasePath, &$results)
    {
        // 1. os.makedirs(dest_base_path, exist_ok=True)
        File::makeDirectory($destBasePath, 0755, true);
        
        Log::info('Starting rename_and_copy_folders', [
            'src' => $srcBasePath,
            'dest' => $destBasePath
        ]);
        
        // 2. for root, dirs, files in os.walk(src_base_path):
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($srcBasePath, RecursiveDirectoryIterator::SKIP_DOTS),
            RecursiveIteratorIterator::SELF_FIRST
        );
        
        foreach ($iterator as $item) {
            if ($item->isDir()) {
                // 3. for folder in dirs:
                $srcFolderPath = $item->getPathname();
                $relativePath = str_replace($srcBasePath . DIRECTORY_SEPARATOR, '', $srcFolderPath);
                $newDestFolderPath = $destBasePath . DIRECTORY_SEPARATOR . $relativePath;
                
                // 4. shutil.copytree(src_folder_path, new_dest_folder_path, dirs_exist_ok=True)
                if (!File::exists($newDestFolderPath)) {
                    File::copyDirectory($srcFolderPath, $newDestFolderPath);
                    $results['copied_folders']++;
                    
                    Log::info('✅ Carpeta copiada', [
                        'src' => $srcFolderPath,
                        'dest' => $newDestFolderPath
                    ]);
                }
                
                // 5. for filename in os.listdir(new_dest_folder_path):
                $folderName = basename($srcFolderPath);
                $filesInFolder = File::files($newDestFolderPath);
                
                foreach ($filesInFolder as $file) {
                    $filename = $file->getFilename();
                    $oldFilePath = $file->getPathname();
                    
                    // 6. if filename.startswith("ResultadosMSPS_"):
                    if (str_starts_with($filename, 'ResultadosMSPS_')) {
                        // 7. new_filename = f"{folder}-CUV{os.path.splitext(filename)[1]}"
                        $extension = pathinfo($filename, PATHINFO_EXTENSION);
                        $newFilename = $folderName . '-CUV.' . $extension;
                        $newFilePath = dirname($oldFilePath) . DIRECTORY_SEPARATOR . $newFilename;
                        
                        // 8. os.rename(old_file_path, new_file_path)
                        if (File::move($oldFilePath, $newFilePath)) {
                            $results['renamed_files']++;
                            
                            Log::info('✅ Archivo renombrado', [
                                'old' => $filename,
                                'new' => $newFilename
                            ]);
                        }
                    }
                }
            }
        }
        
        Log::info('🔹 Proceso de copiado y renombrado finalizado', [
            'copied_folders' => $results['copied_folders'],
            'renamed_files' => $results['renamed_files']
        ]);
    }
    
    /**
     * IMPLEMENTACIÓN EXACTA de process_json_files() del script Python
     */
    private function processJsonFilesExact($destBasePath, &$results)
    {
        // 1. cuv_json_files = glob.glob(os.path.join(dest_base_path, "**", "*CUV.json"), recursive=True)
        $cuvJsonFiles = [];
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($destBasePath, RecursiveDirectoryIterator::SKIP_DOTS)
        );
        
        foreach ($iterator as $file) {
            if ($file->isFile() && str_ends_with($file->getFilename(), 'CUV.json')) {
                $cuvJsonFiles[] = $file->getPathname();
            }
        }
        
        Log::info('Found CUV JSON files', ['count' => count($cuvJsonFiles)]);
        
        $totalCuvCorrectos = 0;
        
        // 2. for archivo_json in cuv_json_files:
        foreach ($cuvJsonFiles as $archivoJson) {
            try {
                // 3. nombre_carpeta = os.path.basename(os.path.dirname(archivo_json))
                $nombreCarpeta = basename(dirname($archivoJson));
                
                // 4. Leer archivo JSON
                $jsonContent = File::get($archivoJson);
                $data = json_decode($jsonContent, true);
                
                if ($data === null) {
                    $results['errors'][] = "❌ Error al procesar {$archivoJson}: JSON inválido";
                    continue;
                }
                
                // 5. data["RutaArchivos"] = f"C:\\Users\\{nombre_carpeta}"
                $data['RutaArchivos'] = "C:\\Users\\{$nombreCarpeta}";
                
                // 6. data.setdefault("ResultadosValidacion", [])
                if (!array_key_exists('ResultadosValidacion', $data)) {
                    $data['ResultadosValidacion'] = [];
                }
                
                // 7. data.setdefault("tipoNota", None)
                if (!array_key_exists('tipoNota', $data)) {
                    $data['tipoNota'] = null;
                }
                
                // 8. data.setdefault("numNota", None)
                if (!array_key_exists('numNota', $data)) {
                    $data['numNota'] = null;
                }
                
                // 9. Escribir archivo JSON modificado
                $jsonOutput = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
                File::put($archivoJson, $jsonOutput);
                
                Log::info('✅ Archivo CUV actualizado correctamente', ['file' => $archivoJson]);
                $totalCuvCorrectos++;
                
            } catch (\Exception $e) {
                $results['errors'][] = "❌ Error al procesar {$archivoJson}: " . $e->getMessage();
                Log::error('Error processing CUV file', [
                    'file' => $archivoJson,
                    'error' => $e->getMessage()
                ]);
            }
        }
        
        $results['processed_cuv_files'] = $totalCuvCorrectos;
        
        Log::info('📊 Resumen del proceso', [
            'total_cuv_correctos' => $totalCuvCorrectos
        ]);
        Log::info('✔️ Número total de CUV modificados correctamente: ' . $totalCuvCorrectos);
    }
    
    /**
     * Crear paquete de descarga desde directorio procesado
     */
    private function createDownloadPackage($sourcePath)
    {
        $downloadsPath = storage_path('app/downloads');
        if (!File::exists($downloadsPath)) {
            File::makeDirectory($downloadsPath, 0755, true);
        }
        
        $packageName = 'json_procesados_sos_' . date('Y-m-d_H-i-s');
        
        // Priorizar ZIP si está disponible
        if ($this->isZipAvailable()) {
            return $this->createZipPackage($sourcePath, $packageName, $downloadsPath);
        } else {
            return $this->createDirectoryPackage($sourcePath, $packageName, $downloadsPath);
        }
    }
    
    /**
     * Crear paquete ZIP
     */
    private function createZipPackage($sourcePath, $packageName, $downloadsPath)
    {
        $zipPath = $downloadsPath . '/' . $packageName . '.zip';
        $zip = new \ZipArchive();
        
        if ($zip->open($zipPath, \ZipArchive::CREATE | \ZipArchive::OVERWRITE) === TRUE) {
            $iterator = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator($sourcePath, \RecursiveDirectoryIterator::SKIP_DOTS)
            );
            
            foreach ($iterator as $file) {
                if ($file->isFile()) {
                    $relativePath = substr($file->getPathname(), strlen($sourcePath) + 1);
                    $zip->addFile($file->getPathname(), $relativePath);
                }
            }
            
            $zip->close();
            
            Log::info('ZIP package created successfully', [
                'source' => $sourcePath,
                'zip_path' => $zipPath,
                'size' => filesize($zipPath),
                'files_count' => count(File::allFiles($sourcePath))
            ]);
            
            return $zipPath;
        }
        
        // Fallback si ZIP falla
        Log::warning('ZIP creation failed, falling back to directory');
        return $this->createDirectoryPackage($sourcePath, $packageName, $downloadsPath);
    }
    
    /**
     * Crear paquete de directorio (fallback)
     */
    private function createDirectoryPackage($sourcePath, $packageName, $downloadsPath)
    {
        $packagePath = $downloadsPath . '/' . $packageName;
        
        if (File::exists($packagePath)) {
            File::deleteDirectory($packagePath);
        }
        
        File::copyDirectory($sourcePath, $packagePath);
        
        Log::info('Directory package created (fallback)', [
            'source' => $sourcePath,
            'package' => $packagePath,
            'files_count' => count(File::allFiles($packagePath))
        ]);
        
        return $packagePath;
    }
}