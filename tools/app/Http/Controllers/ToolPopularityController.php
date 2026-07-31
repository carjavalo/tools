<?php

namespace App\Http\Controllers;

use App\Models\ToolClick;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class ToolPopularityController extends Controller
{
    /**
     * Registrar un clic en una herramienta
     */
    public function recordClick(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'tool_id' => 'required|string|max:255',
        ]);

        try {
            ToolClick::recordClick(
                toolId: $validated['tool_id'],
                ipAddress: $request->ip(),
                userAgent: $request->userAgent()
            );

            return response()->json([
                'success' => true,
                'message' => 'Clic registrado exitosamente',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al registrar el clic',
            ], 500);
        }
    }

    /**
     * Obtener herramientas populares (últimas 24 horas)
     */
    public function getPopularTools(Request $request): JsonResponse
    {
        // Umbral de clics para considerar popular (por defecto 5)
        $threshold = $request->input('threshold', 5);

        try {
            $popularTools = ToolClick::getPopularTools($threshold);

            return response()->json([
                'success' => true,
                'popular_tools' => $popularTools,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener herramientas populares',
            ], 500);
        }
    }

    /**
     * Obtener estadísticas de una herramienta específica
     */
    public function getToolStats(Request $request, string $toolId): JsonResponse
    {
        try {
            $stats = ToolClick::getToolStats($toolId);

            return response()->json([
                'success' => true,
                'tool_id' => $toolId,
                'clicks_24h' => $stats,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener estadísticas',
            ], 500);
        }
    }
}
