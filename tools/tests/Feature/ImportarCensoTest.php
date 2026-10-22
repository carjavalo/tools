<?php

use App\Models\Permiso;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

const URL_CENSO = '/tools/gestion-usuarios/importar-censo';

function filaCenso(string $nombre, string $documento, string $tipo = 'CC', string $eps = 'NUEVA EPS'): array
{
    return ['nombre' => $nombre, 'identificacion' => $tipo, 'documento' => $documento, 'responsable' => $eps];
}

test('el censo crea pacientes repartiendo el nombre y con correo y clave del documento', function () {
    $admin = User::factory()->create();

    $this->actingAs($admin)
        ->postJson(URL_CENSO, ['filas' => [
            filaCenso('BASTIDAS BENAVIDES JORGE LUIS', '1151950143', 'CC', 'ADMINISTRADORA ADRES EV TERRO'),
            filaCenso('  CEBALLOS   PAZ SEBASTIAN ', '13107017', 'TI', 'ASMET SALUD EPS SAS'),
        ]])
        ->assertOk()
        ->assertJson(['creados' => 2, 'existentes' => 0, 'omitidos' => 0]);

    $jorge = User::where('Numero_D', '1151950143')->first();
    expect($jorge->Apellido1)->toBe('BASTIDAS')
        ->and($jorge->apellido2)->toBe('BENAVIDES')
        ->and($jorge->name)->toBe('JORGE LUIS')
        ->and($jorge->tipo_Docu)->toBe('CC')
        ->and($jorge->Eps)->toBe('ADMINISTRADORA ADRES EV TERRO')
        ->and($jorge->rol)->toBe('paciente')
        ->and($jorge->email)->toBe('1151950143@notiene.com')
        ->and(Hash::check('1151950143', $jorge->password))->toBeTrue()
        ->and($jorge->Telefono1)->toBeNull()
        ->and($jorge->Direccion)->toBeNull();

    $sebastian = User::where('Numero_D', '13107017')->first();
    expect($sebastian->Apellido1)->toBe('CEBALLOS')
        ->and($sebastian->apellido2)->toBe('PAZ')
        ->and($sebastian->name)->toBe('SEBASTIAN')
        ->and($sebastian->tipo_Docu)->toBe('TI');
});

test('el censo omite HUV EVARISTO sin importar mayúsculas y las filas sin documento', function () {
    $admin = User::factory()->create();

    $this->actingAs($admin)
        ->postJson(URL_CENSO, ['filas' => [
            filaCenso('HUV EVARISTO', '760010452', 'SI'),
            filaCenso('huv  Evaristo', '760010453', 'SI'),
            filaCenso('PEREZ GOMEZ ANA', ''),
            filaCenso('', '555'),
        ]])
        ->assertOk()
        ->assertJson(['creados' => 0, 'existentes' => 0, 'omitidos' => 4]);

    expect(User::whereIn('Numero_D', ['760010452', '760010453', '555'])->exists())->toBeFalse();
});

test('el censo ignora a los pacientes cuyo documento o correo ya existe', function () {
    $admin = User::factory()->create();
    User::factory()->create(['Numero_D' => '1002855477', 'name' => 'Luis', 'rol' => 'paciente']);
    User::factory()->create(['email' => '31371203@notiene.com']);

    $this->actingAs($admin)
        ->postJson(URL_CENSO, ['filas' => [
            filaCenso('GUTIERREZ GUTIERREZ LUIS FERNANDO', '1002855477'),
            filaCenso('RENTERIA MARIA JOSEFA', '31371203'),
            filaCenso('BOYA RODRIGUEZ MARIA MARTHA', '37893220'),
            filaCenso('BOYA RODRIGUEZ MARIA MARTHA', '37893220'),
        ]])
        ->assertOk()
        ->assertJson(['creados' => 1, 'existentes' => 3, 'omitidos' => 0]);

    // El existente no se toca.
    expect(User::where('Numero_D', '1002855477')->count())->toBe(1)
        ->and(User::where('Numero_D', '1002855477')->first()->name)->toBe('Luis')
        ->and(User::where('Numero_D', '37893220')->count())->toBe(1);

    // Cargar el mismo censo otra vez no crea nada.
    $this->actingAs($admin)
        ->postJson(URL_CENSO, ['filas' => [filaCenso('BOYA RODRIGUEZ MARIA MARTHA', '37893220')]])
        ->assertJson(['creados' => 0, 'existentes' => 1, 'omitidos' => 0]);
});

test('un nombre de dos palabras queda como apellido y nombre', function () {
    $admin = User::factory()->create();

    $this->actingAs($admin)
        ->postJson(URL_CENSO, ['filas' => [filaCenso('BONILLA AMPARO', '29535627')]])
        ->assertOk();

    $amparo = User::where('Numero_D', '29535627')->first();
    expect($amparo->Apellido1)->toBe('BONILLA')
        ->and($amparo->apellido2)->toBeNull()
        ->and($amparo->name)->toBe('AMPARO');
});

test('el botón Importar Censo va justo debajo de Asignar subir paquete y viene apagado', function () {
    $claves = collect(Permiso::VISTAS)->pluck('key')->values();
    $vista = collect(Permiso::VISTAS)->firstWhere('key', 'gestion-usuarios-importar-censo');

    expect($vista['titulo'])->toBe('Boton Importar Censo Hospitalario')
        ->and($claves->search('gestion-usuarios-importar-censo'))
        ->toBe($claves->search('radicar-solicitud-subir-paquete') + 1)
        ->and(Permiso::VISTAS_OPT_IN)->toContain('gestion-usuarios-importar-censo');
});

test('importar el censo exige tener asignado el botón, incluso al Operador', function () {
    $operador = User::factory()->create(['rol' => 'Operador']);

    $this->actingAs($operador)
        ->postJson(URL_CENSO, ['filas' => [filaCenso('PEREZ GOMEZ ANA', '111')]])
        ->assertForbidden();

    $rol = Role::create(['Nombre' => 'Censo', 'Estado' => true]);
    $usuario = User::factory()->create(['rol' => 'Censo']);
    Permiso::create(['role_id' => $rol->id, 'vista' => 'gestion-usuarios-importar-censo', 'ver' => false]);

    $this->actingAs($usuario)
        ->postJson(URL_CENSO, ['filas' => [filaCenso('PEREZ GOMEZ ANA', '111')]])
        ->assertForbidden();

    Permiso::where('role_id', $rol->id)->update(['ver' => true]);

    $this->actingAs($usuario)
        ->postJson(URL_CENSO, ['filas' => [filaCenso('PEREZ GOMEZ ANA', '111')]])
        ->assertOk()
        ->assertJsonPath('creados', 1);
});

test('el lote del censo tiene tope de filas', function () {
    $admin = User::factory()->create();
    $filas = array_fill(0, 101, filaCenso('PEREZ GOMEZ ANA', '111'));

    $this->actingAs($admin)
        ->postJson(URL_CENSO, ['filas' => $filas])
        ->assertUnprocessable();
});

test('el censo devuelve el resultado de cada fila, en orden, para exportarlo', function () {
    $admin = User::factory()->create();
    User::factory()->create([
        'Numero_D' => '1002855477', 'name' => 'Luis', 'Apellido1' => 'Gutierrez', 'apellido2' => null, 'rol' => 'paciente',
    ]);

    $resultados = $this->actingAs($admin)
        ->postJson(URL_CENSO, ['filas' => [
            filaCenso('HUV EVARISTO', '760010452', 'SI'),
            filaCenso('BASTIDAS BENAVIDES JORGE LUIS', '1151950143'),
            filaCenso('GUTIERREZ GUTIERREZ LUIS FERNANDO', '1002855477'),
            filaCenso('PEREZ GOMEZ ANA', ''),
        ]])
        ->assertOk()
        ->json('resultados');

    expect($resultados)->toHaveCount(4)
        ->and($resultados[0])->toBe(['estado' => 'omitido', 'motivo' => 'HUV EVARISTO'])
        ->and($resultados[1]['estado'])->toBe('creado')
        ->and($resultados[1]['usuario'])->toMatchArray([
            'Apellido1' => 'BASTIDAS', 'apellido2' => 'BENAVIDES', 'name' => 'JORGE LUIS',
            'Numero_D' => '1151950143', 'email' => '1151950143@notiene.com',
        ])
        ->and($resultados[1]['usuario'])->not->toHaveKey('password')
        ->and($resultados[2])->toBe([
            'estado' => 'existente', 'motivo' => 'Documento ya registrado',
            'registrado' => 'Luis Gutierrez', 'rol' => 'paciente',
        ])
        ->and($resultados[3])->toBe(['estado' => 'omitido', 'motivo' => 'Sin documento']);
});

test('el resultado del censo no revela a un Super Admin a quien no lo es', function () {
    $rol = Role::create(['Nombre' => 'Censo', 'Estado' => true]);
    Permiso::create(['role_id' => $rol->id, 'vista' => 'gestion-usuarios-importar-censo', 'ver' => true]);
    $usuario = User::factory()->create(['rol' => 'Censo']);
    User::factory()->create(['rol' => 'Super Admin', 'Numero_D' => '999', 'name' => 'Root']);

    $this->actingAs($usuario)
        ->postJson(URL_CENSO, ['filas' => [filaCenso('PEREZ GOMEZ ANA', '999')]])
        ->assertOk()
        ->assertJsonPath('resultados.0.registrado', 'Usuario del sistema')
        ->assertJsonPath('resultados.0.rol', null);
});
