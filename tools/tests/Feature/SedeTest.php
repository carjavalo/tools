<?php

use App\Models\Convenio;
use App\Models\CotizacionCaso;
use App\Models\Cups;
use App\Models\Eps;
use App\Models\ProgramacionCaso;
use App\Models\RadicarCaso;
use App\Models\Role;
use App\Models\User;
use App\Support\Sede;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

// Radicaciones por sede. La opción por la que se ingresa (Programación de
// Cirugía Sede Cali o Sede Cartago) define la sede activa de la sesión: lo
// radicado queda en ella y solo se ven sus radicaciones. Qué sedes tiene cada
// rol se configura en el Gestor de Permisos; sin configurar, solo Cali.

/** Radicación puesta directamente en una sede, sin pasar por la sesión. */
function casoEnSede(string $sede, array $datos = []): RadicarCaso
{
    return RadicarCaso::withoutGlobalScope('sede')
        ->forceCreate(array_merge(['estRad' => '1'], $datos, ['sede' => $sede]));
}

/** Usuario de un rol con las sedes dadas guardadas en el Gestor de Permisos. */
function usuarioConSedes(string $rol, array $sedes): User
{
    $role = Role::firstOrCreate(['Nombre' => $rol], ['Estado' => true]);

    foreach ($sedes as $sede) {
        DB::table('role_sedes')->insert([
            'role_id' => $role->id,
            'sede' => $sede,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    return User::factory()->create(['rol' => $rol]);
}

/** Datos válidos de una Nueva Radicación, con sus catálogos creados. */
function payloadRadicacion(string $documento): array
{
    $medico = User::factory()->create(['rol' => 'Medico']);
    User::factory()->create(['rol' => 'paciente', 'Numero_D' => $documento]);
    Eps::firstOrCreate(['nit_empresa' => '900100'], ['Nombre' => 'EPS Prueba', 'Estado' => true]);
    $convenio = Convenio::firstOrCreate(['nit_Convenio' => 'CONV-1'], [
        'nombre' => 'Convenio Prueba',
        'regimen' => 'Contributivo',
        'tarifa' => 'SOAT',
        'nit_empresa' => '900100',
    ]);
    $cups = Cups::create(['Nombre' => 'Procedimiento Uno', 'Estado' => true]);

    return [
        'Codesp' => '01',
        'codMed' => (string) $medico->id,
        'Ndocumento' => $documento,
        'convenio' => $convenio->nit_Convenio,
        'copago' => false,
        'estRad' => '1',
        'fentregapro' => '2026-09-10',
        'fecAutorizacion' => '2026-09-01',
        'fechavenautorizacion' => '2026-12-01',
        'ObservacionTFX' => 'Observación TFX',
        'ObservacionCCX' => 'Observación CCX',
        'procedimientos' => [
            ['cusv_id' => $cups->id, 'N_Autorizacion' => 'AUT-1'],
        ],
    ];
}

test('lo radicado queda en la sede por la que se ingreso', function () {
    $this->actingAs(User::factory()->create())
        ->withSession(['sede' => Sede::CARTAGO])
        ->post('/tools/radicar-solicitud', payloadRadicacion('7001'))
        ->assertRedirect(route('tools.radicar-solicitud'))
        ->assertSessionHas('success', fn (string $mensaje) => str_contains($mensaje, 'Sede Cartago'));

    $this->assertDatabaseHas('RadicarCaso', ['Ndocumento' => '7001', 'sede' => Sede::CARTAGO]);
});

test('la sede no se puede escoger desde la peticion', function () {
    // Manda la sede de la sesión: si la petición pudiera escogerla, se
    // radicaría en una sede a la que el rol no entra.
    $this->actingAs(User::factory()->create())
        ->withSession(['sede' => Sede::CALI])
        ->post('/tools/radicar-solicitud', [...payloadRadicacion('7002'), 'sede' => Sede::CARTAGO])
        ->assertRedirect(route('tools.radicar-solicitud'));

    $this->assertDatabaseHas('RadicarCaso', ['Ndocumento' => '7002', 'sede' => Sede::CALI]);
});

test('cada sede solo ve sus radicaciones en la grilla y en la busqueda', function () {
    $admin = User::factory()->create();
    $cali = casoEnSede(Sede::CALI, ['Ndocumento' => '8001']);
    $cartago = casoEnSede(Sede::CARTAGO, ['Ndocumento' => '8002']);

    $this->actingAs($admin)->withSession(['sede' => Sede::CALI])
        ->get('/tools/radicar-solicitud')
        ->assertInertia(fn (Assert $page) => $page
            ->has('casosLista', 1)
            ->where('casosLista.0.codrad', $cali->codrad)
            ->where('auth.sede.clave', Sede::CALI)
        );

    $this->getJson("/tools/radicar-solicitud/buscar-caso?q={$cartago->codrad}")
        ->assertJson(['found' => false]);
    $this->getJson('/tools/radicar-solicitud/buscar-caso?q=8002')
        ->assertJson(['found' => false]);
    $this->getJson("/tools/radicar-solicitud/buscar-caso?q={$cali->codrad}")
        ->assertJson(['found' => true]);

    $this->actingAs($admin)->withSession(['sede' => Sede::CARTAGO])
        ->getJson("/tools/radicar-solicitud/buscar-caso?q={$cali->codrad}")
        ->assertJson(['found' => false]);
    $this->getJson("/tools/radicar-solicitud/buscar-caso?q={$cartago->codrad}")
        ->assertJson(['found' => true]);
});

test('el informe solo trae radicaciones de la sede activa', function () {
    $admin = User::factory()->create();
    $cali = casoEnSede(Sede::CALI, ['Ndocumento' => '8101']);
    casoEnSede(Sede::CARTAGO, ['Ndocumento' => '8102']);

    $rows = $this->actingAs($admin)->withSession(['sede' => Sede::CALI])
        ->getJson('/tools/radicar-solicitud/informe')
        ->assertOk()
        ->json('rows');

    expect(collect($rows)->pluck('codrad')->unique()->values()->all())->toBe([$cali->codrad]);
});

test('una radicacion de la otra sede no se alcanza por su url', function () {
    $admin = User::factory()->create();
    $cartago = casoEnSede(Sede::CARTAGO, ['Ndocumento' => '8201']);

    $this->actingAs($admin)->withSession(['sede' => Sede::CALI]);

    $this->putJson("/tools/radicar-solicitud/{$cartago->codrad}", [])->assertNotFound();
    $this->postJson("/tools/radicar-solicitud/{$cartago->codrad}/seguimiento", [])->assertNotFound();
    $this->deleteJson("/tools/radicar-solicitud/{$cartago->codrad}")->assertNotFound();

    expect(RadicarCaso::withoutGlobalScope('sede')->find($cartago->codrad))->not->toBeNull();

    // Desde su propia sede sí se alcanza.
    $this->actingAs($admin)->withSession(['sede' => Sede::CARTAGO])
        ->deleteJson("/tools/radicar-solicitud/{$cartago->codrad}")
        ->assertOk();
});

test('ver programados y sus botones solo alcanzan la sede activa', function () {
    $admin = User::factory()->create();
    $progCali = ProgramacionCaso::create(['codrad' => casoEnSede(Sede::CALI)->codrad]);
    $progCartago = ProgramacionCaso::create(['codrad' => casoEnSede(Sede::CARTAGO)->codrad]);

    $rows = $this->actingAs($admin)->withSession(['sede' => Sede::CALI])
        ->getJson('/tools/radicar-solicitud/programados')
        ->assertOk()
        ->json('rows');

    expect(collect($rows)->pluck('id')->all())->toBe([$progCali->id]);

    $this->putJson("/tools/radicar-solicitud/programacion/{$progCartago->id}", [])->assertNotFound();
    $this->deleteJson("/tools/radicar-solicitud/programacion/{$progCartago->id}")->assertNotFound();

    expect(ProgramacionCaso::withoutGlobalScope('sede')->find($progCartago->id))->not->toBeNull();
});

test('el pdf de una cotizacion solo se abre desde la sede de su radicacion', function () {
    Storage::fake(config('filesystems.default'));
    Storage::disk(config('filesystems.default'))->put('cotizaciones/cartago.pdf', '%PDF-1.4');

    $admin = User::factory()->create();
    $cotizacion = CotizacionCaso::create([
        'codrad' => casoEnSede(Sede::CARTAGO)->codrad,
        'tercero' => 'Proveedor',
        'fecha_cotizacion' => '2026-09-01',
        'valor' => 1000,
        'adjunto' => 'cotizaciones/cartago.pdf',
    ]);

    $this->actingAs($admin)->withSession(['sede' => Sede::CALI])
        ->get("/tools/radicar-solicitud/cotizacion/{$cotizacion->id}/adjunto")
        ->assertNotFound();

    $this->actingAs($admin)->withSession(['sede' => Sede::CARTAGO])
        ->get("/tools/radicar-solicitud/cotizacion/{$cotizacion->id}/adjunto")
        ->assertOk();
});

test('cambiar la cedula de un paciente repunta sus radicaciones de las dos sedes', function () {
    // El paciente es de ambas sedes: editarlo desde Cali no puede dejar
    // huérfanas sus radicaciones de Cartago.
    Role::firstOrCreate(['Nombre' => 'paciente'], ['Estado' => true]);
    $admin = User::factory()->create();
    $paciente = User::factory()->create(['rol' => 'paciente', 'Numero_D' => '9001']);
    $cali = casoEnSede(Sede::CALI, ['Ndocumento' => '9001']);
    $cartago = casoEnSede(Sede::CARTAGO, ['Ndocumento' => '9001']);

    $this->actingAs($admin)->withSession(['sede' => Sede::CALI])
        ->putJson("/tools/radicar-solicitud/paciente/{$paciente->id}", [
            'name' => $paciente->name,
            'rol' => 'paciente',
            'email' => $paciente->email,
            'Numero_D' => '9002',
        ])
        ->assertOk();

    expect(RadicarCaso::withoutGlobalScope('sede')->find($cali->codrad)->Ndocumento)->toBe('9002')
        ->and(RadicarCaso::withoutGlobalScope('sede')->find($cartago->codrad)->Ndocumento)->toBe('9002');
});

test('un rol sin configurar solo ingresa por la sede cali', function () {
    $user = usuarioConSedes('Gestor Radicación', []);

    $this->from('/tools/programacion-cirugia-cartago')
        ->post('/tools/programacion-cirugia-cartago', [
            'email' => $user->email,
            'password' => 'password',
        ])
        ->assertRedirect('/tools/programacion-cirugia-cartago')
        ->assertSessionHasErrors(['email' => 'Tu rol no tiene acceso a la Sede Cartago. Ingresa por la opción Programación de Cirugía Sede Cali.']);

    $this->assertGuest();

    $this->post(route('login.store'), [
        'email' => $user->email,
        'password' => 'password',
    ])->assertRedirect(route('dashboard', absolute: false));

    $this->assertAuthenticatedAs($user);
    expect(session('sede'))->toBe(Sede::CALI);
});

test('un rol con cartago habilitada ingresa por cartago y trabaja en esa sede', function () {
    $user = usuarioConSedes('Gestor Cartago', [Sede::CARTAGO]);

    $this->post('/tools/programacion-cirugia-cartago', [
        'email' => $user->email,
        'password' => 'password',
    ])->assertRedirect(route('dashboard', absolute: false));

    $this->assertAuthenticatedAs($user);
    expect(session('sede'))->toBe(Sede::CARTAGO);

    $this->get('/dashboard')
        ->assertInertia(fn (Assert $page) => $page
            ->where('auth.sede.clave', Sede::CARTAGO)
            ->where('auth.sede.nombre', 'Sede Cartago')
        );
});

test('un rol solo de cartago no ingresa por el login de cali', function () {
    $user = usuarioConSedes('Gestor Cartago', [Sede::CARTAGO]);

    $this->from(route('login'))
        ->post(route('login.store'), [
            'email' => $user->email,
            'password' => 'password',
        ])
        ->assertSessionHasErrors(['email' => 'Tu rol no tiene acceso a la Sede Cali. Ingresa por la opción Programación de Cirugía Sede Cartago.']);

    $this->assertGuest();
});

test('con sesion, entrar por la otra opcion cambia de sede si el rol la tiene', function () {
    $user = usuarioConSedes('Gestor Ambas', [Sede::CALI, Sede::CARTAGO]);

    $this->actingAs($user)->withSession(['sede' => Sede::CALI])
        ->get('/tools/programacion-cirugia-cartago')
        ->assertRedirect(route('dashboard'))
        ->assertSessionHas('success', 'Ahora trabajas en la Sede Cartago.');

    expect(session('sede'))->toBe(Sede::CARTAGO);

    $this->get('/tools/programacion-cirugia-cali')->assertRedirect(route('dashboard'));

    expect(session('sede'))->toBe(Sede::CALI);
});

test('con sesion, la opcion de una sede que el rol no tiene no cambia de sede', function () {
    $user = usuarioConSedes('Gestor Radicación', []);

    $this->actingAs($user)->withSession(['sede' => Sede::CALI])
        ->get('/tools/programacion-cirugia-cartago')
        ->assertRedirect(route('dashboard'))
        ->assertSessionHas('error');

    expect(session('sede'))->toBe(Sede::CALI);
});

test('sin sesion, la opcion de cali lleva al login', function () {
    $this->get('/tools/programacion-cirugia-cali')->assertRedirect(route('login'));
});

test('una sesion sin sede toma la primera que el rol tenga', function () {
    // Pasa con las sesiones abiertas antes de existir las sedes o restauradas
    // por "Recordarme": no traen sede.
    $user = usuarioConSedes('Gestor Cartago', [Sede::CARTAGO]);

    $this->actingAs($user)->get('/dashboard')
        ->assertInertia(fn (Assert $page) => $page->where('auth.sede.clave', Sede::CARTAGO));

    expect(session('sede'))->toBe(Sede::CARTAGO);
});

test('pacientes, medicos y el super admin son de las dos sedes', function () {
    $ambas = [Sede::CALI, Sede::CARTAGO];

    expect(Sede::permitidasPara(User::factory()->make(['rol' => 'paciente'])))->toBe($ambas)
        ->and(Sede::permitidasPara(User::factory()->make(['rol' => 'Medico'])))->toBe($ambas)
        ->and(Sede::permitidasPara(User::factory()->make(['rol' => 'Super Admin'])))->toBe($ambas)
        ->and(Sede::permitidasPara(User::factory()->make(['rol' => 'Rol Sin Configurar'])))->toBe([Sede::CALI]);
});

test('el gestor de permisos guarda las sedes del rol', function () {
    $admin = User::factory()->create();
    $role = Role::firstOrCreate(['Nombre' => 'Gestor Radicación'], ['Estado' => true]);
    $permisos = ['programacion-cirugia' => ['ver' => true, 'crear' => false, 'editar' => false, 'borrar' => false]];

    $this->actingAs($admin)
        ->get("/tools/gestor-permisos?role={$role->id}")
        ->assertInertia(fn (Assert $page) => $page
            ->where('sedesRol', [Sede::CALI])
            ->where('sedesFijas', false)
        );

    $this->post("/tools/gestor-permisos/{$role->id}", [
        'permisos' => $permisos,
        'sedes' => [Sede::CALI, Sede::CARTAGO],
    ])->assertRedirect(route('tools.gestor-permisos', ['role' => $role->id]));

    expect(Sede::delRol($role))->toBe([Sede::CALI, Sede::CARTAGO]);

    // Sin ninguna sede el rol no podría ingresar: no se guarda.
    $this->post("/tools/gestor-permisos/{$role->id}", [
        'permisos' => $permisos,
        'sedes' => [],
    ])->assertSessionHasErrors(['sedes']);

    expect(Sede::delRol($role))->toBe([Sede::CALI, Sede::CARTAGO]);
});

test('el gestor de permisos no configura sedes para medicos', function () {
    $admin = User::factory()->create();
    $medico = Role::firstOrCreate(['Nombre' => 'Medico'], ['Estado' => true]);

    $this->actingAs($admin)
        ->get("/tools/gestor-permisos?role={$medico->id}")
        ->assertInertia(fn (Assert $page) => $page
            ->where('sedesRol', [Sede::CALI, Sede::CARTAGO])
            ->where('sedesFijas', true)
        );
});
