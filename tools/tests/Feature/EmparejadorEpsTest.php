<?php

use App\Models\Eps;
use App\Support\EmparejadorEps;

// Nombres tomados del Censo Hospitalario real y de la tabla eps.

beforeEach(function () {
    foreach ([
        'EMSSANAR', 'COOSALUD', 'S.O.S', 'SOS. SERVICIO OCCIDENTAL DE SALUD EPS', 'FAMISANAR', 'SANITAS',
        'NUEVA EPS', 'EPS SURAMERICANA S. A', 'COMFENALCO', 'SALUD TOTAL EPS', 'MUTUAL SER',
        'CAJA DE COMPENSACIÓN FAMILIAR DE CARTAGENA', 'PIJAOS SALUD E.P.S.I.', 'SEGUROS BOLIVAR', 'SEGUROS BOLIVAR',
    ] as $nombre) {
        Eps::create(['Nombre' => $nombre, 'Estado' => true]);
    }
});

test('vincula el Responsable del censo con la EPS de la tabla aunque esté escrito distinto', function (string $censo, string $tabla) {
    expect((new EmparejadorEps)->buscar($censo))->toBe($tabla);
})->with([
    // Igual salvo tildes, puntuación y mayúsculas.
    ['nueva eps', 'NUEVA EPS'],
    ['Caja de Compensacion Familiar de Cartagena', 'CAJA DE COMPENSACIÓN FAMILIAR DE CARTAGENA'],
    ['PIJAOS SALUD E.P.S', 'PIJAOS SALUD E.P.S.I.'],
    // Con forma legal o régimen de más.
    ['EMSSANAR EPS SAS', 'EMSSANAR'],
    ['EPS FAMISANAR SAS REGIMEN SUBS', 'FAMISANAR'],
    ['ENTIDAD PROMOTORA DE SALUD SANITAS S.A.S.', 'SANITAS'],
    ['SALUD TOTAL S.A', 'SALUD TOTAL EPS'],
    ['MUTUAL SER ESS', 'MUTUAL SER'],
    ['SEGUROS BOLIVAR - SOAT', 'SEGUROS BOLIVAR'],
    // El censo extiende o recorta el nombre.
    ['COOSALUD ENTIDAD PROMOTORA DE', 'COOSALUD'],
    ['COMFENALCO VALLE', 'COMFENALCO'],
    ['S.O.S. SERV.OCCID.DE SALUD EPS', 'S.O.S'],
    ['E.P.S. SURA', 'EPS SURAMERICANA S. A'],
]);

test('sin EPS equivalente no inventa una', function (string $censo) {
    expect((new EmparejadorEps)->buscar($censo))->toBeNull();
})->with([
    'JUAN CAMILO OSORIO ANGULO',
    'ADMINISTRADORA ADRES',
    'COMPAÑIA MUNDIAL DE SEGUROS - SOAT',
    '',
]);

test('si el nombre recortado encaja con varias EPS no escoge ninguna', function () {
    Eps::create(['Nombre' => 'COMFAMILIAR HUILA', 'Estado' => true]);
    Eps::create(['Nombre' => 'COMFAMILIAR GUAJIRA', 'Estado' => true]);

    expect((new EmparejadorEps)->buscar('COMFAMILIAR'))->toBeNull()
        ->and((new EmparejadorEps)->buscar('COMFAMILIAR HUI'))->toBe('COMFAMILIAR HUILA');
});
