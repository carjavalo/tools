<?php

use App\Models\Auditoria;
use App\Models\Permiso;
use App\Models\Role;
use App\Models\Serasignado;
use App\Models\User;
use App\Support\Sede;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Testing\AssertableInertia as Assert;

test('guests cannot access servicio management', function () {
    $this->get('/tools/gestion-servicios')->assertRedirect(route('login'));
});

test('la tabla serasignado tiene codigo, sede, nombre, descripcion y estado', function () {
    expect(Schema::getColumnListing('serasignado'))
        ->toEqualCanonicalizing(['codigo', 'sede', 'nombre', 'descripcion', 'estado']);
});

test('index renders the servicios page with data and stats', function () {
    $user = User::factory()->create();
    Serasignado::create(['nombre' => 'Cardiología', 'descripcion' => 'Servicio de cardiología']);
    Serasignado::create(['nombre' => 'Hemodinamia', 'estado' => false]);

    $this->actingAs($user)
        ->get('/tools/gestion-servicios')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('tools/gestion-servicios')
            ->has('servicios.data', 2)
            ->where('stats.total', 2)
            ->where('stats.activos', 1)
            ->where('stats.inactivos', 1)
        );
});

test('a servicio can be created and gets an autoincrement codigo', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->post('/tools/gestion-servicios', [
        'nombre' => 'Cirugía Cardiovascular',
        'descripcion' => 'Detalle',
        'estado' => true,
    ])->assertRedirect(route('tools.gestion-servicios'));

    $servicio = Serasignado::where('nombre', 'Cirugía Cardiovascular')->first();

    expect($servicio)->not->toBeNull()
        ->and($servicio->codigo)->toBeInt()
        ->and($servicio->descripcion)->toBe('Detalle')
        ->and($servicio->estado)->toBeTrue();
});

test('creating a servicio requires a name of at most 120 characters', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->from('/tools/gestion-servicios')
        ->post('/tools/gestion-servicios', ['descripcion' => 'Sin nombre'])
        ->assertSessionHasErrors(['nombre']);

    $this->actingAs($user)
        ->from('/tools/gestion-servicios')
        ->post('/tools/gestion-servicios', [
            'nombre' => str_repeat('a', 121),
            'descripcion' => str_repeat('b', 121),
        ])
        ->assertSessionHasErrors(['nombre', 'descripcion']);
});

test('servicio names cannot repeat', function () {
    $user = User::factory()->create();
    Serasignado::create(['nombre' => 'Hemodinamia']);

    $this->actingAs($user)
        ->from('/tools/gestion-servicios')
        ->post('/tools/gestion-servicios', ['nombre' => 'Hemodinamia', 'estado' => true])
        ->assertSessionHasErrors(['nombre']);
});

test('a servicio can be updated keeping its own name', function () {
    $user = User::factory()->create();
    $servicio = Serasignado::create(['nombre' => 'Viejo']);

    $this->actingAs($user)->put('/tools/gestion-servicios/'.$servicio->codigo, [
        'nombre' => 'Viejo',
        'descripcion' => 'Nueva descripción',
        'estado' => false,
    ])->assertRedirect(route('tools.gestion-servicios'));

    $servicio->refresh();
    expect($servicio->descripcion)->toBe('Nueva descripción')
        ->and($servicio->estado)->toBeFalse();
});

test('a servicio can be deleted', function () {
    $user = User::factory()->create();
    $servicio = Serasignado::create(['nombre' => 'Borrar']);

    $this->actingAs($user)->delete('/tools/gestion-servicios/'.$servicio->codigo)
        ->assertRedirect(route('tools.gestion-servicios'));

    $this->assertDatabaseMissing('serasignado', ['codigo' => $servicio->codigo]);
});

test('search filters the servicio listing by name or codigo', function () {
    $user = User::factory()->create();
    $uno = Serasignado::create(['nombre' => 'Urgencias']);
    Serasignado::create(['nombre' => 'Consulta externa']);

    $this->actingAs($user)
        ->get('/tools/gestion-servicios?search=Urgenc')
        ->assertInertia(fn (Assert $page) => $page
            ->has('servicios.data', 1)
            ->where('servicios.data.0.nombre', 'Urgencias')
        );

    $this->actingAs($user)
        ->get('/tools/gestion-servicios?search='.$uno->codigo)
        ->assertInertia(fn (Assert $page) => $page
            ->where('servicios.data.0.codigo', $uno->codigo)
        );
});

test('un servicio nuevo queda activo por defecto en la base', function () {
    $servicio = Serasignado::create(['nombre' => 'Sin estado']);

    expect($servicio->refresh()->estado)->toBeTrue();
});

test('creating a servicio requires the estado', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->from('/tools/gestion-servicios')
        ->post('/tools/gestion-servicios', ['nombre' => 'Sin estado'])
        ->assertSessionHasErrors(['estado']);
});

test('gestion servicios queda en el Gestor de Permisos despues de usuarios', function () {
    $claves = collect(Permiso::VISTAS)->pluck('key')->values();

    expect($claves->search('gestion-servicios'))
        ->toBe($claves->search('gestion-usuarios') + 1);
});

test('crear un servicio queda en la bitacora', function () {
    // El Super Admin queda fuera de la bitácora por diseño: se usa un Operador.
    $user = User::factory()->create(['rol' => 'Operador']);

    $this->actingAs($user)->post('/tools/gestion-servicios', ['nombre' => 'Auditado', 'estado' => true]);

    expect(Auditoria::where('evento', 'creacion')->where('descripcion', 'like', '%servicio%')->exists())->toBeTrue();
});

/** Servicio puesto directamente en una sede, sin pasar por la sesión. */
function servicioEnSede(string $sede, string $nombre): Serasignado
{
    return Serasignado::withoutGlobalScope('sede')
        ->forceCreate(['nombre' => $nombre, 'estado' => true, 'sede' => $sede]);
}

/**
 * Operador que entra a Cali y a Cartago. Un rol normal: trabaja solo en la
 * sede activa, a diferencia del Super Admin.
 */
function operadorDeDosSedes(): User
{
    $role = Role::firstOrCreate(['Nombre' => 'Operador'], ['Estado' => true]);

    foreach ([Sede::CALI, Sede::CARTAGO] as $sede) {
        DB::table('role_sedes')->insertOrIgnore([
            'role_id' => $role->id,
            'sede' => $sede,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    return User::factory()->create(['rol' => 'Operador']);
}

test('un rol normal crea en la sede por la que ingreso y no la escoge desde la peticion', function () {
    $this->actingAs(operadorDeDosSedes())
        ->withSession(['sede' => Sede::CARTAGO])
        ->post('/tools/gestion-servicios', ['nombre' => 'Hemodinamia', 'estado' => true, 'sede' => Sede::CALI])
        ->assertRedirect(route('tools.gestion-servicios'));

    $this->assertDatabaseHas('serasignado', ['nombre' => 'Hemodinamia', 'sede' => Sede::CARTAGO]);
});

test('un rol normal solo ve y cuenta los servicios de su sede', function () {
    $operador = operadorDeDosSedes();
    servicioEnSede(Sede::CALI, 'Servicio Cali');
    servicioEnSede(Sede::CARTAGO, 'Servicio Cartago');
    servicioEnSede(Sede::CARTAGO, 'Otro Cartago');

    $this->actingAs($operador)->withSession(['sede' => Sede::CALI])
        ->get('/tools/gestion-servicios')
        ->assertInertia(fn (Assert $page) => $page
            ->has('servicios.data', 1)
            ->where('servicios.data.0.nombre', 'Servicio Cali')
            // La vista la muestra en la columna Sede.
            ->where('servicios.data.0.sede', Sede::CALI)
            ->where('stats.total', 1)
            ->where('puedeEscogerSede', false)
        );

    // Aunque pida la otra sede por la URL, sigue viendo solo la suya.
    $this->actingAs($operador)->withSession(['sede' => Sede::CARTAGO])
        ->get('/tools/gestion-servicios?sede='.Sede::CALI)
        ->assertInertia(fn (Assert $page) => $page
            ->has('servicios.data', 2)
            ->where('stats.total', 2)
        );
});

test('un rol normal no edita ni borra un servicio de la otra sede', function () {
    $operador = operadorDeDosSedes();
    $cartago = servicioEnSede(Sede::CARTAGO, 'De Cartago');

    $this->actingAs($operador)->withSession(['sede' => Sede::CALI])
        ->put('/tools/gestion-servicios/'.$cartago->codigo, ['nombre' => 'Cambiado', 'estado' => false])
        ->assertNotFound();

    $this->actingAs($operador)->withSession(['sede' => Sede::CALI])
        ->delete('/tools/gestion-servicios/'.$cartago->codigo)
        ->assertNotFound();

    $this->assertDatabaseHas('serasignado', ['codigo' => $cartago->codigo, 'nombre' => 'De Cartago']);
});

test('el mismo nombre puede existir en las dos sedes pero no repetirse en una', function () {
    $operador = operadorDeDosSedes();
    servicioEnSede(Sede::CALI, 'Hemodinamia');

    $this->actingAs($operador)->withSession(['sede' => Sede::CARTAGO])
        ->post('/tools/gestion-servicios', ['nombre' => 'Hemodinamia', 'estado' => true])
        ->assertSessionHasNoErrors();

    $this->actingAs($operador)->withSession(['sede' => Sede::CALI])
        ->from('/tools/gestion-servicios')
        ->post('/tools/gestion-servicios', ['nombre' => 'Hemodinamia', 'estado' => true])
        ->assertSessionHasErrors(['nombre']);
});

test('el Super Admin ve las dos sedes y puede filtrar por una', function () {
    $admin = User::factory()->create();
    servicioEnSede(Sede::CALI, 'Servicio Cali');
    servicioEnSede(Sede::CARTAGO, 'Servicio Cartago');

    $this->actingAs($admin)->withSession(['sede' => Sede::CALI])
        ->get('/tools/gestion-servicios')
        ->assertInertia(fn (Assert $page) => $page
            ->has('servicios.data', 2)
            ->where('stats.total', 2)
            ->where('puedeEscogerSede', true)
            ->has('sedes', 2)
        );

    $this->actingAs($admin)->withSession(['sede' => Sede::CALI])
        ->get('/tools/gestion-servicios?sede='.Sede::CARTAGO)
        ->assertInertia(fn (Assert $page) => $page
            ->has('servicios.data', 1)
            ->where('servicios.data.0.nombre', 'Servicio Cartago')
            ->where('stats.total', 1)
            ->where('filters.sede', Sede::CARTAGO)
        );
});

test('el Super Admin escoge la sede al crear', function () {
    $this->actingAs(User::factory()->create())
        ->withSession(['sede' => Sede::CALI])
        ->post('/tools/gestion-servicios', ['nombre' => 'Hemodinamia', 'estado' => true, 'sede' => Sede::CARTAGO])
        ->assertRedirect(route('tools.gestion-servicios'));

    $this->assertDatabaseHas('serasignado', ['nombre' => 'Hemodinamia', 'sede' => Sede::CARTAGO]);
});

test('el Super Admin mueve un servicio de sede y lo edita aunque sea de la otra', function () {
    $admin = User::factory()->create();
    $servicio = servicioEnSede(Sede::CARTAGO, 'Movible');

    $this->actingAs($admin)->withSession(['sede' => Sede::CALI])
        ->put('/tools/gestion-servicios/'.$servicio->codigo, ['nombre' => 'Movible', 'estado' => true, 'sede' => Sede::CALI])
        ->assertRedirect(route('tools.gestion-servicios'));

    $this->assertDatabaseHas('serasignado', ['codigo' => $servicio->codigo, 'sede' => Sede::CALI]);

    // Sin mandar sede (el interruptor de estado) conserva la que tiene.
    $this->actingAs($admin)->withSession(['sede' => Sede::CARTAGO])
        ->put('/tools/gestion-servicios/'.$servicio->codigo, ['nombre' => 'Movible', 'estado' => false])
        ->assertRedirect(route('tools.gestion-servicios'));

    $this->assertDatabaseHas('serasignado', ['codigo' => $servicio->codigo, 'sede' => Sede::CALI, 'estado' => false]);
});

test('el Super Admin no puede usar una sede que no existe', function () {
    $this->actingAs(User::factory()->create())
        ->from('/tools/gestion-servicios')
        ->post('/tools/gestion-servicios', ['nombre' => 'X', 'estado' => true, 'sede' => 'bogota'])
        ->assertSessionHasErrors(['sede']);

    $this->assertDatabaseMissing('serasignado', ['nombre' => 'X']);
});
