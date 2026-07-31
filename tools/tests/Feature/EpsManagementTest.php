<?php

use App\Models\Eps;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('guests cannot access EPS management', function () {
    $this->get('/tools/gestion-eps')->assertRedirect(route('login'));
});

test('index renders the EPS page with paginated data and stats', function () {
    $user = User::factory()->create();
    Eps::create(['Nombre' => 'Sura', 'Estado' => true]);
    Eps::create(['Nombre' => 'Sanitas', 'Estado' => false]);

    $this->actingAs($user)
        ->get('/tools/gestion-eps')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('tools/gestion-eps')
            ->has('eps.data', 2)
            ->where('stats.total', 2)
            ->where('stats.activas', 1)
            ->where('stats.inactivas', 1)
        );
});

test('an EPS can be created', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->post('/tools/gestion-eps', [
        'Nombre' => 'Nueva EPS',
        'Estado' => true,
        'Observacion' => 'Cobertura nacional',
    ])->assertRedirect(route('tools.gestion-eps'));

    $this->assertDatabaseHas('eps', [
        'Nombre' => 'Nueva EPS',
        'Estado' => true,
        'Observacion' => 'Cobertura nacional',
    ]);
});

test('creating an EPS requires a name', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->from('/tools/gestion-eps')
        ->post('/tools/gestion-eps', ['Estado' => true])
        ->assertSessionHasErrors(['Nombre']);
});

test('an EPS can be updated', function () {
    $user = User::factory()->create();
    $eps = Eps::create(['Nombre' => 'Vieja', 'Estado' => true]);

    $this->actingAs($user)->put('/tools/gestion-eps/'.$eps->id, [
        'Nombre' => 'Actualizada',
        'Estado' => false,
        'Observacion' => 'Cambió',
    ])->assertRedirect(route('tools.gestion-eps'));

    $eps->refresh();
    expect($eps->Nombre)->toBe('Actualizada');
    expect($eps->Estado)->toBeFalse();
});

test('an EPS can be deleted', function () {
    $user = User::factory()->create();
    $eps = Eps::create(['Nombre' => 'Borrar', 'Estado' => true]);

    $this->actingAs($user)->delete('/tools/gestion-eps/'.$eps->id)
        ->assertRedirect(route('tools.gestion-eps'));

    $this->assertDatabaseMissing('eps', ['id' => $eps->id]);
});

test('the EPS listing is paginated', function () {
    $user = User::factory()->create();
    foreach (range(1, 10) as $i) {
        Eps::create(['Nombre' => 'EPS '.str_pad((string) $i, 2, '0', STR_PAD_LEFT), 'Estado' => true]);
    }

    $this->actingAs($user)
        ->get('/tools/gestion-eps')
        ->assertInertia(fn (Assert $page) => $page
            ->has('eps.data', 8)
            ->where('eps.total', 10)
            ->where('eps.last_page', 2)
        );
});

test('search filters the EPS listing', function () {
    $user = User::factory()->create();
    Eps::create(['Nombre' => 'Coomeva', 'Estado' => true]);
    Eps::create(['Nombre' => 'Famisanar', 'Estado' => true]);

    $this->actingAs($user)
        ->get('/tools/gestion-eps?search=Coomeva')
        ->assertInertia(fn (Assert $page) => $page
            ->has('eps.data', 1)
            ->where('eps.data.0.Nombre', 'Coomeva')
        );
});

test('the register page only shares active EPS', function () {
    Eps::create(['Nombre' => 'Activa EPS', 'Estado' => true]);
    Eps::create(['Nombre' => 'Inactiva EPS', 'Estado' => false]);

    $this->get('/register')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('auth/register')
            ->has('epsList', 1)
            ->where('epsList.0.Nombre', 'Activa EPS')
        );
});

test('a user can register selecting an EPS from the table', function () {
    Eps::create(['Nombre' => 'Salud Total', 'Estado' => true]);

    $this->post('/register', [
        'name' => 'Pedro',
        'Apellido1' => 'Ruiz',
        'email' => 'pedro@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
        'Eps' => 'Salud Total',
    ]);

    $this->assertAuthenticated();
    $this->assertDatabaseHas('users', [
        'email' => 'pedro@example.com',
        'Eps' => 'Salud Total',
    ]);
});
