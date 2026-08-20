<?php

use Illuminate\Support\Facades\DB;

test('la aplicación trabaja en la hora de Colombia', function () {
    expect(config('app.timezone'))->toBe('America/Bogota');

    // Bogotá es UTC-5 permanente: no hay horario de verano que mover.
    expect(now()->getOffset())->toBe(-5 * 3600);
});

test('los timestamps nuevos se guardan en hora de Bogotá', function () {
    $id = DB::table('auditoria')->insertGetId([
        'evento' => 'creacion',
        'descripcion' => 'prueba',
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $guardado = DB::table('auditoria')->where('id', $id)->value('created_at');

    // Lo que queda en la columna es la hora de pared colombiana, que es la que
    // la vista de seguimiento imprime tal cual.
    expect(substr((string) $guardado, 0, 16))
        ->toBe(now()->format('Y-m-d H:i'));
});

test('la migración baja cinco horas las fechas y horas ya registradas', function () {
    $migracion = require database_path(
        'migrations/2026_08_20_000002_ajustar_horas_guardadas_a_zona_bogota.php',
    );

    $id = DB::table('auditoria')->insertGetId([
        'evento' => 'creacion',
        'descripcion' => 'registro viejo guardado en UTC',
        'created_at' => '2026-08-20 14:54:35',
        'updated_at' => '2026-08-20 14:54:35',
    ]);

    $migracion->up();

    $fila = DB::table('auditoria')->where('id', $id)->first();
    expect(substr((string) $fila->created_at, 0, 19))->toBe('2026-08-20 09:54:35');
    expect(substr((string) $fila->updated_at, 0, 19))->toBe('2026-08-20 09:54:35');

    // Y se puede deshacer si hiciera falta.
    $migracion->down();
    $fila = DB::table('auditoria')->where('id', $id)->first();
    expect(substr((string) $fila->created_at, 0, 19))->toBe('2026-08-20 14:54:35');
});

test('un registro de madrugada retrocede al día anterior, que es cuando ocurrió', function () {
    $migracion = require database_path(
        'migrations/2026_08_20_000002_ajustar_horas_guardadas_a_zona_bogota.php',
    );

    $id = DB::table('auditoria')->insertGetId([
        'evento' => 'sesion_inicio',
        'descripcion' => 'inicio de sesión de madrugada',
        'created_at' => '2026-08-10 00:39:57',
        'updated_at' => '2026-08-10 00:39:57',
    ]);

    $migracion->up();

    expect(substr((string) DB::table('auditoria')->where('id', $id)->value('created_at'), 0, 19))
        ->toBe('2026-08-09 19:39:57');
});

test('las columnas de solo fecha no se mueven', function () {
    $migracion = require database_path(
        'migrations/2026_08_20_000002_ajustar_horas_guardadas_a_zona_bogota.php',
    );

    // Restarle horas a una fecha sin hora la correría al día anterior: la fecha
    // de autorización de un caso no puede cambiar por un ajuste de reloj.
    $codrad = DB::table('RadicarCaso')->insertGetId([
        'Ndocumento' => '9001',
        'estRad' => '1',
        'fecAutorizacion' => '2026-08-20',
        'fechavenautorizacion' => '2026-09-20',
        'fecreci' => '2026-08-19',
        'created_at' => '2026-08-20 14:54:35',
        'updated_at' => '2026-08-20 14:54:35',
    ]);

    $migracion->up();

    $caso = DB::table('RadicarCaso')->where('codrad', $codrad)->first();

    expect((string) $caso->fecAutorizacion)->toStartWith('2026-08-20');
    expect((string) $caso->fechavenautorizacion)->toStartWith('2026-09-20');
    expect((string) $caso->fecreci)->toStartWith('2026-08-19');
    // El timestamp sí se corrigió.
    expect(substr((string) $caso->created_at, 0, 19))->toBe('2026-08-20 09:54:35');
});
