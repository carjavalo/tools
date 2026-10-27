<?php

use App\Models\Permiso;
use App\Models\RadicarCaso;
use App\Models\Role;
use App\Models\TrazabilidadCaso;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

// Botón "Rad sin Paquetes" del Historial: grilla de las radicaciones
// ambulatorias que no tienen el PDF del paquete adjunto.

const URL_SIN_PAQUETE = '/tools/radicar-solicitud/sin-paquete';

function radicadoPor(RadicarCaso $caso, User $autor): void
{
    TrazabilidadCaso::create([
        'codrad' => $caso->codrad,
        'user_id' => $autor->id,
        'evento' => 'creacion',
        'etiqueta' => 'Radicación creada',
    ]);
}

test('el botón va justo debajo de Modificar Radicado y viene apagado', function () {
    $claves = collect(Permiso::VISTAS)->pluck('key')->values();
    $vista = collect(Permiso::VISTAS)->firstWhere('key', 'radicar-solicitud-sin-paquete');

    expect($vista['titulo'])->toBe('Botón Rad sin Paquetes (Historial)')
        ->and($claves->search('radicar-solicitud-sin-paquete'))
        ->toBe($claves->search('radicar-solicitud-modificar') + 1)
        ->and(Permiso::VISTAS_OPT_IN)->toContain('radicar-solicitud-sin-paquete');
});

test('lista solo las ambulatorias sin paquete, con el paciente y quién radicó', function () {
    $admin = User::factory()->create(); // Super Admin
    $radicador = User::factory()->create(['rol' => 'Operador', 'name' => 'Ana', 'Apellido1' => 'Radica', 'apellido2' => null]);
    User::factory()->create(['rol' => 'paciente', 'Numero_D' => '5501', 'name' => 'Pedro', 'Apellido1' => 'Paciente', 'apellido2' => null, 'Eps' => 'EPS SUR']);

    $sinPaquete = RadicarCaso::create(['Ndocumento' => '5501', 'estRad' => '1', 'ambito' => RadicarCaso::AMBULATORIO]);
    radicadoPor($sinPaquete, $radicador);
    $vacio = RadicarCaso::create(['Ndocumento' => '5501', 'estRad' => '1', 'ambito' => RadicarCaso::AMBULATORIO, 'paquete' => '']);
    RadicarCaso::create(['Ndocumento' => '5501', 'estRad' => '1', 'ambito' => RadicarCaso::AMBULATORIO, 'paquete' => 'paquetes/x.pdf']);
    RadicarCaso::create(['Ndocumento' => '5501', 'estRad' => '1', 'ambito' => RadicarCaso::HOSPITALARIO]);

    $rows = $this->actingAs($admin)->getJson(URL_SIN_PAQUETE)->assertOk()->json('rows');

    expect(collect($rows)->pluck('codrad')->all())->toBe([$vacio->codrad, $sinPaquete->codrad]);

    $fila = collect($rows)->firstWhere('codrad', $sinPaquete->codrad);
    expect($fila['paciente'])->toBe('Pedro Paciente')
        ->and($fila['documento'])->toBe('5501')
        ->and($fila['eps'])->toBe('EPS SUR')
        ->and($fila['radicadoPor'])->toBe('Ana Radica')
        ->and($fila['fechaRadicacion'])->not->toBeNull();

    // Radicación anterior a la bitácora: no se sabe quién la hizo.
    expect(collect($rows)->firstWhere('codrad', $vacio->codrad)['radicadoPor'])->toBe('—');
});

test('sin asignar el botón se niega, incluso al Operador; asignado se permite', function () {
    $rol = Role::create(['Nombre' => 'Auditor Paquetes', 'Estado' => true]);
    Permiso::create(['role_id' => $rol->id, 'vista' => 'radicar-solicitud', 'ver' => true]);
    $usuario = User::factory()->create(['rol' => 'Auditor Paquetes']);
    $operador = User::factory()->create(['rol' => 'Operador']);

    $this->actingAs($usuario)->getJson(URL_SIN_PAQUETE)->assertForbidden();
    $this->actingAs($operador)->getJson(URL_SIN_PAQUETE)->assertForbidden();

    Permiso::create(['role_id' => $rol->id, 'vista' => 'radicar-solicitud-sin-paquete', 'ver' => true]);

    $this->actingAs($usuario)->getJson(URL_SIN_PAQUETE)->assertOk();
});

test('a otros roles no se les muestra que radicó un Super Admin', function () {
    $admin = User::factory()->create(['name' => 'Admin']);
    $rol = Role::create(['Nombre' => 'Auditor Paquetes', 'Estado' => true]);
    Permiso::create(['role_id' => $rol->id, 'vista' => 'radicar-solicitud-sin-paquete', 'ver' => true]);
    $usuario = User::factory()->create(['rol' => 'Auditor Paquetes']);

    $caso = RadicarCaso::create(['Ndocumento' => '5502', 'estRad' => '1', 'ambito' => RadicarCaso::AMBULATORIO]);
    radicadoPor($caso, $admin);

    expect($this->actingAs($usuario)->getJson(URL_SIN_PAQUETE)->json('rows.0.radicadoPor'))->toBe('—');
    expect($this->actingAs($admin)->getJson(URL_SIN_PAQUETE)->json('rows.0.radicadoPor'))->not->toBe('—');
});

test('con el botón asignado sube el primer paquete de un caso ambulatorio, pero no reemplaza ni anexa', function () {
    Storage::fake('public');
    $rol = Role::create(['Nombre' => 'Auditor Paquetes', 'Estado' => true]);
    Permiso::create(['role_id' => $rol->id, 'vista' => 'radicar-solicitud-sin-paquete', 'ver' => true]);
    $usuario = User::factory()->create(['rol' => 'Auditor Paquetes']);
    $pdf = fn () => UploadedFile::fake()->create('paquete.pdf', 64, 'application/pdf');

    $caso = RadicarCaso::create(['Ndocumento' => '5503', 'estRad' => '1', 'ambito' => RadicarCaso::AMBULATORIO]);
    $hospitalario = RadicarCaso::create(['Ndocumento' => '5503', 'estRad' => '1', 'ambito' => RadicarCaso::HOSPITALARIO]);

    $this->actingAs($usuario)
        ->postJson("/tools/radicar-solicitud/{$caso->codrad}/paquete", ['paquete' => $pdf()])
        ->assertOk()
        ->assertJsonPath('ok', true);
    Storage::disk('public')->assertExists($caso->refresh()->paquete);

    // Ya tiene paquete: reemplazarlo o anexarle es de "Asignar subir paquete".
    $this->actingAs($usuario)
        ->postJson("/tools/radicar-solicitud/{$caso->codrad}/paquete", ['paquete' => $pdf()])
        ->assertForbidden();
    $this->actingAs($usuario)
        ->postJson("/tools/radicar-solicitud/{$caso->codrad}/paquete", [
            'paquete' => $pdf(),
            'modo' => 'anexar',
            'paquete_base' => basename($caso->paquete),
        ])
        ->assertForbidden();

    // Los hospitalarios no están en la grilla.
    $this->actingAs($usuario)
        ->postJson("/tools/radicar-solicitud/{$hospitalario->codrad}/paquete", ['paquete' => $pdf()])
        ->assertForbidden();

    // Sin el botón asignado tampoco sube el primero.
    $otro = User::factory()->create(['rol' => 'Operador']);
    $nuevo = RadicarCaso::create(['Ndocumento' => '5503', 'estRad' => '1', 'ambito' => RadicarCaso::AMBULATORIO]);
    $this->actingAs($otro)
        ->postJson("/tools/radicar-solicitud/{$nuevo->codrad}/paquete", ['paquete' => $pdf()])
        ->assertForbidden();

    // Al recargar la grilla, el caso ya no aparece.
    expect(collect($this->actingAs($usuario)->getJson(URL_SIN_PAQUETE)->json('rows'))->pluck('codrad')->all())
        ->toBe([$nuevo->codrad]);
});
