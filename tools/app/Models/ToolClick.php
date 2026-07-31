<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class ToolClick extends Model
{
    protected $fillable = [
        'tool_id',
        'ip_address',
        'user_agent',
    ];

    /**
     * Registrar un clic en una herramienta
     */
    public static function recordClick(string $toolId, ?string $ipAddress = null, ?string $userAgent = null): void
    {
        self::create([
            'tool_id' => $toolId,
            'ip_address' => $ipAddress,
            'user_agent' => $userAgent,
        ]);
    }

    /**
     * Obtener herramientas populares (últimas 24 horas)
     * @param int $threshold Cantidad mínima de clics para considerar popular
     * @return array Array de tool_ids populares
     */
    public static function getPopularTools(int $threshold = 5): array
    {
        $last24Hours = Carbon::now()->subDay();

        return self::select('tool_id', DB::raw('count(*) as clicks'))
            ->where('created_at', '>=', $last24Hours)
            ->groupBy('tool_id')
            ->having('clicks', '>=', $threshold)
            ->orderBy('clicks', 'desc')
            ->pluck('tool_id')
            ->toArray();
    }

    /**
     * Obtener estadísticas de clics de una herramienta (últimas 24 horas)
     */
    public static function getToolStats(string $toolId): int
    {
        $last24Hours = Carbon::now()->subDay();

        return self::where('tool_id', $toolId)
            ->where('created_at', '>=', $last24Hours)
            ->count();
    }

    /**
     * Limpiar clics antiguos (más de 30 días)
     * Este método puede ser llamado por un scheduled job
     */
    public static function cleanOldClicks(): int
    {
        $thirtyDaysAgo = Carbon::now()->subDays(30);
        
        return self::where('created_at', '<', $thirtyDaysAgo)->delete();
    }
}
