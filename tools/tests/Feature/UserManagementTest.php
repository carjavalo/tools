<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('guests cannot access user management', function () {
    $this->get('/tools/gestion-usuarios')->assertRedirect(route('login'));
});

test('index renders the user management page with users', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get('/tools/gestion-usuarios')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('tools/gestion-usuarios')
            ->has('users')
        );
});

test('a user can be created', function () {
    $admin = User::factory()->create();

    $response = $this->actingAs($admin)->post('/tools/gestion-usuarios', [
        'name' => 'Juan',
        'rol' => 'Operador',
        'Apellido1' => 'Pérez',
        'apellido2' => 'Gómez',
        'tipo_Docu' => 'CC',
        'Numero_D' => '123456789',
        'email' => 'juan.perez@example.com',
        'Telefono1' => '3001234567',
        'telefono2' => '',
        'Direccion' => 'Calle 1 # 2-3',
        'Eps' => 'Sura',
        'password' => 'password',
        'password_confirmation' => 'password',
    ]);

    $response->assertRedirect(route('tools.gestion-usuarios'));
    $response->assertSessionHas('success');

    $this->assertDatabaseHas('users', [
        'email' => 'juan.perez@example.com',
        'name' => 'Juan',
        'Apellido1' => 'Pérez',
        'tipo_Docu' => 'CC',
        'Numero_D' => '123456789',
    ]);

    expect(User::where('email', 'juan.perez@example.com')->first()->email_verified_at)
        ->not->toBeNull();
});

test('creating a user requires name, email and password', function () {
    $admin = User::factory()->create();

    $this->actingAs($admin)
        ->from('/tools/gestion-usuarios')
        ->post('/tools/gestion-usuarios', [])
        ->assertSessionHasErrors(['name', 'email', 'password']);
});

test('email must be unique when creating', function () {
    $admin = User::factory()->create();
    User::factory()->create(['email' => 'taken@example.com']);

    $this->actingAs($admin)
        ->from('/tools/gestion-usuarios')
        ->post('/tools/gestion-usuarios', [
            'name' => 'X',
            'email' => 'taken@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ])
        ->assertSessionHasErrors(['email']);
});

test('a user can be updated without changing the password', function () {
    $admin = User::factory()->create();
    $target = User::factory()->create([
        'name' => 'Old',
        'email' => 'old@example.com',
    ]);
    $originalPassword = $target->password;

    $this->actingAs($admin)
        ->put('/tools/gestion-usuarios/'.$target->id, [
            'name' => 'Nuevo Nombre',
            'rol' => 'Operador',
            'email' => 'old@example.com',
            'password' => '',
            'password_confirmation' => '',
        ])
        ->assertRedirect(route('tools.gestion-usuarios'));

    $target->refresh();
    expect($target->name)->toBe('Nuevo Nombre');
    expect($target->password)->toBe($originalPassword);
});

test('a user can be updated with a new password', function () {
    $admin = User::factory()->create();
    $target = User::factory()->create();
    $originalPassword = $target->password;

    $this->actingAs($admin)
        ->put('/tools/gestion-usuarios/'.$target->id, [
            'name' => $target->name,
            'rol' => $target->rol,
            'email' => $target->email,
            'password' => 'nuevaclave',
            'password_confirmation' => 'nuevaclave',
        ])
        ->assertRedirect(route('tools.gestion-usuarios'));

    $target->refresh();
    expect($target->password)->not->toBe($originalPassword);
});

test('a user can be deleted', function () {
    $admin = User::factory()->create();
    $target = User::factory()->create();

    $this->actingAs($admin)
        ->delete('/tools/gestion-usuarios/'.$target->id)
        ->assertRedirect(route('tools.gestion-usuarios'));

    $this->assertDatabaseMissing('users', ['id' => $target->id]);
});

test('a user cannot delete their own account', function () {
    $admin = User::factory()->create();

    $this->actingAs($admin)
        ->delete('/tools/gestion-usuarios/'.$admin->id)
        ->assertSessionHas('error');

    $this->assertDatabaseHas('users', ['id' => $admin->id]);
});

test('the user listing is paginated with a selectable page size', function () {
    $admin = User::factory()->create();
    User::factory()->count(20)->create();

    // 21 usuarios en total; el tamaño por defecto es 12.
    $this->actingAs($admin)
        ->get('/tools/gestion-usuarios')
        ->assertInertia(fn (Assert $page) => $page
            ->has('users.data', 12)
            ->where('users.total', 21)
            ->where('users.last_page', 2)
            ->where('filters.perPage', 12)
        );

    // perPage = 24 trae los 21 en una sola página.
    $this->actingAs($admin)
        ->get('/tools/gestion-usuarios?perPage=24')
        ->assertInertia(fn (Assert $page) => $page
            ->has('users.data', 21)
            ->where('users.last_page', 1)
            ->where('filters.perPage', 24)
        );
});

test('an invalid page size falls back to 12', function () {
    $admin = User::factory()->create();

    $this->actingAs($admin)
        ->get('/tools/gestion-usuarios?perPage=999')
        ->assertInertia(fn (Assert $page) => $page
            ->where('filters.perPage', 12)
        );
});

test('search filters the user listing', function () {
    $admin = User::factory()->create(['name' => 'Zoraida']);
    User::factory()->create(['name' => 'Otro', 'email' => 'otro@example.com']);

    $this->actingAs($admin)
        ->get('/tools/gestion-usuarios?search=Zoraida')
        ->assertInertia(fn (Assert $page) => $page
            ->where('users.total', 1)
            ->where('users.data.0.name', 'Zoraida')
        );
});

test('a non super admin does not see super admin users in the listing', function () {
    $operador = User::factory()->create(['rol' => 'Operador']);
    User::factory()->create(['rol' => 'Super Admin', 'name' => 'Root']);
    User::factory()->create(['rol' => 'Medico', 'name' => 'Medico Uno']);

    // Ve al operador y al médico, pero NO al Super Admin.
    $this->actingAs($operador)
        ->get('/tools/gestion-usuarios')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('users.total', 2));
});

test('a super admin does see super admin users in the listing', function () {
    $admin = User::factory()->create(); // Super Admin por defecto
    User::factory()->create(['rol' => 'Super Admin', 'name' => 'Otro Root']);

    $this->actingAs($admin)
        ->get('/tools/gestion-usuarios')
        ->assertInertia(fn (Assert $page) => $page->where('users.total', 2));
});

test('the roles select hides super admin for a non super admin', function () {
    $operador = User::factory()->create(['rol' => 'Operador']);

    // 4 roles activos sembrados; el operador no debe ver "Super Admin".
    $this->actingAs($operador)
        ->get('/tools/gestion-usuarios')
        ->assertInertia(fn (Assert $page) => $page->has('rolesList', 3));
});

test('a non super admin cannot see or update a super admin user', function () {
    $operador = User::factory()->create(['rol' => 'Operador']);
    $root = User::factory()->create(['rol' => 'Super Admin', 'name' => 'Root']);

    $this->actingAs($operador)
        ->put('/tools/gestion-usuarios/'.$root->id, [
            'name' => 'Hackeado',
            'rol' => 'Operador',
            'email' => $root->email,
        ])
        ->assertNotFound();

    expect($root->fresh()->name)->toBe('Root');
});

test('a non super admin cannot delete a super admin user', function () {
    $operador = User::factory()->create(['rol' => 'Operador']);
    $root = User::factory()->create(['rol' => 'Super Admin']);

    $this->actingAs($operador)
        ->delete('/tools/gestion-usuarios/'.$root->id)
        ->assertNotFound();

    $this->assertDatabaseHas('users', ['id' => $root->id]);
});

test('a non super admin cannot create a super admin user', function () {
    $operador = User::factory()->create(['rol' => 'Operador']);

    $this->actingAs($operador)
        ->from('/tools/gestion-usuarios')
        ->post('/tools/gestion-usuarios', [
            'name' => 'Intruso',
            'rol' => 'Super Admin',
            'email' => 'intruso@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ])
        ->assertSessionHasErrors(['rol']);

    $this->assertDatabaseMissing('users', ['email' => 'intruso@example.com']);
});

test('a non super admin cannot promote an existing user to super admin', function () {
    $operador = User::factory()->create(['rol' => 'Operador']);
    $target = User::factory()->create(['rol' => 'Medico']);

    $this->actingAs($operador)
        ->from('/tools/gestion-usuarios')
        ->put('/tools/gestion-usuarios/'.$target->id, [
            'name' => $target->name,
            'rol' => 'Super Admin',
            'email' => $target->email,
        ])
        ->assertSessionHasErrors(['rol']);

    expect($target->fresh()->rol)->toBe('Medico');
});
