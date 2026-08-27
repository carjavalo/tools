<?php

namespace App\Support;

use App\Models\Convenio;
use App\Models\Cups;
use App\Models\Especialidad;
use App\Models\EstRadicado;
use App\Models\EstRadisecundario;
use App\Models\Motivo;
use App\Models\RadicarCaso;
use App\Models\SubEspecialidad;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

/**
 * Convierte un cambio en la base en una frase que se entienda sin conocerla.
 *
 * La bitácora la lee un auditor, no un programador: "Cambió el Estado Actual
 * de la radicación #88 de Recibido a Entregado" sirve; "estRad: 2 -> 4" no.
 */
class DescriptorAuditoria
{
    /** Nombre legible de cada modelo, en singular. */
    private const ENTIDADES = [
        'RadicarCaso' => 'la radicación',
        'SeguimientoCaso' => 'el seguimiento',
        'CupsAnezado' => 'el procedimiento CUPS',
        'CotizacionCaso' => 'la cotización',
        'User' => 'el usuario',
        'Role' => 'el rol',
        'Permiso' => 'los permisos',
        'Especialidad' => 'la especialidad',
        'SubEspecialidad' => 'la subespecialidad',
        'EstRadicado' => 'el estado',
        'EstRadisecundario' => 'el estado QX',
        'Motivo' => 'el motivo',
        'Eps' => 'la EPS',
        'Convenio' => 'el convenio',
        'Regimen' => 'el régimen',
        'Cups' => 'el CUPS',
        'CupsEps' => 'la asociación CUPS / EPS',
        'TipoDocumento' => 'el tipo de documento',
    ];

    /** Módulo al que pertenece cada modelo, para poder filtrar la vista. */
    private const MODULOS = [
        'RadicarCaso' => 'Radicaciones',
        'SeguimientoCaso' => 'Radicaciones',
        'CupsAnezado' => 'Radicaciones',
        'CotizacionCaso' => 'Radicaciones',
        'User' => 'Usuarios',
        'Role' => 'Roles y permisos',
        'Permiso' => 'Roles y permisos',
    ];

    /** Nombre con el que se conoce cada campo en la interfaz. */
    private const CAMPOS = [
        'estRad' => 'Estado Actual',
        'codestsecundario' => 'Estado QX',
        'codMed' => 'Médico',
        'Codesp' => 'Especialidad',
        'codsubesp' => 'Subespecialidad',
        'convenio' => 'Convenio',
        'Ndocumento' => 'Identificación del paciente',
        'fentregapro' => 'Entrega al Serv',
        'fecreci' => 'Fecha Recibido Serv',
        'fecAutorizacion' => 'Fecha Autorización',
        'fechavenautorizacion' => 'Fecha Vencimiento Autorización',
        'ObservacionTFX' => 'OB TFX',
        'ObservacionCCX' => 'Observación CCX',
        'venc_anestesia' => 'Vencimiento Anestesia',
        'copago' => 'Copago',
        'valor_copago' => 'Valor del copago',
        'paquete' => 'Paquete (PDF)',
        'maos' => 'MAOS',
        'estcod' => 'Motivo',
        'rol' => 'Rol',
        'Estado' => 'Estado',
        'Nombre' => 'Nombre',
        'name' => 'Nombres',
        'Apellido1' => 'Primer apellido',
        'apellido2' => 'Segundo apellido',
        'email' => 'Correo',
        'Numero_D' => 'N° de documento',
        'tipo_Docu' => 'Tipo de documento',
        'Telefono1' => 'Teléfono 1',
        'telefono2' => 'Teléfono 2',
        'Direccion' => 'Dirección',
        'Eps' => 'EPS',
        'codesp' => 'Especialidad',
        'Observacion' => 'Observación',
    ];

    public static function modulo(Model $model): string
    {
        return self::MODULOS[class_basename($model)] ?? 'Catálogos';
    }

    public static function entidad(Model $model): string
    {
        return self::ENTIDADES[class_basename($model)] ?? 'el registro';
    }

    /**
     * Cómo se identifica el registro en una frase, con datos puntuales.
     */
    public static function identidad(Model $model): string
    {
        return match (class_basename($model)) {
            'RadicarCaso' => '#'.$model->codrad
                .($model->Ndocumento ? ' (paciente '.$model->Ndocumento.')' : ''),
            'SeguimientoCaso', 'CotizacionCaso' => 'de la radicación #'.$model->codrad,
            'CupsAnezado' => 'de la radicación #'.$model->codRadicado,
            'User' => trim(implode(' ', array_filter([$model->name, $model->Apellido1, $model->apellido2])))
                .($model->Numero_D ? ' ('.$model->tipo_Docu.' '.$model->Numero_D.')' : '')
                .($model->rol ? ' con rol '.$model->rol : ''),
            'Permiso' => 'del rol '.(optional($model->role)->Nombre ?? $model->role_id).' sobre '.$model->vista,
            default => (string) ($model->Nombre ?? $model->nombre ?? $model->getKey()),
        };
    }

    public static function creacion(Model $model): string
    {
        return 'Creó '.self::entidad($model).' '.self::identidad($model);
    }

    public static function eliminacion(Model $model): string
    {
        return 'Eliminó '.self::entidad($model).' '.self::identidad($model);
    }

    /**
     * @param  array<string, array{antes: string, despues: string}>  $cambios
     */
    public static function modificacion(Model $model, array $cambios): string
    {
        $detalle = [];

        foreach ($cambios as $campo => $par) {
            $detalle[] = sprintf(
                '%s de %s a %s',
                self::etiquetaCampo($campo),
                $par['antes'],
                $par['despues'],
            );
        }

        return 'Modificó '.self::entidad($model).' '.self::identidad($model)
            .': '.implode('; ', $detalle);
    }

    public static function etiquetaCampo(string $campo): string
    {
        return self::CAMPOS[$campo] ?? $campo;
    }

    /**
     * Traduce el valor guardado al texto que ve el usuario: el nombre del
     * estado, del médico, del convenio… en vez del código.
     */
    public static function valor(Model $model, string $campo, mixed $valor): string
    {
        if ($valor instanceof \DateTimeInterface) {
            return $valor->format('Y-m-d');
        }

        $plano = trim((string) $valor);

        // Booleanos: "No" es un valor, no un vacío.
        if (in_array($campo, ['copago', 'maos', 'Estado', 'ver', 'crear', 'editar', 'borrar'], true)) {
            return in_array($plano, ['1', 'true'], true) ? 'Sí' : 'No';
        }

        if ($plano === '') {
            return '—';
        }

        if (preg_match('/^(\d{4}-\d{2}-\d{2})[ T]/', $plano, $m)) {
            return $m[1];
        }

        $nombre = match ($campo) {
            'estRad' => EstRadicado::find($plano)?->Nombre,
            'codestsecundario' => EstRadisecundario::find($plano)?->Nombre,
            'estcod' => Motivo::find($plano)?->Nombre,
            'Codesp', 'codesp' => Especialidad::where('espcodser', $plano)->value('Nombre'),
            'codsubesp' => SubEspecialidad::where('cod_SubEspecialidad', $plano)->value('Nombre'),
            'convenio' => Convenio::where('nit_Convenio', $plano)->value('nombre'),
            'cusv_id' => Cups::find($plano)?->Nombre,
            'codMed' => optional(User::find($plano), fn (User $u) => RegistroAuditoria::nombreCompleto($u)),
            'paquete' => basename($plano),
            'valor_copago' => '$'.number_format((float) $plano, 2, ',', '.'),
            default => null,
        };

        $texto = $nombre !== null && $nombre !== '' ? (string) $nombre : $plano;

        // Una observación larga no debe inundar la descripción.
        return mb_strlen($texto) > 120 ? mb_substr($texto, 0, 117).'…' : $texto;
    }

    /**
     * Descripción del inicio o cierre de sesión.
     */
    public static function sesion(string $evento, User $user): string
    {
        return match ($evento) {
            'sesion_inicio' => 'Inició sesión en el sistema',
            'sesion_fin' => 'Cerró sesión',
            default => 'Actividad de sesión',
        };
    }

    /**
     * Radicación asociada a un registro, para poder rastrearla.
     */
    public static function radicacionDe(Model $model): ?RadicarCaso
    {
        $codrad = $model->codrad ?? $model->codRadicado ?? null;

        return $codrad ? RadicarCaso::find($codrad) : null;
    }
}
