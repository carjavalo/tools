<?php

namespace App\Providers;

use App\Listeners\RegistrarSesionAuditoria;
use App\Models\User;
use App\Observers\AuditoriaObserver;
use App\Observers\DocumentoPacienteObserver;
use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Events\Lockout;
use Illuminate\Auth\Events\Login;
use Illuminate\Auth\Events\Logout;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->registrarAuditoria();

        // Las radicaciones apuntan al paciente por su número de documento: si
        // cambia, hay que llevarlas con él o quedan huérfanas.
        User::observe(DocumentoPacienteObserver::class);

        $this->registrarLimitesEvarisdrop();
    }

    /**
     * Evarisdrop consulta la sala cada 2-3 segundos. El límite va por sesión
     * porque en el hospital muchos equipos salen a internet con la misma IP;
     * el tope por IP es amplio y solo frena abusos.
     */
    private function registrarLimitesEvarisdrop(): void
    {
        $porSesion = fn (Request $request) => $request->hasSession() ? $request->session()->getId() : $request->ip();

        RateLimiter::for('evarisdrop', fn (Request $request) => [
            Limit::perMinute(120)->by('sesion:'.$porSesion($request)),
            Limit::perMinute(1500)->by('ip:'.$request->ip()),
        ]);

        RateLimiter::for('evarisdrop-envios', fn (Request $request) => [
            Limit::perMinute(15)->by('sesion:'.$porSesion($request)),
            Limit::perMinute(60)->by('ip:'.$request->ip()),
        ]);
    }

    /**
     * Engancha la bitácora de actividad.
     *
     * Se hace aquí y no dentro de los controladores: ninguno cambia, y lo que
     * se escriba mañana desde un punto nuevo queda auditado igual, sin que
     * nadie tenga que acordarse de registrarlo.
     */
    private function registrarAuditoria(): void
    {
        foreach (AuditoriaObserver::modelosAuditados() as $modelo) {
            $modelo::observe(AuditoriaObserver::class);
        }

        Event::listen(Login::class, [RegistrarSesionAuditoria::class, 'login']);
        Event::listen(Logout::class, [RegistrarSesionAuditoria::class, 'logout']);
        Event::listen(Failed::class, [RegistrarSesionAuditoria::class, 'failed']);
        Event::listen(Lockout::class, [RegistrarSesionAuditoria::class, 'lockout']);
    }
}
