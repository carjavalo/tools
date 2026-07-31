<?php

use App\Models\User;

$managementRoutes = [
    '/tools/programacion-cirugia',
    '/tools/gestion-usuarios',
    '/tools/gestion-eps',
    '/tools/gestion-especialidades',
];

test('a newly registered user gets the paciente role', function () {
    $this->post('/register', [
        'name' => 'Ana',
        'email' => 'ana@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
    ]);

    $this->assertDatabaseHas('users', [
        'email' => 'ana@example.com',
        'rol' => 'paciente',
    ]);
});

test('a paciente can access the dashboard', function () {
    $paciente = User::factory()->paciente()->create();

    $this->actingAs($paciente)->get('/dashboard')->assertOk();
});

test('a paciente can manage their own account settings', function () {
    $paciente = User::factory()->paciente()->create();

    $this->actingAs($paciente)->get('/settings/profile')->assertOk();
    $this->actingAs($paciente)->get('/settings/password')->assertOk();
});

test('a paciente is redirected away from management routes', function () use ($managementRoutes) {
    $paciente = User::factory()->paciente()->create();

    foreach ($managementRoutes as $route) {
        $this->actingAs($paciente)
            ->get($route)
            ->assertRedirect(route('dashboard'));
    }
});

test('an operador can access management routes', function () use ($managementRoutes) {
    $operador = User::factory()->create(['rol' => 'Operador']);

    foreach ($managementRoutes as $route) {
        $this->actingAs($operador)->get($route)->assertOk();
    }
});

test('a super admin can access management routes', function () use ($managementRoutes) {
    $admin = User::factory()->create(['rol' => 'Super Admin']);

    foreach ($managementRoutes as $route) {
        $this->actingAs($admin)->get($route)->assertOk();
    }
});

test('the cartago module shows its login screen to everyone', function () {
    // Sin autenticar y autenticado como Super Admin: siempre la pantalla de login.
    $this->get('/tools/programacion-cirugia-cartago')->assertOk();

    $admin = User::factory()->create(['rol' => 'Super Admin']);
    $this->actingAs($admin)
        ->get('/tools/programacion-cirugia-cartago')
        ->assertOk();
});

test('nobody can log into the cartago module yet', function () {
    $admin = User::factory()->create(['rol' => 'Super Admin']);

    $this->from('/tools/programacion-cirugia-cartago')
        ->post('/tools/programacion-cirugia-cartago', [
            'email' => $admin->email,
            'password' => 'password',
        ])
        ->assertRedirect('/tools/programacion-cirugia-cartago')
        ->assertSessionHasErrors(['email']);

    $this->assertGuest();
});

test('a paciente cannot create users via the management endpoint', function () {
    $paciente = User::factory()->paciente()->create();

    $this->actingAs($paciente)->post('/tools/gestion-usuarios', [
        'name' => 'Intruso',
        'rol' => 'Super Admin',
        'email' => 'intruso@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
    ])->assertRedirect(route('dashboard'));

    $this->assertDatabaseMissing('users', ['email' => 'intruso@example.com']);
});

test('users can be created with a specific role from the management CRUD', function () {
    $admin = User::factory()->create(['rol' => 'Super Admin']);

    $this->actingAs($admin)->post('/tools/gestion-usuarios', [
        'name' => 'Operadora',
        'rol' => 'Operador',
        'email' => 'operadora@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
    ])->assertRedirect(route('tools.gestion-usuarios'));

    $this->assertDatabaseHas('users', [
        'email' => 'operadora@example.com',
        'rol' => 'Operador',
    ]);
});

test('creating a user requires a valid role', function () {
    $admin = User::factory()->create(['rol' => 'Super Admin']);

    $this->actingAs($admin)
        ->from('/tools/gestion-usuarios')
        ->post('/tools/gestion-usuarios', [
            'name' => 'Sin Rol',
            'rol' => 'rol-invalido',
            'email' => 'sinrol@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ])
        ->assertSessionHasErrors(['rol']);
});
