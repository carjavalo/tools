import { useRef, useState } from 'react';
import { Head } from '@inertiajs/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Ban,
    CheckCheck,
    CheckCircle,
    Download,
    Eye,
    FileText,
    HelpCircle,
    Loader2,
    RectangleHorizontal,
    Repeat,
    RotateCcw,
    RotateCw,
    Undo2,
    Upload,
} from 'lucide-react';
import ToolPageHeader from '@/components/ToolPageHeader';
import ToolCard from '@/components/ToolCard';
import FileUploadZone from '@/components/FileUploadZone';
import { PDFDocument, degrees } from 'pdf-lib';
import { usePdfThumbnails } from '@/hooks/use-pdf-thumbnails';
import {
    displaySize,
    downloadBlob,
    formatFileSize,
    isEncryptedPdfError,
    isPdfFile,
    normalizeRotation,
    pageFrame,
    pdfBaseName,
    type PageRotation,
} from '@/lib/pdf-pages';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

interface PageInfo {
    // Giro que ya trae el PDF (las miniaturas lo muestran aplicado).
    rotation: PageRotation;
    landscape: boolean;
}

interface RotatedResult {
    blob: Blob;
    url: string;
    changedPages: number;
}

const pageSequence = (total: number) => Array.from({ length: total }, (_, index) => index);

const describeTurn = (turn: number) => (turn === 90 ? '90° derecha' : turn === 180 ? '180°' : '90° izquierda');

export default function RotatePDF() {
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [pages, setPages] = useState<PageInfo[]>([]);
    // Giro que el usuario añade a cada página (en sentido horario).
    const [turns, setTurns] = useState<PageRotation[]>([]);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState<RotatedResult | null>(null);
    const [error, setError] = useState('');
    const [dragOver, setDragOver] = useState(false);
    const lastClickedRef = useRef<number | null>(null);

    const { thumbnails, isRendering, error: thumbnailsError } = usePdfThumbnails(pdfFile, 200);

    const pageCount = pages.length;
    const changedCount = turns.filter((turn) => turn !== 0).length;
    const renderedCount = thumbnails.filter(Boolean).length;
    // Las acciones de grupo se aplican a la selección, o a todo si no hay.
    const targets = selected.size > 0 ? [...selected] : pageSequence(pageCount);

    const startTour = () => {
        const driverObj = driver({
            showProgress: true,
            popoverClass: 'driverjs-theme',
            prevBtnText: 'Anterior',
            nextBtnText: 'Siguiente',
            doneBtnText: 'Finalizar',
            steps: [
                {
                    element: '[data-tour="upload"]',
                    popover: {
                        title: 'Paso 1: Subir PDF',
                        description: 'Selecciona o arrastra tu archivo PDF. Verás todas sus páginas abajo.',
                        side: 'right',
                        align: 'start',
                    },
                },
                {
                    element: '[data-tour="pages"]',
                    popover: {
                        title: 'Paso 2: Girar páginas',
                        description:
                            'Usa los botones de cada página para girarla, o haz clic en varias (Shift + clic para un rango) y gíralas juntas. La miniatura muestra cómo quedará.',
                        side: 'top',
                        align: 'start',
                    },
                },
                {
                    element: '[data-tour="options"]',
                    popover: {
                        title: 'Paso 3: Girar en grupo',
                        description:
                            'Gira las páginas seleccionadas (o todas, si no hay ninguna seleccionada). "Horizontales" selecciona de una vez las páginas apaisadas, útil con escaneos.',
                        side: 'left',
                        align: 'start',
                    },
                },
                {
                    element: '[data-tour="actions"]',
                    popover: {
                        title: 'Paso 4: Aplicar',
                        description: 'Haz clic en "Aplicar Rotaciones" y descarga el PDF. Todo se procesa en tu navegador.',
                        side: 'left',
                        align: 'start',
                    },
                },
            ],
        });
        driverObj.drive();
    };

    const clearResult = () => {
        if (result) URL.revokeObjectURL(result.url);
        setResult(null);
    };

    const handleFileSelect = async (files: FileList) => {
        const file = files[0];
        if (!file) return;

        if (!isPdfFile(file)) {
            setError('Por favor selecciona un archivo PDF válido.');
            return;
        }

        if (file.size > 50 * 1024 * 1024) {
            setError('El archivo es demasiado grande. Máximo 50MB permitido.');
            return;
        }

        clearResult();
        setError('');
        setIsLoading(true);
        try {
            const pdfDoc = await PDFDocument.load(await file.arrayBuffer());
            const info = pdfDoc.getPages().map((page) => {
                const frame = pageFrame(page);
                const size = displaySize(frame);
                return { rotation: frame.rotation, landscape: size.width > size.height };
            });
            setPdfFile(file);
            setPages(info);
            setTurns(info.map(() => 0));
            setSelected(new Set());
            lastClickedRef.current = null;
        } catch (err) {
            console.error('Error loading PDF:', err);
            setError(
                isEncryptedPdfError(err)
                    ? 'Este PDF está protegido con contraseña. Quita la protección antes de girarlo.'
                    : 'Error al cargar el PDF. El archivo puede estar dañado.',
            );
        } finally {
            setIsLoading(false);
        }
    };

    const turnPages = (indexes: number[], degreesClockwise: number) => {
        clearResult();
        setTurns((prev) => prev.map((turn, index) => (indexes.includes(index) ? normalizeRotation(turn + degreesClockwise) : turn)));
    };

    const resetTurns = () => {
        clearResult();
        setTurns((prev) => prev.map(() => 0));
    };

    const toggleSelected = (index: number, extendRange: boolean) => {
        const anchor = lastClickedRef.current;
        lastClickedRef.current = index;

        setSelected((prev) => {
            const next = new Set(prev);
            const select = !prev.has(index);
            const [from, to] = extendRange && anchor !== null ? [Math.min(anchor, index), Math.max(anchor, index)] : [index, index];
            for (let page = from; page <= to; page++) {
                if (select) next.add(page);
                else next.delete(page);
            }
            return next;
        });
    };

    // Horizontal tal como quedará, contando el giro que ya se le dio.
    const isLandscapeNow = (index: number) => (turns[index] % 180 === 0 ? pages[index].landscape : !pages[index].landscape);

    const selectWhere = (predicate: (index: number) => boolean) => setSelected(new Set(pageSequence(pageCount).filter(predicate)));

    const applyRotations = async () => {
        if (!pdfFile) return;

        setIsProcessing(true);
        setError('');

        try {
            const pdfDoc = await PDFDocument.load(await pdfFile.arrayBuffer());
            pdfDoc.getPages().forEach((page, index) => {
                const turn = turns[index] ?? 0;
                // Se suma al giro que ya tenía: antes se reemplazaba y una página
                // que venía girada no cambiaba o quedaba mal.
                if (turn !== 0) page.setRotation(degrees(normalizeRotation(pages[index].rotation + turn)));
            });

            const bytes = await pdfDoc.save();
            const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
            clearResult();
            setResult({ blob, url: URL.createObjectURL(blob), changedPages: changedCount });
        } catch (err) {
            console.error('Error rotating PDF:', err);
            setError('Error al rotar el PDF. Por favor intenta de nuevo.');
        } finally {
            setIsProcessing(false);
        }
    };

    const downloadRotatedPDF = () => {
        if (result && pdfFile) downloadBlob(result.blob, `${pdfBaseName(pdfFile)}_rotado.pdf`);
    };

    const resetTool = () => {
        clearResult();
        setPdfFile(null);
        setPages([]);
        setTurns([]);
        setSelected(new Set());
        setError('');
        lastClickedRef.current = null;
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files.length > 0) handleFileSelect(e.dataTransfer.files);
    };

    const scopeLabel = selected.size > 0 ? `${selected.size} ${selected.size === 1 ? 'seleccionada' : 'seleccionadas'}` : 'todas';

    return (
        <>
            <Head title="Rotar PDF - Evaristools" />

            <div className="min-h-screen bg-white dark:bg-[#1d1d1e]">
                <ToolPageHeader
                    title="Rotar PDF"
                    description="Rota las páginas de tus documentos PDF de forma individual o todas a la vez"
                    icon={RotateCw}
                />

                <div className="container mx-auto px-4 py-8">
                    <div className="max-w-6xl mx-auto">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                            {/* Left Column: File Upload & Messages */}
                            <div className="space-y-6" data-tour="upload">
                                {!pdfFile && (
                                    <ToolCard title="Seleccionar PDF">
                                        <FileUploadZone
                                            onFileSelect={handleFileSelect}
                                            acceptedTypes=".pdf,application/pdf"
                                            dragOver={dragOver}
                                            onDragOver={handleDragOver}
                                            onDragEnter={handleDragOver}
                                            onDragLeave={handleDragLeave}
                                            onDrop={handleDrop}
                                            title="Arrastra tu PDF aquí"
                                            subtitle="o haz clic para seleccionar (máximo 50MB)"
                                        />
                                        {isLoading && (
                                            <p className="flex items-center text-sm text-slate-600 dark:text-slate-300">
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Leyendo el PDF...
                                            </p>
                                        )}
                                    </ToolCard>
                                )}

                                {error && (
                                    <ToolCard title="Error">
                                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                            <p className="text-red-800 dark:text-red-200">{error}</p>
                                        </div>
                                    </ToolCard>
                                )}

                                {pdfFile && (
                                    <ToolCard title="Archivo Seleccionado">
                                        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-[#222322] rounded-lg">
                                            <div className="flex min-w-0 items-center space-x-3">
                                                <FileText className="h-8 w-8 flex-shrink-0 text-institutional" />
                                                <div className="min-w-0">
                                                    <p className="truncate font-medium text-slate-900 dark:text-white">{pdfFile.name}</p>
                                                    <p className="text-sm text-slate-600 dark:text-slate-300">
                                                        {pageCount} {pageCount === 1 ? 'página' : 'páginas'} · {formatFileSize(pdfFile.size)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </ToolCard>
                                )}

                                {result && (
                                    <ToolCard title="¡PDF Rotado Exitosamente!">
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-center space-x-3 p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                                <CheckCircle className="h-8 w-8 flex-shrink-0 text-green-600" />
                                                <div>
                                                    <p className="font-medium text-green-800 dark:text-green-200">
                                                        {result.changedPages === 1
                                                            ? 'Se giró 1 página.'
                                                            : `Se giraron ${result.changedPages} páginas.`}
                                                    </p>
                                                    <p className="text-sm text-green-600 dark:text-green-300">
                                                        {formatFileSize(result.blob.size)} · descárgalo o revísalo antes.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex flex-col sm:flex-row gap-3">
                                                <Button onClick={downloadRotatedPDF} className="flex-1 bg-institutional hover:bg-institutional/90">
                                                    <Download className="mr-2 h-4 w-4" />
                                                    Descargar PDF Rotado
                                                </Button>
                                                <Button asChild variant="outline" className="flex-1">
                                                    <a href={result.url} target="_blank" rel="noopener noreferrer">
                                                        <Eye className="mr-2 h-4 w-4" />
                                                        Ver PDF
                                                    </a>
                                                </Button>
                                            </div>
                                        </div>
                                    </ToolCard>
                                )}
                            </div>

                            {/* Right Column */}
                            <div className="space-y-6">
                                <ToolCard title="Girar en Grupo" data-tour="options">
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label className="text-base block">Girar {scopeLabel}</Label>
                                            <div className="flex flex-wrap gap-2">
                                                <Button onClick={() => turnPages(targets, -90)} variant="outline" size="sm" disabled={!pageCount}>
                                                    <RotateCcw className="h-4 w-4 mr-2" />
                                                    90° Izquierda
                                                </Button>
                                                <Button onClick={() => turnPages(targets, 90)} variant="outline" size="sm" disabled={!pageCount}>
                                                    <RotateCw className="h-4 w-4 mr-2" />
                                                    90° Derecha
                                                </Button>
                                                <Button onClick={() => turnPages(targets, 180)} variant="outline" size="sm" disabled={!pageCount}>
                                                    180°
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-base block">Seleccionar</Label>
                                            <div className="flex flex-wrap gap-2">
                                                <Button size="sm" variant="outline" onClick={() => selectWhere(() => true)} disabled={!pageCount}>
                                                    <CheckCheck className="h-4 w-4 mr-1" />
                                                    Todas
                                                </Button>
                                                <Button size="sm" variant="outline" onClick={() => setSelected(new Set())} disabled={selected.size === 0}>
                                                    <Ban className="h-4 w-4 mr-1" />
                                                    Ninguna
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => selectWhere((index) => !selected.has(index))}
                                                    disabled={!pageCount}
                                                >
                                                    <Repeat className="h-4 w-4 mr-1" />
                                                    Invertir
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => selectWhere(isLandscapeNow)}
                                                    disabled={!pageCount}
                                                    title="Selecciona las páginas que quedarían apaisadas"
                                                >
                                                    <RectangleHorizontal className="h-4 w-4 mr-1" />
                                                    Horizontales
                                                </Button>
                                            </div>
                                        </div>

                                        <p className="text-sm text-slate-600 dark:text-slate-300">
                                            {pageCount === 0
                                                ? 'Sube un PDF para ver sus páginas.'
                                                : changedCount === 0
                                                  ? 'Aún no has girado ninguna página.'
                                                  : `${changedCount} ${changedCount === 1 ? 'página cambiará' : 'páginas cambiarán'} de orientación.`}
                                        </p>
                                    </div>
                                </ToolCard>

                                <ToolCard title="Acciones" data-tour="actions">
                                    <div className="space-y-3">
                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <Button
                                                onClick={applyRotations}
                                                disabled={isProcessing || !pdfFile || changedCount === 0}
                                                className="flex-1 bg-institutional hover:bg-institutional/90"
                                            >
                                                {isProcessing ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        Aplicando Rotaciones...
                                                    </>
                                                ) : (
                                                    <>
                                                        <RotateCw className="mr-2 h-4 w-4" />
                                                        Aplicar Rotaciones
                                                    </>
                                                )}
                                            </Button>
                                            <Button onClick={resetTool} variant="outline" className="flex-1" disabled={isProcessing || !pdfFile}>
                                                <Upload className="mr-2 h-4 w-4" />
                                                Seleccionar Otro
                                            </Button>
                                        </div>
                                        <Button
                                            onClick={startTour}
                                            variant="outline"
                                            className="w-full border-institutional text-institutional hover:bg-institutional/10"
                                        >
                                            <HelpCircle className="mr-2 h-4 w-4" />
                                            ¿Cómo funciona? - Tour Interactivo
                                        </Button>
                                    </div>
                                </ToolCard>
                            </div>
                        </div>

                        {/* Page grid */}
                        {pdfFile && pageCount > 0 && (
                            <ToolCard
                                title="Páginas"
                                description="Gira cada página con sus botones, o haz clic para seleccionar varias (Shift + clic para un rango)."
                                icon={Eye}
                                className="mt-8"
                                data-tour="pages"
                            >
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline">{selected.size} seleccionadas</Badge>
                                    <Button size="sm" variant="ghost" onClick={resetTurns} disabled={changedCount === 0}>
                                        <Undo2 className="h-4 w-4 mr-1" />
                                        Deshacer giros
                                    </Button>
                                    {isRendering && (
                                        <span className="flex items-center text-sm text-slate-600 dark:text-slate-300">
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Generando vista previa... {renderedCount}/{pageCount}
                                        </span>
                                    )}
                                </div>
                                {thumbnailsError && (
                                    <p className="text-sm text-red-600 dark:text-red-400">
                                        {thumbnailsError} Aún puedes girar las páginas con los botones.
                                    </p>
                                )}
                                <div className="grid max-h-[70vh] grid-cols-2 gap-4 overflow-y-auto p-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                                    {pageSequence(pageCount).map((index) => {
                                        const isSelected = selected.has(index);
                                        const turn = turns[index];
                                        const thumbnail = thumbnails[index];

                                        return (
                                            <div
                                                key={index}
                                                className={`flex flex-col overflow-hidden rounded-lg border bg-white dark:bg-[#2a2a2b] ${
                                                    isSelected
                                                        ? 'border-transparent ring-2 ring-institutional dark:ring-[#8b9bd6]'
                                                        : 'border-slate-200 dark:border-[#3f3f40]'
                                                }`}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={(e) => toggleSelected(index, e.shiftKey)}
                                                    aria-pressed={isSelected}
                                                    aria-label={`Página ${index + 1}${turn ? `, girada ${describeTurn(turn)}` : ''}: ${isSelected ? 'seleccionada' : 'clic para seleccionarla'}`}
                                                    className="relative flex aspect-square items-center justify-center overflow-hidden bg-slate-100 p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-institutional dark:bg-[#1d1d1e]"
                                                >
                                                    {thumbnail ? (
                                                        <img
                                                            src={thumbnail}
                                                            alt=""
                                                            draggable={false}
                                                            className="max-h-full max-w-full object-contain shadow-sm transition-transform duration-200"
                                                            style={{ transform: `rotate(${turn}deg)` }}
                                                        />
                                                    ) : thumbnailsError ? (
                                                        <FileText className="h-8 w-8 text-slate-400" style={{ transform: `rotate(${turn}deg)` }} />
                                                    ) : (
                                                        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                                                    )}
                                                    {turn !== 0 && (
                                                        <span className="absolute top-2 left-2 rounded bg-institutional px-1.5 py-0.5 text-xs font-semibold text-white shadow dark:bg-[#4a5ba3]">
                                                            {describeTurn(turn)}
                                                        </span>
                                                    )}
                                                    {isSelected && (
                                                        <CheckCircle className="absolute top-2 right-2 h-5 w-5 rounded-full bg-white text-institutional dark:bg-[#1d1d1e] dark:text-[#8b9bd6]" />
                                                    )}
                                                </button>
                                                <div className="flex items-center justify-between gap-1 border-t border-slate-200 px-1.5 py-1 text-xs dark:border-[#3f3f40]">
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-7 w-7"
                                                        onClick={() => turnPages([index], -90)}
                                                        aria-label={`Girar la página ${index + 1} a la izquierda`}
                                                        title="Girar a la izquierda"
                                                    >
                                                        <RotateCcw className="h-4 w-4" />
                                                    </Button>
                                                    <span className="font-medium text-slate-700 dark:text-slate-200">Pág. {index + 1}</span>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-7 w-7"
                                                        onClick={() => turnPages([index], 90)}
                                                        aria-label={`Girar la página ${index + 1} a la derecha`}
                                                        title="Girar a la derecha"
                                                    >
                                                        <RotateCw className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </ToolCard>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
