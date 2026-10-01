<?php

use App\Models\Permiso;
use App\Models\QuirofanoQx;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('guests cannot access quirofano qx management', function () {
    $this->get('/tools/gestion-quirofano-qx')->assertRedirect(route('login'));
});

test('index renders the quirofano qx page with data and stats', function () {
    $user = User::factory()->create();
    QuirofanoQx::create(['nombre' => 'Quirófano 1', 'estado' => true]);
    QuirofanoQx::create(['nombre' => 'Quirófano 2', 'estado' => false]);

    $this->actingAs($user)
        ->get('/tools/gestion-quirofano-qx')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('tools/gestion-quirofano-qx')
            ->has('quirofanos.data', 2)
            ->where('stats.total', 2)
            ->where('stats.activos', 1)
            ->where('stats.inactivos', 1)
        );
});

test('a quirofano can be created, updated and deleted', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post('/tools/gestion-quirofano-qx', ['nombre' => 'Sala 3', 'estado' => true])
        ->assertRedirect(route('tools.gestion-quirofano-qx'));

    $quirofano = QuirofanoQx::where('nombre', 'Sala 3')->firstOrFail();
    expect($quirofano->estado)->toBeTrue();

    $this->actingAs($user)
        ->put('/tools/gestion-quirofano-qx/'.$quirofano->id, ['nombre' => 'Sala 3B', 'estado' => false])
        ->assertRedirect(route('tools.gestion-quirofano-qx'));

    $quirofano->refresh();
    expect($quirofano->nombre)->toBe('Sala 3B')
        ->and($quirofano->estado)->toBeFalse();

    $this->actingAs($user)
        ->delete('/tools/gestion-quirofano-qx/'.$quirofano->id)
        ->assertRedirect(route('tools.gestion-quirofano-qx'));

    $this->assertDatabaseMissing('quirofanoQx', ['id' => $quirofano->id]);
});

test('the quirofano name is required, limited to 100 and unique', function () {
    $user = User::factory()->create();
    QuirofanoQx::create(['nombre' => 'Sala 1', 'estado' => true]);

    $this->actingAs($user)->from('/tools/gestion-quirofano-qx')
        ->post('/tools/gestion-quirofano-qx', ['estado' => true])
        ->assertSessionHasErrors(['nombre']);

    $this->actingAs($user)->from('/tools/gestion-quirofano-qx')
        ->post('/tools/gestion-quirofano-qx', ['nombre' => str_repeat('X', 101), 'estado' => true])
        ->assertSessionHasErrors(['nombre']);

    $this->actingAs($user)->from('/tools/gestion-quirofano-qx')
        ->post('/tools/gestion-quirofano-qx', ['nombre' => 'Sala 1', 'estado' => true])
        ->assertSessionHasErrors(['nombre']);

    // Al editar, conservar su propio nombre no choca consigo mismo.
    $sala = QuirofanoQx::where('nombre', 'Sala 1')->first();
    $this->actingAs($user)
        ->put('/tools/gestion-quirofano-qx/'.$sala->id, ['nombre' => 'Sala 1', 'estado' => false])
        ->assertSessionHasNoErrors();
});

test('the quirofano listing is paginated and filtered by search and estado', function () {
    $user = User::factory()->create();
    foreach (range(1, 10) as $i) {
        QuirofanoQx::create(['nombre' => 'Sala '.str_pad((string) $i, 2, '0', STR_PAD_LEFT), 'estado' => $i <= 7]);
    }
    QuirofanoQx::create(['nombre' => 'Hemodinamia', 'estado' => true]);

    $this->actingAs($user)
        ->get('/tools/gestion-quirofano-qx')
        ->assertInertia(fn (Assert $page) => $page
            ->has('quirofanos.data', 8)
            ->where('quirofanos.total', 11)
            ->where('quirofanos.last_page', 2)
        );

    $this->actingAs($user)
        ->get('/tools/gestion-quirofano-qx?search=Hemo')
        ->assertInertia(fn (Assert $page) => $page
            ->has('quirofanos.data', 1)
            ->where('quirofanos.data.0.nombre', 'Hemodinamia')
        );

    $this->actingAs($user)
        ->get('/tools/gestion-quirofano-qx?estado=0')
        ->assertInertia(fn (Assert $page) => $page
            ->where('quirofanos.total', 3)
            ->where('filters.estado', '0')
        );
});

test('gestion quirofano qx sits right after gestion servicios in the permissions', function () {
    $claves = collect(Permiso::VISTAS)->pluck('key')->values();

    expect($claves->search('gestion-quirofano-qx'))
        ->toBe($claves->search('gestion-servicios') + 1);
});
