<?php

use App\Models\EstRadisecundario;
use App\Models\Permiso;
use App\Models\ProgramacionCaso;
use App\Models\QuirofanoQx;
use App\Models\RadicarCaso;
use App\Models\Role;
use App\Models\TrazabilidadCaso;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

// Botones por fila del modal "Radicaciones programadas para cirugía". Se rigen
// por la sub-vista "Grilla ver programados" (radicar-solicitud-programados) del
// Gestor de Permisos, que hay que asignar expresamente: sin ella, solo el Super
// Admin edita o borra una programación.

test('una consulta sin sesion responde 401 y no una pagina de login', function () {
    // La vista distingue "sin sesión" de "no hay datos" por este código. Si
    // estas rutas empezaran a responder una redirección o un 200 con HTML, el
    // aviso de sesión caducada dejaría de aparecer y volverían los mensajes
    // engañosos ("no se encontró el caso", grillas vacías).
    $this->getJson('/tools/radicar-solicitud/programados')->assertStatus(401);
    $this->getJson('/tools/radicar-solicitud/buscar-caso?q=109')->assertStatus(401);
    $this->putJson('/tools/radicar-solicitud/programacion/1', [])->assertStatus(401);
    $this->deleteJson('/tools/radicar-solicitud/programacion/1')->assertStatus(401);
});

test('la grilla de Hemo solo trae lo programado por Hemodinamia y la de cirugía el resto', function () {
    $admin = User::factory()->create();
    $programados = EstRadisecundario::create(['Nombre' => 'Programados', 'Estado' => true]);
    $hemo = EstRadisecundario::create(['Nombre' => 'Programado x Hemodinamia', 'Estado' => true]);

    $casoCx = RadicarCaso::create(['Ndocumento' => '4200', 'estRad' => '1']);
    $casoHemo = RadicarCaso::create(['Ndocumento' => '4201', 'estRad' => '1']);
    $casoViejo = RadicarCaso::create(['Ndocumento' => '4202', 'estRad' => '1']);

    $cx = ProgramacionCaso::create(['codrad' => $casoCx->codrad, 'codestsecundario' => (string) $programados->id]);
    $hm = ProgramacionCaso::create(['codrad' => $casoHemo->codrad, 'codestsecundario' => (string) $hemo->id]);
    // Anterior a que se guardara el Estado QX: cuenta como cirugía.
    $viejo = ProgramacionCaso::create(['codrad' => $casoViejo->codrad]);

    $idsHemo = collect($this->actingAs($admin)
        ->getJson('/tools/radicar-solicitud/programados?tipo=hemo')
        ->assertOk()->json('rows'))->pluck('id')->all();

    $idsCx = collect($this->actingAs($admin)
        ->getJson('/tools/radicar-solicitud/programados')
        ->assertOk()->json('rows'))->pluck('id')->sort()->values()->all();

    expect($idsHemo)->toBe([$hm->id])
        ->and($idsCx)->toBe(collect([$cx->id, $viejo->id])->sort()->values()->all());
});

test('la grilla Cvascular solo trae lo programado para Cirugía Cardio Vascular', function () {
    $admin = User::factory()->create();
    $programados = EstRadisecundario::create(['Nombre' => 'Programados', 'Estado' => true]);
    $hemo = EstRadisecundario::create(['Nombre' => 'Programado x Hemodinamia', 'Estado' => true]);
    $cv = EstRadisecundario::create(['Nombre' => 'Programado Cirugia Cardio Vascular', 'Estado' => true]);

    $cx = ProgramacionCaso::create(['codrad' => RadicarCaso::create(['Ndocumento' => '4300', 'estRad' => '1'])->codrad, 'codestsecundario' => (string) $programados->id]);
    $hm = ProgramacionCaso::create(['codrad' => RadicarCaso::create(['Ndocumento' => '4301', 'estRad' => '1'])->codrad, 'codestsecundario' => (string) $hemo->id]);
    $cvp = ProgramacionCaso::create(['codrad' => RadicarCaso::create(['Ndocumento' => '4302', 'estRad' => '1'])->codrad, 'codestsecundario' => (string) $cv->id]);

    $ids = fn (string $url) => collect($this->actingAs($admin)->getJson($url)->assertOk()->json('rows'))->pluck('id')->all();

    expect($ids('/tools/radicar-solicitud/programados?tipo=cvascular'))->toBe([$cvp->id])
        ->and($ids('/tools/radicar-solicitud/programados?tipo=hemo'))->toBe([$hm->id])
        ->and($ids('/tools/radicar-solicitud/programados'))->toBe([$cx->id]);
});

test('el formulario Cvascular programa y su botón da la grilla sin el formulario', function () {
    $rol = Role::create(['Nombre' => 'Consulta Cvascular', 'Estado' => true]);
    $usuario = User::factory()->create(['rol' => 'Consulta Cvascular']);
    $cv = EstRadisecundario::create(['Nombre' => 'Programado Cirugia Cardio Vascular', 'Estado' => true]);
    $caso = RadicarCaso::create(['Ndocumento' => '4310', 'estRad' => '1']);

    Permiso::create(['role_id' => $rol->id, 'vista' => 'radicar-solicitud', 'ver' => true]);
    Permiso::create(['role_id' => $rol->id, 'vista' => 'radicar-solicitud-seguimiento', 'ver' => false]);

    // Sin el formulario Cvascular ni su botón: no entra ni guarda.
    $this->actingAs($usuario)
        ->getJson('/tools/radicar-solicitud/programados?tipo=cvascular')
        ->assertForbidden();
    $this->actingAs($usuario)
        ->postJson("/tools/radicar-solicitud/{$caso->codrad}/seguimiento", ['codestsecundario' => (string) $cv->id])
        ->assertForbidden();

    // Con el formulario Cvascular: guarda la programación y ve su grilla.
    $form = Permiso::create(['role_id' => $rol->id, 'vista' => 'radicar-solicitud-seguimiento-cvascular', 'ver' => true]);
    $this->actingAs($usuario)
        ->postJson("/tools/radicar-solicitud/{$caso->codrad}/seguimiento", ['codestsecundario' => (string) $cv->id])
        ->assertOk();
    expect(ProgramacionCaso::where('codrad', $caso->codrad)->value('codestsecundario'))->toBe((string) $cv->id);
    $this->actingAs($usuario)
        ->getJson('/tools/radicar-solicitud/programados?tipo=cvascular')
        ->assertOk()
        ->assertJsonCount(1, 'rows');

    // Solo con el botón "Ver prog Cvascular" (p. ej. los médicos): ve la
    // grilla Cvascular, pero no la de Hemo.
    $form->delete();
    Permiso::create(['role_id' => $rol->id, 'vista' => 'radicar-solicitud-ver-programados-cvascular', 'ver' => true]);
    $this->actingAs($usuario)
        ->getJson('/tools/radicar-solicitud/programados?tipo=cvascular')
        ->assertOk();
    $this->actingAs($usuario)
        ->getJson('/tools/radicar-solicitud/programados?tipo=hemo')
        ->assertForbidden();

    expect(Permiso::VISTAS_OPT_IN)->toContain('radicar-solicitud-ver-programados-cvascular')
        ->and(Permiso::VISTAS_OPT_IN)->toContain('radicar-solicitud-seguimiento-cvascular');
});

test('la programación guarda el quirófano y la grilla lo muestra y lo deja editar', function () {
    $admin = User::factory()->create();
    $programados = EstRadisecundario::create(['Nombre' => 'Programados', 'Estado' => true]);
    $sala1 = QuirofanoQx::create(['nombre' => 'Sala 1', 'estado' => true]);
    $sala2 = QuirofanoQx::create(['nombre' => 'Sala 2', 'estado' => true]);
    $caso = RadicarCaso::create(['Ndocumento' => '4400', 'estRad' => '1']);

    $this->actingAs($admin)
        ->postJson("/tools/radicar-solicitud/{$caso->codrad}/seguimiento", [
            'codestsecundario' => (string) $programados->id,
            'quirofano_id' => $sala1->id,
        ])
        ->assertOk();

    $prog = ProgramacionCaso::where('codrad', $caso->codrad)->firstOrFail();
    expect($prog->quirofano_id)->toBe($sala1->id);

    $this->actingAs($admin)
        ->getJson('/tools/radicar-solicitud/programados')
        ->assertOk()
        ->assertJsonPath('rows.0.quirofano', 'Sala 1')
        ->assertJsonPath('rows.0.quirofanoId', $sala1->id);

    // Un quirófano inexistente se rechaza.
    $this->actingAs($admin)
        ->postJson("/tools/radicar-solicitud/{$caso->codrad}/seguimiento", [
            'codestsecundario' => (string) $programados->id,
            'quirofano_id' => 99999,
        ])
        ->assertUnprocessable();

    // Editar desde la grilla cambia el quirófano y deja rastro.
    $this->actingAs($admin)
        ->putJson("/tools/radicar-solicitud/programacion/{$prog->id}", ['quirofano_id' => $sala2->id])
        ->assertOk();

    expect($prog->refresh()->quirofano_id)->toBe($sala2->id)
        ->and(TrazabilidadCaso::where('codrad', $caso->codrad)->where('etiqueta', 'Quirófano')->where('nuevo', 'Sala 2')->exists())->toBeTrue();
});

test('el botón Ver programados con editar y borrar deja manipular solo las programaciones de su grilla', function () {
    $rol = Role::create(['Nombre' => 'Programador Cx', 'Estado' => true]);
    $usuario = User::factory()->create(['rol' => 'Programador Cx']);
    $programados = EstRadisecundario::create(['Nombre' => 'Programados', 'Estado' => true]);
    $hemo = EstRadisecundario::create(['Nombre' => 'Programado x Hemodinamia', 'Estado' => true]);

    $cx = ProgramacionCaso::create(['codrad' => RadicarCaso::create(['Ndocumento' => '4500', 'estRad' => '1'])->codrad, 'codestsecundario' => (string) $programados->id]);
    $hm = ProgramacionCaso::create(['codrad' => RadicarCaso::create(['Ndocumento' => '4501', 'estRad' => '1'])->codrad, 'codestsecundario' => (string) $hemo->id]);

    Permiso::create(['role_id' => $rol->id, 'vista' => 'radicar-solicitud', 'ver' => true]);
    $boton = Permiso::create(['role_id' => $rol->id, 'vista' => 'radicar-solicitud-ver-programados', 'ver' => true, 'editar' => false, 'borrar' => false]);

    // Solo con "ver": no edita ni borra.
    $this->actingAs($usuario)->putJson("/tools/radicar-solicitud/programacion/{$cx->id}", ['observaciones_prg' => 'x'])->assertForbidden();
    $this->actingAs($usuario)->deleteJson("/tools/radicar-solicitud/programacion/{$cx->id}")->assertForbidden();

    $boton->update(['editar' => true, 'borrar' => true]);

    // Con editar y borrar: manipula las de cirugía, pero no las de Hemo.
    $this->actingAs($usuario)->putJson("/tools/radicar-solicitud/programacion/{$cx->id}", ['observaciones_prg' => 'x'])->assertOk();
    $this->actingAs($usuario)->putJson("/tools/radicar-solicitud/programacion/{$hm->id}", ['observaciones_prg' => 'x'])->assertForbidden();
    $this->actingAs($usuario)->deleteJson("/tools/radicar-solicitud/programacion/{$hm->id}")->assertForbidden();
    $this->actingAs($usuario)->deleteJson("/tools/radicar-solicitud/programacion/{$cx->id}")->assertOk();

    expect(ProgramacionCaso::find($cx->id))->toBeNull()
        ->and(collect(Permiso::VISTAS)->firstWhere('key', 'radicar-solicitud-ver-programados')['acciones'])
        ->toBe(['ver', 'editar', 'borrar']);
});

test('las observaciones de Revisión Clínica Hemodinamia se acumulan solo con ese Estado QX', function () {
    $admin = User::factory()->create(['name' => 'Ana', 'Apellido1' => 'Ruiz']);
    $revision = EstRadisecundario::create(['Nombre' => 'Revisión Clínica Hemodinamia', 'Estado' => true]);
    $otro = EstRadisecundario::create(['Nombre' => 'Programados', 'Estado' => true]);
    $caso = RadicarCaso::create(['Ndocumento' => '4600', 'estRad' => '1']);
    $url = "/tools/radicar-solicitud/{$caso->codrad}/seguimiento";

    $this->actingAs($admin)->postJson($url, ['codestsecundario' => (string) $revision->id, 'obs_revision_hemo' => 'Primera revisión'])->assertOk();
    $this->actingAs($admin)->postJson($url, ['codestsecundario' => (string) $revision->id, 'obs_revision_hemo' => 'Segunda revisión'])
        ->assertOk()
        ->assertJsonPath('caso.obsRevisionHemo', fn ($v) => str_contains($v, 'Primera revisión') && str_contains($v, 'Segunda revisión'));

    $acumulado = $caso->refresh()->obs_revision_hemo;
    expect(strpos($acumulado, 'Primera revisión'))->toBeLessThan(strpos($acumulado, 'Segunda revisión'))
        ->and($acumulado)->toContain('— Ana Ruiz');

    // Con otro Estado QX el texto no se anexa.
    $this->actingAs($admin)->postJson($url, ['codestsecundario' => (string) $otro->id, 'obs_revision_hemo' => 'No va'])->assertOk();
    expect($caso->refresh()->obs_revision_hemo)->toBe($acumulado);
});

test('los botones Ver programados se asignan en el Gestor y vienen apagados', function () {
    $claves = collect(Permiso::VISTAS)->pluck('key');

    expect($claves)->toContain('radicar-solicitud-ver-programados')
        ->and($claves)->toContain('radicar-solicitud-ver-programados-hemo')
        ->and(Permiso::VISTAS_OPT_IN)->toContain('radicar-solicitud-ver-programados')
        ->and(Permiso::VISTAS_OPT_IN)->toContain('radicar-solicitud-ver-programados-hemo');
});

test('el botón Ver programados Hemo da la grilla Hemo sin el formulario Hemo', function () {
    $rol = Role::create(['Nombre' => 'Consulta Hemo', 'Estado' => true]);
    $usuario = User::factory()->create(['rol' => 'Consulta Hemo']);

    Permiso::create(['role_id' => $rol->id, 'vista' => 'radicar-solicitud', 'ver' => true]);
    Permiso::create(['role_id' => $rol->id, 'vista' => 'radicar-solicitud-seguimiento', 'ver' => false]);

    // Sin el formulario Hemo ni el botón: no entra.
    $this->actingAs($usuario)
        ->getJson('/tools/radicar-solicitud/programados?tipo=hemo')
        ->assertForbidden();

    Permiso::create(['role_id' => $rol->id, 'vista' => 'radicar-solicitud-ver-programados-hemo', 'ver' => true]);

    $this->actingAs($usuario)
        ->getJson('/tools/radicar-solicitud/programados?tipo=hemo')
        ->assertOk();

    // El botón Hemo no abre la grilla de cirugía.
    $this->actingAs($usuario)
        ->getJson('/tools/radicar-solicitud/programados')
        ->assertForbidden();
});

test('el botón Ver programados da la grilla de cirugía sin el formulario completo', function () {
    $rol = Role::create(['Nombre' => 'Consulta Cx', 'Estado' => true]);
    $usuario = User::factory()->create(['rol' => 'Consulta Cx']);

    Permiso::create(['role_id' => $rol->id, 'vista' => 'radicar-solicitud', 'ver' => true]);
    Permiso::create(['role_id' => $rol->id, 'vista' => 'radicar-solicitud-seguimiento', 'ver' => false]);
    Permiso::create(['role_id' => $rol->id, 'vista' => 'radicar-solicitud-ver-programados', 'ver' => true]);

    $this->actingAs($usuario)
        ->getJson('/tools/radicar-solicitud/programados')
        ->assertOk();

    $this->actingAs($usuario)
        ->getJson('/tools/radicar-solicitud/programados?tipo=hemo')
        ->assertForbidden();
});

test('el seguimiento guarda en la programación el Estado QX con que se programó', function () {
    $admin = User::factory()->create();
    $hemo = EstRadisecundario::create(['Nombre' => 'Programado x Hemodinamia', 'Estado' => true]);
    $caso = RadicarCaso::create(['Ndocumento' => '4203', 'estRad' => '1']);

    $this->actingAs($admin)
        ->postJson("/tools/radicar-solicitud/{$caso->codrad}/seguimiento", [
            'codestsecundario' => (string) $hemo->id,
            'fecha_programacion' => '2026-09-30T10:00',
        ])
        ->assertOk();

    expect(ProgramacionCaso::where('codrad', $caso->codrad)->value('codestsecundario'))
        ->toBe((string) $hemo->id);
});

test('la grilla de programados entrega los valores crudos para editar la fila', function () {
    $admin = User::factory()->create();
    $especialista = User::factory()->create([
        'rol' => 'Medico',
        'name' => 'Ana',
        'Apellido1' => 'Ruiz',
    ]);
    $caso = RadicarCaso::create(['Ndocumento' => '4100', 'estRad' => '1']);
    $prog = ProgramacionCaso::create([
        'codrad' => $caso->codrad,
        'fecha_programacion' => '2026-09-09T03:41',
        'especialista_medico_id' => $especialista->id,
        'observaciones_prg' => 'Torres laparo',
    ]);

    $rows = $this->actingAs($admin)
        ->getJson('/tools/radicar-solicitud/programados')
        ->assertOk()
        ->json('rows');

    $fila = collect($rows)->firstWhere('id', $prog->id);

    expect($fila)->not->toBeNull()
        ->and($fila['fechaProgramacion'])->toBe('2026-09-09 03:41')
        // El input datetime-local del formulario no entiende el texto que se
        // muestra en la grilla.
        ->and($fila['fechaProgramacionInput'])->toBe('2026-09-09T03:41')
        ->and($fila['especialistaId'])->toBe($especialista->id);
});

test('el super admin edita una programacion y el cambio queda en la bitacora', function () {
    $admin = User::factory()->create();
    $antes = User::factory()->create(['rol' => 'Medico', 'name' => 'Ana', 'Apellido1' => 'Ruiz']);
    $despues = User::factory()->create(['rol' => 'Medico', 'name' => 'Luis', 'Apellido1' => 'Paz']);
    $caso = RadicarCaso::create(['Ndocumento' => '4101', 'estRad' => '1']);
    $prog = ProgramacionCaso::create([
        'codrad' => $caso->codrad,
        'fecha_programacion' => '2026-09-09 03:41',
        'especialista_medico_id' => $antes->id,
        'observaciones_prg' => 'Torres laparo',
    ]);

    $this->actingAs($admin)
        ->putJson("/tools/radicar-solicitud/programacion/{$prog->id}", [
            'fecha_programacion' => '2026-09-10T07:30',
            'especialista_medico_id' => $despues->id,
            'observaciones_prg' => '',
        ])
        ->assertOk();

    $prog->refresh();

    expect($prog->fecha_programacion->format('Y-m-d H:i'))->toBe('2026-09-10 07:30')
        ->and($prog->especialista_medico_id)->toBe($despues->id)
        // Un campo que se dejó vacío se guarda vacío: aquí se corrige la
        // programación, no se anexa a ella.
        ->and($prog->observaciones_prg)->toBeNull();

    $this->assertDatabaseHas('trazabilidad_caso', [
        'codrad' => $caso->codrad,
        'evento' => 'programacion',
        'etiqueta' => 'Especialista Médico',
        'anterior' => 'Ana Ruiz',
        'nuevo' => 'Luis Paz',
    ]);
    $this->assertDatabaseHas('trazabilidad_caso', [
        'codrad' => $caso->codrad,
        'etiqueta' => 'Fecha y Hora de Programación',
        'anterior' => '2026-09-09 03:41',
        'nuevo' => '2026-09-10 07:30',
    ]);
});

test('editar una programacion sin cambiar nada no ensucia la bitacora', function () {
    $admin = User::factory()->create();
    $caso = RadicarCaso::create(['Ndocumento' => '4102', 'estRad' => '1']);
    $prog = ProgramacionCaso::create([
        'codrad' => $caso->codrad,
        'fecha_programacion' => '2026-09-09 03:41',
        'observaciones_prg' => 'Torres laparo',
    ]);

    $this->actingAs($admin)
        ->putJson("/tools/radicar-solicitud/programacion/{$prog->id}", [
            'fecha_programacion' => '2026-09-09T03:41',
            'especialista_medico_id' => null,
            'observaciones_prg' => 'Torres laparo',
        ])
        ->assertOk();

    expect(TrazabilidadCaso::where('codrad', $caso->codrad)->count())->toBe(0);
});

test('el super admin borra una programacion y el caso queda intacto', function () {
    $admin = User::factory()->create();
    $caso = RadicarCaso::create([
        'Ndocumento' => '4103',
        'estRad' => '1',
        'codestsecundario' => '7',
    ]);
    $prog = ProgramacionCaso::create([
        'codrad' => $caso->codrad,
        'fecha_programacion' => '2026-09-09 03:41',
    ]);

    $this->actingAs($admin)
        ->deleteJson("/tools/radicar-solicitud/programacion/{$prog->id}")
        ->assertOk();

    $this->assertDatabaseMissing('programacion_caso', ['id' => $prog->id]);
    // Lo que se corrige es el registro de la cirugía, no el estado del caso.
    expect($caso->refresh()->codestsecundario)->toBe('7');

    $this->assertDatabaseHas('trazabilidad_caso', [
        'codrad' => $caso->codrad,
        'evento' => 'programacion',
        'etiqueta' => 'Programación de cirugía eliminada',
    ]);
});

test('un rol sin la subvista de programados no puede editar ni borrar una programacion', function () {
    $rol = Role::create(['Nombre' => 'Gestor Prg', 'Estado' => true]);
    $usuario = User::factory()->create(['rol' => 'Gestor Prg']);
    // Tiene todo en Radicar Solicitud, y aun así no alcanza: los botones de la
    // grilla dependen de su propia sub-vista.
    Permiso::create([
        'role_id' => $rol->id,
        'vista' => 'radicar-solicitud',
        'ver' => true,
        'crear' => true,
        'editar' => true,
        'borrar' => true,
    ]);

    $caso = RadicarCaso::create(['Ndocumento' => '4104', 'estRad' => '1']);
    $prog = ProgramacionCaso::create([
        'codrad' => $caso->codrad,
        'fecha_programacion' => '2026-09-09 03:41',
    ]);

    $this->actingAs($usuario)
        ->putJson("/tools/radicar-solicitud/programacion/{$prog->id}", [
            'fecha_programacion' => '2026-09-10T07:30',
        ])
        ->assertForbidden();

    $this->actingAs($usuario)
        ->deleteJson("/tools/radicar-solicitud/programacion/{$prog->id}")
        ->assertForbidden();

    expect($prog->refresh()->fecha_programacion->format('Y-m-d H:i'))->toBe('2026-09-09 03:41');
});

test('cada boton de la grilla de programados responde a su propia accion', function () {
    $rol = Role::create(['Nombre' => 'Gestor Prg2', 'Estado' => true]);
    $usuario = User::factory()->create(['rol' => 'Gestor Prg2']);
    Permiso::create([
        'role_id' => $rol->id,
        'vista' => 'radicar-solicitud',
        'ver' => true,
        'crear' => true,
        'editar' => true,
        'borrar' => true,
    ]);
    // Puede ver el radicado y editar la programación, pero no borrarla.
    Permiso::create([
        'role_id' => $rol->id,
        'vista' => 'radicar-solicitud-programados',
        'ver' => true,
        'crear' => false,
        'editar' => true,
        'borrar' => false,
    ]);

    $caso = RadicarCaso::create(['Ndocumento' => '4105', 'estRad' => '1']);
    $prog = ProgramacionCaso::create([
        'codrad' => $caso->codrad,
        'fecha_programacion' => '2026-09-09 03:41',
    ]);

    $this->actingAs($usuario)
        ->putJson("/tools/radicar-solicitud/programacion/{$prog->id}", [
            'fecha_programacion' => '2026-09-10T07:30',
        ])
        ->assertOk();

    expect($prog->refresh()->fecha_programacion->format('Y-m-d H:i'))->toBe('2026-09-10 07:30');

    $this->actingAs($usuario)
        ->deleteJson("/tools/radicar-solicitud/programacion/{$prog->id}")
        ->assertForbidden();

    $this->assertDatabaseHas('programacion_caso', ['id' => $prog->id]);
});

test('editar una programacion rechaza un especialista que no es medico', function () {
    $admin = User::factory()->create();
    $noMedico = User::factory()->create(['rol' => 'Operador']);
    $caso = RadicarCaso::create(['Ndocumento' => '4106', 'estRad' => '1']);
    $prog = ProgramacionCaso::create(['codrad' => $caso->codrad]);

    $this->actingAs($admin)
        ->putJson("/tools/radicar-solicitud/programacion/{$prog->id}", [
            'especialista_medico_id' => $noMedico->id,
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['especialista_medico_id']);
});

test('la subvista de programados llega apagada al gestor de permisos', function () {
    $admin = User::factory()->create();
    $rol = Role::create(['Nombre' => 'Gestor Prg3', 'Estado' => true]);

    $this->actingAs($admin)
        ->get('/tools/gestor-permisos?role='.$rol->id)
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            // Sin fila guardada se muestra negada, que es como la trata el
            // servidor; el resto de vistas conserva el permitido por defecto.
            ->where('permisos.radicar-solicitud-programados.ver', false)
            ->where('permisos.radicar-solicitud-programados.editar', false)
            ->where('permisos.radicar-solicitud-programados.borrar', false)
            ->where('permisos.radicar-solicitud-grilla.ver', true)
        );
});

// Filtros "Fecha Inicial Programados" / "Fecha Final Programados" de la
// pestaña Informes: dejan solo las radicaciones con alguna cirugía programada
// (Fecha y Hora Prog.) dentro del período.

test('el informe filtra las radicaciones por el periodo de programacion', function () {
    $admin = User::factory()->create();
    $septiembre = RadicarCaso::create(['Ndocumento' => '4201', 'estRad' => '1']);
    $finDeMes = RadicarCaso::create(['Ndocumento' => '4202', 'estRad' => '1']);
    $octubre = RadicarCaso::create(['Ndocumento' => '4203', 'estRad' => '1']);
    RadicarCaso::create(['Ndocumento' => '4204', 'estRad' => '1']);
    ProgramacionCaso::create(['codrad' => $septiembre->codrad, 'fecha_programacion' => '2026-09-05 07:00']);
    // La fecha final cuenta completa, aunque la cirugía sea tarde en la noche.
    ProgramacionCaso::create(['codrad' => $finDeMes->codrad, 'fecha_programacion' => '2026-09-30 23:30']);
    ProgramacionCaso::create(['codrad' => $octubre->codrad, 'fecha_programacion' => '2026-10-10 08:00']);

    $rows = $this->actingAs($admin)
        ->getJson('/tools/radicar-solicitud/informe?programadoInicial=2026-09-01&programadoFinal=2026-09-30')
        ->assertOk()
        ->json('rows');

    expect(collect($rows)->pluck('codrad')->unique()->sort()->values()->all())
        ->toBe([$septiembre->codrad, $finDeMes->codrad]);

    // Solo con la fecha inicial queda abierto hacia adelante.
    $rows = $this->getJson('/tools/radicar-solicitud/informe?programadoInicial=2026-10-01')
        ->assertOk()
        ->json('rows');

    expect(collect($rows)->pluck('codrad')->unique()->values()->all())->toBe([$octubre->codrad]);
});

test('el informe muestra todas las fechas de programacion del caso', function () {
    // Un caso reprogramado entra por la programación que cae en el período,
    // y la columna muestra también la posterior: la reprogramación es justo
    // lo que interesa ver.
    $admin = User::factory()->create();
    $caso = RadicarCaso::create(['Ndocumento' => '4211', 'estRad' => '1']);
    ProgramacionCaso::create(['codrad' => $caso->codrad, 'fecha_programacion' => '2026-09-20 09:00']);
    ProgramacionCaso::create(['codrad' => $caso->codrad, 'fecha_programacion' => '2026-11-02 08:00']);

    $rows = $this->actingAs($admin)
        ->getJson('/tools/radicar-solicitud/informe?programadoInicial=2026-09-01&programadoFinal=2026-09-30')
        ->assertOk()
        ->json('rows');

    expect($rows)->toHaveCount(1)
        ->and($rows[0]['fechasProgramacion'])->toBe(['2026-11-02 08:00', '2026-09-20 09:00']);

    // Sin período, el informe sigue trayendo todo y la columna llega igual.
    $sinProgramar = RadicarCaso::create(['Ndocumento' => '4212', 'estRad' => '1']);
    $rows = $this->getJson('/tools/radicar-solicitud/informe')->assertOk()->json('rows');

    expect(collect($rows)->firstWhere('codrad', $sinProgramar->codrad)['fechasProgramacion'])->toBe([]);
});

test('el informe rechaza una fecha de programacion invalida', function () {
    $this->actingAs(User::factory()->create())
        ->getJson('/tools/radicar-solicitud/informe?programadoInicial=no-es-fecha')
        ->assertStatus(422)
        ->assertJsonValidationErrors(['programadoInicial']);
});
