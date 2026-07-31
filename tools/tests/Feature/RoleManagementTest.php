<?php

use App\Models\EstRadicado;
use App\Models\EstRadisecundario;
use App\Models\Role;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('guests cannot access role management', function () {
    $this->get('/tools/gestion-roles')->assertRedirect(route('login'));
});

test('index renders the roles page with the seeded roles and stats', function () {
    $user = User::factory()->create();

    // La migración siembra 4 roles base (paciente, Medico, Operador, Super Admin).
    $this->actingAs($user)
        ->get('/tools/gestion-roles')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('tools/gestion-roles')
            ->has('roles.data', 4)
            ->where('stats.total', 4)
            ->where('stats.activas', 4)
        );
});

test('a role can be created', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->post('/tools/gestion-roles', [
        'Nombre' => 'Enfermero',
        'Estado' => true,
        'Observacion' => 'Personal de enfermería',
    ])->assertRedirect(route('tools.gestion-roles'));

    $this->assertDatabaseHas('roles', [
        'Nombre' => 'Enfermero',
        'Estado' => true,
    ]);
});

test('creating a role requires a name', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->from('/tools/gestion-roles')
        ->post('/tools/gestion-roles', ['Estado' => true])
        ->assertSessionHasErrors(['Nombre']);
});

test('a role can be updated', function () {
    $user = User::factory()->create();
    $role = Role::create(['Nombre' => 'Viejo', 'Estado' => true]);

    $this->actingAs($user)->put('/tools/gestion-roles/'.$role->id, [
        'Nombre' => 'Nuevo',
        'Estado' => false,
    ])->assertRedirect(route('tools.gestion-roles'));

    $role->refresh();
    expect($role->Nombre)->toBe('Nuevo');
    expect($role->Estado)->toBeFalse();
});

test('a role can be deleted', function () {
    $user = User::factory()->create();
    $role = Role::create(['Nombre' => 'Borrar', 'Estado' => true]);

    $this->actingAs($user)->delete('/tools/gestion-roles/'.$role->id)
        ->assertRedirect(route('tools.gestion-roles'));

    $this->assertDatabaseMissing('roles', ['id' => $role->id]);
});

test('the roles index shares the estado catalogs for the modal', function () {
    $user = User::factory()->create();
    EstRadicado::create(['Nombre' => 'Recibido', 'Estado' => true]);
    EstRadisecundario::create(['Nombre' => 'Sec A', 'Estado' => true]);

    $this->actingAs($user)
        ->get('/tools/gestion-roles')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('estadosRadicado', 1)
            ->has('estadosSecundarios', 1)
        );
});

test('a role is created with its assigned estados', function () {
    $user = User::factory()->create();
    $primario = EstRadicado::create(['Nombre' => 'Recibido', 'Estado' => true]);
    $secundario = EstRadisecundario::create(['Nombre' => 'Sec A', 'Estado' => true]);

    $this->actingAs($user)->post('/tools/gestion-roles', [
        'Nombre' => 'Auditor',
        'Estado' => true,
        'est_radicado_ids' => [$primario->id],
        'est_radisecundario_ids' => [$secundario->id],
    ])->assertRedirect(route('tools.gestion-roles'));

    $role = Role::where('Nombre', 'Auditor')->firstOrFail();
    expect($role->estadosRadicado()->pluck('EstRadicado.id')->all())->toBe([$primario->id]);
    expect($role->estadosSecundarios()->pluck('EstRadisecundario.id')->all())->toBe([$secundario->id]);
});

test('updating a role replaces its assigned estados', function () {
    $user = User::factory()->create();
    $e1 = EstRadicado::create(['Nombre' => 'Recibido', 'Estado' => true]);
    $e2 = EstRadicado::create(['Nombre' => 'Rechazado', 'Estado' => true]);
    $role = Role::create(['Nombre' => 'Auditor', 'Estado' => true]);
    $role->estadosRadicado()->sync([$e1->id]);

    $this->actingAs($user)->put('/tools/gestion-roles/'.$role->id, [
        'Nombre' => 'Auditor',
        'Estado' => true,
        'est_radicado_ids' => [$e2->id],
        'est_radisecundario_ids' => [],
    ])->assertRedirect(route('tools.gestion-roles'));

    expect($role->estadosRadicado()->pluck('EstRadicado.id')->all())->toBe([$e2->id]);
});

test('a partial role update keeps the assigned estados (inline toggle)', function () {
    $user = User::factory()->create();
    $e1 = EstRadicado::create(['Nombre' => 'Recibido', 'Estado' => true]);
    $role = Role::create(['Nombre' => 'Auditor', 'Estado' => true]);
    $role->estadosRadicado()->sync([$e1->id]);

    // El switch inline envía solo Nombre/Estado/Observacion (sin campos de estados).
    $this->actingAs($user)->put('/tools/gestion-roles/'.$role->id, [
        'Nombre' => 'Auditor',
        'Estado' => false,
        'Observacion' => '',
    ])->assertRedirect(route('tools.gestion-roles'));

    expect($role->fresh()->Estado)->toBeFalse();
    expect($role->estadosRadicado()->pluck('EstRadicado.id')->all())->toBe([$e1->id]);
});

test('creating a role rejects estado ids that do not exist', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->from('/tools/gestion-roles')
        ->post('/tools/gestion-roles', [
            'Nombre' => 'Auditor',
            'Estado' => true,
            'est_radicado_ids' => [999999],
        ])
        ->assertSessionHasErrors(['est_radicado_ids.0']);
});

test('user management shares the active roles for its select', function () {
    $user = User::factory()->create();
    Role::create(['Nombre' => 'Inactivo', 'Estado' => false]);

    $this->actingAs($user)
        ->get('/tools/gestion-usuarios')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('rolesList', 4) // los 4 activos sembrados (no el inactivo)
        );
});

test('a non super admin does not see the super admin role in the list or stats', function () {
    $operador = User::factory()->create(['rol' => 'Operador']);

    // 4 roles sembrados (paciente, Medico, Operador, Super Admin); ve 3.
    $this->actingAs($operador)
        ->get('/tools/gestion-roles')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('roles.data', 3)
            ->where('stats.total', 3)
            ->where('stats.activas', 3)
        );
});

test('a super admin does see the super admin role', function () {
    $admin = User::factory()->create(); // Super Admin por defecto

    $this->actingAs($admin)
        ->get('/tools/gestion-roles')
        ->assertInertia(fn (Assert $page) => $page
            ->has('roles.data', 4)
            ->where('stats.total', 4)
        );
});

test('a non super admin cannot update the super admin role', function () {
    $operador = User::factory()->create(['rol' => 'Operador']);
    $superRole = Role::where('Nombre', 'Super Admin')->firstOrFail();

    $this->actingAs($operador)
        ->put('/tools/gestion-roles/'.$superRole->id, [
            'Nombre' => 'Hackeado',
            'Estado' => true,
        ])
        ->assertNotFound();

    expect($superRole->fresh()->Nombre)->toBe('Super Admin');
});

test('a non super admin cannot delete the super admin role', function () {
    $operador = User::factory()->create(['rol' => 'Operador']);
    $superRole = Role::where('Nombre', 'Super Admin')->firstOrFail();

    $this->actingAs($operador)
        ->delete('/tools/gestion-roles/'.$superRole->id)
        ->assertNotFound();

    $this->assertDatabaseHas('roles', ['id' => $superRole->id]);
});

test('a non super admin cannot create a role named super admin', function () {
    $operador = User::factory()->create(['rol' => 'Operador']);

    $this->actingAs($operador)
        ->from('/tools/gestion-roles')
        ->post('/tools/gestion-roles', [
            'Nombre' => 'Super Admin',
            'Estado' => true,
        ])
        ->assertSessionHasErrors(['Nombre']);
});
