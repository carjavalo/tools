<?php

namespace App\Observers;

use App\Models\RadicarCaso;
use App\Models\TrazabilidadCaso;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * Mantiene las radicaciones apuntando a su paciente cuando le cambian la
 * cédula.
 *
 * Las radicaciones no guardan el id del paciente: guardan su número de
 * documento (RadicarCaso.Ndocumento) y de ahí resuelven nombre, teléfonos y
 * aseguradora cada vez que se consultan. Por eso cambiar el nombre o los
 * apellidos se ve de inmediato en Consulta e Historial de Casos, pero cambiar
 * la cédula dejaba las radicaciones apuntando a un documento que ya no existía:
 * el paciente salía en blanco y la búsqueda por cédula dejaba de encontrarlas.
 *
 * Va en un observador y no dentro de los controladores porque la edición entra
 * por dos sitios —el modal de Nueva Radicación y el de Gestión de Usuarios— y
 * cualquier punto que se agregue después queda cubierto igual, sin que nadie
 * tenga que acordarse de repuntar las radicaciones.
 */
class DocumentoPacienteObserver
{
    public function updated(User $user): void
    {
        if (! $user->wasChanged('Numero_D')) {
            return;
        }

        $anterior = trim((string) $user->getOriginal('Numero_D'));
        $nuevo = trim((string) $user->Numero_D);

        // Sin documento anterior no hay radicaciones que repuntar. Sin
        // documento nuevo se quedarían huérfanas igual, así que se prefiere
        // dejarlas donde están antes que apuntarlas a la nada.
        if ($anterior === '' || $nuevo === '' || $anterior === $nuevo) {
            return;
        }

        // Todo el sistema resuelve un documento con el primer usuario que lo
        // tenga. Si otro usuario conserva el documento anterior, no hay forma
        // de saber de quién son esas radicaciones: se dejan como están antes
        // que moverlas al paciente equivocado.
        if (User::where('Numero_D', $anterior)->exists()) {
            return;
        }

        $casos = RadicarCaso::where('Ndocumento', $anterior)->get();

        if ($casos->isEmpty()) {
            return;
        }

        $autor = Auth::id();

        DB::transaction(function () use ($casos, $anterior, $nuevo, $autor) {
            foreach ($casos as $caso) {
                // Uno por uno y no con un update masivo: así el cambio entra
                // también en la bitácora general, que se alimenta de eventos
                // de modelo y no se dispara con las actualizaciones en bloque.
                $caso->update(['Ndocumento' => $nuevo]);

                // Y queda en la trazabilidad del caso, igual que cualquier
                // otro cambio de la identificación del paciente.
                TrazabilidadCaso::create([
                    'codrad' => $caso->codrad,
                    'user_id' => $autor,
                    'evento' => 'modificacion',
                    'campo' => 'Ndocumento',
                    'etiqueta' => 'Identificación del paciente',
                    'anterior' => $anterior,
                    'nuevo' => $nuevo,
                ]);
            }
        });
    }
}
