<?php

use App\Models\RadicarCaso;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

test('la zona horaria no se lee del entorno', function () {
    // Se comprueba sobre el código fuente y no sobre config('app.timezone'):
    // env() resuelve el entorno al arrancar, así que cambiar APP_TIMEZONE
    // desde la prueba no altera nada y la comprobación pasaría siempre,
    // incluso con la lectura del entorno reintroducida.
    //
    // Mientras se leía de env('APP_TIMEZONE', ...), un servidor con
    // APP_TIMEZONE=UTC ignoraba el valor de Bogotá y todo quedaba guardado
    // cinco horas adelantado.
    $fuente = file_get_contents(config_path('app.php'));

    // Se busca la LLAMADA a env(), no la cadena APP_TIMEZONE suelta: el
    // comentario que explica por qué está fija sí la nombra.
    expect($fuente)->toMatch("/'timezone'\s*=>\s*'America\/Bogota'\s*,/")
        ->and($fuente)->not->toMatch("/env\(\s*'APP_TIMEZONE'/");
});

test('la aplicación corre en hora de Colombia', function () {
    expect(config('app.timezone'))->toBe('America/Bogota')
        ->and(date_default_timezone_get())->toBe('America/Bogota')
        // Colombia es UTC-5 permanente: no hay horario de verano.
        ->and(now()->getOffset())->toBe(-5 * 3600);
});

test('un registro nuevo se guarda con la hora de Colombia, no en UTC', function () {
    $caso = RadicarCaso::create(['Ndocumento' => '7001', 'estRad' => '1']);

    // Se lee el valor crudo de la columna: es lo que de verdad quedó escrito.
    // Comparar objetos Carbon no probaría nada, porque representan el mismo
    // instante aunque la zona sea distinta.
    $crudo = DB::table('RadicarCaso')->where('codrad', $caso->codrad)->value('created_at');
    $guardado = Carbon::parse($crudo, 'America/Bogota');

    // Si la aplicación estuviera en UTC, lo guardado iría ~300 minutos por
    // delante de la hora de Bogotá y esta comprobación fallaría.
    expect($guardado->diffInMinutes(Carbon::now('America/Bogota'), true))
        ->toBeLessThan(2);
});
