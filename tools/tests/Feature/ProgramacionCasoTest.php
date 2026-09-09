<?php

use App\Models\Permiso;
use App\Models\ProgramacionCaso;
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
