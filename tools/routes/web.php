<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('evaristools');
})->name('home');

// Tools Routes
Route::prefix('tools')->name('tools.')->group(function () {
    Route::get('qr-generator', function () {
        return Inertia::render('tools/qr-generator');
    })->name('qr-generator');
    
    Route::get('pdf-compress', function () {
        return Inertia::render('tools/pdf-compress');
    })->name('pdf-compress');
    
    Route::get('ocr-extract', function () {
        return Inertia::render('tools/ocr-extract');
    })->name('ocr-extract');
    
    Route::get('merge-pdfs', function () {
        return Inertia::render('tools/merge-pdfs');
    })->name('merge-pdfs');
    
    Route::get('split-pdf', function () {
        return Inertia::render('tools/split-pdf');
    })->name('split-pdf');
    
    Route::get('images-to-pdf', function () {
        return Inertia::render('tools/images-to-pdf');
    })->name('images-to-pdf');
    
    Route::get('images-to-word', function () {
        return Inertia::render('tools/images-to-word');
    })->name('images-to-word');
    
    Route::get('pdf-to-images', function () {
        return Inertia::render('tools/pdf-to-images');
    })->name('pdf-to-images');
    
    Route::get('word-to-pdf', function () {
        return Inertia::render('tools/word-to-pdf');
    })->name('word-to-pdf');
    
    Route::get('rotate-pdf', function () {
        return Inertia::render('tools/rotate-pdf');
    })->name('rotate-pdf');

    // Sede Cartago: el módulo aún no está habilitado. Muestra la pantalla de
    // inicio de sesión, pero el intento siempre se rechaza y nadie entra.
    Route::get('programacion-cirugia-cartago', function () {
        return Inertia::render('tools/programacion-cirugia-cartago-login', [
            'canResetPassword' => Route::has('password.request'),
        ]);
    })->name('programacion-cirugia-cartago');

    Route::post('programacion-cirugia-cartago', function () {
        throw \Illuminate\Validation\ValidationException::withMessages([
            'email' => 'El módulo de Programación de Cirugía Sede Cartago aún no está habilitado.',
        ]);
    })->name('programacion-cirugia-cartago.store');

    // El acceso por rol a cada opción lo gobierna el Gestor de Permisos
    // (middleware permiso.auto): Operador y Super Admin pasan por defecto;
    // los demás roles requieren permiso explícito.
    Route::middleware(['auth', 'permiso.auto'])->group(function () {
        Route::get('programacion-cirugia', function () {
            return Inertia::render('tools/programacion-cirugia');
        })->name('programacion-cirugia');

        // Radicar Solicitud (radicación de casos Multi-CUPS / Multi-Autorización)
        Route::get('radicar-solicitud', [App\Http\Controllers\RadicarCasoController::class, 'index'])->name('radicar-solicitud');
        Route::get('radicar-solicitud/buscar-paciente', [App\Http\Controllers\RadicarCasoController::class, 'buscarPaciente'])->name('radicar-solicitud.buscar-paciente');
        Route::get('radicar-solicitud/buscar-cups', [App\Http\Controllers\RadicarCasoController::class, 'buscarCups'])->name('radicar-solicitud.buscar-cups');
        Route::post('radicar-solicitud/crear-paciente', [App\Http\Controllers\RadicarCasoController::class, 'crearPaciente'])->name('radicar-solicitud.crear-paciente');
        Route::post('radicar-solicitud/crear-especialidad', [App\Http\Controllers\RadicarCasoController::class, 'crearEspecialidad'])->name('radicar-solicitud.crear-especialidad');
        Route::get('radicar-solicitud/editar-paciente', [App\Http\Controllers\RadicarCasoController::class, 'editarPaciente'])->name('radicar-solicitud.editar-paciente');
        Route::put('radicar-solicitud/paciente/{user}', [App\Http\Controllers\RadicarCasoController::class, 'actualizarPaciente'])->name('radicar-solicitud.actualizar-paciente');
        Route::get('radicar-solicitud/buscar-caso', [App\Http\Controllers\RadicarCasoController::class, 'buscarCaso'])->name('radicar-solicitud.buscar-caso');
        Route::get('radicar-solicitud/{caso}/paquete', [App\Http\Controllers\RadicarCasoController::class, 'verPaquete'])->name('radicar-solicitud.paquete');
        // El adjunto de la cotización se entrega por una ruta con permisos,
        // no por la URL del disco: en S3 el bucket es privado.
        Route::get('radicar-solicitud/cotizacion/{cotizacion}/adjunto', [App\Http\Controllers\RadicarCasoController::class, 'verAdjuntoCotizacion'])->name('radicar-solicitud.cotizacion-adjunto');
        Route::get('radicar-solicitud/informe', [App\Http\Controllers\RadicarCasoController::class, 'informe'])->name('radicar-solicitud.informe');
        Route::post('radicar-solicitud/{caso}/seguimiento', [App\Http\Controllers\RadicarCasoController::class, 'aplicarModificacion'])->name('radicar-solicitud.seguimiento');
        Route::put('radicar-solicitud/{caso}', [App\Http\Controllers\RadicarCasoController::class, 'actualizarCaso'])->name('radicar-solicitud.actualizar-caso');
        Route::post('radicar-solicitud/{caso}/cotizaciones', [App\Http\Controllers\RadicarCasoController::class, 'guardarCotizaciones'])->name('radicar-solicitud.cotizaciones');
        Route::delete('radicar-solicitud/{caso}', [App\Http\Controllers\RadicarCasoController::class, 'destroyCaso'])->name('radicar-solicitud.destroy-caso');
        Route::post('radicar-solicitud', [App\Http\Controllers\RadicarCasoController::class, 'store'])->name('radicar-solicitud.store');

        // Gestión de Usuarios (CRUD)
        Route::get('gestion-usuarios', [App\Http\Controllers\UserManagementController::class, 'index'])->name('gestion-usuarios');
        Route::post('gestion-usuarios', [App\Http\Controllers\UserManagementController::class, 'store'])->name('gestion-usuarios.store');
        Route::put('gestion-usuarios/{user}', [App\Http\Controllers\UserManagementController::class, 'update'])->name('gestion-usuarios.update');
        Route::delete('gestion-usuarios/{user}', [App\Http\Controllers\UserManagementController::class, 'destroy'])->name('gestion-usuarios.destroy');

        // Gestión de Roles (CRUD)
        Route::get('gestion-roles', [App\Http\Controllers\RoleManagementController::class, 'index'])->name('gestion-roles');
        Route::post('gestion-roles', [App\Http\Controllers\RoleManagementController::class, 'store'])->name('gestion-roles.store');
        Route::put('gestion-roles/{role}', [App\Http\Controllers\RoleManagementController::class, 'update'])->name('gestion-roles.update');
        Route::delete('gestion-roles/{role}', [App\Http\Controllers\RoleManagementController::class, 'destroy'])->name('gestion-roles.destroy');

        // Asignación de Estados a Roles (CRUD)
        Route::get('asignacion-estados', [App\Http\Controllers\AsignacionEstadosController::class, 'index'])->name('asignacion-estados');
        Route::post('asignacion-estados', [App\Http\Controllers\AsignacionEstadosController::class, 'store'])->name('asignacion-estados.store');
        Route::put('asignacion-estados/{role}', [App\Http\Controllers\AsignacionEstadosController::class, 'update'])->name('asignacion-estados.update');
        Route::delete('asignacion-estados/{role}', [App\Http\Controllers\AsignacionEstadosController::class, 'destroy'])->name('asignacion-estados.destroy');

        // Gestor de Permisos (solo Super Admin; validado en el controlador)
        Route::get('gestor-permisos', [App\Http\Controllers\GestorPermisosController::class, 'index'])->name('gestor-permisos');
        Route::post('gestor-permisos/{role}', [App\Http\Controllers\GestorPermisosController::class, 'guardar'])->name('gestor-permisos.guardar');

        // Herramientas - Seguimiento: bitácora de actividad (solo consulta)
        Route::get('herramientas-seguimiento', [App\Http\Controllers\AuditoriaController::class, 'index'])->name('herramientas-seguimiento');

        // Gestión de EPS (CRUD)
        Route::get('gestion-eps', [App\Http\Controllers\EpsController::class, 'index'])->name('gestion-eps');
        Route::post('gestion-eps', [App\Http\Controllers\EpsController::class, 'store'])->name('gestion-eps.store');
        Route::put('gestion-eps/{eps}', [App\Http\Controllers\EpsController::class, 'update'])->name('gestion-eps.update');
        Route::delete('gestion-eps/{eps}', [App\Http\Controllers\EpsController::class, 'destroy'])->name('gestion-eps.destroy');

        // Gestión Convenios (CRUD)
        Route::get('gestion-convenios', [App\Http\Controllers\ConvenioController::class, 'index'])->name('gestion-convenios');
        Route::post('gestion-convenios', [App\Http\Controllers\ConvenioController::class, 'store'])->name('gestion-convenios.store');
        Route::put('gestion-convenios/{convenio}', [App\Http\Controllers\ConvenioController::class, 'update'])->name('gestion-convenios.update');
        Route::delete('gestion-convenios/{convenio}', [App\Http\Controllers\ConvenioController::class, 'destroy'])->name('gestion-convenios.destroy');

        // Gestión de Régimen (mini CRUD embebido en Gestión Convenios)
        Route::post('gestion-regimen', [App\Http\Controllers\RegimenController::class, 'store'])->name('gestion-regimen.store');
        Route::put('gestion-regimen/{regimen}', [App\Http\Controllers\RegimenController::class, 'update'])->name('gestion-regimen.update');
        Route::delete('gestion-regimen/{regimen}', [App\Http\Controllers\RegimenController::class, 'destroy'])->name('gestion-regimen.destroy');

        // Gestión de Especialidades (CRUD)
        Route::get('gestion-especialidades', [App\Http\Controllers\EspecialidadController::class, 'index'])->name('gestion-especialidades');
        Route::post('gestion-especialidades', [App\Http\Controllers\EspecialidadController::class, 'store'])->name('gestion-especialidades.store');
        Route::put('gestion-especialidades/{especialidad}', [App\Http\Controllers\EspecialidadController::class, 'update'])->name('gestion-especialidades.update');
        Route::delete('gestion-especialidades/{especialidad}', [App\Http\Controllers\EspecialidadController::class, 'destroy'])->name('gestion-especialidades.destroy');

        // Gestión de Sub Especialidades (CRUD)
        Route::get('gestion-subespecialidades', [App\Http\Controllers\SubEspecialidadController::class, 'index'])->name('gestion-subespecialidades');
        Route::post('gestion-subespecialidades', [App\Http\Controllers\SubEspecialidadController::class, 'store'])->name('gestion-subespecialidades.store');
        Route::put('gestion-subespecialidades/{subespecialidad}', [App\Http\Controllers\SubEspecialidadController::class, 'update'])->name('gestion-subespecialidades.update');
        Route::delete('gestion-subespecialidades/{subespecialidad}', [App\Http\Controllers\SubEspecialidadController::class, 'destroy'])->name('gestion-subespecialidades.destroy');

        // Gestión de Tipo de Documento (CRUD)
        Route::get('gestion-tipo-documento', [App\Http\Controllers\TipoDocumentoController::class, 'index'])->name('gestion-tipo-documento');
        Route::post('gestion-tipo-documento', [App\Http\Controllers\TipoDocumentoController::class, 'store'])->name('gestion-tipo-documento.store');
        Route::put('gestion-tipo-documento/{tipoDocumento}', [App\Http\Controllers\TipoDocumentoController::class, 'update'])->name('gestion-tipo-documento.update');
        Route::delete('gestion-tipo-documento/{tipoDocumento}', [App\Http\Controllers\TipoDocumentoController::class, 'destroy'])->name('gestion-tipo-documento.destroy');

        // Gestión de CUPS (CRUD)
        Route::get('gestion-cups', [App\Http\Controllers\CupsManagementController::class, 'index'])->name('gestion-cups');
        Route::post('gestion-cups', [App\Http\Controllers\CupsManagementController::class, 'store'])->name('gestion-cups.store');
        Route::put('gestion-cups/{cups}', [App\Http\Controllers\CupsManagementController::class, 'update'])->name('gestion-cups.update');
        Route::delete('gestion-cups/{cups}', [App\Http\Controllers\CupsManagementController::class, 'destroy'])->name('gestion-cups.destroy');

        // Gestión CUPS / EPS (asociación EPS ↔ CUPS)
        Route::get('gestion-cups-eps', [App\Http\Controllers\CupsEpsController::class, 'index'])->name('gestion-cups-eps');
        Route::get('gestion-cups-eps/buscar-cups', [App\Http\Controllers\CupsEpsController::class, 'buscarCups'])->name('gestion-cups-eps.buscar-cups');
        Route::post('gestion-cups-eps', [App\Http\Controllers\CupsEpsController::class, 'store'])->name('gestion-cups-eps.store');
        Route::put('gestion-cups-eps/{cupsEps}', [App\Http\Controllers\CupsEpsController::class, 'update'])->name('gestion-cups-eps.update');
        Route::delete('gestion-cups-eps/{cupsEps}', [App\Http\Controllers\CupsEpsController::class, 'destroy'])->name('gestion-cups-eps.destroy');

        // Gestión de Motivo (CRUD)
        Route::get('gestion-motivo', [App\Http\Controllers\MotivoManagementController::class, 'index'])->name('gestion-motivo');
        Route::post('gestion-motivo', [App\Http\Controllers\MotivoManagementController::class, 'store'])->name('gestion-motivo.store');
        Route::put('gestion-motivo/{motivo}', [App\Http\Controllers\MotivoManagementController::class, 'update'])->name('gestion-motivo.update');
        Route::delete('gestion-motivo/{motivo}', [App\Http\Controllers\MotivoManagementController::class, 'destroy'])->name('gestion-motivo.destroy');

        // Gestión Estado (CRUD)
        Route::get('gestion-estado', [App\Http\Controllers\EstRadicadoController::class, 'index'])->name('gestion-estado');
        Route::post('gestion-estado', [App\Http\Controllers\EstRadicadoController::class, 'store'])->name('gestion-estado.store');
        Route::put('gestion-estado/{estado}', [App\Http\Controllers\EstRadicadoController::class, 'update'])->name('gestion-estado.update');
        Route::delete('gestion-estado/{estado}', [App\Http\Controllers\EstRadicadoController::class, 'destroy'])->name('gestion-estado.destroy');

        // Gestión Estado Secundario (CRUD)
        Route::get('gestion-estado-secundario', [App\Http\Controllers\EstRadisecundarioController::class, 'index'])->name('gestion-estado-secundario');
        Route::post('gestion-estado-secundario', [App\Http\Controllers\EstRadisecundarioController::class, 'store'])->name('gestion-estado-secundario.store');
        Route::put('gestion-estado-secundario/{estado}', [App\Http\Controllers\EstRadisecundarioController::class, 'update'])->name('gestion-estado-secundario.update');
        Route::delete('gestion-estado-secundario/{estado}', [App\Http\Controllers\EstRadisecundarioController::class, 'destroy'])->name('gestion-estado-secundario.destroy');
    });

    Route::get('page-numbers', function () {
        return Inertia::render('tools/page-numbers');
    })->name('page-numbers');
    
    Route::get('watermark-pdf', function () {
        return Inertia::render('tools/watermark-pdf');
    })->name('watermark-pdf');
    
    Route::get('sort-pdf', function () {
        return Inertia::render('tools/sort-pdf');
    })->name('sort-pdf');
    
    Route::get('crop-pdf', function () {
        return Inertia::render('tools/crop-pdf');
    })->name('crop-pdf');
    
    Route::get('powerpoint-to-pdf', function () {
        return Inertia::render('tools/powerpoint-to-pdf');
    })->name('powerpoint-to-pdf');
    
    Route::get('excel-to-pdf', function () {
        return Inertia::render('tools/excel-to-pdf');
    })->name('excel-to-pdf');
    
    Route::get('resume-document', function () {
        return Inertia::render('tools/resume-document');
    })->name('resume-document');
    
    Route::get('sign-pdf', function () {
        return Inertia::render('tools/sign-pdf');
    })->name('sign-pdf');
    
    Route::get('protect-pdf', function () {
        return Inertia::render('tools/protect-pdf');
    })->name('protect-pdf');
    
    Route::get('cups', function () {
        return Inertia::render('tools/cups');
    })->name('cups');
    
    Route::get('evarisdrop', function () {
        return Inertia::render('tools/evarisdrop');
    })->name('evarisdrop');
    
    // API endpoints for tools
    Route::post('word-to-pdf/convert', [App\Http\Controllers\WordToPDFController::class, 'convert'])->name('word-to-pdf.convert');
    Route::post('powerpoint-to-pdf/convert', [App\Http\Controllers\PowerPointToPDFController::class, 'convert'])->name('powerpoint-to-pdf.convert');
    Route::post('excel-to-pdf/convert', [App\Http\Controllers\ExcelToPDFController::class, 'convert'])->name('excel-to-pdf.convert');
    Route::post('resume-document/generate', [App\Http\Controllers\ResumeDocumentController::class, 'generate'])->name('resume-document.generate');
    Route::post('sign-pdf/sign', [App\Http\Controllers\SignPDFController::class, 'sign'])->name('sign-pdf.sign');
    Route::post('protect-pdf/protect', [App\Http\Controllers\ProtectPDFController::class, 'protect'])->name('protect-pdf.protect');
    Route::post('ocr-extract/extract', [App\Http\Controllers\OCRController::class, 'extract'])->name('ocr-extract.extract');
    
    // CUPS endpoints
    Route::post('cups/process-json-sos', [App\Http\Controllers\CupsController::class, 'processJsonSOS'])->name('cups.process-json-sos');
    Route::get('cups/download-processed/{filename}', [App\Http\Controllers\CupsController::class, 'downloadProcessed'])->name('cups.download-processed');
    
    // Evarisdrop endpoints
    Route::post('evarisdrop/room/create', [App\Http\Controllers\EvarisdropRoomController::class, 'createRoom'])->name('evarisdrop.room.create');
    Route::post('evarisdrop/room/join', [App\Http\Controllers\EvarisdropRoomController::class, 'joinRoom'])->name('evarisdrop.room.join');
    Route::get('evarisdrop/room/{roomCode}/devices', [App\Http\Controllers\EvarisdropRoomController::class, 'getRoomDevices'])->name('evarisdrop.room.devices');
    Route::post('evarisdrop/room/leave', [App\Http\Controllers\EvarisdropRoomController::class, 'leaveRoom'])->name('evarisdrop.room.leave');
    Route::post('evarisdrop/transfer/request', [App\Http\Controllers\EvarisdropFileTransferController::class, 'requestTransfer'])->name('evarisdrop.transfer.request');
    Route::get('evarisdrop/transfer/pending', [App\Http\Controllers\EvarisdropFileTransferController::class, 'getPendingRequests'])->name('evarisdrop.transfer.pending');
    Route::post('evarisdrop/transfer/{transferId}/respond', [App\Http\Controllers\EvarisdropFileTransferController::class, 'respondToTransfer'])->name('evarisdrop.transfer.respond');
    Route::get('evarisdrop/transfer/{transferId}/download', [App\Http\Controllers\EvarisdropFileTransferController::class, 'downloadFile'])->name('evarisdrop.transfer.download');
    Route::get('evarisdrop/transfer/{transferId}/status', [App\Http\Controllers\EvarisdropFileTransferController::class, 'getTransferStatus'])->name('evarisdrop.transfer.status');
});

// API Routes for Tool Popularity System
Route::prefix('api/tools')->name('api.tools.')->group(function () {
    Route::post('click', [App\Http\Controllers\ToolPopularityController::class, 'recordClick'])->name('click');
    Route::get('popular', [App\Http\Controllers\ToolPopularityController::class, 'getPopularTools'])->name('popular');
    Route::get('{toolId}/stats', [App\Http\Controllers\ToolPopularityController::class, 'getToolStats'])->name('stats');
});

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
