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
import { CheckCircle2, LoaderCircle, Upload, XCircle } from 'lucide-react';
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

interface Resumen {
    hojas: { nombre: string; filas: number }[];
    hojasFaltantes: string[];
    repetidos: number;
    creados: number;
    existentes: number;
    omitidos: number;
}

/** Sin tildes, en minúsculas y sin espacios de más: "Extensión" = "EXTENSION". */
function normalizar(texto: unknown): string {
    return String(texto ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
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

    const filas: FilaCenso[] = [];
    const hojas: Resumen['hojas'] = [];
    const hojasFaltantes: string[] = [];
    const vistos = new Set<string>();
    let repetidos = 0;

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
                if (vistos.has(fila.documento)) {
                    repetidos++;
                    continue;
                }
                vistos.add(fila.documento);
            }
            filas.push(fila);
        }
        hojas.push({ nombre: nombreHoja, filas: n });
    }

    return { filas, hojas, hojasFaltantes, repetidos };
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

            parcial = {
                hojas: censo.hojas,
                hojasFaltantes: censo.hojasFaltantes,
                repetidos: censo.repetidos,
                creados: 0,
                existentes: 0,
                omitidos: 0,
            };
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
                        body: JSON.stringify({ filas: lote }),
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
                const d = await r.json();
                parcial = {
                    ...parcial,
                    creados: parcial.creados + d.creados,
                    existentes: parcial.existentes + d.existentes,
                    omitidos: parcial.omitidos + d.omitidos,
                };
                setProgreso({
                    hechas: Math.min(i + LOTE, censo.filas.length),
                    total: censo.filas.length,
                });
            }
            setResumen(parcial);
        } catch (e) {
            const msg =
                e instanceof Error
                    ? e.message
                    : 'No se pudo leer el archivo de Excel.';
            // Lo ya importado queda guardado; al volver a cargar el archivo se
            // omite por documento existente.
            setError(
                parcial && parcial.creados > 0
                    ? `${msg} Alcanzaron a crearse ${parcial.creados} pacientes; puede volver a cargar el archivo y los ya creados se omitirán.`
                    : msg,
            );
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
            <DialogContent className="sm:max-w-lg">
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
                        <div className="grid gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-3 text-sm text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-100">
                            <div className="flex items-center gap-2 font-semibold">
                                <CheckCircle2 className="size-4" />
                                Importación terminada
                            </div>
                            <ul className="grid gap-0.5">
                                <li>
                                    Pacientes creados:{' '}
                                    <strong>{resumen.creados}</strong>
                                </li>
                                <li>
                                    Ya existían (omitidos):{' '}
                                    <strong>{resumen.existentes}</strong>
                                </li>
                                <li>
                                    Repetidos en el archivo:{' '}
                                    <strong>{resumen.repetidos}</strong>
                                </li>
                                <li>
                                    Sin datos válidos o HUV EVARISTO:{' '}
                                    <strong>{resumen.omitidos}</strong>
                                </li>
                            </ul>
                            <p className="text-xs opacity-80">
                                Hojas leídas:{' '}
                                {resumen.hojas
                                    .map((h) => `${h.nombre} (${h.filas})`)
                                    .join(', ')}
                                {resumen.hojasFaltantes.length > 0 &&
                                    `. No se encontraron: ${resumen.hojasFaltantes.join(', ')}.`}
                            </p>
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
