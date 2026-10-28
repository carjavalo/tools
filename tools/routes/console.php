<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Archivos de Evarisdrop que nadie descargó. También se limpian solos al
// enviar archivos; esto solo aplica si el hosting tiene el cron de Laravel.
Artisan::command('evarisdrop:limpiar', function () {
    $this->info('Archivos borrados: '.App\Http\Controllers\EvarisdropFileTransferController::purgeOldFiles());
})->purpose('Borra los archivos de Evarisdrop con más de 30 minutos');

Schedule::command('evarisdrop:limpiar')->everyTenMinutes();
