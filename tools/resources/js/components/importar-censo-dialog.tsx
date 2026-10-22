import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { router } from '@inertiajs/react';
import {
    CheckCircle2,
    FileSpreadsheet,
    LoaderCircle,
    TriangleAlert,
    Upload,
    XCircle,
} from 'lucide-react';
import { useState } from 'react';

/** Hojas del censo que se importan, en orden: la primera aparición manda. */
const HOJAS_CENSO = ['Hospitalización', 'Urgencias', 'Extensión', 'Egresados'];

/** Filas por petición; debe coincidir con UserManagementController::LOTE_CENSO. */
const LOTE = 100;

interface FilaCenso {
    nombre: string;
    identificacion: string;
    documento: string;
    responsable: string;
}

/** Fila del censo con la hoja de la que salió. */
interface FilaLeida {
    hoja: string;
    datos: FilaCenso;
}

/** Fila que ya había salido en una hoja anterior (o antes en la misma). */
interface FilaRepetida extends FilaLeida {
    primeraHoja: string;
}

/** Lo que el servidor respondió para cada fila enviada. */
type ResultadoFila =
    | {
          estado: 'creado';
          usuario: {
              Apellido1: string | null;
              apellido2: string | null;
              name: string;
              tipo_Docu: string | null;
              Numero_D: string;
              Eps: string | null;
              email: string;
          };
      }
    | {
          estado: 'existente';
          motivo: string;
          registrado?: string;
          rol?: string | null;
      }
    | { estado: 'omitido'; motivo: string };

type FilaResultado = FilaLeida & { resultado: ResultadoFila };

interface Resumen {
    hojas: { nombre: string; filas: number }[];
    hojasFaltantes: string[];
    repetidos: FilaRepetida[];
    resultados: FilaResultado[];
}

/** Sin tildes, en minúsculas y sin espacios de más: "Extensión" = "EXTENSION". */
function normalizar(texto: unknown): string {
    return String(texto ?? '')
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

/** Valor de una celda como texto; los números (documentos) sin decimales. */
function celda(valor: unknown): string {
    if (typeof valor === 'number') return String(Math.trunc(valor));
    return String(valor ?? '').trim();
}

function getXsrfToken(): string {
    const m = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : '';
}

/**
 * Lee el Excel del Censo Hospitalario y devuelve, de las hojas del censo, las
 * columnas Nombre, Identificación, Documento y Responsable. Las columnas se
 * ubican por su encabezado: en Egresados van en otra posición.
 */
async function leerCenso(archivo: File) {
    const XLSX = await import('xlsx');
    const libro = XLSX.read(await archivo.arrayBuffer(), { type: 'array' });

    const filas: FilaLeida[] = [];
    const repetidos: FilaRepetida[] = [];
    const hojas: Resumen['hojas'] = [];
    const hojasFaltantes: string[] = [];
    // Documento → hoja en la que salió por primera vez.
    const vistos = new Map<string, string>();

    for (const hojaCenso of HOJAS_CENSO) {
        const nombreHoja = libro.SheetNames.find(
            (n) => normalizar(n) === normalizar(hojaCenso),
        );
        if (!nombreHoja) {
            hojasFaltantes.push(hojaCenso);
            continue;
        }

        const datos = XLSX.utils.sheet_to_json<unknown[]>(
            libro.Sheets[nombreHoja],
            { header: 1, raw: true, defval: null, blankrows: false },
        );

        // El encabezado suele ser la primera fila; se busca en las primeras
        // por si el archivo trae un título encima.
        const iEncabezado = datos
            .slice(0, 15)
            .findIndex(
                (r) =>
                    r.some((c) => normalizar(c) === 'nombre') &&
                    r.some((c) => normalizar(c) === 'documento'),
            );
        if (iEncabezado < 0) {
            throw new Error(
                `La hoja "${nombreHoja}" no tiene las columnas Nombre y Documento.`,
            );
        }

        const encabezado = datos[iEncabezado].map(normalizar);
        const col = (titulo: string) => encabezado.indexOf(titulo);
        const iNombre = col('nombre');
        const iIdent = col('identificacion');
        const iDoc = col('documento');
        const iResp = col('responsable');

        let n = 0;
        for (const r of datos.slice(iEncabezado + 1)) {
            const fila: FilaCenso = {
                nombre: celda(r[iNombre]),
                identificacion: iIdent >= 0 ? celda(r[iIdent]) : '',
                documento: celda(r[iDoc]),
                responsable: iResp >= 0 ? celda(r[iResp]) : '',
            };
            if (!fila.nombre && !fila.documento) continue;
            n++;

            // Un paciente sale en varias hojas (o varias veces en Egresados):
            // se envía solo la primera vez.
            if (fila.documento) {
                const primeraHoja = vistos.get(fila.documento);
                if (primeraHoja !== undefined) {
                    repetidos.push({
                        hoja: nombreHoja,
                        datos: fila,
                        primeraHoja,
                    });
                    continue;
                }
                vistos.set(fila.documento, nombreHoja);
            }
            filas.push({ hoja: nombreHoja, datos: fila });
        }
        hojas.push({ nombre: nombreHoja, filas: n });
    }

    return { filas, repetidos, hojas, hojasFaltantes };
}

/** Columnas comunes: la fila tal como venía en el censo. */
function columnasCenso(f: FilaLeida) {
    return {
        Hoja: f.hoja,
        'Nombre (censo)': f.datos.nombre,
        Identificación: f.datos.identificacion,
        Documento: f.datos.documento,
        Responsable: f.datos.responsable,
    };
}

/** Filas de cada grupo, listas para Excel. */
function filasCreados(r: Resumen) {
    return r.resultados.flatMap((f) =>
        f.resultado.estado === 'creado'
            ? [
                  {
                      Hoja: f.hoja,
                      Apellido1: f.resultado.usuario.Apellido1 ?? '',
                      Apellido2: f.resultado.usuario.apellido2 ?? '',
                      Nombres: f.resultado.usuario.name,
                      'Tipo documento': f.resultado.usuario.tipo_Docu ?? '',
                      Documento: f.resultado.usuario.Numero_D,
                      EPS: f.resultado.usuario.Eps ?? '',
                      Correo: f.resultado.usuario.email,
                  },
              ]
            : [],
    );
}

function filasExistentes(r: Resumen) {
    return r.resultados.flatMap((f) =>
        f.resultado.estado === 'existente'
            ? [
                  {
                      ...columnasCenso(f),
                      Motivo: f.resultado.motivo,
                      'Registrado como': f.resultado.registrado ?? '',
                      'Rol registrado': f.resultado.rol ?? '',
                  },
              ]
            : [],
    );
}

function filasRepetidos(r: Resumen) {
    return r.repetidos.map((f) => ({
        ...columnasCenso(f),
        'Primera aparición (hoja)': f.primeraHoja,
    }));
}

function filasOmitidos(r: Resumen) {
    return r.resultados.flatMap((f) =>
        f.resultado.estado === 'omitido'
            ? [{ ...columnasCenso(f), Motivo: f.resultado.motivo }]
            : [],
    );
}

const GRUPOS = [
    {
        clave: 'creados',
        titulo: 'Pacientes creados',
        hoja: 'Creados',
        filas: filasCreados,
    },
    {
        clave: 'existentes',
        titulo: 'Ya existían (omitidos)',
        hoja: 'Ya existían',
        filas: filasExistentes,
    },
    {
        clave: 'repetidos',
        titulo: 'Repetidos en el archivo',
        hoja: 'Repetidos',
        filas: filasRepetidos,
    },
    {
        clave: 'omitidos',
        titulo: 'Sin datos válidos o HUV EVARISTO',
        hoja: 'Omitidos',
        filas: filasOmitidos,
    },
] as const;

type Grupo = (typeof GRUPOS)[number];

/** Ancho de columna aproximado a su contenido más largo, con tope. */
function anchos(filas: Record<string, string>[]) {
    return Object.keys(filas[0]).map((clave) => {
        let max = clave.length + 2;
        for (const f of filas)
            max = Math.max(max, String(f[clave] ?? '').length);
        return { wch: Math.min(50, max) };
    });
}

/** Descarga un libro con una hoja por grupo (los que tengan filas). */
async function exportar(
    resumen: Resumen,
    grupos: readonly Grupo[],
    nombre: string,
) {
    const XLSX = await import('xlsx');
    const libro = XLSX.utils.book_new();
    for (const g of grupos) {
        const filas: Record<string, string>[] = g.filas(resumen);
        if (filas.length === 0) continue;
        const hoja = XLSX.utils.json_to_sheet(filas);
        hoja['!cols'] = anchos(filas);
        XLSX.utils.book_append_sheet(libro, hoja, g.hoja);
    }
    if (libro.SheetNames.length === 0) return;
    const hoy = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(libro, `censo-${nombre}-${hoy}.xlsx`);
}

export default function ImportarCensoDialog({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [archivo, setArchivo] = useState<File | null>(null);
    const [importando, setImportando] = useState(false);
    const [progreso, setProgreso] = useState<{
        hechas: number;
        total: number;
    } | null>(null);
    const [resumen, setResumen] = useState<Resumen | null>(null);
    const [error, setError] = useState<string | null>(null);

    const reiniciar = () => {
        setArchivo(null);
        setProgreso(null);
        setResumen(null);
        setError(null);
    };

    const importar = async () => {
        if (!archivo) return;
        setImportando(true);
        setError(null);
        setResumen(null);

        let parcial: Resumen | null = null;
        try {
            const censo = await leerCenso(archivo);
            if (censo.hojas.length === 0) {
                throw new Error(
                    `El archivo no tiene ninguna de las hojas del censo (${HOJAS_CENSO.join(', ')}).`,
                );
            }

            const acumulado: Resumen = {
                hojas: censo.hojas,
                hojasFaltantes: censo.hojasFaltantes,
                repetidos: censo.repetidos,
                resultados: [],
            };
            parcial = acumulado;
            setProgreso({ hechas: 0, total: censo.filas.length });

            for (let i = 0; i < censo.filas.length; i += LOTE) {
                const lote = censo.filas.slice(i, i + LOTE);
                const r = await fetch(
                    '/tools/gestion-usuarios/importar-censo',
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Accept: 'application/json',
                            'X-XSRF-TOKEN': getXsrfToken(),
                        },
                        body: JSON.stringify({
                            filas: lote.map((f) => f.datos),
                        }),
                    },
                );
                if (r.status === 401 || r.status === 419) {
                    throw new Error(
                        'La sesión expiró. Recargue la página e inicie sesión de nuevo.',
                    );
                }
                if (r.status === 403) {
                    throw new Error(
                        'No tiene permiso para importar el Censo Hospitalario.',
                    );
                }
                if (!r.ok) {
                    throw new Error(
                        `El servidor respondió con error (${r.status}).`,
                    );
                }
                const d: { resultados: ResultadoFila[] } = await r.json();
                // El servidor responde en el mismo orden del lote.
                lote.forEach((f, j) => {
                    acumulado.resultados.push({
                        ...f,
                        resultado: d.resultados[j],
                    });
                });
                setProgreso({
                    hechas: Math.min(i + LOTE, censo.filas.length),
                    total: censo.filas.length,
                });
            }
            setResumen(acumulado);
        } catch (e) {
            const msg =
                e instanceof Error
                    ? e.message
                    : 'No se pudo leer el archivo de Excel.';
            // Lo ya importado queda guardado (y se puede exportar); al volver
            // a cargar el archivo se omite por documento existente.
            const creados = parcial ? filasCreados(parcial).length : 0;
            setError(
                creados > 0
                    ? `${msg} Alcanzaron a crearse ${creados} pacientes; puede volver a cargar el archivo y los ya creados se omitirán.`
                    : msg,
            );
            if (parcial && parcial.resultados.length > 0) setResumen(parcial);
        } finally {
            setImportando(false);
            router.reload({ only: ['users'] });
        }
    };

    const porcentaje =
        progreso && progreso.total > 0
            ? Math.round((progreso.hechas / progreso.total) * 100)
            : 0;

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                if (importando) return;
                onOpenChange(o);
                if (!o) reiniciar();
            }}
        >
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Importar Censo Hospitalario</DialogTitle>
                    <DialogDescription>
                        Carga como pacientes a las personas de las hojas
                        Hospitalización, Urgencias, Extensión y Egresados. Los
                        que ya están registrados (mismo número de documento) se
                        omiten.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="archivo-censo">Archivo de Excel</Label>
                        <Input
                            id="archivo-censo"
                            type="file"
                            accept=".xlsx,.xls"
                            disabled={importando}
                            onChange={(e) => {
                                setArchivo(e.target.files?.[0] ?? null);
                                setResumen(null);
                                setError(null);
                                setProgreso(null);
                            }}
                        />
                    </div>

                    {progreso && importando && (
                        <div className="grid gap-1.5">
                            <div className="h-2 overflow-hidden rounded-full bg-muted">
                                <div
                                    className="h-full bg-[#2d3e83] transition-all dark:bg-white"
                                    style={{ width: `${porcentaje}%` }}
                                />
                            </div>
                            <span className="text-xs text-muted-foreground">
                                Procesando {progreso.hechas} de {progreso.total}{' '}
                                pacientes ({porcentaje}%)…
                            </span>
                        </div>
                    )}

                    {error && (
                        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                            <XCircle className="mt-0.5 size-4 shrink-0" />
                            {error}
                        </div>
                    )}

                    {resumen && (
                        <div
                            className={`grid gap-2 rounded-lg border px-3 py-3 text-sm ${
                                error
                                    ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100'
                                    : 'border-green-200 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-100'
                            }`}
                        >
                            <div className="flex items-center gap-2 font-semibold">
                                {error ? (
                                    <TriangleAlert className="size-4" />
                                ) : (
                                    <CheckCircle2 className="size-4" />
                                )}
                                {error
                                    ? 'Importación incompleta'
                                    : 'Importación terminada'}
                            </div>
                            <ul className="grid gap-1">
                                {GRUPOS.map((g) => {
                                    const total = g.filas(resumen).length;
                                    return (
                                        <li
                                            key={g.clave}
                                            className="flex items-center justify-between gap-3"
                                        >
                                            <span>
                                                {g.titulo}:{' '}
                                                <strong>{total}</strong>
                                            </span>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="h-7 gap-1.5 bg-background px-2 text-xs text-foreground"
                                                disabled={total === 0}
                                                title={`Exportar a Excel: ${g.titulo.toLowerCase()}`}
                                                onClick={() =>
                                                    exportar(
                                                        resumen,
                                                        [g],
                                                        g.clave,
                                                    )
                                                }
                                            >
                                                <FileSpreadsheet className="size-3.5 text-green-700 dark:text-green-400" />
                                                Exportar
                                            </Button>
                                        </li>
                                    );
                                })}
                            </ul>
                            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-black/10 pt-2 dark:border-white/15">
                                <p className="text-xs opacity-80">
                                    Hojas leídas:{' '}
                                    {resumen.hojas
                                        .map((h) => `${h.nombre} (${h.filas})`)
                                        .join(', ')}
                                    {resumen.hojasFaltantes.length > 0 &&
                                        `. No se encontraron: ${resumen.hojasFaltantes.join(', ')}.`}
                                </p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 gap-1.5 bg-background px-2 text-xs text-foreground"
                                    onClick={() =>
                                        exportar(resumen, GRUPOS, 'resultado')
                                    }
                                >
                                    <FileSpreadsheet className="size-3.5 text-green-700 dark:text-green-400" />
                                    Exportar todo
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        disabled={importando}
                        onClick={() => {
                            onOpenChange(false);
                            reiniciar();
                        }}
                    >
                        Cerrar
                    </Button>
                    <Button
                        className="gap-2"
                        disabled={!archivo || importando}
                        onClick={importar}
                    >
                        {importando ? (
                            <LoaderCircle className="size-4 animate-spin" />
                        ) : (
                            <Upload className="size-4" />
                        )}
                        Importar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
