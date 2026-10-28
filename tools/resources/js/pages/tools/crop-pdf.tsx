import { useEffect, useRef, useState } from 'react';
import { Head } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    CheckCircle,
    ChevronLeft,
    ChevronRight,
    Crop,
    Download,
    Eye,
    FileText,
    HelpCircle,
    Loader2,
    ScanLine,
    Undo2,
    Upload,
    WandSparkles,
} from 'lucide-react';
import ToolPageHeader from '@/components/ToolPageHeader';
import ToolCard from '@/components/ToolCard';
import FileUploadZone from '@/components/FileUploadZone';
import OptionButtons from '@/components/OptionButtons';
import { PDFDocument } from 'pdf-lib';
import { usePdfRenderer } from '@/hooks/use-pdf-thumbnails';
import { loadImageElement } from '@/lib/image-tools';
import {
    displaySize,
    displayToPdf,
    downloadBlob,
    formatFileSize,
    isEncryptedPdfError,
    isPdfFile,
    pageFrame,
    parsePageList,
    pdfBaseName,
} from '@/lib/pdf-pages';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

type Side = 'top' | 'right' | 'bottom' | 'left';
type Margins = Record<Side, number>;
type CropMode = 'same' | 'auto';
type PageScope = 'all' | 'current' | 'custom';

interface PageSize {
    width: number;
    height: number;
}

interface CroppedResult {
    blob: Blob;
    url: string;
    pages: number;
}

const POINTS_PER_MM = 72 / 25.4;
// Lo mínimo que puede quedar de la página, en milímetros.
const MIN_SIZE_MM = 20;
// Margen que se deja alrededor del contenido detectado.
const AUTO_PADDING_MM = 3;
const PREVIEW_WIDTH = 640;
const SIDES: { side: Side; label: string }[] = [
    { side: 'top', label: 'Superior' },
    { side: 'right', label: 'Derecho' },
    { side: 'bottom', label: 'Inferior' },
    { side: 'left', label: 'Izquierdo' },
];
const NO_MARGINS: Margins = { top: 0, right: 0, bottom: 0, left: 0 };

const roundMm = (value: number) => Math.round(value * 10) / 10;

/**
 * Márgenes en blanco de una página pintada (en mm), buscando la zona donde
 * hay algo que no es blanco. Devuelve null si la página está en blanco.
 */
async function detectContentMargins(imageUrl: string, page: PageSize): Promise<Margins | null> {
    const image = await loadImageElement(imageUrl);
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    context.drawImage(image, 0, 0);
    const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);

    let top = height;
    let left = width;
    let right = -1;
    let bottom = -1;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            // Tolerancia para el ruido de la compresión JPEG y de los escaneos.
            if (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2] < 235) {
                if (x < left) left = x;
                if (x > right) right = x;
                if (y < top) top = y;
                if (y > bottom) bottom = y;
            }
        }
    }
    if (right < 0) return null;

    const mmPerPixelX = page.width / POINTS_PER_MM / width;
    const mmPerPixelY = page.height / POINTS_PER_MM / height;
    const padding = AUTO_PADDING_MM;
    return {
        top: Math.max(0, top * mmPerPixelY - padding),
        bottom: Math.max(0, (height - 1 - bottom) * mmPerPixelY - padding),
        left: Math.max(0, left * mmPerPixelX - padding),
        right: Math.max(0, (width - 1 - right) * mmPerPixelX - padding),
    };
}

/** Recorta los márgenes para que quede al menos MIN_SIZE_MM de página. */
function fitMargins(margins: Margins, page: PageSize): Margins {
    const widthMm = page.width / POINTS_PER_MM;
    const heightMm = page.height / POINTS_PER_MM;
    const clamp = (value: number) => Math.max(0, value);
    const result = { ...margins };
    const extraX = result.left + result.right - (widthMm - MIN_SIZE_MM);
    if (extraX > 0) {
        result.left = clamp(result.left - extraX / 2);
        result.right = clamp(widthMm - MIN_SIZE_MM - result.left);
    }
    const extraY = result.top + result.bottom - (heightMm - MIN_SIZE_MM);
    if (extraY > 0) {
        result.top = clamp(result.top - extraY / 2);
        result.bottom = clamp(heightMm - MIN_SIZE_MM - result.top);
    }
    return result;
}

export default function CropPDF() {
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [pageSizes, setPageSizes] = useState<PageSize[]>([]);
    const [previewPage, setPreviewPage] = useState(1);
    const [pageImage, setPageImage] = useState<string | null>(null);
    const [margins, setMargins] = useState<Margins>({ top: 10, right: 10, bottom: 10, left: 10 });
    const [autoMargins, setAutoMargins] = useState<Margins | null>(null);
    const [mode, setMode] = useState<CropMode>('same');
    const [scope, setScope] = useState<PageScope>('all');
    const [pageList, setPageList] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isDetecting, setIsDetecting] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState('');
    const [result, setResult] = useState<CroppedResult | null>(null);
    const [error, setError] = useState('');
    const [dragOver, setDragOver] = useState(false);
    const pageRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<{ side: Side | 'move'; x: number; y: number; start: Margins } | null>(null);

    const { pageCount, renderPage } = usePdfRenderer(pdfFile);
    const totalPages = pageSizes.length;
    const pageSize = pageSizes[previewPage - 1];
    const shownMargins = mode === 'auto' ? (autoMargins ?? NO_MARGINS) : margins;

    const targetPages: number[] | null = (() => {
        if (!totalPages) return [];
        if (scope === 'all') return Array.from({ length: totalPages }, (_, index) => index);
        if (scope === 'current') return [previewPage - 1];
        return parsePageList(pageList, totalPages)?.map((page) => page - 1) ?? null;
    })();

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
                        description: 'Selecciona o arrastra tu archivo PDF. Verás la página para marcar el recorte.',
                        side: 'right',
                        align: 'start',
                    },
                },
                {
                    element: '[data-tour="preview"]',
                    popover: {
                        title: 'Paso 2: Marcar el Recorte',
                        description: 'Arrastra los bordes del recuadro sobre la página. Lo que queda oscuro se recorta.',
                        side: 'right',
                        align: 'start',
                    },
                },
                {
                    element: '[data-tour="options"]',
                    popover: {
                        title: 'Paso 3: Opciones',
                        description:
                            'Escribe los márgenes en milímetros, detéctalos automáticamente o ajusta cada página a su contenido. Elige a qué páginas aplicarlo.',
                        side: 'left',
                        align: 'start',
                    },
                },
                {
                    element: '[data-tour="actions"]',
                    popover: {
                        title: 'Paso 4: Aplicar Recorte',
                        description: 'Haz clic en "Aplicar Recorte" y descarga el PDF.',
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

    // Página de la vista previa.
    useEffect(() => {
        setPageImage(null);
        if (!pageCount) return;
        let cancelled = false;
        renderPage(previewPage, PREVIEW_WIDTH).then((url) => !cancelled && setPageImage(url));
        return () => {
            cancelled = true;
        };
    }, [pageCount, previewPage, renderPage]);

    // En modo automático se muestra lo que se detecta en la página visible.
    useEffect(() => {
        setAutoMargins(null);
        if (mode !== 'auto' || !pageImage || !pageSize) return;
        let cancelled = false;
        detectContentMargins(pageImage, pageSize).then((detected) => !cancelled && setAutoMargins(fitMargins(detected ?? NO_MARGINS, pageSize)));
        return () => {
            cancelled = true;
        };
    }, [mode, pageImage, pageSize]);

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

        setError('');
        setIsLoading(true);
        try {
            const pdfDoc = await PDFDocument.load(await file.arrayBuffer());
            clearResult();
            setPageSizes(pdfDoc.getPages().map((page) => displaySize(pageFrame(page))));
            setPdfFile(file);
            setPreviewPage(1);
        } catch (err) {
            console.error('Error loading PDF:', err);
            setError(
                isEncryptedPdfError(err)
                    ? 'Este PDF está protegido con contraseña. Quita la protección antes de recortarlo.'
                    : 'Error al cargar el PDF. El archivo puede estar dañado.',
            );
        } finally {
            setIsLoading(false);
        }
    };

    const updateMargins = (next: Margins) => {
        clearResult();
        setMargins(pageSize ? fitMargins(next, pageSize) : next);
    };

    const setUniformMargin = (value: number) => updateMargins({ top: value, right: value, bottom: value, left: value });

    // Toma los márgenes en blanco de la página visible y los deja para todas.
    const detectFromCurrentPage = async () => {
        if (!pageImage || !pageSize) return;
        setIsDetecting(true);
        try {
            const detected = await detectContentMargins(pageImage, pageSize);
            if (!detected) {
                setError('La página está en blanco: no hay contenido para detectar los márgenes.');
                return;
            }
            setError('');
            setMode('same');
            updateMargins({
                top: roundMm(detected.top),
                right: roundMm(detected.right),
                bottom: roundMm(detected.bottom),
                left: roundMm(detected.left),
            });
        } finally {
            setIsDetecting(false);
        }
    };

    // Arrastrar un borde (o todo el recuadro) sobre la vista previa.
    const startDrag = (side: Side | 'move') => (e: React.PointerEvent<HTMLElement>) => {
        if (mode !== 'same') return;
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        dragRef.current = { side, x: e.clientX, y: e.clientY, start: margins };
    };

    const handleDrag = (e: React.PointerEvent<HTMLElement>) => {
        const drag = dragRef.current;
        const rect = pageRef.current?.getBoundingClientRect();
        if (!drag || !rect || !pageSize) return;

        const dxMm = ((e.clientX - drag.x) / rect.width) * (pageSize.width / POINTS_PER_MM);
        const dyMm = ((e.clientY - drag.y) / rect.height) * (pageSize.height / POINTS_PER_MM);
        const start = drag.start;
        const next = { ...start };
        if (drag.side === 'move') {
            const moveX = Math.min(Math.max(dxMm, -start.left), start.right);
            const moveY = Math.min(Math.max(dyMm, -start.top), start.bottom);
            next.left = start.left + moveX;
            next.right = start.right - moveX;
            next.top = start.top + moveY;
            next.bottom = start.bottom - moveY;
        } else if (drag.side === 'left') next.left = Math.max(0, start.left + dxMm);
        else if (drag.side === 'right') next.right = Math.max(0, start.right - dxMm);
        else if (drag.side === 'top') next.top = Math.max(0, start.top + dyMm);
        else next.bottom = Math.max(0, start.bottom - dyMm);

        updateMargins({ top: roundMm(next.top), right: roundMm(next.right), bottom: roundMm(next.bottom), left: roundMm(next.left) });
    };

    const endDrag = () => {
        dragRef.current = null;
    };

    const cropPDF = async () => {
        if (!pdfFile || !targetPages || targetPages.length === 0) return;

        setIsProcessing(true);
        setError('');

        try {
            const pdfDoc = await PDFDocument.load(await pdfFile.arrayBuffer());
            const pages = pdfDoc.getPages();
            let blankPages = 0;

            for (const [position, index] of targetPages.entries()) {
                const page = pages[index];
                const frame = pageFrame(page);
                const size = displaySize(frame);

                let pageMargins = margins;
                if (mode === 'auto') {
                    setProgress(`Detectando contenido... ${position + 1}/${targetPages.length}`);
                    const image = await renderPage(index + 1, 300);
                    const detected = image ? await detectContentMargins(image, size) : null;
                    if (!detected) {
                        blankPages++;
                        continue;
                    }
                    pageMargins = detected;
                }

                // Los márgenes se miden en la página tal como se ve: se pasan a
                // coordenadas del PDF para que funcione con páginas giradas.
                const fitted = fitMargins(pageMargins, size);
                const toPoints = (mm: number) => mm * POINTS_PER_MM;
                const a = displayToPdf(frame, toPoints(fitted.left), toPoints(fitted.top));
                const b = displayToPdf(frame, size.width - toPoints(fitted.right), size.height - toPoints(fitted.bottom));
                page.setCropBox(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
            }

            const bytes = await pdfDoc.save();
            const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
            clearResult();
            setResult({ blob, url: URL.createObjectURL(blob), pages: targetPages.length - blankPages });
        } catch (err) {
            console.error('Error cropping PDF:', err);
            setError('Error al recortar el PDF. Por favor intenta de nuevo.');
        } finally {
            setIsProcessing(false);
            setProgress('');
        }
    };

    const downloadCroppedPDF = () => {
        if (result && pdfFile) downloadBlob(result.blob, `${pdfBaseName(pdfFile)}_recortado.pdf`);
    };

    const resetTool = () => {
        clearResult();
        setPdfFile(null);
        setPageSizes([]);
        setPreviewPage(1);
        setError('');
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

    // Posición del recuadro de recorte en la vista previa, en porcentajes.
    const box = pageSize
        ? {
              left: (shownMargins.left * POINTS_PER_MM * 100) / pageSize.width,
              right: (shownMargins.right * POINTS_PER_MM * 100) / pageSize.width,
              top: (shownMargins.top * POINTS_PER_MM * 100) / pageSize.height,
              bottom: (shownMargins.bottom * POINTS_PER_MM * 100) / pageSize.height,
          }
        : null;
    const resultSize = pageSize
        ? {
              width: Math.round(pageSize.width / POINTS_PER_MM - shownMargins.left - shownMargins.right),
              height: Math.round(pageSize.height / POINTS_PER_MM - shownMargins.top - shownMargins.bottom),
          }
        : null;
    const canCrop = !!pdfFile && !!targetPages && targetPages.length > 0 && !isProcessing;
    const handleClass = 'absolute z-10 bg-institutional shadow ring-2 ring-white dark:bg-[#8b9bd6]';

    return (
        <>
            <Head title="Recortar PDF - Evaristools" />

            <div className="min-h-screen bg-white dark:bg-[#1d1d1e]">
                <ToolPageHeader title="Recortar PDF" description="Elimina los márgenes de tus documentos PDF ajustando los bordes" icon={Crop} />

                <div className="container mx-auto px-4 py-8">
                    <div className="max-w-6xl mx-auto">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                            {/* Left Column: Upload, Preview & Messages */}
                            <div className="space-y-6">
                                {!pdfFile && (
                                    <ToolCard title="Seleccionar PDF" data-tour="upload">
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
                                                        {totalPages} {totalPages === 1 ? 'página' : 'páginas'} · {formatFileSize(pdfFile.size)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </ToolCard>
                                )}

                                {pdfFile && pageSize && box && (
                                    <ToolCard
                                        title="Marcar el Recorte"
                                        icon={Eye}
                                        description={
                                            mode === 'same'
                                                ? 'Arrastra los bordes del recuadro. Lo oscuro se recorta.'
                                                : 'Así queda esta página ajustada a su contenido. Cada página se ajusta por separado.'
                                        }
                                        data-tour="preview"
                                    >
                                        {totalPages > 1 && (
                                            <div className="flex items-center justify-between gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setPreviewPage(previewPage - 1)}
                                                    disabled={previewPage <= 1}
                                                    aria-label="Página anterior"
                                                >
                                                    <ChevronLeft className="h-4 w-4" />
                                                </Button>
                                                <span className="text-sm text-slate-700 dark:text-slate-200">
                                                    Página {previewPage} de {totalPages}
                                                </span>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setPreviewPage(previewPage + 1)}
                                                    disabled={previewPage >= totalPages}
                                                    aria-label="Página siguiente"
                                                >
                                                    <ChevronRight className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )}
                                        <div className="flex justify-center rounded-lg bg-slate-100 p-4 dark:bg-[#1d1d1e]">
                                            <div
                                                ref={pageRef}
                                                className="relative w-full max-w-[520px] select-none bg-white shadow-sm"
                                                style={{ aspectRatio: `${pageSize.width} / ${pageSize.height}` }}
                                            >
                                                {pageImage ? (
                                                    <img src={pageImage} alt={`Página ${previewPage}`} draggable={false} className="absolute inset-0 h-full w-full" />
                                                ) : (
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                                                    </div>
                                                )}
                                                {/* Zona que se conserva: la sombra exterior oscurece lo que se recorta */}
                                                <div
                                                    className={`absolute border-2 border-institutional shadow-[0_0_0_9999px_rgba(15,23,42,0.55)] dark:border-[#8b9bd6] ${mode === 'same' ? 'cursor-move touch-none' : ''}`}
                                                    style={{ left: `${box.left}%`, right: `${box.right}%`, top: `${box.top}%`, bottom: `${box.bottom}%` }}
                                                    onPointerDown={startDrag('move')}
                                                    onPointerMove={handleDrag}
                                                    onPointerUp={endDrag}
                                                    onPointerCancel={endDrag}
                                                >
                                                    {mode === 'same' &&
                                                        (['top', 'right', 'bottom', 'left'] as Side[]).map((side) => (
                                                            <span
                                                                key={side}
                                                                aria-hidden="true"
                                                                onPointerDown={startDrag(side)}
                                                                onPointerMove={handleDrag}
                                                                onPointerUp={endDrag}
                                                                onPointerCancel={endDrag}
                                                                className={`${handleClass} touch-none ${
                                                                    side === 'top'
                                                                        ? 'left-1/2 -top-1.5 h-3 w-10 -translate-x-1/2 cursor-ns-resize rounded-full'
                                                                        : side === 'bottom'
                                                                          ? 'left-1/2 -bottom-1.5 h-3 w-10 -translate-x-1/2 cursor-ns-resize rounded-full'
                                                                          : side === 'left'
                                                                            ? 'top-1/2 -left-1.5 h-10 w-3 -translate-y-1/2 cursor-ew-resize rounded-full'
                                                                            : 'top-1/2 -right-1.5 h-10 w-3 -translate-y-1/2 cursor-ew-resize rounded-full'
                                                                }`}
                                                            />
                                                        ))}
                                                </div>
                                                {mode === 'auto' && !autoMargins && pageImage && (
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <Loader2 className="h-6 w-6 animate-spin text-white" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {resultSize && (
                                            <p className="text-center text-sm text-slate-600 dark:text-slate-300">
                                                Esta página queda de {resultSize.width} × {resultSize.height} mm
                                            </p>
                                        )}
                                    </ToolCard>
                                )}

                                {result && (
                                    <ToolCard title="¡PDF Recortado Exitosamente!">
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-center space-x-3 p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                                <CheckCircle className="h-8 w-8 flex-shrink-0 text-green-600" />
                                                <div>
                                                    <p className="font-medium text-green-800 dark:text-green-200">
                                                        Se recortaron {result.pages} {result.pages === 1 ? 'página' : 'páginas'}.
                                                    </p>
                                                    <p className="text-sm text-green-600 dark:text-green-300">{formatFileSize(result.blob.size)}</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col sm:flex-row gap-3">
                                                <Button onClick={downloadCroppedPDF} className="flex-1 bg-institutional hover:bg-institutional/90">
                                                    <Download className="mr-2 h-4 w-4" />
                                                    Descargar PDF Recortado
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

                            {/* Right Column: Options & Actions */}
                            <div className="space-y-6">
                                <ToolCard title="Opciones de Recorte" data-tour="options">
                                    <div className="space-y-5">
                                        <div className="space-y-2">
                                            <Label id="crop-mode-label">Cómo recortar</Label>
                                            <OptionButtons
                                                labelledBy="crop-mode-label"
                                                value={mode}
                                                onChange={(value) => {
                                                    setMode(value);
                                                    clearResult();
                                                }}
                                                className="grid-cols-1 sm:grid-cols-2"
                                                options={[
                                                    { value: 'same', label: 'Mismos márgenes', icon: Crop },
                                                    { value: 'auto', label: 'Ajustar al contenido', icon: ScanLine },
                                                ]}
                                            />
                                            <p className="text-xs text-slate-600 dark:text-slate-400">
                                                {mode === 'same'
                                                    ? 'Quita los mismos milímetros de cada página.'
                                                    : 'Cada página se recorta hasta su contenido, dejando 3 mm alrededor. Útil para escaneos.'}
                                            </p>
                                        </div>

                                        {mode === 'same' && (
                                            <>
                                                <Button
                                                    variant="outline"
                                                    onClick={detectFromCurrentPage}
                                                    disabled={!pageImage || isDetecting}
                                                    className="w-full border-institutional text-institutional hover:bg-institutional/10 dark:border-[#8b9bd6] dark:text-[#8b9bd6]"
                                                >
                                                    {isDetecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WandSparkles className="mr-2 h-4 w-4" />}
                                                    Detectar márgenes de esta página
                                                </Button>

                                                <div className="space-y-2">
                                                    <Label>Márgenes iguales</Label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {[0, 5, 10, 15, 20].map((value) => (
                                                            <Button key={value} onClick={() => setUniformMargin(value)} variant="outline" size="sm">
                                                                {value === 0 ? 'Ninguno' : `${value} mm`}
                                                            </Button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <Label>Márgenes a recortar (mm)</Label>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        {SIDES.map(({ side, label }) => (
                                                            <div key={side}>
                                                                <Label htmlFor={`margin-${side}`} className="text-sm">
                                                                    {label}
                                                                </Label>
                                                                <Input
                                                                    id={`margin-${side}`}
                                                                    type="number"
                                                                    min="0"
                                                                    step="0.5"
                                                                    value={margins[side]}
                                                                    onChange={(e) => updateMargins({ ...margins, [side]: Math.max(0, parseFloat(e.target.value) || 0) })}
                                                                    className="mt-1"
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                <Button variant="ghost" size="sm" onClick={() => setUniformMargin(0)} disabled={Object.values(margins).every((value) => value === 0)}>
                                                    <Undo2 className="mr-1 h-4 w-4" />
                                                    Quitar recorte
                                                </Button>
                                            </>
                                        )}

                                        <div className="space-y-2">
                                            <Label id="crop-scope-label">Páginas</Label>
                                            <OptionButtons
                                                labelledBy="crop-scope-label"
                                                value={scope}
                                                onChange={(value) => {
                                                    setScope(value);
                                                    clearResult();
                                                }}
                                                className="grid-cols-3"
                                                options={[
                                                    { value: 'all', label: 'Todas' },
                                                    { value: 'current', label: 'Solo esta' },
                                                    { value: 'custom', label: 'Elegir' },
                                                ]}
                                            />
                                            {scope === 'custom' && (
                                                <>
                                                    <Input
                                                        value={pageList}
                                                        onChange={(e) => {
                                                            setPageList(e.target.value);
                                                            clearResult();
                                                        }}
                                                        placeholder="Ej: 1-3, 5, 8"
                                                        aria-label="Páginas a recortar"
                                                        aria-invalid={!!pdfFile && !!pageList.trim() && targetPages === null}
                                                    />
                                                    {pdfFile && pageList.trim() && targetPages === null && (
                                                        <p className="text-sm text-red-600 dark:text-red-400">
                                                            Revisa la lista: usa números entre 1 y {totalPages}, separados por comas o como rangos (2-5).
                                                        </p>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </ToolCard>

                                <ToolCard title="Acciones" data-tour="actions">
                                    <div className="space-y-3">
                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <Button onClick={cropPDF} disabled={!canCrop} className="flex-1 bg-institutional hover:bg-institutional/90">
                                                {isProcessing ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        {progress || 'Recortando...'}
                                                    </>
                                                ) : (
                                                    <>
                                                        <Crop className="mr-2 h-4 w-4" />
                                                        Aplicar Recorte
                                                    </>
                                                )}
                                            </Button>
                                            <Button onClick={resetTool} variant="outline" className="flex-1" disabled={isProcessing || !pdfFile}>
                                                <Upload className="mr-2 h-4 w-4" />
                                                Seleccionar Otro
                                            </Button>
                                        </div>
                                        <p className="text-xs text-slate-600 dark:text-slate-400">
                                            El recorte oculta los bordes en todos los lectores e impresoras, pero no borra lo que hay fuera: un programa de edición
                                            podría recuperarlo.
                                        </p>
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
                    </div>
                </div>
            </div>
        </>
    );
}
