<?php

use App\Http\Controllers\EvarisdropFileTransferController;
use App\Support\Almacenamiento;
use App\Support\EvarisdropRooms;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

const DEVICE = ['deviceName' => 'PC Ficticio', 'deviceType' => 'desktop', 'userName' => 'Usuario Prueba'];

beforeEach(function () {
    $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class);
    Storage::fake(Almacenamiento::nombreDisco());
});

function otherDevice(string $roomCode, string $id = 'equipo-b'): void
{
    EvarisdropRooms::put($roomCode, ['id' => $id, 'name' => 'Celular', 'type' => 'mobile', 'userName' => 'Otro', 'status' => 'connected', 'lastSeen' => now()->toISOString()]);
}

test('crea una sala y no expone el id de sesión', function () {
    $response = $this->postJson('/api/room/create', DEVICE)->assertOk();

    expect($response->json('roomCode'))->toMatch('/^[A-Z]{4}-\d{4}$/')
        ->and($response->json('device'))->not->toHaveKey('sessionId');
});

test('no se puede unir a una sala que no existe', function () {
    $this->postJson('/api/room/join', ['roomCode' => 'ABCD-2345'] + DEVICE)
        ->assertStatus(404)
        ->assertJson(['error' => 'No existe una sala con ese código. Revisa que esté bien escrito.']);
});

test('se une a una sala existente', function () {
    $code = $this->postJson('/api/room/create', DEVICE)->json('roomCode');
    $this->flushSession();

    $this->postJson('/api/room/join', ['roomCode' => strtolower($code)] + DEVICE)->assertOk()->assertJson(['roomCode' => $code]);
    expect(EvarisdropRooms::devices($code))->toHaveCount(2);
});

test('solo los equipos de la sala ven su lista', function () {
    $code = $this->postJson('/api/room/create', DEVICE)->json('roomCode');
    $this->getJson("/api/room/{$code}/devices")->assertOk()->assertJsonCount(1, 'devices');

    $this->flushSession();
    $this->getJson("/api/room/{$code}/devices")->assertStatus(403);
});

test('los equipos inactivos salen de la lista y el propio vuelve a aparecer', function () {
    $code = $this->postJson('/api/room/create', DEVICE)->json('roomCode');
    EvarisdropRooms::put($code, ['id' => 'viejo', 'name' => 'Viejo', 'type' => 'mobile', 'userName' => 'X', 'status' => 'connected', 'lastSeen' => now()->subMinutes(10)->toISOString()]);
    otherDevice($code);

    // Aunque el propio equipo se haya perdido de la lista, la consulta lo vuelve a anotar.
    EvarisdropRooms::remove($code, session('device_id'));

    $ids = collect($this->getJson("/api/room/{$code}/devices")->json('devices'))->pluck('id');
    expect($ids->all())->toContain('equipo-b', session('device_id'))->not->toContain('viejo');
});

test('no envía archivos a un equipo que no está en la sala', function () {
    $this->postJson('/api/room/create', DEVICE);

    $this->post('/api/transfer/request', [
        'targetDeviceId' => 'fantasma',
        'fileName' => 'nota.txt',
        'fileSize' => 5,
        'file' => UploadedFile::fake()->createWithContent('nota.txt', 'hola'),
    ], ['Accept' => 'application/json'])->assertStatus(422)->assertJson(['error' => 'El otro equipo ya no está conectado a la sala.']);

    expect(Storage::disk(Almacenamiento::nombreDisco())->files('transfers'))->toBe([]);
});

test('envía, acepta y descarga un archivo; el estado solo lo ven los involucrados', function () {
    $code = $this->postJson('/api/room/create', DEVICE)->json('roomCode');
    otherDevice($code);

    $transferId = $this->post('/api/transfer/request', [
        'targetDeviceId' => 'equipo-b',
        'fileName' => 'informe final.txt',
        'fileSize' => 16,
        'file' => UploadedFile::fake()->createWithContent('informe final.txt', 'contenido ficticio'),
    ], ['Accept' => 'application/json'])->assertOk()->json('transferId');

    // El nombre se limpia para guardarlo, pero se descarga con el original.
    expect(Storage::disk(Almacenamiento::nombreDisco())->files('transfers')[0])->toEndWith('_informe-final.txt');

    // Un tercero no puede consultar la transferencia.
    $this->flushSession();
    $this->withSession(['device_id' => 'intruso', 'room_code' => $code])
        ->getJson("/api/transfer/{$transferId}/status")->assertStatus(404);

    $this->flushSession();
    $this->withSession(['device_id' => 'equipo-b', 'room_code' => $code]);
    $this->getJson('/api/transfer/pending')->assertOk()->assertJsonPath('requests.0.fileName', 'informe final.txt');
    $this->postJson("/api/transfer/{$transferId}/respond", ['action' => 'accept'])->assertOk();

    // El archivo se borra al terminar la petición (en las pruebas, antes de
    // leer el contenido transmitido), así que se revisa la cabecera.
    $this->get("/api/transfer/{$transferId}/download")
        ->assertOk()
        ->assertHeader('Content-Disposition', 'attachment; filename="informe final.txt"');
    $this->getJson("/api/transfer/{$transferId}/status")->assertJson(['status' => 'completed']);
});

test('borra los archivos de transferencias con más de 30 minutos', function () {
    $disk = Storage::disk(Almacenamiento::nombreDisco());
    $disk->put('transfers/viejo.txt', 'x');
    $disk->put('transfers/nuevo.txt', 'y');
    touch($disk->path('transfers/viejo.txt'), now()->subMinutes(40)->getTimestamp());

    expect(EvarisdropFileTransferController::purgeOldFiles())->toBe(1)
        ->and($disk->files('transfers'))->toBe(['transfers/nuevo.txt']);
});
