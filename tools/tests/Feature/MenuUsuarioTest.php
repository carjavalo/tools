<?php

use App\Models\Role;
use App\Models\User;
use App\Support\MenuUsuario;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

// Gestor Menú de Usuario: el Super Admin decide por rol qué opciones de la
// cuenta (cambiar cuenta, contraseña, dos pasos, eliminar cuenta) puede usar.
// Sin configurar se permiten, como siempre.

function bloquearOpcion(Role $role, string $opcion): void
{
    DB::table('role_menu_usuario')->insert([
        'role_id' => $role->id,
        'opcion' => $opcion,
        'permitido' => false,
        'created_at' => now(),
        'updated_at' => now(),
    ]);
}

test('sin configurar, el rol conserva todas las opciones de su cuenta', function () {
    Role::firstOrCreate(['Nombre' => 'Operador'], ['Estado' => true]);
    $user = User::factory()->create(['rol' => 'Operador']);

    $this->actingAs($user)->get(route('profile.edit'))->assertOk();
    $this->actingAs($user)->get(route('password.edit'))->assertOk();
});

test('una opción bloqueada se niega en la ruta y se informa a la vista', function () {
    $role = Role::firstOrCreate(['Nombre' => 'Operador'], ['Estado' => true]);
    bloquearOpcion($role, MenuUsuario::PASSWORD);
    $user = User::factory()->create(['rol' => 'Operador']);

    $this->actingAs($user)->get(route('password.edit'))
        ->assertRedirect(route('dashboard'));

    $this->actingAs($user)->put(route('password.update'), [
        'current_password' => 'password',
        'password' => 'nueva-clave-123',
        'password_confirmation' => 'nueva-clave-123',
    ])->assertRedirect(route('dashboard'));

    $this->actingAs($user)->get(route('profile.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('auth.menuUsuario.password', false)
            ->where('auth.menuUsuario.perfil', true));
});

test('bloquear eliminar cuenta impide borrarla', function () {
    $role = Role::firstOrCreate(['Nombre' => 'Operador'], ['Estado' => true]);
    bloquearOpcion($role, MenuUsuario::ELIMINAR);
    $user = User::factory()->create(['rol' => 'Operador']);

    $this->actingAs($user)->delete(route('profile.destroy'), ['password' => 'password']);

    expect($user->fresh())->not->toBeNull();
});

test('el Super Admin guarda el menú de usuario de un rol', function () {
    $admin = User::factory()->create(['rol' => User::SUPER_ADMIN]);
    $role = Role::firstOrCreate(['Nombre' => 'Gestor Radicación'], ['Estado' => true]);

    $this->actingAs($admin)
        ->get("/tools/gestor-menu-usuario?role={$role->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('tools/gestor-menu-usuario')
            ->where('roleId', $role->id)
            ->where('permitidas.perfil', true));

    $this->actingAs($admin)->post("/tools/gestor-menu-usuario/{$role->id}", [
        'opciones' => ['perfil' => false, 'password' => false, 'two-factor' => true, 'eliminar-cuenta' => false],
    ])->assertRedirect(route('tools.gestor-menu-usuario', ['role' => $role->id]));

    expect(MenuUsuario::delRol($role))->toBe([
        'perfil' => false,
        'password' => false,
        'two-factor' => true,
        'eliminar-cuenta' => false,
    ]);
});

test('solo el Super Admin entra al Gestor Menú de Usuario', function () {
    Role::firstOrCreate(['Nombre' => 'Operador'], ['Estado' => true]);
    $user = User::factory()->create(['rol' => 'Operador']);

    $this->actingAs($user)->get('/tools/gestor-menu-usuario')->assertForbidden();
});
