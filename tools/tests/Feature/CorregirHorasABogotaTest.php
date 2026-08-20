<?php

use Illuminate\Support\Facades\DB;

function auditoriaCon(string $creado): int
{
    return DB::table('auditoria')->insertGetId([
        'evento' => 'creacion',
        'descripcion' => 'prueba',
        'created_at' => $creado,
        'updated_at' => $creado,
    ]);
}

test('el diagnóstico no escribe nada', function () {
    $id = auditoriaCon('2026-08-20 14:54:35');

    $this->artisan('horas:corregir-bogota')->assertSuccessful();

    expect(substr((string) DB::table('auditoria')->where('id', $id)->value('created_at'), 0, 19))
        ->toBe('2026-08-20 14:54:35');
    expect(DB::table('migrations')->where('migration', 'like', 'zona_horaria%')->exists())
        ->toBeFalse();
});

test('con --aplicar corrige las horas y deja constancia', function () {
    $id = auditoriaCon('2026-08-20 14:54:35');

    $this->artisan('horas:corregir-bogota --aplicar')->assertSuccessful();

    expect(substr((string) DB::table('auditoria')->where('id', $id)->value('created_at'), 0, 19))
        ->toBe('2026-08-20 09:54:35');
    expect(DB::table('migrations')->where('migration', 'like', 'zona_horaria%')->exists())
        ->toBeTrue();
});

test('no se repite: una segunda pasada restaría diez horas', function () {
    $id = auditoriaCon('2026-08-20 14:54:35');

    $this->artisan('horas:corregir-bogota --aplicar')->assertSuccessful();
    $this->artisan('horas:corregir-bogota --aplicar')->assertFailed();

    // Sigue con una sola corrección aplicada, no dos.
    expect(substr((string) DB::table('auditoria')->where('id', $id)->value('created_at'), 0, 19))
        ->toBe('2026-08-20 09:54:35');
});

test('las columnas de solo fecha no se tocan', function () {
    $codrad = DB::table('RadicarCaso')->insertGetId([
        'Ndocumento' => '9001',
        'estRad' => '1',
        'fecAutorizacion' => '2026-08-20',
        'fecreci' => '2026-08-19',
        'created_at' => '2026-08-20 14:54:35',
        'updated_at' => '2026-08-20 14:54:35',
    ]);

    $this->artisan('horas:corregir-bogota --aplicar')->assertSuccessful();

    $caso = DB::table('RadicarCaso')->where('codrad', $codrad)->first();
    expect((string) $caso->fecAutorizacion)->toStartWith('2026-08-20');
    expect((string) $caso->fecreci)->toStartWith('2026-08-19');
    expect(substr((string) $caso->created_at, 0, 19))->toBe('2026-08-20 09:54:35');
});

test('el diagnóstico encuentra las columnas de fecha y hora de la base', function () {
    auditoriaCon('2026-08-20 14:54:35');

    $this->artisan('horas:corregir-bogota')
        ->expectsOutputToContain('Columnas de fecha y hora con datos')
        ->assertSuccessful();
});
