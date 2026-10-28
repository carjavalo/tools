<?php

namespace App\Http\Controllers;

use App\Support\EvarisdropRooms;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class EvarisdropRoomController extends Controller
{
    private const DEVICE_RULES = [
        'deviceName' => 'required|string|max:50',
        'deviceType' => 'required|string|in:laptop,desktop,mobile,tablet',
        'userName' => 'required|string|max:50',
    ];

    /**
     * Join an existing room with device information
     */
    public function joinRoom(Request $request): JsonResponse
    {
        $request->validate(['roomCode' => 'required|string|max:12'] + self::DEVICE_RULES);

        $roomCode = strtoupper(trim($request->roomCode));

        // Antes un código mal escrito creaba una sala vacía y decía "Conectado".
        if (! EvarisdropRooms::exists($roomCode)) {
            return response()->json(['error' => 'No existe una sala con ese código. Revisa que esté bien escrito.'], 404);
        }

        return $this->enterRoom($request, $roomCode, 'Conectado a la sala exitosamente');
    }

    /**
     * Get devices in a room
     */
    public function getRoomDevices(Request $request, string $roomCode): JsonResponse
    {
        $roomCode = strtoupper($roomCode);

        // Solo quien está en la sala puede ver sus equipos.
        if ($request->session()->get('room_code') !== $roomCode) {
            return response()->json(['error' => 'No estás conectado a esta sala.'], 403);
        }

        $currentDeviceId = (string) $request->session()->get('device_id', '');
        $devices = EvarisdropRooms::touch($roomCode, $currentDeviceId, $request->session()->get('device_info'));

        return response()->json([
            'devices' => array_values($devices),
            'currentDeviceId' => $currentDeviceId,
            'roomCode' => $roomCode,
        ]);
    }

    /**
     * Leave room
     */
    public function leaveRoom(Request $request): JsonResponse
    {
        $deviceId = (string) $request->session()->get('device_id', '');
        $roomCode = $request->session()->get('room_code');

        if ($deviceId && $roomCode) {
            EvarisdropRooms::remove($roomCode, $deviceId);
        }

        $request->session()->forget(['device_id', 'room_code', 'device_info']);

        return response()->json([
            'success' => true,
            'message' => 'Desconectado de la sala',
        ]);
    }

    /**
     * Create a new room
     */
    public function createRoom(Request $request): JsonResponse
    {
        $request->validate(self::DEVICE_RULES);

        do {
            $roomCode = $this->generateRoomCode();
        } while (EvarisdropRooms::exists($roomCode));

        return $this->enterRoom($request, $roomCode, 'Sala creada');
    }

    private function enterRoom(Request $request, string $roomCode, string $message): JsonResponse
    {
        $deviceId = (string) ($request->session()->get('device_id') ?? Str::uuid());
        $device = [
            'id' => $deviceId,
            'name' => $request->deviceName,
            'type' => $request->deviceType,
            'userName' => $request->userName,
            'status' => 'connected',
            'lastSeen' => now()->toISOString(),
        ];

        $request->session()->put('device_id', $deviceId);
        $request->session()->put('room_code', $roomCode);
        // Para volver a anotar el equipo si se pierde de la lista.
        $request->session()->put('device_info', $device);

        EvarisdropRooms::put($roomCode, $device);

        return response()->json([
            'success' => true,
            'device' => $device,
            'roomCode' => $roomCode,
            'message' => $message,
        ]);
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

        return $letterPart.'-'.$numberPart;
    }
}
