<?php

use App\Models\EstRadisecundario;
use App\Models\Permiso;
use App\Models\ProgramacionCaso;
use App\Models\RadicarCaso;
use App\Models\Role;
use App\Models\User;

const URL_CONSULTA_GENERAL = '/tools/radicar-solicitud/consulta-general';

/**
 * Cuatro radicaciones programadas el 15 de octubre, una por cada tipo de
 * programado (Estado QX), más una de Endoscopia programada en noviembre.
 *
 * @return array<string, RadicarCaso>
 */
function casosProgramadosPorTipo(): array
{
    $estados = [
        'cirugia' => EstRadisecundario::create(['Nombre' => 'Programados', 'Estado' => true]),
        'hemo' => EstRadisecundario::create(['Nombre' => 'Programado x Hemodinamia', 'Estado' => true]),
        'cvascular' => EstRadisecundario::create(['Nombre' => 'Programado Cirugia Cardio Vascular', 'Estado' => true]),
        'endo' => EstRadisecundario::create(['Nombre' => 'Programado x Endoscopia', 'Estado' => true]),
    ];

    $casos = [];
    foreach ($estados as $tipo => $estado) {
        $casos[$tipo] = RadicarCaso::create(['Ndocumento' => "77{$estado->id}", 'estRad' => '1']);
        ProgramacionCaso::create([
            'codrad' => $casos[$tipo]->codrad,
            'codestsecundario' => (string) $estado->id,
            'fecha_programacion' => '2026-10-15 08:00:00',
        ]);
    }

    $casos['endoNoviembre'] = RadicarCaso::create(['Ndocumento' => '7799', 'estRad' => '1']);
    ProgramacionCaso::create([
        'codrad' => $casos['endoNoviembre']->codrad,
        'codestsecundario' => (string) $estados['endo']->id,
        'fecha_programacion' => '2026-11-20 10:00:00',
    ]);

    return $casos;
}

function codradsConsultaGeneral($test, string $query): array
{
    return collect($test->getJson(URL_CONSULTA_GENERAL.'?'.$query)->assertOk()->json('rows'))
        ->pluck('codrad')->sort()->values()->all();
}

test('el tipo de programado acota el período de programados a ese Estado QX', function () {
    $admin = User::factory()->create();
    $casos = casosProgramadosPorTipo();
    $this->actingAs($admin);

    $octubre = 'programadoInicial=2026-10-01&programadoFinal=2026-10-31';

    expect(codradsConsultaGeneral($this, "{$octubre}&tipoProgramado=endo"))->toBe([$casos['endo']->codrad])
        ->and(codradsConsultaGeneral($this, "{$octubre}&tipoProgramado=hemo"))->toBe([$casos['hemo']->codrad])
        ->and(codradsConsultaGeneral($this, "{$octubre}&tipoProgramado=cvascular"))->toBe([$casos['cvascular']->codrad])
        ->and(codradsConsultaGeneral($this, "{$octubre}&tipoProgramado=cirugia"))->toBe([$casos['cirugia']->codrad])
        // Sin tipo, el período vale para cualquier programación, como en CONSULTAS.
        ->and(codradsConsultaGeneral($this, $octubre))->toHaveCount(4)
        // Sin fechas, el tipo trae los casos con alguna programación de ese tipo.
        ->and(codradsConsultaGeneral($this, 'tipoProgramado=endo'))
        ->toBe(collect([$casos['endo']->codrad, $casos['endoNoviembre']->codrad])->sort()->values()->all());
});

test('cada fila de consulta general dice de qué tipo es cada programación', function () {
    $admin = User::factory()->create();
    $casos = casosProgramadosPorTipo();

    $fila = collect($this->actingAs($admin)
        ->getJson(URL_CONSULTA_GENERAL.'?consecutivo='.$casos['cvascular']->codrad)
        ->assertOk()
        ->json('rows'))->first();

    expect($fila['programaciones'])->toBe([['fecha' => '2026-10-15 08:00', 'tipo' => 'cvascular']]);
});

test('consulta general filtra por la Fecha Vencimiento Autorización', function () {
    $admin = User::factory()->create();
    $octubre = RadicarCaso::create(['Ndocumento' => '7801', 'estRad' => '1', 'fechavenautorizacion' => '2026-10-10']);
    $noviembre = RadicarCaso::create(['Ndocumento' => '7802', 'estRad' => '1', 'fechavenautorizacion' => '2026-11-10']);
    RadicarCaso::create(['Ndocumento' => '7803', 'estRad' => '1']);
    $this->actingAs($admin);

    expect(codradsConsultaGeneral($this, 'vencimientoInicial=2026-10-01&vencimientoFinal=2026-10-31'))->toBe([$octubre->codrad])
        ->and(codradsConsultaGeneral($this, 'vencimientoInicial=2026-11-01'))->toBe([$noviembre->codrad])
        ->and(codradsConsultaGeneral($this, 'vencimientoFinal=2026-11-30'))
        ->toBe(collect([$octubre->codrad, $noviembre->codrad])->sort()->values()->all());

    $this->getJson(URL_CONSULTA_GENERAL.'?vencimientoInicial=no-es-fecha')
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['vencimientoInicial']);
});

test('la pestaña Consultas no cambia: ignora los filtros nuevos', function () {
    $admin = User::factory()->create();
    $casos = casosProgramadosPorTipo();

    $respuesta = $this->actingAs($admin)
        ->getJson('/tools/radicar-solicitud/consulta?tipoProgramado=endo&vencimientoInicial=2030-01-01')
        ->assertOk();

    expect(collect($respuesta->json('rows'))->pluck('codrad'))->toHaveCount(count($casos))
        ->and($respuesta->json('rows.0'))->not->toHaveKey('programaciones');
});

test('la pestaña Consulta General va debajo de Consultas y viene apagada', function () {
    $claves = collect(Permiso::VISTAS)->pluck('key')->values();
    expect($claves->search('radicar-solicitud-consulta-general'))
        ->toBe($claves->search('radicar-solicitud-consultas') + 1)
        ->and(collect(Permiso::VISTAS)->firstWhere('key', 'radicar-solicitud-consulta-general')['titulo'])
        ->toBe('Pestaña Consulta General')
        ->and(Permiso::VISTAS_OPT_IN)->toContain('radicar-solicitud-consulta-general');

    $rol = Role::create(['Nombre' => 'Consultor General', 'Estado' => true]);
    $usuario = User::factory()->create(['rol' => 'Consultor General']);
    Permiso::create(['role_id' => $rol->id, 'vista' => 'radicar-solicitud', 'ver' => true]);
    // Tener Consultas no da Consulta General.
    Permiso::create(['role_id' => $rol->id, 'vista' => 'radicar-solicitud-consultas', 'ver' => true]);

    $this->actingAs($usuario)->getJson(URL_CONSULTA_GENERAL)->assertForbidden();

    Permiso::create(['role_id' => $rol->id, 'vista' => 'radicar-solicitud-consulta-general', 'ver' => true]);

    $this->actingAs($usuario)->getJson(URL_CONSULTA_GENERAL)->assertOk();
});

test('consulta general sale deshabilitada para todos los roles hasta que el Super Admin la asigne', function () {
    $admin = User::factory()->create(); // Super Admin
    $operador = User::factory()->create(['rol' => 'Operador']);
    $rolOperador = Role::where('Nombre', 'Operador')->first();

    // En el Gestor de Permisos aparece desmarcada para el rol.
    $this->actingAs($admin)
        ->get('/tools/gestor-permisos?role='.$rolOperador->id)
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('permisos.radicar-solicitud-consulta-general.ver', false));

    // Ni siquiera el Operador, que conserva el acceso a lo no configurado,
    // la tiene sin asignarla; el Super Admin sí.
    $this->actingAs($operador)->getJson(URL_CONSULTA_GENERAL)->assertForbidden();
    $this->actingAs($admin)->getJson(URL_CONSULTA_GENERAL)->assertOk();
});
