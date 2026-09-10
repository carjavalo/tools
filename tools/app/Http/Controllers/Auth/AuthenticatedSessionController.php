<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Support\Sede;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Laravel\Fortify\Features;

class AuthenticatedSessionController extends Controller
{
    /**
     * Show the login page.
     */
    public function create(Request $request): Response
    {
        return Inertia::render('auth/login', [
            'canResetPassword' => Route::has('password.request'),
            'status' => $request->session()->get('status'),
        ]);
    }

    /**
     * Handle an incoming authentication request.
     *
     * Este es el ingreso de Programación de Cirugía Sede Cali.
     */
    public function store(LoginRequest $request): RedirectResponse
    {
        return $this->iniciarSesion($request, Sede::CALI);
    }

    /**
     * Opción "Programación de Cirugía Sede Cali" del inicio. Sin sesión lleva
     * al login, que es el de Cali; con sesión pasa a trabajar en Cali.
     */
    public function ingresarCali(Request $request): RedirectResponse
    {
        if (! $request->user()) {
            return to_route('login');
        }

        return $this->cambiarSede($request, Sede::CALI);
    }

    /**
     * Opción "Programación de Cirugía Sede Cartago" del inicio. Sin sesión
     * muestra su propio login; con sesión pasa a trabajar en Cartago.
     */
    public function createCartago(Request $request): Response|RedirectResponse
    {
        if ($request->user()) {
            return $this->cambiarSede($request, Sede::CARTAGO);
        }

        return Inertia::render('tools/programacion-cirugia-cartago-login', [
            'canResetPassword' => Route::has('password.request'),
            'status' => $request->session()->get('status'),
        ]);
    }

    /**
     * Ingreso de Programación de Cirugía Sede Cartago.
     */
    public function storeCartago(LoginRequest $request): RedirectResponse
    {
        return $this->iniciarSesion($request, Sede::CARTAGO);
    }

    /**
     * Inicia sesión dejando como sede activa la de la opción por la que se
     * ingresó. Un rol sin acceso a esa sede no entra, aunque la contraseña
     * sea correcta: entrar le daría una sede en la que no puede trabajar.
     */
    private function iniciarSesion(LoginRequest $request, string $sede): RedirectResponse
    {
        $user = $request->validateCredentials();

        if (! Sede::puedeIngresar($user, $sede)) {
            throw ValidationException::withMessages([
                'email' => $this->mensajeSinAcceso($sede, Sede::permitidasPara($user)),
            ]);
        }

        // Antes del segundo factor: el reto de Fortify regenera la sesión al
        // terminar, pero conserva sus datos, así que la sede llega intacta.
        Sede::establecer($request, $sede);

        if (Features::enabled(Features::twoFactorAuthentication()) && $user->hasEnabledTwoFactorAuthentication()) {
            $request->session()->put([
                'login.id' => $user->getKey(),
                'login.remember' => $request->boolean('remember'),
            ]);

            return to_route('two-factor.login');
        }

        Auth::login($user, $request->boolean('remember'));

        $request->session()->regenerate();

        return redirect()->intended(route('dashboard', absolute: false));
    }

    /**
     * Cambia de sede a quien ya tiene sesión y entra por la opción de la otra.
     */
    private function cambiarSede(Request $request, string $sede): RedirectResponse
    {
        if (! Sede::puedeIngresar($request->user(), $sede)) {
            return to_route('dashboard')->with(
                'error',
                'Tu rol no tiene acceso a la '.Sede::nombre($sede).'. Sigues trabajando en la '.Sede::nombre(Sede::activa()).'.',
            );
        }

        Sede::establecer($request, $sede);

        return to_route('dashboard')->with('success', 'Ahora trabajas en la '.Sede::nombre($sede).'.');
    }

    /**
     * Rechazo de ingreso por sede, con la opción por la que sí puede entrar.
     *
     * @param  list<string>  $permitidas
     */
    private function mensajeSinAcceso(string $sede, array $permitidas): string
    {
        $mensaje = 'Tu rol no tiene acceso a la '.Sede::nombre($sede).'.';

        if ($permitidas !== []) {
            $mensaje .= ' Ingresa por la opción Programación de Cirugía '.Sede::nombre($permitidas[0]).'.';
        }

        return $mensaje;
    }

    /**
     * Destroy an authenticated session.
     */
    public function destroy(Request $request): RedirectResponse
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }
}
