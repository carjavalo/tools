<?php

use App\Models\Motivo;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('guests cannot access motivo management', function () {
    $this->get('/tools/gestion-motivo')->assertRedirect(route('login'));
});

test('index renders the motivo page with data and stats', function () {
    $user = User::factory()->create();
    Motivo::create(['Nombre' => 'Motivo Uno', 'Estado' => true]);
    Motivo::create(['Nombre' => 'Motivo Dos', 'Estado' => false]);

    $this->actingAs($user)
        ->get('/tools/gestion-motivo')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('tools/gestion-motivo')
            ->has('motivos.data', 2)
            ->where('stats.total', 2)
            ->where('stats.activas', 1)
            ->where('stats.inactivas', 1)
        );
});

test('a motivo can be created', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->post('/tools/gestion-motivo', [
        'Nombre' => 'Cirugía programada',
        'Estado' => true,
        'Observacion' => 'Detalle',
    ])->assertRedirect(route('tools.gestion-motivo'));

    $this->assertDatabaseHas('motivo', [
        'Nombre' => 'Cirugía programada',
        'Estado' => true,
    ]);
});

test('creating a motivo requires a name', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->from('/tools/gestion-motivo')
        ->post('/tools/gestion-motivo', ['Estado' => true])
        ->assertSessionHasErrors(['Nombre']);
});

test('a motivo can be updated', function () {
    $user = User::factory()->create();
    $motivo = Motivo::create(['Nombre' => 'Viejo', 'Estado' => true]);

    $this->actingAs($user)->put('/tools/gestion-motivo/'.$motivo->id, [
        'Nombre' => 'Nuevo',
        'Estado' => false,
    ])->assertRedirect(route('tools.gestion-motivo'));

    $motivo->refresh();
    expect($motivo->Nombre)->toBe('Nuevo');
    expect($motivo->Estado)->toBeFalse();
});

test('a motivo can be deleted', function () {
    $user = User::factory()->create();
    $motivo = Motivo::create(['Nombre' => 'Borrar', 'Estado' => true]);

    $this->actingAs($user)->delete('/tools/gestion-motivo/'.$motivo->id)
        ->assertRedirect(route('tools.gestion-motivo'));

    $this->assertDatabaseMissing('motivo', ['id' => $motivo->id]);
});

test('the motivo listing is paginated', function () {
    $user = User::factory()->create();
    foreach (range(1, 10) as $i) {
        Motivo::create(['Nombre' => 'Motivo '.str_pad((string) $i, 2, '0', STR_PAD_LEFT), 'Estado' => true]);
    }

    $this->actingAs($user)
        ->get('/tools/gestion-motivo')
        ->assertInertia(fn (Assert $page) => $page
            ->has('motivos.data', 8)
            ->where('motivos.total', 10)
            ->where('motivos.last_page', 2)
        );
});

test('search filters the motivo listing', function () {
    $user = User::factory()->create();
    Motivo::create(['Nombre' => 'Urgencia', 'Estado' => true]);
    Motivo::create(['Nombre' => 'Consulta', 'Estado' => true]);

    $this->actingAs($user)
        ->get('/tools/gestion-motivo?search=Urgenc')
        ->assertInertia(fn (Assert $page) => $page
            ->has('motivos.data', 1)
            ->where('motivos.data.0.Nombre', 'Urgencia')
        );
});
