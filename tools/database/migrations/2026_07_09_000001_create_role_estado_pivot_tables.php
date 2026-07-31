<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tablas pivote para asignar estados (primario y secundario) a cada rol.
     * Un rol solo verá, en los selects de la app, los estados que tenga asignados.
     */
    public function up(): void
    {
        Schema::create('role_est_radicado', function (Blueprint $table) {
            $table->foreignId('role_id')->constrained('roles')->cascadeOnDelete();
            $table->foreignId('est_radicado_id')->constrained('EstRadicado')->cascadeOnDelete();
            $table->primary(['role_id', 'est_radicado_id']);
        });

        Schema::create('role_est_radisecundario', function (Blueprint $table) {
            $table->foreignId('role_id')->constrained('roles')->cascadeOnDelete();
            $table->foreignId('est_radisecundario_id')->constrained('EstRadisecundario')->cascadeOnDelete();
            $table->primary(['role_id', 'est_radisecundario_id']);
        });

        // Sembrado retrocompatible: asigna TODOS los estados existentes a TODOS los
        // roles existentes, para que la radicación siga funcionando tras el cambio.
        // Los estados que se creen a partir de ahora quedarán sin asignar hasta que
        // un administrador los asigne desde "Gestión de Roles".
        $roleIds = DB::table('roles')->pluck('id');

        $this->seedPivot('role_est_radicado', 'est_radicado_id', $roleIds, DB::table('EstRadicado')->pluck('id'));
        $this->seedPivot('role_est_radisecundario', 'est_radisecundario_id', $roleIds, DB::table('EstRadisecundario')->pluck('id'));
    }

    /**
     * Inserta el producto cartesiano rol × estado en la tabla pivote indicada.
     */
    private function seedPivot(string $table, string $estadoColumn, $roleIds, $estadoIds): void
    {
        $rows = [];

        foreach ($roleIds as $roleId) {
            foreach ($estadoIds as $estadoId) {
                $rows[] = ['role_id' => $roleId, $estadoColumn => $estadoId];
            }
        }

        foreach (array_chunk($rows, 500) as $chunk) {
            DB::table($table)->insert($chunk);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('role_est_radisecundario');
        Schema::dropIfExists('role_est_radicado');
    }
};
