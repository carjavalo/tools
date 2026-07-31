<?php

use App\Models\TipoDocumento;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('the migration seeds the default document types', function () {
    expect(TipoDocumento::count())->toBe(6);
    $this->assertDatabaseHas('tipo_documento', ['Nombre' => 'Cédula de Ciudadanía']);
    $this->assertDatabaseHas('tipo_documento', ['Nombre' => 'Pasaporte']);
    $this->assertDatabaseHas('tipo_documento', ['Nombre' => 'NIT']);
});

test('guests cannot access tipo documento management', function () {
    $this->get('/tools/gestion-tipo-documento')->assertRedirect(route('login'));
});

test('index renders the tipo documento page with data and stats', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get('/tools/gestion-tipo-documento')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('tools/gestion-tipo-documento')
            ->has('tipos.data')
            ->where('stats.total', 6)
            ->where('stats.activas', 6)
        );
});

test('a tipo documento can be created', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->post('/tools/gestion-tipo-documento', [
        'Nombre' => 'Permiso Especial',
        'Estado' => true,
        'Observacion' => 'PEP',
    ])->assertRedirect(route('tools.gestion-tipo-documento'));

    $this->assertDatabaseHas('tipo_documento', ['Nombre' => 'Permiso Especial']);
});

test('creating a tipo documento requires a name', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->from('/tools/gestion-tipo-documento')
        ->post('/tools/gestion-tipo-documento', ['Estado' => true])
        ->assertSessionHasErrors(['Nombre']);
});

test('a tipo documento can be updated', function () {
    $user = User::factory()->create();
    $tipo = TipoDocumento::create(['Nombre' => 'Viejo', 'Estado' => true]);

    $this->actingAs($user)->put('/tools/gestion-tipo-documento/'.$tipo->id, [
        'Nombre' => 'Nuevo',
        'Estado' => false,
    ])->assertRedirect(route('tools.gestion-tipo-documento'));

    $tipo->refresh();
    expect($tipo->Nombre)->toBe('Nuevo');
    expect($tipo->Estado)->toBeFalse();
});

test('a tipo documento can be deleted', function () {
    $user = User::factory()->create();
    $tipo = TipoDocumento::create(['Nombre' => 'Borrar', 'Estado' => true]);

    $this->actingAs($user)->delete('/tools/gestion-tipo-documento/'.$tipo->id)
        ->assertRedirect(route('tools.gestion-tipo-documento'));

    $this->assertDatabaseMissing('tipo_documento', ['id' => $tipo->id]);
});

test('the tipo documento listing is paginated', function () {
    $user = User::factory()->create();
    // ya existen 6 sembrados; agregamos 4 -> 10 en total
    foreach (range(1, 4) as $i) {
        TipoDocumento::create(['Nombre' => 'Extra '.$i, 'Estado' => true]);
    }

    $this->actingAs($user)
        ->get('/tools/gestion-tipo-documento')
        ->assertInertia(fn (Assert $page) => $page
            ->has('tipos.data', 8)
            ->where('tipos.total', 10)
            ->where('tipos.last_page', 2)
        );
});

test('user management shares active document types for its select', function () {
    $user = User::factory()->create();
    TipoDocumento::create(['Nombre' => 'Inactivo', 'Estado' => false]);

    $this->actingAs($user)
        ->get('/tools/gestion-usuarios')
        ->assertInertia(fn (Assert $page) => $page
            ->has('tiposDocumento', 6) // solo activos (los 6 sembrados)
        );
});

test('the register page shares active document types', function () {
    TipoDocumento::create(['Nombre' => 'Inactivo', 'Estado' => false]);

    $this->get('/register')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('auth/register')
            ->has('tiposDocumento', 6)
        );
});

test('a user can be created with a document type name from the table', function () {
    $admin = User::factory()->create();

    $this->actingAs($admin)->post('/tools/gestion-usuarios', [
        'name' => 'Carlos',
        'rol' => 'Operador',
        'tipo_Docu' => 'Cédula de Ciudadanía',
        'email' => 'carlos.td@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
    ])->assertRedirect(route('tools.gestion-usuarios'));

    $this->assertDatabaseHas('users', [
        'email' => 'carlos.td@example.com',
        'tipo_Docu' => 'Cédula de Ciudadanía',
    ]);
});
