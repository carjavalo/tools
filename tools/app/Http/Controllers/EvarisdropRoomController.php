<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class EvarisdropRoomController extends Controller
{
    /**
     * Join a room with device information
     */
    public function joinRoom(Request $request)
    {
        $request->validate([
            'roomCode' => 'required|string|max:12',
            'deviceName' => 'required|string|max:50',
            'deviceType' => 'required|string|in:laptop,desktop,mobile,tablet',
            'userName' => 'required|string|max:50',
        ]);

        $roomCode = strtoupper($request->roomCode);
        $deviceId = (string) ($request->session()->get('device_id') ?? Str::uuid());
        $request->session()->put('device_id', $deviceId);
        $request->session()->put('room_code', $roomCode);

        $device = [
            'id' => $deviceId,
            'name' => $request->deviceName,
            'type' => $request->deviceType,
            'userName' => $request->userName,
            'status' => 'connected',
            'lastSeen' => now()->toISOString(),
            'sessionId' => $request->session()->getId(),
        ];

        // Get current devices in room
        $roomDevices = Cache::get("room_{$roomCode}_devices", []);
        
        // Update or add current device
        $roomDevices[$deviceId] = $device;
        
        // Store back to cache (expire in 1 hour)
        Cache::put("room_{$roomCode}_devices", $roomDevices, 3600);

        return response()->json([
            'success' => true,
            'device' => $device,
            'roomCode' => $roomCode,
            'message' => 'Conectado a la sala exitosamente'
        ]);
    }

    /**
     * Get devices in a room
     */
    public function getRoomDevices(Request $request, $roomCode)
    {
        $roomCode = strtoupper($roomCode);
        $currentDeviceId = (string) ($request->session()->get('device_id') ?? '');
        
        // Get devices from cache
        $roomDevices = Cache::get("room_{$roomCode}_devices", []);
        
        // Mark current device as active before filtering
        if ($currentDeviceId && isset($roomDevices[$currentDeviceId])) {
            $roomDevices[$currentDeviceId]['lastSeen'] = now()->toISOString();
        }
        
        // Filter out expired devices (not seen in last 5 minutes)
        $activeDevices = collect($roomDevices)->filter(function ($device) {
            return now()->diffInMinutes($device['lastSeen']) < 5;
        });

        // Update cache with active devices only (keep as associative array with IDs as keys)
        $updatedRoomDevices = $activeDevices->keyBy(function ($device) {
            return (string) $device['id'];
        })->toArray();
        Cache::put("room_{$roomCode}_devices", $updatedRoomDevices, 3600);

        return response()->json([
            'devices' => $activeDevices->values()->toArray(),
            'currentDeviceId' => $currentDeviceId,
            'roomCode' => $roomCode
        ]);
    }

    /**
     * Leave room
     */
    public function leaveRoom(Request $request)
    {
        $deviceId = (string) ($request->session()->get('device_id') ?? '');
        $roomCode = $request->session()->get('room_code');

        if ($deviceId && $roomCode) {
            $roomDevices = Cache::get("room_{$roomCode}_devices", []);
            unset($roomDevices[$deviceId]);
            Cache::put("room_{$roomCode}_devices", $roomDevices, 3600);
        }

        $request->session()->forget(['device_id', 'room_code']);

        return response()->json([
            'success' => true,
            'message' => 'Desconectado de la sala'
        ]);
    }

    /**
     * Create a new room
     */
    public function createRoom(Request $request)
    {
        $request->validate([
            'deviceName' => 'required|string|max:50',
            'deviceType' => 'required|string|in:laptop,desktop,mobile,tablet',
            'userName' => 'required|string|max:50',
        ]);

        // Generate unique room code
        do {
            $roomCode = $this->generateRoomCode();
            $roomExists = Cache::has("room_{$roomCode}_devices");
        } while ($roomExists);

        // Join the newly created room
        $request->merge(['roomCode' => $roomCode]);
        return $this->joinRoom($request);
    }

    /**
     * Generate a secure room code
     */
    private function generateRoomCode(): string
    {
        $letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Exclude I, O for clarity
        $numbers = '23456789'; // Exclude 0, 1 for clarity
        
        $letterPart = '';
        for ($i = 0; $i < 4; $i++) {
            $letterPart .= $letters[random_int(0, strlen($letters) - 1)];
        }
        
        $numberPart = '';
        for ($i = 0; $i < 4; $i++) {
            $numberPart .= $numbers[random_int(0, strlen($numbers) - 1)];
        }
        
        return $letterPart . '-' . $numberPart;
    }
}
