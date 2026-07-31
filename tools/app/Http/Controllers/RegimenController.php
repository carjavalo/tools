<?php

namespace App\Http\Controllers;

use App\Models\Regimen;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class RegimenController extends Controller
{
    /**
     * Crear un régimen (mini CRUD embebido en Gestión Convenios).
     */
    public function store(Request $request): RedirectResponse
    {
        Regimen::create($request->validate($this->rules()));

        return back()->with('success', 'Régimen creado correctamente.');
    }

    /**
     * Actualizar un régimen.
     */
    public function update(Request $request, Regimen $regimen): RedirectResponse
    {
        $regimen->update($request->validate($this->rules($regimen)));

        return back()->with('success', 'Régimen actualizado correctamente.');
    }

    /**
     * Eliminar un régimen.
     */
    public function destroy(Regimen $regimen): RedirectResponse
    {
        $regimen->delete();

        return back()->with('success', 'Régimen eliminado correctamente.');
    }

    /**
     * Reglas de validación.
     *
     * @return array<string, mixed>
     */
    private function rules(?Regimen $regimen = null): array
    {
        return [
            'nombre' => [
                'required',
                'string',
                'max:120',
                Rule::unique('regimen', 'nombre')->ignore($regimen?->id),
            ],
            'descripcion' => ['nullable', 'string', 'max:250'],
            'estado' => ['required', 'boolean'],
        ];
    }
}
