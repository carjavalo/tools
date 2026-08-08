<?php

namespace App\Observers;

use App\Models\Auditoria;
use App\Models\Convenio;
use App\Models\CotizacionCaso;
use App\Models\Cups;
use App\Models\CupsAnezado;
use App\Models\CupsEps;
use App\Models\Eps;
use App\Models\Especialidad;
use App\Models\EstRadicado;
use App\Models\EstRadisecundario;
use App\Models\Motivo;
use App\Models\Permiso;
use App\Models\RadicarCaso;
use App\Models\Regimen;
use App\Models\Role;
use App\Models\SeguimientoCaso;
use App\Models\SubEspecialidad;
use App\Models\TipoDocumento;
use App\Models\TrazabilidadCaso;
use App\Models\User;
use App\Support\DescriptorAuditoria;
use App\Support\RegistroAuditoria;
use Illuminate\Database\Eloquent\Model;

/**
 * Observa la creación, modificación y borrado de cualquier modelo del sistema
 * y lo deja escrito en la bitácora.
 *
 * Se engancha por eventos de modelo y no dentro de los controladores: así
 * ningún flujo existente cambia, y una escritura hecha desde un punto nuevo
 * también queda auditada sin que nadie tenga que acordarse de registrarla.
 */
class AuditoriaObserver
{
    /**
     * Modelos que se auditan. Se deja fuera la propia bitácora (se auditaría a
     * sí misma) y la trazabilidad de radicaciones, que ya es un registro de
     * cambios y duplicaría cada línea.
     *
     * @return array<int, class-string<Model>>
     */
    public static function modelosAuditados(): array
    {
        return [
            RadicarCaso::class,
            SeguimientoCaso::class,
            CupsAnezado::class,
            CotizacionCaso::class,
            User::class,
            Role::class,
            Permiso::class,
            Especialidad::class,
            SubEspecialidad::class,
            EstRadicado::class,
            EstRadisecundario::class,
            Motivo::class,
            Eps::class,
            Convenio::class,
            Regimen::class,
            Cups::class,
            CupsEps::class,
            TipoDocumento::class,
        ];
    }

    public function created(Model $model): void
    {
        if ($this->seOmite($model)) {
            return;
        }

        RegistroAuditoria::registrar(
            'creacion',
            DescriptorAuditoria::creacion($model),
            DescriptorAuditoria::modulo($model),
            $model,
            $this->valores($model, $model->getAttributes()),
        );
    }

    public function updated(Model $model): void
    {
        if ($this->seOmite($model)) {
            return;
        }

        $cambios = $this->cambios($model);

        // Un save() que no cambió nada no es una modificación.
        if ($cambios === []) {
            return;
        }

        RegistroAuditoria::registrar(
            'modificacion',
            DescriptorAuditoria::modificacion($model, $cambios),
            DescriptorAuditoria::modulo($model),
            $model,
            $cambios,
        );
    }

    public function deleted(Model $model): void
    {
        if ($this->seOmite($model)) {
            return;
        }

        RegistroAuditoria::registrar(
            'eliminacion',
            DescriptorAuditoria::eliminacion($model),
            DescriptorAuditoria::modulo($model),
            $model,
            $this->valores($model, $model->getOriginal()),
        );
    }

    /**
     * La bitácora nunca se audita a sí misma: entraría en un ciclo infinito.
     */
    private function seOmite(Model $model): bool
    {
        return $model instanceof Auditoria || $model instanceof TrazabilidadCaso;
    }

    /**
     * Campos que cambiaron, con su valor anterior y el nuevo ya legibles.
     *
     * @return array<string, array{antes: string, despues: string}>
     */
    private function cambios(Model $model): array
    {
        $cambios = [];

        foreach ($model->getChanges() as $campo => $nuevo) {
            if (! RegistroAuditoria::campoAuditable($campo)) {
                continue;
            }

            $cambios[$campo] = [
                'antes' => DescriptorAuditoria::valor($model, $campo, $model->getOriginal($campo)),
                'despues' => DescriptorAuditoria::valor($model, $campo, $nuevo),
            ];
        }

        return $cambios;
    }

    /**
     * Valores de un registro completo, ya filtrados y legibles.
     *
     * @param  array<string, mixed>  $atributos
     * @return array<string, string>
     */
    private function valores(Model $model, array $atributos): array
    {
        $valores = [];

        foreach ($atributos as $campo => $valor) {
            if (! RegistroAuditoria::campoAuditable($campo)) {
                continue;
            }

            $legible = DescriptorAuditoria::valor($model, $campo, $valor);

            if ($legible !== '—') {
                $valores[$campo] = $legible;
            }
        }

        return $valores;
    }
}
