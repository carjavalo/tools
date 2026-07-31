<?php

use App\Models\Cups;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('guests cannot access cups management', function () {
    $this->get('/tools/gestion-cups')->assertRedirect(route('login'));
});

test('index renders the cups page with data and stats', function () {
    $user = User::factory()->create();
    Cups::create(['CodCupsHuv' => '001', 'CodCupsHo' => 'H1', 'Nombre' => 'CUPS Uno', 'Estado' => true]);
    Cups::create(['Nombre' => 'CUPS Dos', 'Estado' => false]);

    $this->actingAs($user)
        ->get('/tools/gestion-cups')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('tools/gestion-cups')
            ->has('cups.data', 2)
            ->where('stats.total', 2)
            ->where('stats.activas', 1)
            ->where('stats.inactivas', 1)
        );
});

test('a cups can be created with both codes', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->post('/tools/gestion-cups', [
        'CodCupsHuv' => 'A100',
        'CodCupsHo' => 'B200',
        'Nombre' => 'Procedimiento X',
        'Estado' => true,
        'Observacion' => 'Detalle',
    ])->assertRedirect(route('tools.gestion-cups'));

    $this->assertDatabaseHas('cups', [
        'CodCupsHuv' => 'A100',
        'CodCupsHo' => 'B200',
        'Nombre' => 'Procedimiento X',
        'Estado' => true,
    ]);
});

test('creating a cups requires a name', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->from('/tools/gestion-cups')
        ->post('/tools/gestion-cups', ['Estado' => true])
        ->assertSessionHasErrors(['Nombre']);
});

test('the code fields are limited to 10 characters', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->from('/tools/gestion-cups')
        ->post('/tools/gestion-cups', [
            'CodCupsHuv' => str_repeat('X', 11),
            'CodCupsHo' => str_repeat('Y', 11),
            'Nombre' => 'Largo',
            'Estado' => true,
        ])
        ->assertSessionHasErrors(['CodCupsHuv', 'CodCupsHo']);
});

test('a cups can be updated', function () {
    $user = User::factory()->create();
    $cups = Cups::create(['Nombre' => 'Viejo', 'Estado' => true]);

    $this->actingAs($user)->put('/tools/gestion-cups/'.$cups->id, [
        'CodCupsHuv' => 'NEWP',
        'CodCupsHo' => 'NEWH',
        'Nombre' => 'Nuevo',
        'Estado' => false,
    ])->assertRedirect(route('tools.gestion-cups'));

    $cups->refresh();
    expect($cups->Nombre)->toBe('Nuevo');
    expect($cups->CodCupsHuv)->toBe('NEWP');
    expect($cups->CodCupsHo)->toBe('NEWH');
    expect($cups->Estado)->toBeFalse();
});

test('a cups can be deleted', function () {
    $user = User::factory()->create();
    $cups = Cups::create(['Nombre' => 'Borrar', 'Estado' => true]);

    $this->actingAs($user)->delete('/tools/gestion-cups/'.$cups->id)
        ->assertRedirect(route('tools.gestion-cups'));

    $this->assertDatabaseMissing('cups', ['id' => $cups->id]);
});

test('the cups listing is paginated', function () {
    $user = User::factory()->create();
    foreach (range(1, 10) as $i) {
        Cups::create(['Nombre' => 'CUPS '.str_pad((string) $i, 2, '0', STR_PAD_LEFT), 'Estado' => true]);
    }

    $this->actingAs($user)
        ->get('/tools/gestion-cups')
        ->assertInertia(fn (Assert $page) => $page
            ->has('cups.data', 8)
            ->where('cups.total', 10)
            ->where('cups.last_page', 2)
        );
});

test('search filters the cups listing', function () {
    $user = User::factory()->create();
    Cups::create(['CodCupsHuv' => 'ZZZ', 'Nombre' => 'Apendicectomía', 'Estado' => true]);
    Cups::create(['Nombre' => 'Colecistectomía', 'Estado' => true]);

    $this->actingAs($user)
        ->get('/tools/gestion-cups?search=ZZZ')
        ->assertInertia(fn (Assert $page) => $page
            ->has('cups.data', 1)
            ->where('cups.data.0.Nombre', 'Apendicectomía')
        );
});

test('duplicate codes are rejected', function () {
    $user = User::factory()->create();
    Cups::create(['CodCupsHuv' => 'DUP1', 'CodCupsHo' => 'DUP2', 'Nombre' => 'Existente', 'Estado' => true]);

    $this->actingAs($user)
        ->from('/tools/gestion-cups')
        ->post('/tools/gestion-cups', [
            'CodCupsHuv' => 'DUP1',
            'CodCupsHo' => 'OTRO',
            'Nombre' => 'Nuevo',
            'Estado' => true,
        ])
        ->assertSessionHasErrors(['CodCupsHuv']);
});

test('a cups keeps its own codes when updated', function () {
    $user = User::factory()->create();
    $cups = Cups::create(['CodCupsHuv' => 'KEEP1', 'CodCupsHo' => 'KEEP2', 'Nombre' => 'Reg', 'Estado' => true]);

    $this->actingAs($user)->put('/tools/gestion-cups/'.$cups->id, [
        'CodCupsHuv' => 'KEEP1',
        'CodCupsHo' => 'KEEP2',
        'Nombre' => 'Reg Editado',
        'Estado' => true,
    ])->assertRedirect(route('tools.gestion-cups'));

    expect($cups->refresh()->Nombre)->toBe('Reg Editado');
});

test('CodCupsHo can be repeated across records', function () {
    $user = User::factory()->create();
    Cups::create(['CodCupsHuv' => 'P1', 'CodCupsHo' => 'SHARED', 'Nombre' => 'Uno', 'Estado' => true]);

    $this->actingAs($user)
        ->from('/tools/gestion-cups')
        ->post('/tools/gestion-cups', [
            'CodCupsHuv' => 'P2',
            'CodCupsHo' => 'SHARED',
            'Nombre' => 'Dos',
            'Estado' => true,
        ])
        ->assertRedirect(route('tools.gestion-cups'))
        ->assertSessionHasNoErrors();

    expect(Cups::where('CodCupsHo', 'SHARED')->count())->toBe(2);
});
