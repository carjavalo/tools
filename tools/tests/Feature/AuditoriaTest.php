<?php

use App\Models\Auditoria;
use App\Models\EstRadicado;
use App\Models\Especialidad;
use App\Models\Permiso;
use App\Models\RadicarCaso;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

function usuarioAuditable(string $rol = 'Operador'): User
{
    Role::firstOrCreate(['Nombre' => $rol], ['Estado' => true]);

    return User::factory()->create([
        'rol' => $rol,
        'name' => 'Ana',
        'Apellido1' => 'López',
        'Numero_D' => '555111',
        'tipo_Docu' => 'CC',
    ]);
}

test('crear un registro queda en la bitacora con una descripcion legible', function () {
    $user = usuarioAuditable();
    Auth::login($user);

    $estado = EstRadicado::create(['Nombre' => 'Recibido', 'Estado' => true]);
    $caso = RadicarCaso::create([
        'Ndocumento' => '1112223',
        'estRad' => (string) $estado->id,
    ]);

    $registro = Auditoria::where('registro_tipo', 'RadicarCaso')
        ->where('registro_id', (string) $caso->codrad)
        ->where('evento', 'creacion')
        ->firstOrFail();

    expect($registro->descripcion)->toContain('Creó la radicación #'.$caso->codrad)
        ->and($registro->descripcion)->toContain('1112223')
        ->and($registro->modulo)->toBe('Radicaciones')
        ->and($registro->usuario)->toBe('Ana López')
        ->and($registro->rol)->toBe('Operador');
});

test('modificar un registro describe el antes y el despues con nombres', function () {
    $user = usuarioAuditable();
    Auth::login($user);

    $recibido = EstRadicado::create(['Nombre' => 'Recibido', 'Estado' => true]);
    $autorizado = EstRadicado::create(['Nombre' => 'Autorizado', 'Estado' => true]);

    $caso = RadicarCaso::create([
        'Ndocumento' => '1112224',
        'estRad' => (string) $recibido->id,
    ]);
    $caso->update(['estRad' => (string) $autorizado->id]);

    $registro = Auditoria::where('evento', 'modificacion')
        ->where('registro_id', (string) $caso->codrad)
        ->firstOrFail();

    // El auditor debe leer nombres, no códigos.
    expect($registro->descripcion)
        ->toContain('Estado Actual de Recibido a Autorizado');
    expect($registro->cambios['estRad']['antes'])->toBe('Recibido');
    expect($registro->cambios['estRad']['despues'])->toBe('Autorizado');
});

test('la actividad del Super Admin no se registra', function () {
    $admin = User::factory()->create(); // Super Admin por defecto
    Auth::login($admin);

    $antes = Auditoria::count();

    Especialidad::create([
        'Nombre' => 'Especialidad Oculta',
        'espcodser' => 'ZZ9',
        'Estado' => true,
    ]);
    RadicarCaso::create(['Ndocumento' => '6006']);

    // Nada de lo que hizo quedó registrado, ni con su rol ni con su id.
    expect(Auditoria::count())->toBe($antes);
    expect(Auditoria::where('rol', 'Super Admin')->count())->toBe(0);
    expect(Auditoria::where('user_id', $admin->id)->count())->toBe(0);
});

test('la contrasena nunca queda escrita en la bitacora', function () {
    $user = usuarioAuditable();
    Auth::login($user);

    User::create([
        'name' => 'Pedro',
        'Apellido1' => 'Gómez',
        'rol' => 'Operador',
        'email' => 'pedro@test.local',
        'password' => bcrypt('SecretoQueNoDebeQuedar'),
    ]);

    $registro = Auditoria::where('registro_tipo', 'User')
        ->where('evento', 'creacion')
        ->latest('id')
        ->firstOrFail();

    expect($registro->cambios)->not->toHaveKey('password');
    expect(json_encode($registro->cambios))->not->toContain('SecretoQueNoDebeQuedar');
    expect(Auditoria::where('cambios', 'like', '%password%')->count())->toBe(0);
});

test('el inicio y el cierre de sesion quedan registrados', function () {
    $user = usuarioAuditable();

    $this->actingAs($user)->post('/logout');

    expect(Auditoria::where('evento', 'sesion_fin')->where('user_id', $user->id)->exists())
        ->toBeTrue();
});

test('un save que no cambia nada no genera registro de modificacion', function () {
    $user = usuarioAuditable();
    Auth::login($user);

    $caso = RadicarCaso::create(['Ndocumento' => '1112225']);
    $antes = Auditoria::where('evento', 'modificacion')->count();

    // Guardar el mismo valor no es una modificación.
    $caso->update(['Ndocumento' => '1112225']);

    expect(Auditoria::where('evento', 'modificacion')->count())->toBe($antes);
});

test('la vista respeta los roles configurados en el Gestor de Permisos', function () {
    $rolA = Role::firstOrCreate(['Nombre' => 'Rol Aud A'], ['Estado' => true]);
    $rolB = Role::firstOrCreate(['Nombre' => 'Rol Aud B'], ['Estado' => true]);
    Permiso::create([
        'role_id' => $rolA->id,
        'vista' => 'herramientas-seguimiento',
        'ver' => true,
        'crear' => false,
        'editar' => false,
        'borrar' => false,
    ]);

    $uA = User::factory()->create(['rol' => 'Rol Aud A']);
    $uB = User::factory()->create(['rol' => 'Rol Aud B']);

    Auth::login($uB);
    RadicarCaso::create(['Ndocumento' => '4004']);
    Auth::login($uA);
    RadicarCaso::create(['Ndocumento' => '4005']);

    // Sin configuración ve toda la actividad.
    $total = Auditoria::count();
    $this->actingAs($uA)
        ->get('/tools/herramientas-seguimiento')
        ->assertOk();

    // Limitado a la actividad del rol B.
    $rolA->auditoriaRoles()->sync([$rolB->id]);

    $props = $this->actingAs($uA)
        ->get('/tools/herramientas-seguimiento')
        ->assertOk()
        ->viewData('page')['props'];

    expect($props['registros']['total'])->toBeLessThan($total);
    expect(collect($props['registros']['data'])->pluck('rol')->unique()->all())
        ->toBe(['Rol Aud B']);
});

test('la vista filtra por texto y por evento', function () {
    $user = usuarioAuditable();
    Auth::login($user);
    RadicarCaso::create(['Ndocumento' => '7007']);

    $props = $this->actingAs($user)
        ->get('/tools/herramientas-seguimiento?search=7007')
        ->assertOk()
        ->viewData('page')['props'];

    expect($props['registros']['total'])->toBeGreaterThan(0);
    expect($props['registros']['data'][0]['descripcion'])->toContain('7007');

    $props = $this->actingAs($user)
        ->get('/tools/herramientas-seguimiento?evento=eliminacion')
        ->assertOk()
        ->viewData('page')['props'];

    expect($props['registros']['total'])->toBe(0);
});

test('la bitacora no se audita a si misma', function () {
    $user = usuarioAuditable();
    Auth::login($user);

    RadicarCaso::create(['Ndocumento' => '8008']);

    // Ninguna fila puede referirse a la propia tabla de auditoría: sería un
    // ciclo y llenaría la tabla sin control.
    expect(Auditoria::where('registro_tipo', 'Auditoria')->count())->toBe(0);
});

test('un fallo al auditar no tumba la operacion del usuario', function () {
    $user = usuarioAuditable();
    Auth::login($user);

    // Se renombra la tabla para forzar el fallo del registro.
    DB::statement('ALTER TABLE auditoria RENAME TO auditoria_tmp');

    try {
        $caso = RadicarCaso::create(['Ndocumento' => '9009']);
        expect($caso->exists)->toBeTrue();
    } finally {
        DB::statement('ALTER TABLE auditoria_tmp RENAME TO auditoria');
    }
});
