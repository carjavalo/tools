<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Support\Almacenamiento;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class EvarisdropFileTransferController extends Controller
{
    /**
     * Send transfer request to another device
     */
    public function requestTransfer(Request $request)
    {
        $request->validate([
            'targetDeviceId' => 'required|string',
            'fileName' => 'required|string',
            'fileSize' => 'required|integer|min:1',
            'file' => 'required|file|max:51200', // 50MB max
        ]);

        $deviceId = $request->session()->get('device_id');
        $roomCode = $request->session()->get('room_code');

        if (!$deviceId || !$roomCode) {
            return response()->json(['error' => 'No estás conectado a una sala'], 401);
        }

        // Store file temporarily
        $file = $request->file('file');
        $fileId = (string) Str::uuid();
        $fileName = $file->getClientOriginalName();
        $filePath = "transfers/{$fileId}_{$fileName}";
        
        Almacenamiento::subirDesdeRuta($file->getRealPath(), $filePath);

        // Create transfer request
        $transferRequest = [
            'id' => (string) Str::uuid(),
            'fileId' => $fileId,
            'fileName' => $fileName,
            'fileSize' => $file->getSize(),
            'filePath' => $filePath,
            'fromDeviceId' => $deviceId,
            'toDeviceId' => $request->targetDeviceId,
            'roomCode' => $roomCode,
            'status' => 'pending',
            'requestedAt' => now()->toISOString(),
        ];

        // Store transfer request in cache (expire in 30 minutes)
        Cache::put("transfer_request_{$transferRequest['id']}", $transferRequest, 1800);
        
        // Add to device's pending transfers
        $deviceTransfers = Cache::get("device_{$request->targetDeviceId}_transfers", []);
        $deviceTransfers[] = $transferRequest['id'];
        Cache::put("device_{$request->targetDeviceId}_transfers", $deviceTransfers, 1800);

        return response()->json([
            'success' => true,
            'transferId' => $transferRequest['id'],
            'message' => 'Solicitud de transferencia enviada'
        ]);
    }

    /**
     * Get pending transfer requests for current device
     */
    public function getPendingRequests(Request $request)
    {
        $deviceId = $request->session()->get('device_id');
        
        if (!$deviceId) {
            return response()->json(['requests' => []]);
        }

        $transferIds = Cache::get("device_{$deviceId}_transfers", []);
        $requests = [];

        foreach ($transferIds as $transferId) {
            $transfer = Cache::get("transfer_request_{$transferId}");
            if ($transfer && $transfer['status'] === 'pending') {
                // Get sender device info
                $roomDevices = Cache::get("room_{$transfer['roomCode']}_devices", []);
                $fromDevice = $roomDevices[$transfer['fromDeviceId']] ?? null;
                
                $requests[] = [
                    'id' => $transfer['id'],
                    'fileName' => $transfer['fileName'],
                    'fileSize' => $transfer['fileSize'],
                    'fromUserName' => $fromDevice['userName'] ?? 'Usuario desconocido',
                    'fromDeviceName' => $fromDevice['name'] ?? 'Dispositivo desconocido',
                    'requestedAt' => $transfer['requestedAt'],
                    'status' => $transfer['status']
                ];
            }
        }

        return response()->json(['requests' => $requests]);
    }

    /**
     * Accept or reject transfer request
     */
    public function respondToTransfer(Request $request, $transferId)
    {
        $request->validate([
            'action' => 'required|string|in:accept,reject',
        ]);

        $deviceId = $request->session()->get('device_id');
        $transfer = Cache::get("transfer_request_{$transferId}");

        if (!$transfer) {
            return response()->json(['error' => 'Solicitud de transferencia no encontrada'], 404);
        }

        if ($transfer['toDeviceId'] !== $deviceId) {
            return response()->json(['error' => 'No autorizado'], 403);
        }

        $action = $request->action;
        $transfer['status'] = $action === 'accept' ? 'accepted' : 'rejected';
        $transfer['respondedAt'] = now()->toISOString();

        // Update transfer status
        Cache::put("transfer_request_{$transferId}", $transfer, 1800);

        // If rejected, delete the file
        if ($action === 'reject') {
            Almacenamiento::eliminar($transfer['filePath']);
        }

        // Remove from pending transfers
        $deviceTransfers = Cache::get("device_{$deviceId}_transfers", []);
        $deviceTransfers = array_filter($deviceTransfers, fn($id) => $id !== $transferId);
        Cache::put("device_{$deviceId}_transfers", $deviceTransfers, 1800);

        return response()->json([
            'success' => true,
            'action' => $action,
            'message' => $action === 'accept' ? 'Transferencia aceptada' : 'Transferencia rechazada'
        ]);
    }

    /**
     * Download accepted file
     */
    public function downloadFile(Request $request, $transferId)
    {
        $deviceId = $request->session()->get('device_id');
        $transfer = Cache::get("transfer_request_{$transferId}");

        if (!$transfer) {
            return response()->json(['error' => 'Transferencia no encontrada'], 404);
        }

        if ($transfer['toDeviceId'] !== $deviceId || $transfer['status'] !== 'accepted') {
            return response()->json(['error' => 'No autorizado o transferencia no aceptada'], 403);
        }

        $filePath = $transfer['filePath'];

        if (!Almacenamiento::existe($filePath)) {
            return response()->json(['error' => 'Archivo no encontrado'], 404);
        }

        // Mark as completed
        $transfer['status'] = 'completed';
        $transfer['completedAt'] = now()->toISOString();
        Cache::put("transfer_request_{$transferId}", $transfer, 1800);

        // El archivo se borra al terminar la petición y no antes de responder:
        // la respuesta se transmite desde el disco, así que el objeto tiene que
        // seguir existiendo mientras se envía. Leerlo completo en memoria para
        // poder borrarlo antes agotaría el memory_limit en transferencias
        // grandes (la validación admite hasta 50 MB).
        app()->terminating(fn () => Almacenamiento::eliminar($filePath));

        return Almacenamiento::descarga(
            $filePath,
            $transfer['fileName'],
            'application/octet-stream',
        );
    }

    /**
     * Get transfer status
     */
    public function getTransferStatus(Request $request, $transferId)
    {
        $transfer = Cache::get("transfer_request_{$transferId}");

        if (!$transfer) {
            return response()->json(['error' => 'Transferencia no encontrada'], 404);
        }

        return response()->json([
            'id' => $transfer['id'],
            'status' => $transfer['status'],
            'fileName' => $transfer['fileName'],
            'fileSize' => $transfer['fileSize'],
            'requestedAt' => $transfer['requestedAt'],
            'respondedAt' => $transfer['respondedAt'] ?? null,
            'completedAt' => $transfer['completedAt'] ?? null,
        ]);
    }

    /**
     * Clean up expired transfers
     */
    public function cleanupExpiredTransfers()
    {
        // This would typically be called by a scheduled job
        // For now, it can be called manually or triggered periodically
        
        $keys = Cache::getRedis()->keys('laravel_cache:transfer_request_*');
        $expiredCount = 0;

        foreach ($keys as $key) {
            $transferId = str_replace('laravel_cache:transfer_request_', '', $key);
            $transfer = Cache::get("transfer_request_{$transferId}");
            
            if ($transfer && isset($transfer['requestedAt'])) {
                $requestedAt = \Carbon\Carbon::parse($transfer['requestedAt']);
                
                // Clean up transfers older than 1 hour
                if ($requestedAt->diffInHours(now()) > 1) {
                    // Delete file if exists
                    if (isset($transfer['filePath'])) {
                        Almacenamiento::eliminar($transfer['filePath']);
                    }
                    
                    // Remove from cache
                    Cache::forget("transfer_request_{$transferId}");
                    $expiredCount++;
                }
            }
        }

        return response()->json([
            'success' => true,
            'cleanedUp' => $expiredCount,
            'message' => "Cleaned up {$expiredCount} expired transfers"
        ]);
    }
}
