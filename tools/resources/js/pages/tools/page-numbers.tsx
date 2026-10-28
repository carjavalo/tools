import { useEffect, useMemo, useRef, useState } from 'react';
import { Head } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, ChevronLeft, ChevronRight, Download, Eye, FileText, Hash, HelpCircle, Loader2, Stamp, Upload } from 'lucide-react';
import ToolPageHeader from '@/components/ToolPageHeader';
import ToolCard from '@/components/ToolCard';
import FileUploadZone from '@/components/FileUploadZone';
import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont } from 'pdf-lib';
import { usePdfRenderer } from '@/hooks/use-pdf-thumbnails';
import { loadImageElement } from '@/lib/image-tools';
import {
    centeredPlacement,
    displaySize,
    downloadBlob,
    formatFileSize,
    isEncryptedPdfError,
    isPdfFile,
    pageFrame,
    pdfBaseName,
} from '@/lib/pdf-pages';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

type Position = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
type NumberFormat = 'number' | 'page' | 'page-of-total' | 'of-total' | 'slash' | 'roman';

interface PageNumberOptions {
    position: Position;
    format: NumberFormat;
    fontSize: number;
    // Distancia al borde, en milímetros.
    margin: number;
    color: string;
    bold: boolean;
    // Primera página que lleva número (las anteriores, como la portada, no).
    fromPage: number;
    startNumber: number;
}

interface PageSize {
    width: number;
    height: number;
}

interface NumberedResult {
    blob: Blob;
    url: string;
    pages: number;
}

const POINTS_PER_MM = 72 / 25.4;
const PREVIEW_WIDTH = 520;

const POSITIONS: { value: Position; label: string }[] = [
    { value: 'top-left', label: 'Arriba a la izquierda' },
    { value: 'top-center', label: 'Arriba al centro' },
    { value: 'top-right', label: 'Arriba a la derecha' },
    { value: 'bottom-left', label: 'Abajo a la izquierda' },
    { value: 'bottom-center', label: 'Abajo al centro' },
    { value: 'bottom-right', label: 'Abajo a la derecha' },
];

const FORMATS: { value: NumberFormat; label: string }[] = [
    { value: 'number', label: '1, 2, 3...' },
    { value: 'page', label: 'Página 1' },
    { value: 'page-of-total', label: 'Página 1 de 10' },
    { value: 'of-total', label: '1 de 10' },
    { value: 'slash', label: '1/10' },
    { value: 'roman', label: 'i, ii, iii...' },
];

const COLORS = [
    { value: '#000000', label: 'Negro' },
    { value: '#4b5563', label: 'Gris' },
    { value: '#2d3e83', label: 'Azul HUV' },
];

const DEFAULT_OPTIONS: PageNumberOptions = {
    position: 'bottom-center',
    format: 'page-of-total',
    fontSize: 11,
    margin: 10,
    color: '#000000',
    bold: false,
    fromPage: 1,
    startNumber: 1,
};

// Foliación de archivo: número consecutivo en la esquina superior derecha.
const FOLIATION: Partial<PageNumberOptions> = { position: 'top-right', format: 'number', fontSize: 12, margin: 10, color: '#000000', bold: true };

function toRoman(value: number): string {
    if (value <= 0) return String(value);
    const numerals: [number, string][] = [
        [1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'],
        [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i'],
    ];
    let result = '';
    for (const [amount, numeral] of numerals) {
        while (value >= amount) {
            result += numeral;
            value -= amount;
        }
    }
    return result;
}

function formatNumber(format: NumberFormat, number: number, total: number): string {
    switch (format) {
        case 'page':
            return `Página ${number}`;
        case 'page-of-total':
            return `Página ${number} de ${total}`;
        case 'of-total':
            return `${number} de ${total}`;
        case 'slash':
            return `${number}/${total}`;
        case 'roman':
            return toRoman(number);
        default:
            return `${number}`;
    }
}

const hexToRgb = (hex: string) => {
    const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return match ? rgb(parseInt(match[1], 16) / 255, parseInt(match[2], 16) / 255, parseInt(match[3], 16) / 255) : rgb(0, 0, 0);
};

/** Centro del número en la página tal como se ve, en puntos. */
function numberCenter(page: PageSize, textWidth: number, textHeight: number, options: PageNumberOptions) {
    const margin = options.margin * POINTS_PER_MM;
    const [row, column] = options.position.split('-');
    const u = column === 'left' ? margin + textWidth / 2 : column === 'right' ? page.width - margin - textWidth / 2 : page.width / 2;
    const v = row === 'top' ? margin + textHeight / 2 : page.height - margin - textHeight / 2;
    return { u, v };
}

let fontsPromise: Promise<{ regular: PDFFont; bold: PDFFont }> | null = null;

// Para medir el texto igual en la vista previa y en el PDF.
function measureFonts() {
    fontsPromise ??= PDFDocument.create().then(async (doc) => ({
        regular: await doc.embedFont(StandardFonts.Helvetica),
        bold: await doc.embedFont(StandardFonts.HelveticaBold),
    }));
    return fontsPromise;
}

export default function PageNumbers() {
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [pageSizes, setPageSizes] = useState<PageSize[]>([]);
    const [options, setOptions] = useState<PageNumberOptions>(DEFAULT_OPTIONS);
    const [previewPage, setPreviewPage] = useState(1);
    const [previewImage, setPreviewImage] = useState<HTMLImageElement | null>(null);
    const [fonts, setFonts] = useState<{ regular: PDFFont; bold: PDFFont } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState<NumberedResult | null>(null);
    const [error, setError] = useState('');
    const [dragOver, setDragOver] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const { pageCount, renderPage } = usePdfRenderer(pdfFile);
    const totalPages = pageSizes.length;
    const fromPage = Math.min(Math.max(1, options.fromPage), Math.max(1, totalPages));
    const numberedCount = Math.max(0, totalPages - fromPage + 1);
    const lastNumber = options.startNumber + numberedCount - 1;

    // Texto del número de una página (índice desde 0), o null si no lleva.
    const labelFor = (index: number) =>
        index + 1 < fromPage ? null : formatNumber(options.format, options.startNumber + index + 1 - fromPage, lastNumber);

    useEffect(() => {
        measureFonts().then(setFonts);
    }, []);

    useEffect(() => {
        setPreviewImage(null);
        if (!pageCount) return;
        let cancelled = false;
        renderPage(previewPage, PREVIEW_WIDTH).then(async (url) => {
            if (!url || cancelled) return;
            const image = await loadImageElement(url);
            if (!cancelled) setPreviewImage(image);
        });
        return () => {
            cancelled = true;
        };
    }, [pageCount, previewPage, renderPage]);

    const previewLabel = pdfFile ? labelFor(previewPage - 1) : formatNumber(options.format, options.startNumber, options.startNumber + 9);

    // Vista previa con la misma geometría que el PDF.
    useEffect(() => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        const page = pdfFile ? pageSizes[previewPage - 1] : { width: 595, height: 842 };
        if (!canvas || !context || !page || !fonts) return;

        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const scale = (PREVIEW_WIDTH * pixelRatio) / page.width;
        canvas.width = Math.round(page.width * scale);
        canvas.height = Math.round(page.height * scale);
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        if (previewImage) context.drawImage(previewImage, 0, 0, canvas.width, canvas.height);
        if (!previewLabel) return;

        const font = options.bold ? fonts.bold : fonts.regular;
        const width = font.widthOfTextAtSize(previewLabel, options.fontSize);
        const height = font.heightAtSize(options.fontSize, { descender: false });
        const { u, v } = numberCenter(page, width, height, options);
        context.font = `${options.bold ? 'bold ' : ''}${options.fontSize * scale}px Helvetica, Arial, sans-serif`;
        context.fillStyle = options.color;
        context.textBaseline = 'alphabetic';
        context.fillText(previewLabel, (u - width / 2) * scale, (v + height / 2) * scale, width * scale);
    }, [pdfFile, pageSizes, previewPage, previewImage, previewLabel, fonts, options]);

    const startTour = () => {
        const driverObj = driver({
            showProgress: true,
            popoverClass: 'driverjs-theme',
            prevBtnText: 'Anterior',
            nextBtnText: 'Siguiente',
            doneBtnText: 'Finalizar',
            steps: [
                {
                    element: '[data-tour="upload-zone"]',
                    popover: {
                        title: 'Paso 1: Seleccionar PDF',
                        description: 'Arrastra tu archivo PDF aquí o haz clic para seleccionarlo. El archivo debe ser menor a 50MB.',
                        side: 'bottom',
                        align: 'start',
                    },
                },
                {
                    element: '[data-tour="options"]',
                    popover: {
                        title: 'Paso 2: Configurar Opciones',
                        description:
                            'Elige la posición, el formato y el tamaño. Puedes empezar a numerar después de la portada y usar "Foliación" para el número en la esquina superior derecha.',
                        side: 'left',
                        align: 'start',
                    },
                },
                {
                    element: '[data-tour="preview"]',
                    popover: {
                        title: 'Paso 3: Revisar',
                        description: 'La vista previa muestra el número sobre tus páginas reales.',
                        side: 'right',
                        align: 'start',
                    },
                },
                {
                    element: '[data-tour="actions"]',
                    popover: {
                        title: 'Paso 4: Aplicar Números',
                        description: 'Haz clic en "Agregar Números de Página" y descarga el PDF.',
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

    const updateOptions = (changes: Partial<PageNumberOptions>) => {
        clearResult();
        setOptions((previous) => ({ ...previous, ...changes }));
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
                    ? 'Este PDF está protegido con contraseña. Quita la protección antes de numerarlo.'
                    : 'Error al cargar el PDF. El archivo puede estar dañado.',
            );
        } finally {
            setIsLoading(false);
        }
    };

    const addPageNumbers = async () => {
        if (!pdfFile || numberedCount === 0) return;

        setIsProcessing(true);
        setError('');

        try {
            const pdfDoc = await PDFDocument.load(await pdfFile.arrayBuffer());
            const font = await pdfDoc.embedFont(options.bold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica);
            const color = hexToRgb(options.color);

            pdfDoc.getPages().forEach((page, index) => {
                const label = labelFor(index);
                if (!label) return;

                // Se ubica en la página tal como se ve, aunque tenga /Rotate.
                const frame = pageFrame(page);
                const size = displaySize(frame);
                const width = font.widthOfTextAtSize(label, options.fontSize);
                const height = font.heightAtSize(options.fontSize, { descender: false });
                const { u, v } = numberCenter(size, width, height, options);
                const origin = centeredPlacement(frame, u, v, width, height);
                page.drawText(label, { x: origin.x, y: origin.y, size: options.fontSize, font, color, rotate: degrees(origin.rotate) });
            });

            const bytes = await pdfDoc.save();
            const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
            clearResult();
            setResult({ blob, url: URL.createObjectURL(blob), pages: numberedCount });
        } catch (err) {
            console.error('Error adding page numbers:', err);
            setError('Error al agregar números de página. Por favor intenta de nuevo.');
        } finally {
            setIsProcessing(false);
        }
    };

    const downloadNumberedPDF = () => {
        if (result && pdfFile) downloadBlob(result.blob, `${pdfBaseName(pdfFile)}_numerado.pdf`);
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

    const isFoliation = useMemo(
        () => Object.entries(FOLIATION).every(([key, value]) => options[key as keyof PageNumberOptions] === value),
        [options],
    );

    return (
        <>
            <Head title="Números de Página - Evaristools" />

            <div className="min-h-screen bg-white dark:bg-[#1d1d1e]">
                <ToolPageHeader title="Números de Página" description="Añade números de página a tus documentos PDF" icon={Hash} />

                <div className="container mx-auto px-4 py-8">
                    <div className="max-w-6xl mx-auto">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                            {/* Left Column: Upload, Preview & Messages */}
                            <div className="space-y-6">
                                {!pdfFile && (
                                    <ToolCard title="Seleccionar PDF" data-tour="upload-zone">
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

                                <ToolCard
                                    title="Vista Previa"
                                    icon={Eye}
                                    description={pdfFile ? undefined : 'Así se verá en una hoja A4. Sube un PDF para verlo sobre tus páginas.'}
                                    data-tour="preview"
                                >
                                    {pdfFile && totalPages > 1 && (
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
                                                {!previewLabel && ' · sin número'}
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
                                    <div className="flex justify-center rounded-lg bg-slate-100 p-3 dark:bg-[#1d1d1e]">
                                        <canvas
                                            ref={canvasRef}
                                            role="img"
                                            aria-label={`Vista previa de la página${previewLabel ? ` con el número "${previewLabel}"` : ''}`}
                                            className="h-auto max-h-[70vh] w-auto max-w-full border border-slate-200 shadow-sm dark:border-slate-700"
                                        />
                                    </div>
                                </ToolCard>

                                {result && (
                                    <ToolCard title="¡Números de Página Agregados!">
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-center space-x-3 p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                                <CheckCircle className="h-8 w-8 flex-shrink-0 text-green-600" />
                                                <div>
                                                    <p className="font-medium text-green-800 dark:text-green-200">
                                                        Se numeraron {result.pages} {result.pages === 1 ? 'página' : 'páginas'}.
                                                    </p>
                                                    <p className="text-sm text-green-600 dark:text-green-300">{formatFileSize(result.blob.size)}</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col sm:flex-row gap-3">
                                                <Button onClick={downloadNumberedPDF} className="flex-1 bg-institutional hover:bg-institutional/90">
                                                    <Download className="mr-2 h-4 w-4" />
                                                    Descargar PDF Numerado
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
                                <ToolCard title="Opciones de Numeración" data-tour="options">
                                    <div className="space-y-5">
                                        <button
                                            type="button"
                                            onClick={() => updateOptions(isFoliation ? DEFAULT_OPTIONS : FOLIATION)}
                                            aria-pressed={isFoliation}
                                            className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-institutional ${
                                                isFoliation
                                                    ? 'border-institutional bg-institutional/10 ring-1 ring-institutional dark:border-[#8b9bd6] dark:bg-[#8b9bd6]/15 dark:ring-[#8b9bd6]'
                                                    : 'border-slate-200 hover:border-institutional/60 dark:border-slate-700 dark:hover:border-[#8b9bd6]/60'
                                            }`}
                                        >
                                            <Stamp className="mt-0.5 h-5 w-5 flex-shrink-0 text-institutional dark:text-[#8b9bd6]" />
                                            <span>
                                                <span className="block text-sm font-medium text-slate-900 dark:text-white">Foliación</span>
                                                <span className="block text-xs text-slate-600 dark:text-slate-400">
                                                    Número consecutivo en la esquina superior derecha, como se folian los expedientes de archivo.
                                                </span>
                                            </span>
                                        </button>

                                        <div className="space-y-2">
                                            <Label id="position-label">Posición</Label>
                                            <div role="radiogroup" aria-labelledby="position-label" className="grid grid-cols-3 gap-2">
                                                {POSITIONS.map(({ value, label }) => (
                                                    <button
                                                        key={value}
                                                        type="button"
                                                        role="radio"
                                                        aria-checked={options.position === value}
                                                        aria-label={label}
                                                        title={label}
                                                        onClick={() => updateOptions({ position: value })}
                                                        className={`flex h-12 rounded-md border p-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-institutional ${
                                                            value.startsWith('top') ? 'items-start' : 'items-end'
                                                        } ${value.endsWith('left') ? 'justify-start' : value.endsWith('right') ? 'justify-end' : 'justify-center'} ${
                                                            options.position === value
                                                                ? 'border-institutional bg-institutional/10 dark:border-[#8b9bd6] dark:bg-[#8b9bd6]/15'
                                                                : 'border-slate-200 dark:border-slate-700'
                                                        }`}
                                                    >
                                                        <span
                                                            className={`h-1.5 w-5 rounded ${
                                                                options.position === value ? 'bg-institutional dark:bg-[#8b9bd6]' : 'bg-slate-300 dark:bg-slate-600'
                                                            }`}
                                                        />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label>Formato</Label>
                                                <Select value={options.format} onValueChange={(value) => updateOptions({ format: value as NumberFormat })}>
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {FORMATS.map((format) => (
                                                            <SelectItem key={format.value} value={format.value}>
                                                                {format.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="font-size">Tamaño: {options.fontSize} pt</Label>
                                                <input
                                                    id="font-size"
                                                    type="range"
                                                    min="7"
                                                    max="24"
                                                    step="1"
                                                    value={options.fontSize}
                                                    onChange={(e) => updateOptions({ fontSize: parseInt(e.target.value, 10) })}
                                                    className="w-full accent-institutional"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label htmlFor="margin">Distancia al borde: {options.margin} mm</Label>
                                                <input
                                                    id="margin"
                                                    type="range"
                                                    min="3"
                                                    max="30"
                                                    step="1"
                                                    value={options.margin}
                                                    onChange={(e) => updateOptions({ margin: parseInt(e.target.value, 10) })}
                                                    className="w-full accent-institutional"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label id="color-label">Color</Label>
                                                <div className="flex items-center gap-2" role="group" aria-labelledby="color-label">
                                                    {COLORS.map((color) => (
                                                        <button
                                                            key={color.value}
                                                            type="button"
                                                            onClick={() => updateOptions({ color: color.value })}
                                                            aria-pressed={options.color === color.value}
                                                            title={color.label}
                                                            className={`h-7 w-7 rounded-full border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-institutional ${
                                                                options.color === color.value
                                                                    ? 'border-institutional ring-2 ring-institutional/40 dark:border-white'
                                                                    : 'border-white shadow dark:border-slate-600'
                                                            }`}
                                                            style={{ backgroundColor: color.value }}
                                                        >
                                                            <span className="sr-only">{color.label}</span>
                                                        </button>
                                                    ))}
                                                    <label className="ml-2 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                                                        <Checkbox checked={options.bold} onCheckedChange={(checked) => updateOptions({ bold: checked === true })} />
                                                        Negrita
                                                    </label>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label htmlFor="from-page">Numerar desde la página</Label>
                                                <Input
                                                    id="from-page"
                                                    type="number"
                                                    min="1"
                                                    max={totalPages || undefined}
                                                    value={options.fromPage}
                                                    onChange={(e) => updateOptions({ fromPage: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                                                />
                                                <p className="text-xs text-slate-600 dark:text-slate-400">Usa 2 para no numerar la portada.</p>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="start-number">Primer número</Label>
                                                <Input
                                                    id="start-number"
                                                    type="number"
                                                    min="0"
                                                    value={options.startNumber}
                                                    onChange={(e) => updateOptions({ startNumber: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                                                />
                                                <p className="text-xs text-slate-600 dark:text-slate-400">Útil para continuar la numeración de otro documento.</p>
                                            </div>
                                        </div>

                                        {pdfFile && (
                                            <p className="text-sm text-slate-600 dark:text-slate-300">
                                                {numberedCount === 0
                                                    ? 'Ninguna página quedará numerada.'
                                                    : `Se numerarán ${numberedCount} ${numberedCount === 1 ? 'página' : 'páginas'}, del ${options.startNumber} al ${lastNumber}.`}
                                            </p>
                                        )}
                                    </div>
                                </ToolCard>

                                <ToolCard title="Acciones" data-tour="actions">
                                    <div className="space-y-3">
                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <Button
                                                onClick={addPageNumbers}
                                                disabled={isProcessing || !pdfFile || numberedCount === 0}
                                                className="flex-1 bg-institutional hover:bg-institutional/90"
                                            >
                                                {isProcessing ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        Agregando Números...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Hash className="mr-2 h-4 w-4" />
                                                        Agregar Números de Página
                                                    </>
                                                )}
                                            </Button>
                                            <Button onClick={resetTool} variant="outline" className="flex-1" disabled={isProcessing || !pdfFile}>
                                                <Upload className="mr-2 h-4 w-4" />
                                                Seleccionar Otro PDF
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
                    </div>
                </div>
            </div>
        </>
    );
}
