<?php

use App\Models\Auditoria;
use App\Models\Permiso;
use App\Models\Serasignado;
use App\Models\User;
use Illuminate\Support\Facades\Schema;
use Inertia\Testing\AssertableInertia as Assert;

test('guests cannot access servicio management', function () {
    $this->get('/tools/gestion-servicios')->assertRedirect(route('login'));
});

test('la tabla serasignado tiene codigo, nombre, descripcion y estado', function () {
    expect(Schema::getColumnListing('serasignado'))
        ->toEqualCanonicalizing(['codigo', 'nombre', 'descripcion', 'estado']);
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
