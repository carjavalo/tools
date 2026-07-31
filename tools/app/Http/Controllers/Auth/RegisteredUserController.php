<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\Eps;
use App\Models\TipoDocumento;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules;
use Inertia\Inertia;
use Inertia\Response;

class RegisteredUserController extends Controller
{
    /**
     * Show the registration page.
     */
    public function create(): Response
    {
        return Inertia::render('auth/register', [
            'epsList' => Eps::query()
                ->where('Estado', true)
                ->orderBy('Nombre')
                ->get(['id', 'Nombre']),
            'tiposDocumento' => TipoDocumento::query()
                ->where('Estado', true)
                ->orderBy('Nombre')
                ->get(['id', 'Nombre']),
        ]);
    }

    /**
     * Handle an incoming registration request.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|lowercase|email|max:255|unique:'.User::class,
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
            'tipo_Docu' => 'nullable|string|max:120',
            'Numero_D' => 'nullable|string|max:20',
            'Apellido1' => 'nullable|string|max:50',
            'apellido2' => 'nullable|string|max:50',
            'Telefono1' => 'nullable|string|max:50',
            'telefono2' => 'nullable|string|max:50',
            'Direccion' => 'nullable|string|max:80',
            'Eps' => 'nullable|string|max:120',
        ]);

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'rol' => 'paciente',
            'tipo_Docu' => $request->tipo_Docu,
            'Numero_D' => $request->Numero_D,
            'Apellido1' => $request->Apellido1,
            'apellido2' => $request->apellido2,
            'Telefono1' => $request->Telefono1,
            'telefono2' => $request->telefono2,
            'Direccion' => $request->Direccion,
            'Eps' => $request->Eps,
        ]);

        event(new Registered($user));

        Auth::login($user);

        $request->session()->regenerate();

        return redirect()->intended(route('dashboard', absolute: false));
    }
}
