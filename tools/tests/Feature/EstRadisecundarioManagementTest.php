<?php

use App\Models\EstRadisecundario;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('guests cannot access estado secundario management', function () {
    $this->get('/tools/gestion-estado-secundario')->assertRedirect(route('login'));
});

test('index renders the estado secundario page with data and stats', function () {
    $user = User::factory()->create();
    EstRadisecundario::create(['Nombre' => 'Radicado', 'Estado' => true]);
    EstRadisecundario::create(['Nombre' => 'Anulado', 'Estado' => false]);

    $this->actingAs($user)
        ->get('/tools/gestion-estado-secundario')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('tools/gestion-estado-secundario')
            ->has('estados.data', 2)
            ->where('stats.total', 2)
            ->where('stats.activas', 1)
            ->where('stats.inactivas', 1)
        );
});

test('an estado secundario can be created', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->post('/tools/gestion-estado-secundario', [
        'Nombre' => 'En revisión',
        'Estado' => true,
        'Observacion' => 'Detalle',
    ])->assertRedirect(route('tools.gestion-estado-secundario'));

    $this->assertDatabaseHas('EstRadisecundario', [
        'Nombre' => 'En revisión',
        'Estado' => true,
    ]);
});

test('creating an estado secundario requires a name', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->from('/tools/gestion-estado-secundario')
        ->post('/tools/gestion-estado-secundario', ['Estado' => true])
        ->assertSessionHasErrors(['Nombre']);
});

test('the observacion is limited to 300 characters on estado secundario', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->from('/tools/gestion-estado-secundario')
        ->post('/tools/gestion-estado-secundario', [
            'Nombre' => 'Largo',
            'Estado' => true,
            'Observacion' => str_repeat('X', 301),
        ])
        ->assertSessionHasErrors(['Observacion']);
});

test('an estado secundario can be updated', function () {
    $user = User::factory()->create();
    $estado = EstRadisecundario::create(['Nombre' => 'Viejo', 'Estado' => true]);

    $this->actingAs($user)->put('/tools/gestion-estado-secundario/'.$estado->id, [
        'Nombre' => 'Nuevo',
        'Estado' => false,
    ])->assertRedirect(route('tools.gestion-estado-secundario'));

    $estado->refresh();
    expect($estado->Nombre)->toBe('Nuevo');
    expect($estado->Estado)->toBeFalse();
});

test('an estado secundario can be deleted', function () {
    $user = User::factory()->create();
    $estado = EstRadisecundario::create(['Nombre' => 'Borrar', 'Estado' => true]);

    $this->actingAs($user)->delete('/tools/gestion-estado-secundario/'.$estado->id)
        ->assertRedirect(route('tools.gestion-estado-secundario'));

    $this->assertDatabaseMissing('EstRadisecundario', ['id' => $estado->id]);
});

test('the estado secundario listing is paginated', function () {
    $user = User::factory()->create();
    foreach (range(1, 10) as $i) {
        EstRadisecundario::create(['Nombre' => 'Estado '.str_pad((string) $i, 2, '0', STR_PAD_LEFT), 'Estado' => true]);
    }

    $this->actingAs($user)
        ->get('/tools/gestion-estado-secundario')
        ->assertInertia(fn (Assert $page) => $page
            ->has('estados.data', 8)
            ->where('estados.total', 10)
            ->where('estados.last_page', 2)
        );
});

test('search filters the estado secundario listing', function () {
    $user = User::factory()->create();
    EstRadisecundario::create(['Nombre' => 'Radicado', 'Estado' => true]);
    EstRadisecundario::create(['Nombre' => 'Anulado', 'Estado' => true]);

    $this->actingAs($user)
        ->get('/tools/gestion-estado-secundario?search=Radic')
        ->assertInertia(fn (Assert $page) => $page
            ->has('estados.data', 1)
            ->where('estados.data.0.Nombre', 'Radicado')
        );
});
