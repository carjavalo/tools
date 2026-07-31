<?php

use App\Models\Cups;
use App\Models\CupsEps;
use App\Models\Eps;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('guests cannot access cups-eps management', function () {
    $this->get('/tools/gestion-cups-eps')->assertRedirect(route('login'));
});

test('index renders the page with stats and eps list', function () {
    $user = User::factory()->create();
    $eps = Eps::create(['Nombre' => 'EPS A', 'Estado' => true]);
    $cups = Cups::create(['Nombre' => 'Proc 1', 'Estado' => true]);
    CupsEps::create(['eps_id' => $eps->id, 'cuvs_id' => $cups->id, 'Estado' => true]);

    $this->actingAs($user)
        ->get('/tools/gestion-cups-eps')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('tools/gestion-cups-eps')
            ->has('asociaciones.data', 1)
            ->has('epsList', 1)
            ->where('stats.total', 1)
            ->where('stats.eps', 1)
            ->where('stats.cups', 1)
        );
});

test('store associates each eps with each cups', function () {
    $user = User::factory()->create();
    $eps = Eps::create(['Nombre' => 'EPS A', 'Estado' => true]);
    $c1 = Cups::create(['Nombre' => 'Proc 1', 'Estado' => true]);
    $c2 = Cups::create(['Nombre' => 'Proc 2', 'Estado' => true]);

    $this->actingAs($user)->post('/tools/gestion-cups-eps', [
        'eps_ids' => [$eps->id],
        'cuvs_ids' => [$c1->id, $c2->id],
        'Estado' => true,
    ])->assertRedirect(route('tools.gestion-cups-eps'));

    $this->assertDatabaseHas('cuvs_eps', ['eps_id' => $eps->id, 'cuvs_id' => $c1->id]);
    $this->assertDatabaseHas('cuvs_eps', ['eps_id' => $eps->id, 'cuvs_id' => $c2->id]);
    expect(CupsEps::count())->toBe(2);
});

test('store skips duplicate associations', function () {
    $user = User::factory()->create();
    $eps = Eps::create(['Nombre' => 'EPS A', 'Estado' => true]);
    $c1 = Cups::create(['Nombre' => 'Proc 1', 'Estado' => true]);
    $c2 = Cups::create(['Nombre' => 'Proc 2', 'Estado' => true]);
    CupsEps::create(['eps_id' => $eps->id, 'cuvs_id' => $c1->id, 'Estado' => true]);

    $this->actingAs($user)->post('/tools/gestion-cups-eps', [
        'eps_ids' => [$eps->id],
        'cuvs_ids' => [$c1->id, $c2->id],
        'Estado' => true,
    ])->assertRedirect(route('tools.gestion-cups-eps'));

    // 1 que ya existía + 1 nuevo (c2); el duplicado se omite.
    expect(CupsEps::count())->toBe(2);
});

test('store requires at least one eps and one cups', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->from('/tools/gestion-cups-eps')
        ->post('/tools/gestion-cups-eps', ['Estado' => true])
        ->assertSessionHasErrors(['eps_ids', 'cuvs_ids']);
});

test('buscar-cups returns matches as json', function () {
    $user = User::factory()->create();
    Cups::create(['CodCupsHuv' => 'ZZ9', 'Nombre' => 'Apendicectomia Especial', 'Estado' => true]);

    $this->actingAs($user)
        ->getJson('/tools/gestion-cups-eps/buscar-cups?q=Apendicectomia')
        ->assertOk()
        ->assertJsonFragment(['Nombre' => 'Apendicectomia Especial']);
});

test('buscar-cups requires at least two characters', function () {
    $user = User::factory()->create();
    Cups::create(['Nombre' => 'Algo', 'Estado' => true]);

    $this->actingAs($user)
        ->getJson('/tools/gestion-cups-eps/buscar-cups?q=a')
        ->assertOk()
        ->assertExactJson([]);
});

test('an association can be updated', function () {
    $user = User::factory()->create();
    $eps = Eps::create(['Nombre' => 'EPS A', 'Estado' => true]);
    $cups = Cups::create(['Nombre' => 'Proc 1', 'Estado' => true]);
    $assoc = CupsEps::create(['eps_id' => $eps->id, 'cuvs_id' => $cups->id, 'Estado' => true]);

    $this->actingAs($user)->put('/tools/gestion-cups-eps/'.$assoc->id, [
        'eps_id' => $eps->id,
        'cuvs_id' => $cups->id,
        'Estado' => false,
        'Observacion' => 'Nota',
    ])->assertRedirect(route('tools.gestion-cups-eps'));

    $assoc->refresh();
    expect($assoc->Estado)->toBeFalse();
    expect($assoc->Observacion)->toBe('Nota');
});

test('updating to an existing pair is rejected', function () {
    $user = User::factory()->create();
    $epsA = Eps::create(['Nombre' => 'EPS A', 'Estado' => true]);
    $epsB = Eps::create(['Nombre' => 'EPS B', 'Estado' => true]);
    $cups = Cups::create(['Nombre' => 'Proc 1', 'Estado' => true]);
    CupsEps::create(['eps_id' => $epsA->id, 'cuvs_id' => $cups->id, 'Estado' => true]);
    $assoc = CupsEps::create(['eps_id' => $epsB->id, 'cuvs_id' => $cups->id, 'Estado' => true]);

    $this->actingAs($user)
        ->from('/tools/gestion-cups-eps')
        ->put('/tools/gestion-cups-eps/'.$assoc->id, [
            'eps_id' => $epsA->id,
            'cuvs_id' => $cups->id,
            'Estado' => true,
        ])
        ->assertSessionHasErrors(['eps_id']);
});

test('an association can be deleted', function () {
    $user = User::factory()->create();
    $eps = Eps::create(['Nombre' => 'EPS A', 'Estado' => true]);
    $cups = Cups::create(['Nombre' => 'Proc 1', 'Estado' => true]);
    $assoc = CupsEps::create(['eps_id' => $eps->id, 'cuvs_id' => $cups->id, 'Estado' => true]);

    $this->actingAs($user)->delete('/tools/gestion-cups-eps/'.$assoc->id)
        ->assertRedirect(route('tools.gestion-cups-eps'));

    $this->assertDatabaseMissing('cuvs_eps', ['id' => $assoc->id]);
});
