<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\EvarisdropRoomController;
use App\Http\Controllers\EvarisdropFileTransferController;
use App\Http\Controllers\ToolPopularityController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

// Evarisdrop API Routes - Using 'web' middleware to enable session support
Route::middleware('web')->group(function () {
    // Room Management API Routes
    Route::prefix('room')->name('api.room.')->group(function () {
        Route::post('create', [EvarisdropRoomController::class, 'createRoom'])->name('create');
        Route::post('join', [EvarisdropRoomController::class, 'joinRoom'])->name('join');
        Route::post('leave', [EvarisdropRoomController::class, 'leaveRoom'])->name('leave');
        Route::get('{roomCode}/devices', [EvarisdropRoomController::class, 'getRoomDevices'])->name('devices');
    });

    // File Transfer API Routes
    Route::prefix('transfer')->name('api.transfer.')->group(function () {
        Route::post('request', [EvarisdropFileTransferController::class, 'requestTransfer'])->name('request');
        Route::get('pending', [EvarisdropFileTransferController::class, 'getPendingRequests'])->name('pending');
        Route::post('{transferId}/respond', [EvarisdropFileTransferController::class, 'respondToTransfer'])->name('respond');
        Route::get('{transferId}/status', [EvarisdropFileTransferController::class, 'getTransferStatus'])->name('status');
        Route::get('{transferId}/download', [EvarisdropFileTransferController::class, 'downloadFile'])->name('download');
    });
});

// Tool Popularity API Routes
Route::prefix('tools')->name('api.tools.')->group(function () {
    Route::post('click', [ToolPopularityController::class, 'recordClick'])->name('click');
    Route::get('popular', [ToolPopularityController::class, 'getPopularTools'])->name('popular');
    Route::get('{toolId}/stats', [ToolPopularityController::class, 'getToolStats'])->name('stats');
});

// API Health Check
Route::get('health', function () {
    return response()->json([
        'status' => 'ok',
        'timestamp' => now()->toISOString(),
        'message' => 'Evaristools API is running'
    ]);
})->name('api.health');
