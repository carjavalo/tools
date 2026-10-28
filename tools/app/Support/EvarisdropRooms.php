<?php

namespace App\Support;

use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;

/**
 * Lista de equipos de cada sala de Evarisdrop, guardada en la caché. Las
 * modificaciones van con un candado: varios equipos consultan la sala cada
 * pocos segundos y sin él una consulta podía borrar a uno que acababa de entrar.
 */
class EvarisdropRooms
{
    // La sala dura una hora desde la última actividad.
    private const TTL_SECONDS = 3600;

    // Un equipo que no consulta en este tiempo se da por desconectado.
    private const ACTIVE_MINUTES = 5;

    public static function exists(string $roomCode): bool
    {
        return Cache::has(self::key($roomCode));
    }

    /** @return array<string, array<string, mixed>> */
    public static function devices(string $roomCode): array
    {
        return self::active(Cache::get(self::key($roomCode), []));
    }

    public static function has(string $roomCode, string $deviceId): bool
    {
        return isset(self::devices($roomCode)[$deviceId]);
    }

    /** @param  array<string, mixed>  $device */
    public static function put(string $roomCode, array $device): void
    {
        self::update($roomCode, function (array $devices) use ($device) {
            $devices[$device['id']] = $device;

            return $devices;
        });
    }

    public static function remove(string $roomCode, string $deviceId): void
    {
        self::update($roomCode, function (array $devices) use ($deviceId) {
            unset($devices[$deviceId]);

            return $devices;
        });
    }

    /**
     * Marca al equipo como activo (y lo vuelve a anotar si se perdió de la
     * lista) y devuelve los equipos activos de la sala.
     *
     * @param  array<string, mixed>|null  $device
     * @return array<string, array<string, mixed>>
     */
    public static function touch(string $roomCode, string $deviceId, ?array $device = null): array
    {
        return self::update($roomCode, function (array $devices) use ($deviceId, $device) {
            if ($deviceId && ! isset($devices[$deviceId]) && $device) {
                $devices[$deviceId] = $device;
            }
            if ($deviceId && isset($devices[$deviceId])) {
                $devices[$deviceId]['lastSeen'] = now()->toISOString();
            }

            return $devices;
        });
    }

    /**
     * @param  callable(array<string, array<string, mixed>>): array<string, array<string, mixed>>  $change
     * @return array<string, array<string, mixed>>
     */
    private static function update(string $roomCode, callable $change): array
    {
        $apply = function () use ($roomCode, $change) {
            $devices = self::active($change(Cache::get(self::key($roomCode), [])));
            Cache::put(self::key($roomCode), $devices, self::TTL_SECONDS);

            return $devices;
        };

        try {
            return Cache::lock(self::key($roomCode).'_lock', 5)->block(3, $apply);
        } catch (LockTimeoutException) {
            return $apply();
        }
    }

    /**
     * @param  array<string, array<string, mixed>>  $devices
     * @return array<string, array<string, mixed>>
     */
    private static function active(array $devices): array
    {
        // Antes se comparaba con diffInMinutes, que en Carbon 3 da negativo
        // para fechas pasadas: nadie salía nunca de la lista.
        $limit = now()->subMinutes(self::ACTIVE_MINUTES);

        return array_filter($devices, fn (array $device) => Carbon::parse($device['lastSeen'])->greaterThan($limit));
    }

    private static function key(string $roomCode): string
    {
        return "room_{$roomCode}_devices";
    }
}
