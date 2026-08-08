<?php

namespace App\Providers;

use App\Listeners\RegistrarSesionAuditoria;
use App\Observers\AuditoriaObserver;
use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Events\Lockout;
use Illuminate\Auth\Events\Login;
use Illuminate\Auth\Events\Logout;
use Illuminate\Support\Facades\Event;
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
