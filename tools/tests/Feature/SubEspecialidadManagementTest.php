<?php

use App\Models\Especialidad;
use App\Models\SubEspecialidad;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function makeEspecialidad(bool $estado = true): Especialidad
{
    static $n = 0;
    $n++;

    return Especialidad::create([
        'espcodser' => 'E'.str_pad((string) $n, 5, '0', STR_PAD_LEFT),
        'Nombre' => 'Esp '.$n,
        'Estado' => $estado,
    ]);
}

test('guests cannot access subespecialidad management', function () {
    $this->get('/tools/gestion-subespecialidades')->assertRedirect(route('login'));
});

test('index renders the subespecialidad page with data, stats and especialidades', function () {
    $user = User::factory()->create();
    $esp = makeEspecialidad();
    makeEspecialidad(false); // una inactiva, no debe aparecer en el select
    SubEspecialidad::create(['Nombre' => 'Cardiología Pediátrica', 'Estado' => true, 'codespcodser' => $esp->espcodser]);

    $this->actingAs($user)
        ->get('/tools/gestion-subespecialidades')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('tools/gestion-subespecialidades')
            ->has('subespecialidades.data', 1)
            ->where('subespecialidades.data.0.especialidad.Nombre', $esp->Nombre)
            ->where('stats.total', 1)
            ->has('especialidades', 1) // solo la activa
        );
});

test('a subespecialidad can be created and belongs to an especialidad', function () {
    $user = User::factory()->create();
    $esp = makeEspecialidad();

    $this->actingAs($user)->post('/tools/gestion-subespecialidades', [
        'cod_SubEspecialidad' => 'CARDP',
        'Nombre' => 'Cardiología Pediátrica',
        'Estado' => true,
        'Observacion' => 'Subespecialidad de cardiología',
        'codespcodser' => $esp->espcodser,
    ])->assertRedirect(route('tools.gestion-subespecialidades'));

    $this->assertDatabaseHas('subespecialidad', [
        'cod_SubEspecialidad' => 'CARDP',
        'Nombre' => 'Cardiología Pediátrica',
        'codespcodser' => $esp->espcodser,
    ]);
});

test('creating a subespecialidad requires a name and an especialidad', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->from('/tools/gestion-subespecialidades')
        ->post('/tools/gestion-subespecialidades', ['Estado' => true])
        ->assertSessionHasErrors(['Nombre', 'codespcodser']);
});

test('the especialidad must exist', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->from('/tools/gestion-subespecialidades')
        ->post('/tools/gestion-subespecialidades', [
            'Nombre' => 'X',
            'Estado' => true,
            'codespcodser' => '999999',
        ])
        ->assertSessionHasErrors(['codespcodser']);
});

test('the cod_SubEspecialidad is limited to 10 characters', function () {
    $user = User::factory()->create();
    $esp = makeEspecialidad();

    $this->actingAs($user)
        ->from('/tools/gestion-subespecialidades')
        ->post('/tools/gestion-subespecialidades', [
            'cod_SubEspecialidad' => str_repeat('X', 11),
            'Nombre' => 'Larga',
            'Estado' => true,
            'codespcodser' => $esp->espcodser,
        ])
        ->assertSessionHasErrors(['cod_SubEspecialidad']);
});

test('a subespecialidad can be updated', function () {
    $user = User::factory()->create();
    $esp = makeEspecialidad();
    $other = makeEspecialidad();
    $sub = SubEspecialidad::create(['Nombre' => 'Vieja', 'Estado' => true, 'codespcodser' => $esp->espcodser]);

    $this->actingAs($user)->put('/tools/gestion-subespecialidades/'.$sub->id, [
        'Nombre' => 'Actualizada',
        'Estado' => false,
        'codespcodser' => $other->espcodser,
    ])->assertRedirect(route('tools.gestion-subespecialidades'));

    $sub->refresh();
    expect($sub->Nombre)->toBe('Actualizada');
    expect($sub->Estado)->toBeFalse();
    expect($sub->codespcodser)->toBe($other->espcodser);
});

test('a subespecialidad can be deleted', function () {
    $user = User::factory()->create();
    $esp = makeEspecialidad();
    $sub = SubEspecialidad::create(['Nombre' => 'Borrar', 'Estado' => true, 'codespcodser' => $esp->espcodser]);

    $this->actingAs($user)->delete('/tools/gestion-subespecialidades/'.$sub->id)
        ->assertRedirect(route('tools.gestion-subespecialidades'));

    $this->assertDatabaseMissing('subespecialidad', ['id' => $sub->id]);
});

test('deleting an especialidad cascades to its subespecialidades', function () {
    $user = User::factory()->create();
    $esp = makeEspecialidad();
    $sub = SubEspecialidad::create(['Nombre' => 'Hija', 'Estado' => true, 'codespcodser' => $esp->espcodser]);

    $this->actingAs($user)->delete('/tools/gestion-especialidades/'.$esp->id);

    $this->assertDatabaseMissing('subespecialidad', ['id' => $sub->id]);
});

test('the subespecialidad listing is paginated', function () {
    $user = User::factory()->create();
    $esp = makeEspecialidad();
    foreach (range(1, 10) as $i) {
        SubEspecialidad::create([
            'Nombre' => 'Sub '.str_pad((string) $i, 2, '0', STR_PAD_LEFT),
            'Estado' => true,
            'codespcodser' => $esp->espcodser,
        ]);
    }

    $this->actingAs($user)
        ->get('/tools/gestion-subespecialidades')
        ->assertInertia(fn (Assert $page) => $page
            ->has('subespecialidades.data', 8)
            ->where('subespecialidades.total', 10)
            ->where('subespecialidades.last_page', 2)
        );
});
