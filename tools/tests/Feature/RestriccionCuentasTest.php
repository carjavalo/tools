<?php

use App\Models\Permiso;
use App\Models\Role;
use App\Models\User;
use App\Support\MenuUsuario;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;

// Con Cambiar cuenta, Cambiar contraseña o Eliminar cuenta deshabilitadas en
// el Gestor de Permisos (menú de usuario), el rol solo puede hacer esa acción
// sobre pacientes, también desde Gestión de Usuarios y Radicar Solicitud.

/**
 * Usuario de un rol con Gestión de Usuarios completa y Radicar Solicitud,
 * pero con las opciones de cuenta indicadas deshabilitadas.
 *
 * @param  list<string>  $negadas
 */
function usuarioConCuentasRestringidas(array $negadas): User
{
    $rol = Role::create(['Nombre' => 'Gestor Restringido', 'Estado' => true]);
    Permiso::create(['role_id' => $rol->id, 'vista' => 'gestion-usuarios', 'ver' => true, 'crear' => true, 'editar' => true, 'borrar' => true]);
    Permiso::create(['role_id' => $rol->id, 'vista' => 'radicar-solicitud', 'ver' => true, 'crear' => true, 'editar' => true, 'borrar' => true]);

    foreach ($negadas as $opcion) {
        DB::table('role_menu_usuario')->insert(['role_id' => $rol->id, 'opcion' => $opcion, 'permitido' => false]);
    }

    return User::factory()->create(['rol' => 'Gestor Restringido']);
}

function datosEdicion(User $u, array $cambios = []): array
{
    return array_merge([
        'name' => $u->name,
        'rol' => $u->rol,
        'Apellido1' => $u->Apellido1,
        'apellido2' => $u->apellido2,
        'Numero_D' => $u->Numero_D,
        'email' => $u->email,
        'password' => '',
        'password_confirmation' => '',
    ], $cambios);
}

test('sin Cambiar cuenta no edita su propia cuenta, las de su rol ni otros roles, pero sí pacientes', function () {
    $actor = usuarioConCuentasRestringidas([MenuUsuario::PERFIL]);
    $mismoRol = User::factory()->create(['rol' => 'Gestor Restringido', 'name' => 'Colega']);
    $operador = User::factory()->create(['rol' => 'Operador', 'name' => 'Operador']);
    $paciente = User::factory()->create(['rol' => 'paciente', 'name' => 'Paciente']);

    foreach ([$actor, $mismoRol, $operador] as $protegido) {
        $this->actingAs($actor)
            ->put("/tools/gestion-usuarios/{$protegido->id}", datosEdicion($protegido, ['name' => 'Cambiado']))
            ->assertSessionHas('error');
        expect($protegido->refresh()->name)->not->toBe('Cambiado');
    }

    $this->actingAs($actor)
        ->put("/tools/gestion-usuarios/{$paciente->id}", datosEdicion($paciente, ['name' => 'Paciente Editado']))
        ->assertSessionHas('success');
    expect($paciente->refresh()->name)->toBe('Paciente Editado');

    // Tampoco puede pasar a un paciente a otro rol: dejaría de ser paciente.
    $this->actingAs($actor)
        ->put("/tools/gestion-usuarios/{$paciente->id}", datosEdicion($paciente, ['rol' => 'Operador']))
        ->assertSessionHas('error');
    expect($paciente->refresh()->rol)->toBe('paciente');
});

test('sin Cambiar contraseña edita la cuenta de su rol pero no su contraseña', function () {
    $actor = usuarioConCuentasRestringidas([MenuUsuario::PASSWORD]);
    $colega = User::factory()->create(['rol' => 'Gestor Restringido']);
    $claveOriginal = $colega->password;

    $this->actingAs($actor)
        ->from('/tools/gestion-usuarios')
        ->put("/tools/gestion-usuarios/{$colega->id}", datosEdicion($colega, [
            'password' => 'NuevaClave123',
            'password_confirmation' => 'NuevaClave123',
        ]))
        ->assertSessionHasErrors(['password']);
    expect($colega->refresh()->password)->toBe($claveOriginal);

    // Sin tocar la contraseña, el resto de la cuenta sí se edita.
    $this->actingAs($actor)
        ->put("/tools/gestion-usuarios/{$colega->id}", datosEdicion($colega, ['Telefono1' => '3001112233']))
        ->assertSessionHas('success');
    expect($colega->refresh()->Telefono1)->toBe('3001112233');
});

test('sin Eliminar cuenta solo borra pacientes', function () {
    $actor = usuarioConCuentasRestringidas([MenuUsuario::ELIMINAR]);
    $colega = User::factory()->create(['rol' => 'Gestor Restringido']);
    $paciente = User::factory()->create(['rol' => 'paciente']);

    $this->actingAs($actor)->delete("/tools/gestion-usuarios/{$colega->id}")->assertSessionHas('error');
    expect(User::find($colega->id))->not->toBeNull();

    $this->actingAs($actor)->delete("/tools/gestion-usuarios/{$paciente->id}")->assertSessionHas('success');
    expect(User::find($paciente->id))->toBeNull();
});

test('el modal de usuarios de Radicar Solicitud aplica la misma restricción', function () {
    $actor = usuarioConCuentasRestringidas([MenuUsuario::PERFIL, MenuUsuario::PASSWORD]);
    $colega = User::factory()->create(['rol' => 'Gestor Restringido', 'name' => 'Colega']);
    $paciente = User::factory()->create(['rol' => 'paciente', 'name' => 'Paciente']);

    $this->actingAs($actor)
        ->putJson("/tools/radicar-solicitud/paciente/{$colega->id}", datosEdicion($colega, [
            'name' => 'Cambiado',
            'password' => 'NuevaClave123',
            'password_confirmation' => 'NuevaClave123',
        ]))
        ->assertForbidden();
    expect($colega->refresh()->name)->toBe('Colega')
        ->and(Hash::check('NuevaClave123', $colega->password))->toBeFalse();

    $this->actingAs($actor)
        ->putJson("/tools/radicar-solicitud/paciente/{$paciente->id}", datosEdicion($paciente, ['name' => 'Paciente Editado']))
        ->assertOk();
    expect($paciente->refresh()->name)->toBe('Paciente Editado');
});

test('con las opciones habilitadas todo sigue igual y el Super Admin no tiene restricción', function () {
    $rol = Role::create(['Nombre' => 'Gestor Libre', 'Estado' => true]);
    Permiso::create(['role_id' => $rol->id, 'vista' => 'gestion-usuarios', 'ver' => true, 'editar' => true]);
    $libre = User::factory()->create(['rol' => 'Gestor Libre']);
    $colega = User::factory()->create(['rol' => 'Gestor Libre']);

    $this->actingAs($libre)
        ->put("/tools/gestion-usuarios/{$colega->id}", datosEdicion($colega, ['name' => 'Editado por colega']))
        ->assertSessionHas('success');

    $admin = User::factory()->create(); // Super Admin
    $this->actingAs($admin)
        ->put("/tools/gestion-usuarios/{$colega->id}", datosEdicion($colega->refresh(), [
            'password' => 'NuevaClave123',
            'password_confirmation' => 'NuevaClave123',
        ]))
        ->assertSessionHas('success');
    expect(Hash::check('NuevaClave123', $colega->refresh()->password))->toBeTrue();
});

test('la vista recibe las opciones de cuenta del rol para ocultar botones y campos', function () {
    $actor = usuarioConCuentasRestringidas([MenuUsuario::PERFIL, MenuUsuario::ELIMINAR]);

    $this->actingAs($actor)
        ->get('/tools/gestion-usuarios')
        ->assertInertia(fn (Assert $page) => $page
            ->where('auth.menuUsuario.perfil', false)
            ->where('auth.menuUsuario.eliminar-cuenta', false)
            ->where('auth.menuUsuario.password', true));
});
