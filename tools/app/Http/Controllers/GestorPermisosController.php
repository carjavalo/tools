<?php

namespace App\Http\Controllers;

use App\Models\EstRadicado;
use App\Models\EstRadisecundario;
use App\Models\Permiso;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class GestorPermisosController extends Controller
{
    /**
     * Matriz de permisos por rol. Solo accesible para el Super Admin.
     */
    public function index(Request $request): Response
    {
        abort_unless($request->user()?->isSuperAdmin() ?? false, 403);

        // El Super Admin no se configura: siempre tiene acceso total.
        $roles = Role::where('Nombre', '!=', User::SUPER_ADMIN)
            ->orderBy('Nombre')
            ->get(['id', 'Nombre', 'Estado']);

        $roleId = (int) $request->query('role', 0);
        if (! $roles->contains('id', $roleId)) {
            $roleId = (int) ($roles->first()->id ?? 0);
        }

        // Permisos configurados del rol; las vistas sin fila quedan con todo
        // permitido (el comportamiento por defecto del sistema).
        $configurados = Permiso::where('role_id', $roleId)
            ->get()
            ->keyBy('vista');

        $permisos = collect(Permiso::VISTAS)->mapWithKeys(function ($vista) use ($configurados) {
            $p = $configurados->get($vista['key']);

            return [
                $vista['key'] => [
                    'ver' => $p?->ver ?? true,
                    'crear' => $p?->crear ?? true,
                    'editar' => $p?->editar ?? true,
                    'borrar' => $p?->borrar ?? true,
                ],
            ];
        })->all();

        return Inertia::render('tools/gestor-permisos', [
            'roles' => $roles,
            'vistas' => Permiso::VISTAS,
            'roleId' => $roleId,
            'permisos' => $permisos,
            // Candidatos y selección actual de roles asignables del rol.
            'todosLosRoles' => Role::orderBy('Nombre')->get(['id', 'Nombre']),
            'rolesAsignables' => $roleId
                ? Role::find($roleId)?->rolesAsignables()->pluck('roles.id')->all() ?? []
                : [],
            // Estados de radicación visibles en la grilla del Historial.
            'estadosList' => EstRadicado::orderBy('Nombre')->get(['id', 'Nombre']),
            'estadosGrilla' => $roleId
                ? Role::find($roleId)?->estadosGrilla()->pluck('EstRadicado.id')->all() ?? []
                : [],
            // Estados secundarios visibles en la grilla del Historial.
            'estadosSecList' => EstRadisecundario::orderBy('Nombre')->get(['id', 'Nombre']),
            'estadosSecGrilla' => $roleId
                ? Role::find($roleId)?->estadosSecGrilla()->pluck('EstRadisecundario.id')->all() ?? []
                : [],
            // Herramientas - Seguimiento: de qué roles y de qué módulos puede
            // ver actividad. Sin nada marcado, ve todo.
            'modulosAuditoria' => AuditoriaController::MODULOS,
            'auditoriaRoles' => $roleId
                ? Role::find($roleId)?->auditoriaRoles()->pluck('roles.id')->all() ?? []
                : [],
            'auditoriaModulos' => $roleId
                ? DB::table('role_auditoria_modulos')->where('role_id', $roleId)->pluck('modulo')->all()
                : [],
        ]);
    }

    /**
     * Guardar la matriz de permisos de un rol.
     */
    public function guardar(Request $request, Role $role): RedirectResponse
    {
        abort_unless($request->user()?->isSuperAdmin() ?? false, 403);
        abort_if($role->Nombre === User::SUPER_ADMIN, 422);

        $data = $request->validate([
            'permisos' => ['required', 'array'],
            'permisos.*.ver' => ['required', 'boolean'],
            'permisos.*.crear' => ['required', 'boolean'],
            'permisos.*.editar' => ['required', 'boolean'],
            'permisos.*.borrar' => ['required', 'boolean'],
            'roles_asignables' => ['nullable', 'array'],
            'roles_asignables.*' => ['integer', 'exists:roles,id'],
            'estados_grilla' => ['nullable', 'array'],
            'estados_grilla.*' => ['integer', 'exists:EstRadicado,id'],
            'estados_sec_grilla' => ['nullable', 'array'],
            'estados_sec_grilla.*' => ['integer', 'exists:EstRadisecundario,id'],
            'auditoria_roles' => ['nullable', 'array'],
            'auditoria_roles.*' => ['integer', 'exists:roles,id'],
            'auditoria_modulos' => ['nullable', 'array'],
            'auditoria_modulos.*' => ['string', Rule::in(AuditoriaController::MODULOS)],
        ]);

        $role->rolesAsignables()->sync($data['roles_asignables'] ?? []);
        $role->estadosGrilla()->sync($data['estados_grilla'] ?? []);
        $role->estadosSecGrilla()->sync($data['estados_sec_grilla'] ?? []);
        $role->auditoriaRoles()->sync($data['auditoria_roles'] ?? []);

        // Los módulos no tienen catálogo propio: se reemplaza el conjunto.
        DB::table('role_auditoria_modulos')->where('role_id', $role->id)->delete();
        foreach ($data['auditoria_modulos'] ?? [] as $modulo) {
            DB::table('role_auditoria_modulos')->insert([
                'role_id' => $role->id,
                'modulo' => $modulo,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        foreach ($data['permisos'] as $vista => $flags) {
            if (! in_array($vista, Permiso::vistasKeys(), true)) {
                continue;
            }

            Permiso::updateOrCreate(
                ['role_id' => $role->id, 'vista' => $vista],
                [
                    'ver' => $flags['ver'],
                    'crear' => $flags['crear'],
                    'editar' => $flags['editar'],
                    'borrar' => $flags['borrar'],
                ],
            );
        }

        return to_route('tools.gestor-permisos', ['role' => $role->id])
            ->with('success', "Permisos del rol {$role->Nombre} guardados correctamente.");
    }
}
