<?php

use App\Models\Especialidad;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('guests cannot access especialidad management', function () {
    $this->get('/tools/gestion-especialidades')->assertRedirect(route('login'));
});

test('index renders the especialidad page with paginated data and stats', function () {
    $user = User::factory()->create();
    Especialidad::create(['Nombre' => 'Cardiología', 'Estado' => true]);
    Especialidad::create(['Nombre' => 'Pediatría', 'Estado' => false]);

    $this->actingAs($user)
        ->get('/tools/gestion-especialidades')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('tools/gestion-especialidades')
            ->has('especialidades.data', 2)
            ->where('stats.total', 2)
            ->where('stats.activas', 1)
            ->where('stats.inactivas', 1)
        );
});

test('an especialidad can be created', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->post('/tools/gestion-especialidades', [
        'espcodser' => 'NEU',
        'Nombre' => 'Neurología',
        'Estado' => true,
        'Observacion' => 'Sistema nervioso',
    ])->assertRedirect(route('tools.gestion-especialidades'));

    $this->assertDatabaseHas('especialidad', [
        'espcodser' => 'NEU',
        'Nombre' => 'Neurología',
        'Estado' => true,
        'Observacion' => 'Sistema nervioso',
    ]);
});

test('the espcodser field is limited to 10 characters', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->from('/tools/gestion-especialidades')
        ->post('/tools/gestion-especialidades', [
            'espcodser' => str_repeat('X', 11),
            'Nombre' => 'Larga',
            'Estado' => true,
        ])
        ->assertSessionHasErrors(['espcodser']);
});

test('creating an especialidad requires a name', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->from('/tools/gestion-especialidades')
        ->post('/tools/gestion-especialidades', ['Estado' => true])
        ->assertSessionHasErrors(['Nombre']);
});

test('an especialidad can be updated', function () {
    $user = User::factory()->create();
    $esp = Especialidad::create(['Nombre' => 'Vieja', 'Estado' => true]);

    $this->actingAs($user)->put('/tools/gestion-especialidades/'.$esp->id, [
        'Nombre' => 'Actualizada',
        'Estado' => false,
        'Observacion' => 'Cambió',
    ])->assertRedirect(route('tools.gestion-especialidades'));

    $esp->refresh();
    expect($esp->Nombre)->toBe('Actualizada');
    expect($esp->Estado)->toBeFalse();
});

test('an especialidad can be deleted', function () {
    $user = User::factory()->create();
    $esp = Especialidad::create(['Nombre' => 'Borrar', 'Estado' => true]);

    $this->actingAs($user)->delete('/tools/gestion-especialidades/'.$esp->id)
        ->assertRedirect(route('tools.gestion-especialidades'));

    $this->assertDatabaseMissing('especialidad', ['id' => $esp->id]);
});

test('the especialidad listing is paginated', function () {
    $user = User::factory()->create();
    foreach (range(1, 10) as $i) {
        Especialidad::create([
            'Nombre' => 'Especialidad '.str_pad((string) $i, 2, '0', STR_PAD_LEFT),
            'Estado' => true,
        ]);
    }

    $this->actingAs($user)
        ->get('/tools/gestion-especialidades')
        ->assertInertia(fn (Assert $page) => $page
            ->has('especialidades.data', 8)
            ->where('especialidades.total', 10)
            ->where('especialidades.last_page', 2)
        );
});

test('search filters the especialidad listing', function () {
    $user = User::factory()->create();
    Especialidad::create(['Nombre' => 'Dermatología', 'Estado' => true]);
    Especialidad::create(['Nombre' => 'Ortopedia', 'Estado' => true]);

    $this->actingAs($user)
        ->get('/tools/gestion-especialidades?search=Derma')
        ->assertInertia(fn (Assert $page) => $page
            ->has('especialidades.data', 1)
            ->where('especialidades.data.0.Nombre', 'Dermatología')
        );
});
