<?php

use App\Models\CotizacionCaso;
use App\Models\Cups;
use App\Models\CupsAnezado;
use App\Models\CupsEps;
use App\Models\Eps;
use App\Models\Especialidad;
use App\Models\EstRadicado;
use App\Models\EstRadisecundario;
use App\Models\Motivo;
use App\Models\Permiso;
use App\Models\RadicarCaso;
use App\Models\Role;
use App\Models\SeguimientoCaso;
use App\Models\SubEspecialidad;
use App\Models\TrazabilidadCaso;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

test('guests cannot access radicar solicitud', function () {
    $this->get('/tools/radicar-solicitud')->assertRedirect(route('login'));
});

test('index renders the radicar page with catalogs and default estado', function () {
    $user = User::factory()->create();
    $recibido = EstRadicado::create(['Nombre' => 'Recibido', 'Estado' => true]);

    $this->actingAs($user)
        ->get('/tools/radicar-solicitud')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('tools/radicar-solicitud')
            ->has('especialidades')
            ->has('estados')
            // 'motivos' ya no se envía: el campo Motivo salió del formulario
            // Aplicar Modificaciones y era su único consumidor.
            ->missing('motivos')
            ->where('defaultEstadoId', $recibido->id)
        );
});

test('estado selects are filtered by the assigned estados of the user role', function () {
    $operador = User::factory()->create(['rol' => 'Operador']);

    $recibido = EstRadicado::create(['Nombre' => 'Recibido', 'Estado' => true]);
    EstRadicado::create(['Nombre' => 'Rechazado', 'Estado' => true]);
    $secA = EstRadisecundario::create(['Nombre' => 'Sec A', 'Estado' => true]);
    EstRadisecundario::create(['Nombre' => 'Sec B', 'Estado' => true]);

    // El rol "Operador" solo tiene asignado un estado de cada tipo.
    $role = Role::where('Nombre', 'Operador')->firstOrFail();
    $role->estadosRadicado()->sync([$recibido->id]);
    $role->estadosSecundarios()->sync([$secA->id]);

    $this->actingAs($operador)
        ->get('/tools/radicar-solicitud')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('estados', 1)
            ->where('estados.0.Nombre', 'Recibido')
            ->has('estadosSecundarios', 1)
            ->where('estadosSecundarios.0.Nombre', 'Sec A')
            ->where('defaultEstadoId', $recibido->id)
        );
});

test('a role with no assigned estados sees an empty estado list', function () {
    $operador = User::factory()->create(['rol' => 'Operador']);
    EstRadicado::create(['Nombre' => 'Recibido', 'Estado' => true]);
    EstRadisecundario::create(['Nombre' => 'Sec A', 'Estado' => true]);

    // El rol "Operador" no tiene estados asignados.
    $this->actingAs($operador)
        ->get('/tools/radicar-solicitud')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('estados', 0)
            ->has('estadosSecundarios', 0)
            ->where('defaultEstadoId', null)
        );
});

test('super admin sees all estados regardless of role assignments', function () {
    $admin = User::factory()->create(); // rol Super Admin por defecto

    EstRadicado::create(['Nombre' => 'Recibido', 'Estado' => true]);
    EstRadicado::create(['Nombre' => 'Rechazado', 'Estado' => true]);
    EstRadisecundario::create(['Nombre' => 'Sec A', 'Estado' => true]);

    $this->actingAs($admin)
        ->get('/tools/radicar-solicitud')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('estados', 2)
            ->has('estadosSecundarios', 1)
        );
});

test('a caso can be radicado', function () {
    $user = User::factory()->create();
    $recibido = EstRadicado::create(['Nombre' => 'Recibido', 'Estado' => true]);

    $this->actingAs($user)->post('/tools/radicar-solicitud', [
        'Ndocumento' => '1234567890',
        'estRad' => (string) $recibido->id,
        'fecreci' => '2026-06-23',
        'ObservacionTFX' => 'Observación de prueba',
    ])->assertRedirect(route('tools.radicar-solicitud'));

    $this->assertDatabaseHas('RadicarCaso', [
        'Ndocumento' => '1234567890',
        'estRad' => (string) $recibido->id,
        'ObservacionTFX' => 'Observación de prueba',
    ]);
});

test('radicar requires the document number', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->from('/tools/radicar-solicitud')
        ->post('/tools/radicar-solicitud', [])
        ->assertSessionHasErrors(['Ndocumento']);
});

test('a caso saves its procedimientos into cuvsAnezados', function () {
    $user = User::factory()->create();
    $cups = Cups::create(['Nombre' => 'Procedimiento Uno', 'Estado' => true]);

    $this->actingAs($user)->post('/tools/radicar-solicitud', [
        'Ndocumento' => '555',
        'procedimientos' => [
            ['cusv_id' => $cups->id, 'N_Autorizacion' => 'AUT-001'],
        ],
    ])->assertRedirect(route('tools.radicar-solicitud'));

    $caso = RadicarCaso::where('Ndocumento', '555')->firstOrFail();

    $this->assertDatabaseHas('cuvsAnezados', [
        'codRadicado' => (string) $caso->codrad,
        'cusv_id' => $cups->id,
        'N_Autorizacion' => 'AUT-001',
    ]);
});

test('buscar paciente returns user data by document number', function () {
    $user = User::factory()->create();
    User::factory()->create([
        'name' => 'Juan',
        'Apellido1' => 'Pérez',
        'Numero_D' => '987654',
        'tipo_Docu' => 'CC',
        'Eps' => 'Nueva EPS',
        'Telefono1' => '3000000',
    ]);

    $this->actingAs($user)
        ->getJson('/tools/radicar-solicitud/buscar-paciente?documento=987654')
        ->assertOk()
        ->assertJson([
            'found' => true,
            'tipo_Docu' => 'CC',
            'eps' => 'Nueva EPS',
        ]);
});

test('buscar paciente reports not found for unknown document', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->getJson('/tools/radicar-solicitud/buscar-paciente?documento=000000')
        ->assertOk()
        ->assertJson(['found' => false]);
});

test('buscar paciente returns the cups agreements of the patient EPS', function () {
    $user = User::factory()->create();
    $eps = Eps::create(['Nombre' => 'EPS PRUEBA', 'Estado' => true]);
    $cups = Cups::create(['Nombre' => 'Paquete X', 'CodCupsHuv' => 'P00999', 'Estado' => true]);
    CupsEps::create(['eps_id' => $eps->id, 'cuvs_id' => $cups->id, 'Estado' => true]);
    User::factory()->create(['Numero_D' => '7777', 'Eps' => 'EPS PRUEBA']);

    $this->actingAs($user)
        ->getJson('/tools/radicar-solicitud/buscar-paciente?documento=7777')
        ->assertOk()
        ->assertJson(['found' => true, 'eps' => 'EPS PRUEBA'])
        ->assertJsonFragment(['CodCupsHuv' => 'P00999']);
});

test('buscar paciente returns no agreements when the EPS has none', function () {
    $user = User::factory()->create();
    Eps::create(['Nombre' => 'EPS SIN ACUERDOS', 'Estado' => true]);
    User::factory()->create(['Numero_D' => '8888', 'Eps' => 'EPS SIN ACUERDOS']);

    $this->actingAs($user)
        ->getJson('/tools/radicar-solicitud/buscar-paciente?documento=8888')
        ->assertOk()
        ->assertJson(['found' => true, 'acuerdos' => []]);
});

test('buscar caso returns the case detail by consecutivo', function () {
    $user = User::factory()->create();
    $caso = RadicarCaso::create(['Ndocumento' => '123', 'estRad' => '1']);

    $this->actingAs($user)
        ->getJson('/tools/radicar-solicitud/buscar-caso?q='.$caso->codrad)
        ->assertOk()
        ->assertJson(['found' => true])
        ->assertJsonPath('caso.codrad', $caso->codrad);
});

test('buscar caso finds a case by patient document', function () {
    $user = User::factory()->create();
    RadicarCaso::create(['Ndocumento' => '555777', 'estRad' => '1']);

    $this->actingAs($user)
        ->getJson('/tools/radicar-solicitud/buscar-caso?q=555777')
        ->assertOk()
        ->assertJson(['found' => true])
        ->assertJsonPath('caso.Ndocumento', '555777');
});

test('aplicar modificacion logs a trazabilidad record and updates the case', function () {
    $user = User::factory()->create();
    $caso = RadicarCaso::create(['Ndocumento' => '999']);

    $estadoQx = EstRadisecundario::create(['Nombre' => 'En Revisión', 'Estado' => true]);

    $this->actingAs($user)
        ->postJson("/tools/radicar-solicitud/{$caso->codrad}/seguimiento", [
            'codestsecundario' => (string) $estadoQx->id,
            'ObservacionCCX' => 'Revisión',
        ])
        ->assertOk()
        ->assertJson(['ok' => true]);

    $this->assertDatabaseHas('seguimiento_caso', [
        'codrad' => $caso->codrad,
        'codestsecundario' => (string) $estadoQx->id,
        'user_id' => $user->id,
    ]);

    $caso->refresh();
    expect($caso->codestsecundario)->toBe((string) $estadoQx->id);
    expect($caso->ObservacionCCX)->toBe('Revisión');
});

test('la Fecha Recibido Serv se guarda sola y se ve en la consulta y en el informe', function () {
    $user = User::factory()->create();
    $caso = RadicarCaso::create(['Ndocumento' => '9975', 'estRad' => '1']);

    // El formulario no obliga a diligenciar todos los campos: basta con la
    // fecha para que quede guardada.
    $this->actingAs($user)
        ->postJson("/tools/radicar-solicitud/{$caso->codrad}/seguimiento", [
            'fecreci' => '2026-08-24',
        ])
        ->assertOk()
        ->assertJsonPath('caso.fecreci', '2026-08-24');

    $this->assertDatabaseHas('seguimiento_caso', [
        'codrad' => $caso->codrad,
        'fecreci' => '2026-08-24',
        'user_id' => $user->id,
    ]);

    expect($caso->refresh()->fecreci->format('Y-m-d'))->toBe('2026-08-24');

    // Se rotula distinto de la fecha de radicación (created_at) para que en la
    // bitácora se distinga de la Fecha Recibido de Nueva Radicación.
    $this->assertDatabaseHas('trazabilidad_caso', [
        'codrad' => $caso->codrad,
        'campo' => 'fecreci',
        'etiqueta' => 'Fecha Recibido Serv',
        'nuevo' => '2026-08-24',
    ]);

    // Se ve en la consulta por consecutivo, no solo en el informe.
    $this->actingAs($user)
        ->getJson('/tools/radicar-solicitud/buscar-caso?q='.$caso->codrad)
        ->assertOk()
        ->assertJsonPath('caso.fecreci', '2026-08-24');

    // Y acompaña a TODA fila del informe del caso, incluidas las de la
    // bitácora, que antes la traían siempre vacía.
    $filas = collect(
        $this->actingAs($user)
            ->getJson('/tools/radicar-solicitud/informe?consecutivo='.$caso->codrad)
            ->assertOk()
            ->json('rows')
    );

    expect($filas)->not->toBeEmpty()
        ->and($filas->pluck('fechaRecibidoDev')->unique()->all())->toBe(['2026-08-24']);
});

test('la consulta muestra vacia la Fecha Recibido Serv mientras el servicio no reciba', function () {
    // Es lo que la vista rotula "Sin recibir por el servicio": el caso existe
    // pero nadie ha diligenciado la fecha desde Aplicar Modificaciones.
    $user = User::factory()->create();
    $caso = RadicarCaso::create(['Ndocumento' => '9976', 'estRad' => '1']);

    $this->actingAs($user)
        ->getJson('/tools/radicar-solicitud/buscar-caso?q='.$caso->codrad)
        ->assertOk()
        ->assertJsonPath('caso.fecreci', null);
});

test('la consulta recupera la Fecha Recibido Serv del seguimiento cuando el caso no la tiene', function () {
    // Radicaciones antiguas guardaron la fecha solo en la foto del
    // seguimiento. Sin este respaldo se consultarían como no recibidas.
    $user = User::factory()->create();
    $caso = RadicarCaso::create(['Ndocumento' => '9977', 'estRad' => '1']);

    SeguimientoCaso::create([
        'codrad' => $caso->codrad,
        'user_id' => $user->id,
        'fecreci' => '2026-08-10',
    ]);
    // El seguimiento más reciente que sí trae fecha es el que manda.
    SeguimientoCaso::create([
        'codrad' => $caso->codrad,
        'user_id' => $user->id,
        'fecreci' => '2026-08-18',
    ]);
    SeguimientoCaso::create([
        'codrad' => $caso->codrad,
        'user_id' => $user->id,
        'ObservacionCCX' => 'Sin fecha: no debe borrar la anterior',
    ]);

    expect($caso->refresh()->fecreci)->toBeNull();

    $this->actingAs($user)
        ->getJson('/tools/radicar-solicitud/buscar-caso?q='.$caso->codrad)
        ->assertOk()
        ->assertJsonPath('caso.fecreci', '2026-08-18');
});

test('MAOS se guarda, queda en la bitacora y llega a la grilla de informes', function () {
    $user = User::factory()->create();
    $caso = RadicarCaso::create(['Ndocumento' => '9980', 'estRad' => '1']);

    $this->actingAs($user)
        ->postJson("/tools/radicar-solicitud/{$caso->codrad}/seguimiento", [
            'maos' => true,
        ])
        ->assertOk();

    expect($caso->refresh()->maos)->toBeTrue();

    $this->assertDatabaseHas('trazabilidad_caso', [
        'codrad' => $caso->codrad,
        'evento' => 'seguimiento',
        'campo' => 'maos',
        'etiqueta' => 'MAOS',
        'anterior' => 'No',
        'nuevo' => 'Sí',
    ]);

    $fila = collect(
        $this->actingAs($user)
            ->getJson('/tools/radicar-solicitud/informe?consecutivo='.$caso->codrad)
            ->assertOk()
            ->json('rows')
    )->first();
    expect($fila['maos'])->toBeTrue();

    // Desmarcarlo también se aplica: "No" es un valor, no un campo vacío.
    $this->actingAs($user)
        ->postJson("/tools/radicar-solicitud/{$caso->codrad}/seguimiento", [
            'maos' => false,
        ])
        ->assertOk();

    expect($caso->refresh()->maos)->toBeFalse();
    $this->assertDatabaseHas('trazabilidad_caso', [
        'codrad' => $caso->codrad,
        'campo' => 'maos',
        'anterior' => 'Sí',
        'nuevo' => 'No',
    ]);
});

test('aplicar modificacion ya no acepta el motivo', function () {
    $user = User::factory()->create();
    $caso = RadicarCaso::create(['Ndocumento' => '9970']);
    $motivo = Motivo::create(['Nombre' => 'Paquete Incompleto', 'Estado' => true]);

    // El campo salió del formulario: aunque llegue en la petición, se ignora.
    $this->actingAs($user)
        ->postJson("/tools/radicar-solicitud/{$caso->codrad}/seguimiento", [
            'estcod' => (string) $motivo->id,
        ])
        ->assertOk();

    expect($caso->refresh()->estcod)->toBeNull();
    $this->assertDatabaseMissing('seguimiento_caso', [
        'codrad' => $caso->codrad,
        'estcod' => (string) $motivo->id,
    ]);
});

test('informe returns the trazabilidad rows with subespecialidad and observacion', function () {
    $user = User::factory()->create();
    $caso = RadicarCaso::create(['Ndocumento' => '321', 'estRad' => '1']);
    SubEspecialidad::create([
        'Nombre' => 'SubX',
        'cod_SubEspecialidad' => 'SX1',
        'Estado' => true,
    ]);
    SeguimientoCaso::create([
        'codrad' => $caso->codrad,
        'codsubesp' => 'SX1',
        'ObservacionCCX' => 'Obs prueba',
        'user_id' => $user->id,
    ]);

    $this->actingAs($user)
        ->getJson('/tools/radicar-solicitud/informe')
        ->assertOk()
        ->assertJsonFragment(['codrad' => $caso->codrad])
        ->assertJsonFragment(['subespecialidad' => 'SubX'])
        ->assertJsonFragment(['observacion' => 'Obs prueba']);
});

test('el informe muestra TODAS las radicaciones aunque no tengan cambios', function () {
    $user = User::factory()->create();
    $unoSinCambios = RadicarCaso::create(['Ndocumento' => '8001', 'estRad' => '1']);
    $otroSinCambios = RadicarCaso::create(['Ndocumento' => '8002', 'estRad' => '1']);

    $rows = $this->actingAs($user)
        ->getJson('/tools/radicar-solicitud/informe')
        ->assertOk()
        ->json('rows');

    $casos = collect($rows)->pluck('codrad')->unique();
    expect($casos)->toContain($unoSinCambios->codrad)
        ->and($casos)->toContain($otroSinCambios->codrad);
});

test('cambiar el estado desde Modificar Radicado deja registro con el antes y el despues', function () {
    $admin = User::factory()->create();
    $recibido = EstRadicado::create(['Nombre' => 'Recibido', 'Estado' => true]);
    $autorizado = EstRadicado::create(['Nombre' => 'Autorizado', 'Estado' => true]);
    $cups = Cups::create(['Nombre' => 'Proc Uno', 'Estado' => true]);
    $caso = RadicarCaso::create([
        'Ndocumento' => '8100',
        'estRad' => (string) $recibido->id,
    ]);

    $this->actingAs($admin)->putJson("/tools/radicar-solicitud/{$caso->codrad}", [
        'codMed' => (string) $admin->id,
        'estRad' => (string) $autorizado->id,
        'fentregapro' => '2026-07-30',
        'fecreci' => '2026-07-29',
        'fecAutorizacion' => '2026-07-28',
        'fechavenautorizacion' => '2026-08-28',
        'procedimientos' => [['cusv_id' => $cups->id, 'N_Autorizacion' => 'A1']],
    ])->assertOk();

    $this->assertDatabaseHas('trazabilidad_caso', [
        'codrad' => $caso->codrad,
        'evento' => 'modificacion',
        'campo' => 'estRad',
        'etiqueta' => 'Estado Actual',
        'anterior' => 'Recibido',
        'nuevo' => 'Autorizado',
        'user_id' => $admin->id,
    ]);

    // Y ese cambio se ve en la grilla del informe.
    $rows = $this->actingAs($admin)
        ->getJson('/tools/radicar-solicitud/informe')
        ->assertOk()
        ->json('rows');

    $cambio = collect($rows)->firstWhere('campo', 'Estado Actual');
    expect($cambio)->not->toBeNull()
        ->and($cambio['anterior'])->toBe('Recibido')
        ->and($cambio['nuevo'])->toBe('Autorizado')
        ->and($cambio['tipo'])->toBe('Cambio');
});

test('radicar un caso deja el evento de creacion en la bitacora', function () {
    $user = User::factory()->create();
    $caso = RadicarCaso::create(['Ndocumento' => '8200', 'estRad' => '1']);

    // Un caso creado directamente (sin pasar por store) no tiene bitácora,
    // pero igual debe aparecer en el informe como radicación sin cambios.
    $rows = $this->actingAs($user)
        ->getJson('/tools/radicar-solicitud/informe')
        ->assertOk()
        ->json('rows');

    $fila = collect($rows)->firstWhere('codrad', $caso->codrad);
    expect($fila)->not->toBeNull()
        ->and($fila['tipo'])->toBe('Radicación')
        ->and($fila['campo'])->toBe('Sin cambios registrados');
});

test('aplicar modificacion cambia el estado y solo acepta los del rol', function () {
    $rol = Role::create(['Nombre' => 'Gestor Seg', 'Estado' => true]);
    $operador = User::factory()->create(['rol' => 'Gestor Seg']);
    Permiso::create([
        'role_id' => $rol->id,
        'vista' => 'radicar-solicitud',
        'ver' => true,
        'crear' => true,
        'editar' => true,
        'borrar' => true,
    ]);

    $recibido = EstRadicado::create(['Nombre' => 'Recibido', 'Estado' => true]);
    $autorizado = EstRadicado::create(['Nombre' => 'Autorizado', 'Estado' => true]);
    $ajeno = EstRadicado::create(['Nombre' => 'Anulado', 'Estado' => true]);

    // Al rol solo se le asignan dos de los tres estados.
    $rol->estadosRadicado()->sync([$recibido->id, $autorizado->id]);

    $caso = RadicarCaso::create([
        'Ndocumento' => '9960',
        'estRad' => (string) $recibido->id,
    ]);

    $this->actingAs($operador)
        ->postJson("/tools/radicar-solicitud/{$caso->codrad}/seguimiento", [
            'estRad' => (string) $autorizado->id,
        ])
        ->assertOk();

    expect($caso->refresh()->estRad)->toBe((string) $autorizado->id);

    $this->assertDatabaseHas('trazabilidad_caso', [
        'codrad' => $caso->codrad,
        'evento' => 'seguimiento',
        'campo' => 'estRad',
        'etiqueta' => 'Estado Actual',
        'anterior' => 'Recibido',
        'nuevo' => 'Autorizado',
    ]);

    // Un estado que el rol no tiene asignado se rechaza y el caso no cambia.
    $this->actingAs($operador)
        ->postJson("/tools/radicar-solicitud/{$caso->codrad}/seguimiento", [
            'estRad' => (string) $ajeno->id,
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['estRad']);

    expect($caso->refresh()->estRad)->toBe((string) $autorizado->id);
});

test('aplicar modificacion registra el cambio campo a campo', function () {
    $user = User::factory()->create();
    $sub = SubEspecialidad::create([
        'Nombre' => 'Cirugía de Mano',
        'cod_SubEspecialidad' => 'CM1',
        'Estado' => true,
    ]);
    $caso = RadicarCaso::create(['Ndocumento' => '8300', 'estRad' => '1']);

    $this->actingAs($user)
        ->postJson("/tools/radicar-solicitud/{$caso->codrad}/seguimiento", [
            'codsubesp' => $sub->cod_SubEspecialidad,
            'codestsecundario' => (string) EstRadisecundario::create([
                'Nombre' => 'Programado',
                'Estado' => true,
            ])->id,
            'venc_anestesia' => '2026-09-01',
        ])
        ->assertOk();

    $this->assertDatabaseHas('trazabilidad_caso', [
        'codrad' => $caso->codrad,
        'evento' => 'seguimiento',
        'campo' => 'codsubesp',
        'etiqueta' => 'Subespecialidad',
        'nuevo' => 'Cirugía de Mano',
    ]);
    // El estado secundario ahora se llama Estado QX en toda la interfaz.
    $this->assertDatabaseHas('trazabilidad_caso', [
        'codrad' => $caso->codrad,
        'campo' => 'codestsecundario',
        'etiqueta' => 'Estado QX',
        'nuevo' => 'Programado',
    ]);
    $this->assertDatabaseHas('trazabilidad_caso', [
        'codrad' => $caso->codrad,
        'campo' => 'venc_anestesia',
        'etiqueta' => 'Vencimiento Anestesia',
        'nuevo' => '2026-09-01',
    ]);
});

test('el informe respeta los estados autorizados al rol', function () {
    $rol = Role::create(['Nombre' => 'Gestor Ciau', 'Estado' => true]);
    $operador = User::factory()->create(['rol' => 'Gestor Ciau']);

    $permitido = EstRadicado::create(['Nombre' => 'Recibido', 'Estado' => true]);
    $vetado = EstRadicado::create(['Nombre' => 'Anulado', 'Estado' => true]);

    // El rol solo tiene autorizado ver las radicaciones en "Recibido".
    $rol->estadosGrilla()->sync([$permitido->id]);

    $visible = RadicarCaso::create([
        'Ndocumento' => '8700',
        'estRad' => (string) $permitido->id,
    ]);
    $oculto = RadicarCaso::create([
        'Ndocumento' => '8701',
        'estRad' => (string) $vetado->id,
    ]);

    Permiso::create([
        'role_id' => $rol->id,
        'vista' => 'radicar-solicitud',
        'ver' => true,
        'crear' => true,
        'editar' => true,
        'borrar' => true,
    ]);

    $codrads = collect(
        $this->actingAs($operador)
            ->getJson('/tools/radicar-solicitud/informe')
            ->assertOk()
            ->json('rows')
    )->pluck('codrad');

    expect($codrads)->toContain($visible->codrad)
        ->and($codrads)->not->toContain($oculto->codrad);

    // Un Super Admin no queda limitado por esa configuración.
    $root = User::factory()->create();
    $codradsRoot = collect(
        $this->actingAs($root)
            ->getJson('/tools/radicar-solicitud/informe')
            ->assertOk()
            ->json('rows')
    )->pluck('codrad');

    expect($codradsRoot)->toContain($visible->codrad)
        ->and($codradsRoot)->toContain($oculto->codrad);
});

test('el estado secundario asignado al rol no filtra la grilla', function () {
    $rol = Role::create(['Nombre' => 'Gestor Sec', 'Estado' => true]);
    $operador = User::factory()->create(['rol' => 'Gestor Sec']);

    $secPermitido = EstRadisecundario::create(['Nombre' => 'En trámite', 'Estado' => true]);
    $secVetado = EstRadisecundario::create(['Nombre' => 'Devuelto', 'Estado' => true]);

    // El rol tiene un estado secundario asignado, pero eso no debe recortar
    // lo que ve: el campo tiene otras funciones todavía por definir y las
    // radicaciones nacen sin él, así que filtrar por ahí vaciaba la grilla.
    $rol->estadosSecGrilla()->sync([$secPermitido->id]);

    $conEseSecundario = RadicarCaso::create([
        'Ndocumento' => '8800',
        'estRad' => '1',
        'codestsecundario' => (string) $secPermitido->id,
    ]);
    $conOtroSecundario = RadicarCaso::create([
        'Ndocumento' => '8801',
        'estRad' => '1',
        'codestsecundario' => (string) $secVetado->id,
    ]);
    $sinSecundario = RadicarCaso::create([
        'Ndocumento' => '8802',
        'estRad' => '1',
    ]);

    Permiso::create([
        'role_id' => $rol->id,
        'vista' => 'radicar-solicitud',
        'ver' => true,
        'crear' => true,
        'editar' => true,
        'borrar' => true,
    ]);

    $codrads = collect(
        $this->actingAs($operador)
            ->getJson('/tools/radicar-solicitud/informe')
            ->assertOk()
            ->json('rows')
    )->pluck('codrad');

    expect($codrads)->toContain($conEseSecundario->codrad)
        ->and($codrads)->toContain($conOtroSecundario->codrad)
        ->and($codrads)->toContain($sinSecundario->codrad);
});

test('cambiar fecha, estado u observacion de una cotizacion deja registro', function () {
    $admin = User::factory()->create();
    $caso = RadicarCaso::create(['Ndocumento' => '8500', 'estRad' => '1']);
    $cot = CotizacionCaso::create([
        'codrad' => $caso->codrad,
        'user_id' => $admin->id,
        'tercero' => 'Proveedor A',
        'valor' => 1000000,
        'fecha_cotizacion' => '2026-07-01',
        'estado' => '2',
        'observacion' => 'Sin IVA',
    ]);

    // Se cambian solo fecha, estado y observación: tercero y valor intactos.
    $this->actingAs($admin)
        ->postJson("/tools/radicar-solicitud/{$caso->codrad}/cotizaciones", [
            'cotizaciones' => [[
                'id' => $cot->id,
                'tercero' => 'Proveedor A',
                'valor' => 1000000,
                'fecha_cotizacion' => '2026-08-15',
                'estado' => '5',
                'observacion' => 'Con IVA',
            ]],
        ])
        ->assertOk();

    $this->assertDatabaseHas('trazabilidad_caso', [
        'codrad' => $caso->codrad,
        'evento' => 'cotizacion',
        'etiqueta' => 'Cotizaciones',
    ]);
});

test('un caso con cambios nunca se rotula como sin cambios registrados', function () {
    $admin = User::factory()->create();
    $caso = RadicarCaso::create(['Ndocumento' => '8600', 'estRad' => '1']);
    TrazabilidadCaso::create([
        'codrad' => $caso->codrad,
        'user_id' => $admin->id,
        'evento' => 'modificacion',
        'campo' => 'estRad',
        'etiqueta' => 'Estado Actual',
        'anterior' => 'Recibido',
        'nuevo' => 'Autorizado',
    ]);

    $rows = $this->actingAs($admin)
        ->getJson('/tools/radicar-solicitud/informe')
        ->assertOk()
        ->json('rows');

    $filas = collect($rows)->where('codrad', $caso->codrad);
    expect($filas->pluck('campo'))->not->toContain('Sin cambios registrados');
    expect($filas->pluck('campo'))->toContain('Estado Actual');
});

test('el copago se guarda con su valor y queda en la bitacora', function () {
    $admin = User::factory()->create();
    $cups = Cups::create(['Nombre' => 'Proc', 'Estado' => true]);
    $caso = RadicarCaso::create(['Ndocumento' => '9100', 'estRad' => '1']);

    $this->actingAs($admin)->putJson("/tools/radicar-solicitud/{$caso->codrad}", [
        'codMed' => (string) $admin->id,
        'estRad' => '1',
        'copago' => true,
        'valor_copago' => 85000.50,
        'fentregapro' => '2026-07-31',
        'fecreci' => '2026-07-30',
        'fecAutorizacion' => '2026-07-29',
        'fechavenautorizacion' => '2026-08-29',
        'procedimientos' => [['cusv_id' => $cups->id, 'N_Autorizacion' => 'A1']],
    ])->assertOk();

    $caso->refresh();
    expect($caso->copago)->toBeTrue()
        ->and((float) $caso->valor_copago)->toBe(85000.50);

    $this->assertDatabaseHas('trazabilidad_caso', [
        'codrad' => $caso->codrad,
        'campo' => 'copago',
        'etiqueta' => 'Copago',
        'anterior' => 'No',
        'nuevo' => 'Sí',
    ]);
});

test('marcar copago sin valor es rechazado', function () {
    $admin = User::factory()->create();
    $cups = Cups::create(['Nombre' => 'Proc', 'Estado' => true]);
    $caso = RadicarCaso::create(['Ndocumento' => '9200', 'estRad' => '1']);

    $this->actingAs($admin)
        ->putJson("/tools/radicar-solicitud/{$caso->codrad}", [
            'codMed' => (string) $admin->id,
            'estRad' => '1',
            'copago' => true,
            'fentregapro' => '2026-07-31',
            'fecreci' => '2026-07-30',
            'fecAutorizacion' => '2026-07-29',
            'fechavenautorizacion' => '2026-08-29',
            'procedimientos' => [['cusv_id' => $cups->id, 'N_Autorizacion' => 'A1']],
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['valor_copago']);
});

test('desmarcar el copago borra el valor guardado', function () {
    $admin = User::factory()->create();
    $cups = Cups::create(['Nombre' => 'Proc', 'Estado' => true]);
    $caso = RadicarCaso::create([
        'Ndocumento' => '9300',
        'estRad' => '1',
        'copago' => true,
        'valor_copago' => 50000,
    ]);

    $this->actingAs($admin)->putJson("/tools/radicar-solicitud/{$caso->codrad}", [
        'codMed' => (string) $admin->id,
        'estRad' => '1',
        'copago' => false,
        // Aunque llegue un valor, sin copago no debe conservarse.
        'valor_copago' => 50000,
        'fentregapro' => '2026-07-31',
        'fecreci' => '2026-07-30',
        'fecAutorizacion' => '2026-07-29',
        'fechavenautorizacion' => '2026-08-29',
        'procedimientos' => [['cusv_id' => $cups->id, 'N_Autorizacion' => 'A1']],
    ])->assertOk();

    $caso->refresh();
    expect($caso->copago)->toBeFalse()
        ->and($caso->valor_copago)->toBeNull();
});

test('el copago aparece en la grilla de informes', function () {
    $user = User::factory()->create();
    $conCopago = RadicarCaso::create([
        'Ndocumento' => '9500',
        'estRad' => '1',
        'copago' => true,
        'valor_copago' => 85000.50,
    ]);
    $sinCopago = RadicarCaso::create(['Ndocumento' => '9501', 'estRad' => '1']);

    $rows = collect(
        $this->actingAs($user)
            ->getJson('/tools/radicar-solicitud/informe')
            ->assertOk()
            ->json('rows')
    );

    $con = $rows->firstWhere('codrad', $conCopago->codrad);
    $sin = $rows->firstWhere('codrad', $sinCopago->codrad);

    expect($con['copago'])->toBeTrue()
        ->and($con['valorCopago'])->toBe('85000.50')
        ->and($sin['copago'])->toBeFalse()
        ->and($sin['valorCopago'])->toBeNull();
});

test('el paquete se sube, se reemplaza y borra el archivo anterior', function () {
    Storage::fake('public');
    $admin = User::factory()->create();
    $cups = Cups::create(['Nombre' => 'Proc', 'Estado' => true]);
    $caso = RadicarCaso::create(['Ndocumento' => '9600', 'estRad' => '1']);

    $base = [
        'codMed' => (string) $admin->id,
        'estRad' => '1',
        'copago' => false,
        'fentregapro' => '2026-07-31',
        'fecreci' => '2026-07-30',
        'fecAutorizacion' => '2026-07-29',
        'fechavenautorizacion' => '2026-08-29',
        'procedimientos' => [['cusv_id' => $cups->id, 'N_Autorizacion' => 'A1']],
    ];

    $this->actingAs($admin)->put("/tools/radicar-solicitud/{$caso->codrad}", $base + [
        'paquete' => UploadedFile::fake()->create('uno.pdf', 1024, 'application/pdf'),
    ])->assertOk();

    $primero = $caso->refresh()->paquete;
    expect($primero)->not->toBeNull();
    Storage::disk('public')->assertExists($primero);

    // Al reemplazarlo, el anterior no debe quedar ocupando disco.
    $this->actingAs($admin)->put("/tools/radicar-solicitud/{$caso->codrad}", $base + [
        'paquete' => UploadedFile::fake()->create('dos.pdf', 512, 'application/pdf'),
    ])->assertOk();

    $segundo = $caso->refresh()->paquete;
    expect($segundo)->not->toBe($primero);
    Storage::disk('public')->assertExists($segundo);
    Storage::disk('public')->assertMissing($primero);

    // Sin archivo nuevo se conserva el que ya tenía.
    $this->actingAs($admin)
        ->put("/tools/radicar-solicitud/{$caso->codrad}", $base)
        ->assertOk();
    expect($caso->refresh()->paquete)->toBe($segundo);
});

test('el paquete se guarda con el radicado y el documento del paciente en el nombre', function () {
    Storage::fake('public');
    $admin = User::factory()->create();
    $cups = Cups::create(['Nombre' => 'Proc', 'Estado' => true]);
    $caso = RadicarCaso::create(['Ndocumento' => '1088223344', 'estRad' => '1']);

    $this->actingAs($admin)->put("/tools/radicar-solicitud/{$caso->codrad}", [
        'codMed' => (string) $admin->id,
        'estRad' => '1',
        'copago' => false,
        'fentregapro' => '2026-07-31',
        'fecreci' => '2026-07-30',
        'fecAutorizacion' => '2026-07-29',
        'fechavenautorizacion' => '2026-08-29',
        'procedimientos' => [['cusv_id' => $cups->id, 'N_Autorizacion' => 'A1']],
        'paquete' => UploadedFile::fake()->create('escaneo.pdf', 64, 'application/pdf'),
    ])->assertOk();

    // El nombre debe poder leerse desde la consola de S3 sin cruzarlo contra
    // la base: radicado, paciente, y un sufijo que lo hace único por subida.
    expect(basename($caso->refresh()->paquete))
        ->toMatch('/^rad-'.$caso->codrad.'_doc-1088223344_\d{8}-\d{6}-[a-z0-9]{4}\.pdf$/');
});
test('modificar el radicado y subir el PDF no exige la Fecha Recibido Serv', function () {
    // Esa fecha la diligencia el servicio desde Aplicar Modificaciones. Si el
    // servicio todavía no ha recibido el caso, el modal Modificar Radicado
    // abre con el campo vacío: exigirlo dejaba sin poder guardar el radicado
    // ni adjuntar el PDF.
    Storage::fake('public');
    $admin = User::factory()->create();
    $cups = Cups::create(['Nombre' => 'Proc', 'Estado' => true]);
    $caso = RadicarCaso::create(['Ndocumento' => '9701', 'estRad' => '1']);

    $this->actingAs($admin)
        ->put("/tools/radicar-solicitud/{$caso->codrad}", [
            'codMed' => (string) $admin->id,
            'estRad' => '1',
            'copago' => false,
            'fentregapro' => '2026-08-25',
            // Va vacía, tal como la manda el formulario cuando nadie la ha
            // diligenciado todavía.
            'fecreci' => '',
            'fecAutorizacion' => '2026-08-19',
            'fechavenautorizacion' => '2026-11-17',
            'procedimientos' => [['cusv_id' => $cups->id, 'N_Autorizacion' => '456710715']],
            'paquete' => UploadedFile::fake()->create('25082026_003.pdf', 64, 'application/pdf'),
        ])
        ->assertOk();

    $caso->refresh();
    expect($caso->fecreci)->toBeNull()
        ->and($caso->paquete)->not->toBeNull();
});

test('el paquete rechaza archivos que no sean PDF o pasen de 30 MB', function () {
    Storage::fake('public');
    $admin = User::factory()->create();
    $cups = Cups::create(['Nombre' => 'Proc', 'Estado' => true]);
    $caso = RadicarCaso::create(['Ndocumento' => '9700', 'estRad' => '1']);

    $base = [
        'codMed' => (string) $admin->id,
        'estRad' => '1',
        'copago' => false,
        'fentregapro' => '2026-07-31',
        'fecreci' => '2026-07-30',
        'fecAutorizacion' => '2026-07-29',
        'fechavenautorizacion' => '2026-08-29',
        'procedimientos' => [['cusv_id' => $cups->id, 'N_Autorizacion' => 'A1']],
    ];

    $this->actingAs($admin)
        ->putJson("/tools/radicar-solicitud/{$caso->codrad}", $base + [
            'paquete' => UploadedFile::fake()->create('grande.pdf', 31 * 1024, 'application/pdf'),
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['paquete']);

    $this->actingAs($admin)
        ->putJson("/tools/radicar-solicitud/{$caso->codrad}", $base + [
            'paquete' => UploadedFile::fake()->create('hoja.xlsx', 10),
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['paquete']);

    expect($caso->refresh()->paquete)->toBeNull();
});

test('las fechas del caso llegan como Y-m-d y no en formato ISO', function () {
    $user = User::factory()->create();
    $caso = RadicarCaso::create([
        'Ndocumento' => '9920',
        'estRad' => '1',
        'fecreci' => '2026-07-30',
        'fentregapro' => '2026-07-30',
        'fecAutorizacion' => '2026-05-04',
        'fechavenautorizacion' => '2026-11-04',
    ]);

    // Sin formatear saldrían como 2026-07-30T00:00:00.000000Z, que además
    // deja vacío el <input type="date"> del modal Modificar Radicado.
    $this->actingAs($user)
        ->getJson('/tools/radicar-solicitud/buscar-caso?q='.$caso->codrad)
        ->assertOk()
        ->assertJsonPath('caso.fecreci', '2026-07-30')
        ->assertJsonPath('caso.entregaProg', '2026-07-30')
        ->assertJsonPath('caso.fechaAutorizacion', '2026-05-04')
        ->assertJsonPath('caso.vencimientoAut', '2026-11-04');
});

test('las fechas del informe llegan como Y-m-d', function () {
    $user = User::factory()->create();
    $caso = RadicarCaso::create(['Ndocumento' => '9930', 'estRad' => '1']);
    SeguimientoCaso::create([
        'codrad' => $caso->codrad,
        'user_id' => $user->id,
        'fecreci' => '2026-07-15',
        'venc_anestesia' => '2026-09-01',
    ]);

    $fila = collect(
        $this->actingAs($user)
            ->getJson('/tools/radicar-solicitud/informe?consecutivo='.$caso->codrad)
            ->assertOk()
            ->json('rows')
    )->firstWhere('tipo', 'Seguimiento');

    expect($fila['fechaRecibidoDev'])->toBe('2026-07-15')
        ->and($fila['vencAnestesia'])->toBe('2026-09-01');
});

test('modificar el radicado funciona por POST con _method=PUT y multipart', function () {
    // Es exactamente lo que hace el modal Modificar Radicado: PHP no
    // interpreta el cuerpo de un PUT multipart, así que el navegador manda
    // POST con _method=PUT. Las demás pruebas usan ->put() y no cubren
    // este camino.
    Storage::fake('public');
    $admin = User::factory()->create();
    $cups = Cups::create(['Nombre' => 'Proc', 'Estado' => true]);
    $caso = RadicarCaso::create(['Ndocumento' => '9940', 'estRad' => '1']);

    $this->actingAs($admin)->post("/tools/radicar-solicitud/{$caso->codrad}", [
        '_method' => 'PUT',
        'codMed' => (string) $admin->id,
        'estRad' => '1',
        'copago' => '1',
        'valor_copago' => '3600000',
        'fentregapro' => '2026-08-07',
        'fecreci' => '2026-08-07',
        'fecAutorizacion' => '2026-08-07',
        'fechavenautorizacion' => '2026-08-14',
        'ObservacionTFX' => 'pendientes de tramite',
        'paquete' => UploadedFile::fake()->create('adj.pdf', 300, 'application/pdf'),
        'procedimientos' => [
            ['cusv_id' => (string) $cups->id, 'N_Autorizacion' => '36235'],
        ],
    ])->assertOk();

    $caso->refresh();
    expect($caso->copago)->toBeTrue()
        ->and((float) $caso->valor_copago)->toBe(3600000.0)
        ->and($caso->paquete)->not->toBeNull();
});

test('si el guardado falla, el PDF anterior sobrevive y el nuevo no queda huerfano', function () {
    // Escenario real: el update reventó en el servidor (columna faltante) con
    // un PDF ya subido. El disco no participa de la transacción, así que hay
    // que limpiarlo a mano; si se borrara el anterior antes de guardar, un
    // fallo dejaría la fila apuntando a un archivo inexistente.
    Storage::fake('public');
    $admin = User::factory()->create();
    $cups = Cups::create(['Nombre' => 'Proc', 'Estado' => true]);

    $anterior = UploadedFile::fake()
        ->create('anterior.pdf', 100, 'application/pdf')
        ->store('paquetes', 'public');
    $caso = RadicarCaso::create([
        'Ndocumento' => '9950',
        'estRad' => '1',
        'paquete' => $anterior,
    ]);

    // Un CUPS inexistente hace fallar la validación de procedimientos.
    $this->actingAs($admin)
        ->putJson("/tools/radicar-solicitud/{$caso->codrad}", [
            'codMed' => (string) $admin->id,
            'estRad' => '1',
            'copago' => false,
            'fentregapro' => '2026-08-04',
            'fecreci' => '2026-08-05',
            'fecAutorizacion' => '2026-08-04',
            'fechavenautorizacion' => '2026-08-05',
            'paquete' => UploadedFile::fake()->create('nuevo.pdf', 100, 'application/pdf'),
            'procedimientos' => [['cusv_id' => 999999999, 'N_Autorizacion' => 'X']],
        ])
        ->assertStatus(422);

    // El caso conserva su PDF y el archivo sigue existiendo.
    expect($caso->refresh()->paquete)->toBe($anterior);
    Storage::disk('public')->assertExists($anterior);

    // Y no quedó un segundo archivo suelto en el disco.
    expect(Storage::disk('public')->files('paquetes'))->toHaveCount(1);

    // Con datos correctos el reemplazo sí ocurre y limpia el anterior.
    $this->actingAs($admin)
        ->put("/tools/radicar-solicitud/{$caso->codrad}", [
            'codMed' => (string) $admin->id,
            'estRad' => '1',
            'copago' => false,
            'fentregapro' => '2026-08-04',
            'fecreci' => '2026-08-05',
            'fecAutorizacion' => '2026-08-04',
            'fechavenautorizacion' => '2026-08-05',
            'paquete' => UploadedFile::fake()->create('nuevo.pdf', 100, 'application/pdf'),
            'procedimientos' => [['cusv_id' => $cups->id, 'N_Autorizacion' => 'A1']],
        ])
        ->assertOk();

    Storage::disk('public')->assertMissing($anterior);
    expect(Storage::disk('public')->files('paquetes'))->toHaveCount(1);
});

test('el paquete se visualiza en linea por una ruta protegida', function () {
    Storage::fake('public');
    $user = User::factory()->create();
    $caso = RadicarCaso::create(['Ndocumento' => '9900', 'estRad' => '1']);
    $ruta = UploadedFile::fake()
        ->create('paquete.pdf', 200, 'application/pdf')
        ->store('paquetes', 'public');
    $caso->update(['paquete' => $ruta]);

    $res = $this->actingAs($user)
        ->get("/tools/radicar-solicitud/{$caso->codrad}/paquete")
        ->assertOk();

    // Inline para que el navegador lo muestre en vez de descargarlo.
    expect($res->headers->get('Content-Type'))->toBe('application/pdf');
    expect($res->headers->get('Content-Disposition'))->toContain('inline');

    // Un invitado no puede verlo.
    auth()->logout();
    $this->get("/tools/radicar-solicitud/{$caso->codrad}/paquete")
        ->assertRedirect(route('login'));
});

test('un caso sin paquete responde 404 al pedir el PDF', function () {
    $user = User::factory()->create();
    $caso = RadicarCaso::create(['Ndocumento' => '9910', 'estRad' => '1']);

    $this->actingAs($user)
        ->get("/tools/radicar-solicitud/{$caso->codrad}/paquete")
        ->assertNotFound();
});

test('borrar un caso borra tambien el PDF del paquete', function () {
    Storage::fake('public');
    $admin = User::factory()->create();
    $caso = RadicarCaso::create(['Ndocumento' => '9800', 'estRad' => '1']);
    $ruta = UploadedFile::fake()
        ->create('adj.pdf', 100, 'application/pdf')
        ->store('paquetes', 'public');
    $caso->update(['paquete' => $ruta]);

    Storage::disk('public')->assertExists($ruta);

    $this->actingAs($admin)
        ->deleteJson("/tools/radicar-solicitud/{$caso->codrad}")
        ->assertOk();

    Storage::disk('public')->assertMissing($ruta);
});

test('el copago viaja en la consulta del caso', function () {
    $user = User::factory()->create();
    $caso = RadicarCaso::create([
        'Ndocumento' => '9400',
        'estRad' => '1',
        'copago' => true,
        'valor_copago' => 12345.67,
    ]);

    $this->actingAs($user)
        ->getJson('/tools/radicar-solicitud/buscar-caso?q='.$caso->codrad)
        ->assertOk()
        ->assertJsonPath('caso.copago', true)
        ->assertJsonPath('caso.valorCopago', '12345.67');
});

test('borrar un caso borra tambien su bitacora', function () {
    $admin = User::factory()->create();
    $caso = RadicarCaso::create(['Ndocumento' => '8400', 'estRad' => '1']);
    TrazabilidadCaso::create([
        'codrad' => $caso->codrad,
        'user_id' => $admin->id,
        'evento' => 'creacion',
        'etiqueta' => 'Radicación creada',
    ]);

    $this->actingAs($admin)
        ->deleteJson("/tools/radicar-solicitud/{$caso->codrad}")
        ->assertOk();

    $this->assertDatabaseMissing('trazabilidad_caso', ['codrad' => $caso->codrad]);
});

test('informe filtra por numero de documento del paciente', function () {
    $user = User::factory()->create();
    $delPaciente = RadicarCaso::create(['Ndocumento' => '3131', 'estRad' => '1']);
    $deOtro = RadicarCaso::create(['Ndocumento' => '9292', 'estRad' => '1']);

    SeguimientoCaso::create(['codrad' => $delPaciente->codrad, 'user_id' => $user->id]);
    SeguimientoCaso::create(['codrad' => $deOtro->codrad, 'user_id' => $user->id]);

    $this->actingAs($user)
        ->getJson('/tools/radicar-solicitud/informe?documento=3131')
        ->assertOk()
        ->assertJsonCount(1, 'rows')
        ->assertJsonPath('rows.0.codrad', $delPaciente->codrad);
});

test('informe por documento inexistente no devuelve filas', function () {
    $user = User::factory()->create();
    $caso = RadicarCaso::create(['Ndocumento' => '3232', 'estRad' => '1']);
    SeguimientoCaso::create(['codrad' => $caso->codrad, 'user_id' => $user->id]);

    $this->actingAs($user)
        ->getJson('/tools/radicar-solicitud/informe?documento=000000')
        ->assertOk()
        ->assertJsonCount(0, 'rows');
});

test('informe filters by subespecialidad of the case', function () {
    $user = User::factory()->create();
    $caso1 = RadicarCaso::create(['Ndocumento' => '111', 'Codesp' => 'E1', 'codsubesp' => 'S1']);
    $caso2 = RadicarCaso::create(['Ndocumento' => '222', 'Codesp' => 'E2', 'codsubesp' => 'S2']);
    SeguimientoCaso::create(['codrad' => $caso1->codrad, 'user_id' => $user->id]);
    SeguimientoCaso::create(['codrad' => $caso2->codrad, 'user_id' => $user->id]);

    $this->actingAs($user)
        ->getJson('/tools/radicar-solicitud/informe?subespecialidad=S1')
        ->assertOk()
        ->assertJsonFragment(['codrad' => $caso1->codrad])
        ->assertJsonMissing(['codrad' => $caso2->codrad]);
});

test('informe hides trazabilidad authored by a super admin from other roles', function () {
    $operador = User::factory()->create(['rol' => 'Operador']);
    $root = User::factory()->create(['rol' => 'Super Admin']);

    $casoOp = RadicarCaso::create(['Ndocumento' => '900', 'estRad' => '1']);
    $casoAdmin = RadicarCaso::create(['Ndocumento' => '901', 'estRad' => '1']);

    SeguimientoCaso::create(['codrad' => $casoOp->codrad, 'user_id' => $operador->id]);
    SeguimientoCaso::create(['codrad' => $casoAdmin->codrad, 'user_id' => $root->id]);

    // El operador NO ve la modificación hecha por el Super Admin, pero la
    // radicación sí aparece: el informe debe listarlas todas. Se muestra como
    // radicación sin cambios, sin revelar autor ni qué se tocó.
    $rows = $this->actingAs($operador)
        ->getJson('/tools/radicar-solicitud/informe')
        ->assertOk()
        ->assertJsonFragment(['codrad' => $casoOp->codrad])
        ->json('rows');

    $filasAdmin = collect($rows)->where('codrad', $casoAdmin->codrad);
    expect($filasAdmin)->toHaveCount(1);
    expect($filasAdmin->first()['tipo'])->toBe('Radicación')
        ->and($filasAdmin->first()['campo'])->toBe('Sin cambios registrados')
        ->and($filasAdmin->first()['usuario'])->toBe('—');

    // Y no se filtró ninguna fila de seguimiento del Super Admin.
    expect(collect($rows)->where('tipo', 'Seguimiento')->pluck('codrad')->all())
        ->toBe([$casoOp->codrad]);

    // Un Super Admin sí ve ambas.
    $this->actingAs($root)
        ->getJson('/tools/radicar-solicitud/informe')
        ->assertOk()
        ->assertJsonFragment(['codrad' => $casoOp->codrad])
        ->assertJsonFragment(['codrad' => $casoAdmin->codrad]);
});

test('index shares the filter catalogs from existing cases', function () {
    $user = User::factory()->create();
    Especialidad::create(['espcodser' => 'EX', 'Nombre' => 'Especialidad X', 'Estado' => true]);
    SubEspecialidad::create(['cod_SubEspecialidad' => 'SX', 'Nombre' => 'SubX', 'Estado' => true, 'codespcodser' => 'EX']);
    RadicarCaso::create(['Ndocumento' => '333', 'Codesp' => 'EX', 'codsubesp' => 'SX']);

    $this->actingAs($user)
        ->get('/tools/radicar-solicitud')
        ->assertInertia(fn (Assert $page) => $page
            ->has('especialidadesFiltro', 1)
            ->has('subespecialidadesFiltro', 1)
        );
});

test('super admin can delete a case with its procedures and trazabilidad', function () {
    $admin = User::factory()->create(); // el factory crea Super Admin por defecto
    $caso = RadicarCaso::create(['Ndocumento' => '4321']);
    $cups = Cups::create(['Nombre' => 'P', 'Estado' => true]);
    CupsAnezado::create([
        'codRadicado' => (string) $caso->codrad,
        'cusv_id' => $cups->id,
        'N_Autorizacion' => 'A',
    ]);
    SeguimientoCaso::create([
        'codrad' => $caso->codrad,
        'user_id' => $admin->id,
    ]);

    $this->actingAs($admin)
        ->deleteJson("/tools/radicar-solicitud/{$caso->codrad}")
        ->assertOk()
        ->assertJson(['ok' => true]);

    $this->assertDatabaseMissing('RadicarCaso', ['codrad' => $caso->codrad]);
    $this->assertDatabaseMissing('cuvsAnezados', ['codRadicado' => (string) $caso->codrad]);
    $this->assertDatabaseMissing('seguimiento_caso', ['codrad' => $caso->codrad]);
});

test('a non super admin cannot delete a case', function () {
    $operador = User::factory()->create(['rol' => 'Operador']);
    $caso = RadicarCaso::create(['Ndocumento' => '4322']);

    $this->actingAs($operador)
        ->deleteJson("/tools/radicar-solicitud/{$caso->codrad}")
        ->assertForbidden();

    $this->assertDatabaseHas('RadicarCaso', ['codrad' => $caso->codrad]);
});

test('crear paciente creates a user and returns its data with agreements', function () {
    $user = User::factory()->create();
    $eps = Eps::create(['Nombre' => 'EPS X', 'Estado' => true]);
    $cups = Cups::create(['Nombre' => 'Paquete Z', 'CodCupsHuv' => 'P00111', 'Estado' => true]);
    CupsEps::create(['eps_id' => $eps->id, 'cuvs_id' => $cups->id, 'Estado' => true]);

    $this->actingAs($user)->postJson('/tools/radicar-solicitud/crear-paciente', [
        'name' => 'Nuevo',
        'rol' => 'paciente',
        'Apellido1' => 'Paciente',
        'Numero_D' => '11223344',
        'email' => 'nuevo.paciente@example.com',
        'Eps' => 'EPS X',
        'password' => 'password',
        'password_confirmation' => 'password',
    ])
        ->assertOk()
        ->assertJson(['found' => true, 'documento' => '11223344', 'eps' => 'EPS X'])
        ->assertJsonFragment(['CodCupsHuv' => 'P00111']);

    $this->assertDatabaseHas('users', [
        'email' => 'nuevo.paciente@example.com',
        'Numero_D' => '11223344',
        'rol' => 'paciente',
    ]);
});

test('crear paciente validates required fields', function () {
    $user = User::factory()->create();

    // El paciente no inicia sesión: la contraseña ya no se exige, el correo sí.
    $this->actingAs($user)
        ->postJson('/tools/radicar-solicitud/crear-paciente', ['rol' => 'paciente'])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['name', 'email'])
        ->assertJsonMissingValidationErrors(['password']);
});

test('crear paciente no exige contraseña', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->postJson('/tools/radicar-solicitud/crear-paciente', [
        'name' => 'Sin',
        'rol' => 'paciente',
        'Apellido1' => 'Clave',
        'Numero_D' => '55667788',
        'email' => 'sin.clave@example.com',
    ])->assertOk();

    $creado = User::where('email', 'sin.clave@example.com')->firstOrFail();
    expect($creado->password)->toBeNull();
});

test('crear medico no exige correo ni contraseña', function () {
    $user = User::factory()->create();
    Role::firstOrCreate(['Nombre' => 'Medico'], ['Estado' => true]);
    $esp = Especialidad::create([
        'Nombre' => 'Cirugía General',
        'espcodser' => '137',
        'Estado' => true,
    ]);

    $this->actingAs($user)->postJson('/tools/radicar-solicitud/crear-paciente', [
        'name' => 'Doctor',
        'rol' => 'Medico',
        'Apellido1' => 'Prueba',
        'codesp' => $esp->espcodser,
    ])->assertOk();

    $medico = User::where('name', 'Doctor')->where('rol', 'Medico')->firstOrFail();
    expect($medico->email)->toBeNull()
        ->and($medico->password)->toBeNull()
        ->and($medico->codesp)->toBe('137');
});

test('un medico se crea solo con nombre, apellidos y documento', function () {
    $user = User::factory()->create();
    Role::firstOrCreate(['Nombre' => 'Medico'], ['Estado' => true]);

    // Sin especialidad, correo, contraseña, teléfonos, dirección ni EPS:
    // son los únicos campos que el formulario pide para el rol Medico.
    $this->actingAs($user)->postJson('/tools/radicar-solicitud/crear-paciente', [
        'rol' => 'Medico',
        'name' => 'Ana',
        'Apellido1' => 'Gómez',
        'apellido2' => 'Ruiz',
        'tipo_Docu' => 'Cédula de Ciudadanía',
        'Numero_D' => '123123',
    ])->assertOk();

    $medico = User::where('Numero_D', '123123')->firstOrFail();
    expect($medico->rol)->toBe('Medico')
        ->and($medico->name)->toBe('Ana')
        ->and($medico->Apellido1)->toBe('Gómez')
        ->and($medico->apellido2)->toBe('Ruiz')
        ->and($medico->tipo_Docu)->toBe('Cédula de Ciudadanía')
        ->and($medico->codesp)->toBeNull()
        ->and($medico->email)->toBeNull()
        ->and($medico->password)->toBeNull()
        ->and($medico->Telefono1)->toBeNull()
        ->and($medico->Eps)->toBeNull();
});

test('la sub-vista del formulario básico existe y va justo debajo de Cotizaciones', function () {
    $claves = collect(Permiso::VISTAS)->pluck('key')->values();
    $vista = collect(Permiso::VISTAS)
        ->firstWhere('key', 'radicar-solicitud-seguimiento-basico');

    expect($vista)->not->toBeNull()
        ->and($vista['titulo'])->toBe('Formulario básico Cotizaciones de Conceptos No Convenidos (Historial)')
        // El Gestor de Permisos pinta las opciones en el orden del catálogo.
        ->and($claves->search('radicar-solicitud-seguimiento-basico'))
        ->toBe($claves->search('radicar-solicitud-cotizaciones') + 1);
});

test('un rol que solo tiene el formulario básico puede guardar el seguimiento', function () {
    // Es el caso que importa: con el permiso del formulario completo apagado,
    // el middleware rechazaba la petición y el básico no podía guardar nada.
    $rol = Role::create(['Nombre' => 'Servicio Basico', 'Estado' => true]);
    $usuario = User::factory()->create(['rol' => 'Servicio Basico']);

    Permiso::create(['role_id' => $rol->id, 'vista' => 'radicar-solicitud', 'ver' => true]);
    Permiso::create(['role_id' => $rol->id, 'vista' => 'radicar-solicitud-seguimiento', 'ver' => false]);
    Permiso::create(['role_id' => $rol->id, 'vista' => 'radicar-solicitud-seguimiento-basico', 'ver' => true]);

    $estado = EstRadicado::create(['Nombre' => 'Recibido Serv', 'Estado' => true]);
    $rol->estadosRadicado()->sync([$estado->id]);

    $caso = RadicarCaso::create(['Ndocumento' => '9990', 'estRad' => (string) $estado->id]);

    $this->actingAs($usuario)
        ->postJson("/tools/radicar-solicitud/{$caso->codrad}/seguimiento", [
            'estRad' => (string) $estado->id,
            'fecreci' => '2026-08-26',
            'ObservacionCCX' => 'Recibido por el servicio',
        ])
        ->assertOk();

    $caso->refresh();
    expect($caso->fecreci->format('Y-m-d'))->toBe('2026-08-26')
        ->and($caso->ObservacionCCX)->toBe('Recibido por el servicio');
});

test('sin ninguno de los dos formularios asignados no se puede guardar el seguimiento', function () {
    $rol = Role::create(['Nombre' => 'Solo Lectura Seg', 'Estado' => true]);
    $usuario = User::factory()->create(['rol' => 'Solo Lectura Seg']);

    Permiso::create(['role_id' => $rol->id, 'vista' => 'radicar-solicitud', 'ver' => true]);
    Permiso::create(['role_id' => $rol->id, 'vista' => 'radicar-solicitud-seguimiento', 'ver' => false]);
    Permiso::create(['role_id' => $rol->id, 'vista' => 'radicar-solicitud-seguimiento-basico', 'ver' => false]);

    $caso = RadicarCaso::create(['Ndocumento' => '9991', 'estRad' => '1']);

    $this->actingAs($usuario)
        ->postJson("/tools/radicar-solicitud/{$caso->codrad}/seguimiento", [
            'ObservacionCCX' => 'No debería entrar',
        ])
        ->assertForbidden();

    expect($caso->refresh()->ObservacionCCX)->toBeNull();
});

test('el formulario básico no borra los campos que solo trae el completo', function () {
    // El básico manda tres campos. Los que no viajan no deben tocarse: si los
    // mandara vacíos, borraría MAOS, subespecialidad o Estado QX.
    $usuario = User::factory()->create();
    $caso = RadicarCaso::create([
        'Ndocumento' => '9992',
        'estRad' => '1',
        'maos' => true,
        'codsubesp' => 'SB1',
        'venc_anestesia' => '2026-09-01',
    ]);

    $this->actingAs($usuario)
        ->postJson("/tools/radicar-solicitud/{$caso->codrad}/seguimiento", [
            'estRad' => '',
            'fecreci' => '2026-08-26',
            'ObservacionCCX' => 'Solo recepción',
        ])
        ->assertOk();

    $caso->refresh();
    expect($caso->maos)->toBeTrue()
        ->and($caso->codsubesp)->toBe('SB1')
        ->and(optional($caso->venc_anestesia)->format('Y-m-d'))->toBe('2026-09-01')
        ->and($caso->fecreci->format('Y-m-d'))->toBe('2026-08-26');
});

test('la grilla trae el PDF de los conceptos cotizados', function () {
    Storage::fake('public');
    $rol = Role::create(['Nombre' => 'Gestor Contratación', 'Estado' => true]);
    $gestor = User::factory()->create(['rol' => 'Gestor Contratación']);
    Permiso::create(['role_id' => $rol->id, 'vista' => 'radicar-solicitud', 'ver' => true]);
    Permiso::create(['role_id' => $rol->id, 'vista' => 'radicar-solicitud-cotizaciones', 'ver' => true]);
    Permiso::create(['role_id' => $rol->id, 'vista' => 'radicar-solicitud-grilla', 'ver' => true]);

    $caso = RadicarCaso::create(['Ndocumento' => '9993', 'estRad' => '1']);

    CotizacionCaso::create([
        'codrad' => $caso->codrad,
        'tercero' => 'Proveedor Uno',
        'fecha_cotizacion' => '2026-08-20',
        'valor' => 1000,
        'adjunto' => 'cotizaciones/uno.pdf',
    ]);
    // Sin adjunto: no debe aparecer, no hay archivo que abrir.
    CotizacionCaso::create([
        'codrad' => $caso->codrad,
        'tercero' => 'Proveedor Sin PDF',
        'fecha_cotizacion' => '2026-08-21',
        'valor' => 2000,
    ]);

    $fila = collect(
        $this->actingAs($gestor)
            ->get('/tools/radicar-solicitud')
            ->assertOk()
            ->viewData('page')['props']['casosLista']
    )->firstWhere('codrad', $caso->codrad);

    expect($fila['cotizaciones'])->toHaveCount(1)
        ->and($fila['cotizaciones'][0]['tercero'])->toBe('Proveedor Uno')
        ->and($fila['cotizaciones'][0]['url'])->toContain('/cotizacion/');
});

test('quien ve la grilla verifica las cotizaciones aunque no las gestione', function () {
    // La columna existe para que cualquiera pueda verificar lo cotizado, así
    // que no depende del permiso del formulario de cotizaciones. Basta con ver
    // la grilla.
    Storage::fake('public');
    $rol = Role::create(['Nombre' => 'Sin Cotiz', 'Estado' => true]);
    $usuario = User::factory()->create(['rol' => 'Sin Cotiz']);
    Permiso::create(['role_id' => $rol->id, 'vista' => 'radicar-solicitud', 'ver' => true]);
    Permiso::create(['role_id' => $rol->id, 'vista' => 'radicar-solicitud-cotizaciones', 'ver' => false]);
    Permiso::create(['role_id' => $rol->id, 'vista' => 'radicar-solicitud-grilla', 'ver' => true]);

    $caso = RadicarCaso::create(['Ndocumento' => '9994', 'estRad' => '1']);
    $ruta = UploadedFile::fake()
        ->create('cotizacion.pdf', 20, 'application/pdf')
        ->store('cotizaciones', 'public');
    $cot = CotizacionCaso::create([
        'codrad' => $caso->codrad,
        'tercero' => 'Proveedor Uno',
        'fecha_cotizacion' => '2026-08-20',
        'valor' => 1000,
        'adjunto' => $ruta,
    ]);

    $fila = collect(
        $this->actingAs($usuario)
            ->get('/tools/radicar-solicitud')
            ->assertOk()
            ->viewData('page')['props']['casosLista']
    )->firstWhere('codrad', $caso->codrad);

    expect($fila['cotizaciones'])->toHaveCount(1)
        ->and($fila['cotizaciones'][0]['tercero'])->toBe('Proveedor Uno');

    // Y la ruta del archivo lo deja pasar: sin esto el enlace daría 403.
    $this->actingAs($usuario)
        ->get("/tools/radicar-solicitud/cotizacion/{$cot->id}/adjunto")
        ->assertOk();
});

test('sin grilla ni cotizaciones, la pestaña Informes sin configurar deja abrir el PDF', function () {
    // La pestaña Informes sigue la regla del resto de sub-vistas: sin
    // configurar se permite. Como desde el informe también se verifica lo
    // cotizado, el archivo se abre. Para cerrarlo hay que apagarla
    // expresamente, y eso lo cubre la prueba siguiente.
    Storage::fake('public');
    $rol = Role::create(['Nombre' => 'Sin Nada Cotiz', 'Estado' => true]);
    $usuario = User::factory()->create(['rol' => 'Sin Nada Cotiz']);
    Permiso::create(['role_id' => $rol->id, 'vista' => 'radicar-solicitud', 'ver' => true]);
    Permiso::create(['role_id' => $rol->id, 'vista' => 'radicar-solicitud-cotizaciones', 'ver' => false]);
    Permiso::create(['role_id' => $rol->id, 'vista' => 'radicar-solicitud-grilla', 'ver' => false]);

    $caso = RadicarCaso::create(['Ndocumento' => '9995', 'estRad' => '1']);
    $ruta = UploadedFile::fake()
        ->create('cotizacion.pdf', 20, 'application/pdf')
        ->store('cotizaciones', 'public');
    $cot = CotizacionCaso::create([
        'codrad' => $caso->codrad,
        'tercero' => 'Proveedor Uno',
        'fecha_cotizacion' => '2026-08-20',
        'valor' => 1000,
        'adjunto' => $ruta,
    ]);

    $this->actingAs($usuario)
        ->get("/tools/radicar-solicitud/cotizacion/{$cot->id}/adjunto")
        ->assertOk();
});

test('el informe trae el PDF de los conceptos cotizados en todas las filas del caso', function () {
    Storage::fake('public');
    $usuario = User::factory()->create();
    $caso = RadicarCaso::create(['Ndocumento' => '9996', 'estRad' => '1']);

    $ruta = UploadedFile::fake()
        ->create('cotizacion.pdf', 20, 'application/pdf')
        ->store('cotizaciones', 'public');
    CotizacionCaso::create([
        'codrad' => $caso->codrad,
        'tercero' => 'Proveedor Informe',
        'fecha_cotizacion' => '2026-08-20',
        'valor' => 1000,
        'adjunto' => $ruta,
    ]);
    // Sin adjunto: no hay archivo que abrir, no debe listarse.
    CotizacionCaso::create([
        'codrad' => $caso->codrad,
        'tercero' => 'Proveedor Sin PDF',
        'fecha_cotizacion' => '2026-08-21',
        'valor' => 2000,
    ]);

    // Un seguimiento para que el caso tenga más de una fila en el informe.
    SeguimientoCaso::create([
        'codrad' => $caso->codrad,
        'user_id' => $usuario->id,
        'ObservacionCCX' => 'Movimiento',
    ]);

    $filas = collect(
        $this->actingAs($usuario)
            ->getJson('/tools/radicar-solicitud/informe?consecutivo='.$caso->codrad)
            ->assertOk()
            ->json('rows')
    );

    expect($filas)->not->toBeEmpty();
    // El dato es del caso, así que acompaña a TODAS sus filas.
    $filas->each(function ($fila) {
        expect($fila['cotizaciones'])->toHaveCount(1)
            ->and($fila['cotizaciones'][0]['tercero'])->toBe('Proveedor Informe');
    });
});

test('quien ve el informe puede abrir el PDF aunque no tenga la grilla', function () {
    // Sin esto la columna nueva del informe mostraría enlaces que responden
    // 403 a los roles que solo tienen la pestaña Informes.
    Storage::fake('public');
    $rol = Role::create(['Nombre' => 'Solo Informes', 'Estado' => true]);
    $usuario = User::factory()->create(['rol' => 'Solo Informes']);
    Permiso::create(['role_id' => $rol->id, 'vista' => 'radicar-solicitud', 'ver' => true]);
    Permiso::create(['role_id' => $rol->id, 'vista' => 'radicar-solicitud-cotizaciones', 'ver' => false]);
    Permiso::create(['role_id' => $rol->id, 'vista' => 'radicar-solicitud-grilla', 'ver' => false]);
    Permiso::create(['role_id' => $rol->id, 'vista' => 'radicar-solicitud-informes', 'ver' => true]);

    $caso = RadicarCaso::create(['Ndocumento' => '9997', 'estRad' => '1']);
    $ruta = UploadedFile::fake()
        ->create('cotizacion.pdf', 20, 'application/pdf')
        ->store('cotizaciones', 'public');
    $cot = CotizacionCaso::create([
        'codrad' => $caso->codrad,
        'tercero' => 'Proveedor Uno',
        'fecha_cotizacion' => '2026-08-20',
        'valor' => 1000,
        'adjunto' => $ruta,
    ]);

    $this->actingAs($usuario)
        ->get("/tools/radicar-solicitud/cotizacion/{$cot->id}/adjunto")
        ->assertOk();
});

test('con la pestaña Informes apagada y sin grilla el PDF sigue cerrado', function () {
    Storage::fake('public');
    $rol = Role::create(['Nombre' => 'Nada De Nada', 'Estado' => true]);
    $usuario = User::factory()->create(['rol' => 'Nada De Nada']);
    Permiso::create(['role_id' => $rol->id, 'vista' => 'radicar-solicitud', 'ver' => true]);
    Permiso::create(['role_id' => $rol->id, 'vista' => 'radicar-solicitud-cotizaciones', 'ver' => false]);
    Permiso::create(['role_id' => $rol->id, 'vista' => 'radicar-solicitud-grilla', 'ver' => false]);
    Permiso::create(['role_id' => $rol->id, 'vista' => 'radicar-solicitud-informes', 'ver' => false]);

    $caso = RadicarCaso::create(['Ndocumento' => '9998', 'estRad' => '1']);
    $cot = CotizacionCaso::create([
        'codrad' => $caso->codrad,
        'tercero' => 'Proveedor Uno',
        'fecha_cotizacion' => '2026-08-20',
        'valor' => 1000,
        'adjunto' => 'cotizaciones/uno.pdf',
    ]);

    $this->actingAs($usuario)
        ->get("/tools/radicar-solicitud/cotizacion/{$cot->id}/adjunto")
        ->assertForbidden();
});
