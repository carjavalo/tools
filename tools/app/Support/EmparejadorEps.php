<?php

namespace App\Support;

use App\Models\Eps;
use Illuminate\Support\Str;

/**
 * Encuentra en la tabla eps la EPS que corresponde a un nombre escrito de otra
 * forma, como la columna Responsable del Censo Hospitalario.
 *
 * La radicación busca la EPS del paciente por su nombre exacto (users.Eps =
 * eps.Nombre) para traer sus convenios y acuerdos: "EMSSANAR EPS SAS" no
 * encuentra a "EMSSANAR". Por eso el nombre del archivo se reemplaza por el de
 * la tabla. Se prueba, en orden, y gana la primera regla que da una sola EPS:
 *
 *  1. Igual, sin tildes, puntuación, mayúsculas ni espacios.
 *  2. Igual, quitando además la forma legal y el régimen (EPS, SAS, S.A.,
 *     LTDA, SOAT, "Entidad Promotora de Salud", subsidiado…):
 *     "EPS FAMISANAR SAS" → FAMISANAR.
 *  3. El nombre del archivo extiende al de la tabla ("COMFENALCO VALLE" →
 *     COMFENALCO); si varias encajan, la de nombre más largo.
 *  4. El nombre del archivo viene recortado ("E.P.S. SURA" → EPS
 *     SURAMERICANA S. A); solo si encaja con una sola EPS.
 *
 * Si nada encaja, o encajan varias EPS distintas por igual, no hay EPS: mejor
 * dejarlo sin vincular que vincularlo a la que no es.
 */
class EmparejadorEps
{
    /** Palabras de forma legal o régimen que no distinguen a una EPS de otra. */
    private const GENERICAS = [
        'eps', 'epss', 'epsi', 's', 'a', 'sa', 'sas', 'ltda', 'ess', 'soat',
        'regimen', 'reg', 'subsidiado', 'subs', 'contributivo', 'contri',
    ];

    private const FRASE_GENERICA = ['entidad', 'promotora', 'de', 'salud'];

    /** @var list<array{nombre: string, completo: string, nucleo: string}> */
    private array $tabla;

    /** @var array<string, true> Nombres exactos de la tabla. */
    private array $nombres = [];

    /** @var array<string, ?string> */
    private array $cache = [];

    public function __construct()
    {
        $this->tabla = Eps::query()
            ->orderBy('id')
            ->pluck('Nombre')
            ->filter(fn ($n) => trim((string) $n) !== '')
            ->map(fn ($n) => [
                'nombre' => (string) $n,
                'completo' => self::completo((string) $n),
                'nucleo' => self::nucleo((string) $n),
            ])
            ->values()
            ->all();

        foreach ($this->tabla as $e) {
            $this->nombres[$e['nombre']] = true;
        }
    }

    /** ¿El texto ya es, tal cual, el nombre de una EPS de la tabla? */
    public function esDeLaTabla(?string $nombre): bool
    {
        return $nombre !== null && isset($this->nombres[$nombre]);
    }

    /** Nombre de la EPS de la tabla que corresponde al texto, o null. */
    public function buscar(?string $texto): ?string
    {
        $texto = trim((string) $texto);
        if ($texto === '') {
            return null;
        }

        return $this->cache[$texto] ??= $this->resolver($texto);
    }

    private function resolver(string $texto): ?string
    {
        $completo = self::completo($texto);
        $nucleo = self::nucleo($texto);

        $igual = fn (string $campo, string $valor) => $this->unica(
            array_filter($this->tabla, fn ($e) => $e[$campo] === $valor),
        );

        if (($r = $igual('completo', $completo)) !== null) {
            return $r;
        }
        if (strlen($nucleo) >= 3 && ($r = $igual('nucleo', $nucleo)) !== null) {
            return $r;
        }

        foreach (['completo' => $completo, 'nucleo' => $nucleo] as $campo => $valor) {
            if (strlen($valor) < 3) {
                continue;
            }

            // 3. El archivo extiende el nombre de la tabla: gana el más largo.
            $extendidas = array_filter(
                $this->tabla,
                fn ($e) => strlen($e[$campo]) >= 3 && str_starts_with($valor, $e[$campo]),
            );
            if ($extendidas !== []) {
                $largo = max(array_map(fn ($e) => strlen($e[$campo]), $extendidas));
                $r = $this->unica(array_filter($extendidas, fn ($e) => strlen($e[$campo]) === $largo));
                if ($r !== null) {
                    return $r;
                }
            }

            // 4. El archivo trae el nombre recortado: debe encajar con una sola.
            if (strlen($valor) >= 4) {
                $r = $this->unica(array_filter($this->tabla, fn ($e) => str_starts_with($e[$campo], $valor)));
                if ($r !== null) {
                    return $r;
                }
            }
        }

        return null;
    }

    /**
     * El nombre si todas las EPS encontradas se llaman igual (la tabla tiene
     * algunos nombres repetidos); null si no hay ninguna o hay varias.
     *
     * @param  array<int, array{nombre: string}>  $encontradas
     */
    private function unica(array $encontradas): ?string
    {
        $nombres = array_unique(array_column($encontradas, 'nombre'));

        return count($nombres) === 1 ? reset($nombres) : null;
    }

    /** @return list<string> */
    private static function palabras(string $texto): array
    {
        $texto = strtolower(Str::ascii($texto));
        // Las abreviaturas se juntan ("E.P.S." → "eps"); lo demás separa.
        $texto = str_replace('.', '', $texto);
        $texto = (string) preg_replace('/[^a-z0-9]+/', ' ', $texto);

        return array_values(array_filter(explode(' ', $texto), fn ($p) => $p !== ''));
    }

    /** Sin tildes, puntuación, mayúsculas ni espacios. */
    private static function completo(string $texto): string
    {
        return implode('', self::palabras($texto));
    }

    /** Como completo(), sin la forma legal ni el régimen. */
    private static function nucleo(string $texto): string
    {
        $palabras = self::palabras($texto);
        $frase = self::FRASE_GENERICA;

        for ($i = 0; $i + count($frase) <= count($palabras); $i++) {
            if (array_slice($palabras, $i, count($frase)) === $frase) {
                array_splice($palabras, $i, count($frase));
                $i--;
            }
        }

        return implode('', array_filter($palabras, fn ($p) => ! in_array($p, self::GENERICAS, true)));
    }
}
