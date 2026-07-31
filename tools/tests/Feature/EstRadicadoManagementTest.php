<?php

use App\Models\EstRadicado;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('guests cannot access estado management', function () {
    $this->get('/tools/gestion-estado')->assertRedirect(route('login'));
});

test('index renders the estado page with data and stats', function () {
    $user = User::factory()->create();
    EstRadicado::create(['Nombre' => 'Radicado', 'Estado' => true]);
    EstRadicado::create(['Nombre' => 'Anulado', 'Estado' => false]);

    $this->actingAs($user)
        ->get('/tools/gestion-estado')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('tools/gestion-estado')
            ->has('estados.data', 2)
            ->where('stats.total', 2)
            ->where('stats.activas', 1)
            ->where('stats.inactivas', 1)
        );
});

test('an estado can be created', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->post('/tools/gestion-estado', [
        'Nombre' => 'En revisión',
        'Estado' => true,
        'Observacion' => 'Detalle',
    ])->assertRedirect(route('tools.gestion-estado'));

    $this->assertDatabaseHas('EstRadicado', [
        'Nombre' => 'En revisión',
        'Estado' => true,
    ]);
});

test('creating an estado requires a name', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->from('/tools/gestion-estado')
        ->post('/tools/gestion-estado', ['Estado' => true])
        ->assertSessionHasErrors(['Nombre']);
});

test('the observacion is limited to 300 characters', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->from('/tools/gestion-estado')
        ->post('/tools/gestion-estado', [
            'Nombre' => 'Largo',
            'Estado' => true,
            'Observacion' => str_repeat('X', 301),
        ])
        ->assertSessionHasErrors(['Observacion']);
});

test('an estado can be updated', function () {
    $user = User::factory()->create();
    $estado = EstRadicado::create(['Nombre' => 'Viejo', 'Estado' => true]);

    $this->actingAs($user)->put('/tools/gestion-estado/'.$estado->id, [
        'Nombre' => 'Nuevo',
        'Estado' => false,
    ])->assertRedirect(route('tools.gestion-estado'));

    $estado->refresh();
    expect($estado->Nombre)->toBe('Nuevo');
    expect($estado->Estado)->toBeFalse();
});

test('an estado can be deleted', function () {
    $user = User::factory()->create();
    $estado = EstRadicado::create(['Nombre' => 'Borrar', 'Estado' => true]);

    $this->actingAs($user)->delete('/tools/gestion-estado/'.$estado->id)
        ->assertRedirect(route('tools.gestion-estado'));

    $this->assertDatabaseMissing('EstRadicado', ['id' => $estado->id]);
});

test('the estado listing is paginated', function () {
    $user = User::factory()->create();
    foreach (range(1, 10) as $i) {
        EstRadicado::create(['Nombre' => 'Estado '.str_pad((string) $i, 2, '0', STR_PAD_LEFT), 'Estado' => true]);
    }

    $this->actingAs($user)
        ->get('/tools/gestion-estado')
        ->assertInertia(fn (Assert $page) => $page
            ->has('estados.data', 8)
            ->where('estados.total', 10)
            ->where('estados.last_page', 2)
        );
});

test('search filters the estado listing', function () {
    $user = User::factory()->create();
    EstRadicado::create(['Nombre' => 'Radicado', 'Estado' => true]);
    EstRadicado::create(['Nombre' => 'Anulado', 'Estado' => true]);

    $this->actingAs($user)
        ->get('/tools/gestion-estado?search=Radic')
        ->assertInertia(fn (Assert $page) => $page
            ->has('estados.data', 1)
            ->where('estados.data.0.Nombre', 'Radicado')
        );
});
