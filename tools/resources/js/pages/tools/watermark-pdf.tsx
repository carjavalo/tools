import { useEffect, useMemo, useRef, useState } from 'react';
import { Head } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    CheckCircle,
    ChevronLeft,
    ChevronRight,
    Download,
    Droplet,
    Eye,
    FileText,
    HelpCircle,
    Image as ImageIcon,
    LayoutGrid,
    Loader2,
    Square,
    Type,
    Upload,
} from 'lucide-react';
import ToolPageHeader from '@/components/ToolPageHeader';
import ToolCard from '@/components/ToolCard';
import FileUploadZone from '@/components/FileUploadZone';
import OptionButtons from '@/components/OptionButtons';
import { PDFDocument, type PDFFont } from 'pdf-lib';
import { usePdfRenderer } from '@/hooks/use-pdf-thumbnails';
import { loadImageElement, loadImageFile, loadImageUrl, revokeImage, type LoadedImage } from '@/lib/image-tools';
import {
    displaySize,
    downloadBlob,
    formatFileSize,
    isEncryptedPdfError,
    isPdfFile,
    pageFrame,
    parsePageList,
    pdfBaseName,
} from '@/lib/pdf-pages';
import {
    applyWatermark,
    assertEncodable,
    layoutWatermark,
    markSize,
    watermarkFont,
    type WatermarkAnchor,
    type WatermarkLayout,
    type WatermarkMark,
} from '@/lib/pdf-watermark';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

type MarkKind = 'text' | 'image';
type ImageSource = 'logo' | 'custom';
type PageMode = 'all' | 'first' | 'custom';

interface PageSize {
    width: number;
    height: number;
}

interface WatermarkResult {
    blob: Blob;
    url: string;
    pages: number;
}

const LOGO_URL = '/images/logo.png';
// Hoja A4 en blanco para ver la marca antes de subir un PDF.
const SAMPLE_PAGE: PageSize = { width: 595, height: 842 };
const PREVIEW_WIDTH = 520;

const ANCHORS: WatermarkAnchor[] = ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br'];
const ANCHOR_LABELS: Record<WatermarkAnchor, string> = {
    tl: 'Arriba a la izquierda',
    tc: 'Arriba al centro',
    tr: 'Arriba a la derecha',
    ml: 'Centro a la izquierda',
    mc: 'Centro',
    mr: 'Centro a la derecha',
    bl: 'Abajo a la izquierda',
    bc: 'Abajo al centro',
    br: 'Abajo a la derecha',
};

const ANGLES = [
    { value: '45', label: 'Diagonal ↗' },
    { value: '0', label: 'Horizontal' },
    { value: '-45', label: 'Diagonal ↘' },
    { value: '90', label: 'Vertical' },
];

const COLOR_PRESETS = [
    { value: '#808080', label: 'Gris' },
    { value: '#dc2626', label: 'Rojo' },
    { value: '#2d3e83', label: 'Azul HUV' },
    { value: '#000000', label: 'Negro' },
];

const defaultSize = (layout: WatermarkLayout, kind: MarkKind) => (layout === 'tile' ? 0.3 : kind === 'text' ? 0.75 : 0.45);

export default function WatermarkPDF() {
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [pageSizes, setPageSizes] = useState<PageSize[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState<WatermarkResult | null>(null);
    const [error, setError] = useState('');
    const [dragOver, setDragOver] = useState(false);

    const [kind, setKind] = useState<MarkKind>('text');
    const [text, setText] = useState('CONFIDENCIAL');
    const [color, setColor] = useState('#808080');
    const [imageSource, setImageSource] = useState<ImageSource>('logo');
    const [logoImage, setLogoImage] = useState<LoadedImage | null>(null);
    const [customImage, setCustomImage] = useState<LoadedImage | null>(null);
    const [customImageFile, setCustomImageFile] = useState<File | null>(null);
    const [removeWhite, setRemoveWhite] = useState(true);
    const [imageError, setImageError] = useState('');

    const [layout, setLayout] = useState<WatermarkLayout>('single');
    const [anchor, setAnchor] = useState<WatermarkAnchor>('mc');
    const [angle, setAngle] = useState(45);
    const [size, setSize] = useState(defaultSize('single', 'text'));
    const [opacity, setOpacity] = useState(0.3);

    const [pageMode, setPageMode] = useState<PageMode>('all');
    const [pageList, setPageList] = useState('');
    const [previewPage, setPreviewPage] = useState(1);
    const [previewImage, setPreviewImage] = useState<HTMLImageElement | null>(null);
    const [font, setFont] = useState<PDFFont | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);

    const { pageCount, renderPage } = usePdfRenderer(pdfFile);

    useEffect(() => {
        watermarkFont().then(setFont);
    }, []);

    // El logo solo se descarga si se elige marca de imagen.
    useEffect(() => {
        if (kind !== 'image' || logoImage) return;
        loadImageUrl(LOGO_URL)
            .then(setLogoImage)
            .catch(() => setImageError('No se pudo cargar el logo del hospital.'));
    }, [kind, logoImage]);

    // Se vuelve a procesar la imagen propia si cambia la opción de fondo.
    useEffect(() => {
        if (!customImageFile) return;
        let cancelled = false;
        loadImageFile(customImageFile, { removeWhite, maxDimension: 2000 })
            .then((image) => {
                if (cancelled) return revokeImage(image);
                setCustomImage((previous) => {
                    revokeImage(previous);
                    return image;
                });
                setImageError('');
            })
            .catch((err) => !cancelled && setImageError(err instanceof Error ? err.message : 'No se pudo leer la imagen.'));
        return () => {
            cancelled = true;
        };
    }, [customImageFile, removeWhite]);

    const totalPages = pageSizes.length;
    const activeImage = imageSource === 'logo' ? logoImage : customImage;

    const mark: WatermarkMark | null = useMemo(() => {
        if (kind === 'text') return text.trim() ? { kind: 'text', text: text.trim(), color } : null;
        return activeImage
            ? { kind: 'image', bytes: activeImage.bytes, format: activeImage.format, width: activeImage.width, height: activeImage.height }
            : null;
    }, [kind, text, color, activeImage]);

    const textError = useMemo(() => {
        if (kind !== 'text' || !font || !text.trim()) return '';
        try {
            assertEncodable(font, text.trim());
            return '';
        } catch (err) {
            return (err as Error).message;
        }
    }, [kind, font, text]);

    // Índices (desde 0) de las páginas que llevarán marca; null si la lista no es válida.
    const targetPages = useMemo(() => {
        if (!totalPages) return [];
        if (pageMode === 'all') return Array.from({ length: totalPages }, (_, index) => index);
        if (pageMode === 'first') return [0];
        return parsePageList(pageList, totalPages)?.map((page) => page - 1) ?? null;
    }, [pageMode, pageList, totalPages]);

    const options = { layout, anchor, angle, size };
    const previewHasMark = !pdfFile || (targetPages?.includes(previewPage - 1) ?? false);

    // Página de la vista previa ya pintada.
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

    // Vista previa: la misma geometría que se usa al escribir el PDF.
    useEffect(() => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        if (!canvas || !context) return;

        const page = pdfFile ? pageSizes[previewPage - 1] : SAMPLE_PAGE;
        if (!page) return;

        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const scale = (PREVIEW_WIDTH * pixelRatio) / page.width;
        canvas.width = Math.round(page.width * scale);
        canvas.height = Math.round(page.height * scale);

        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        if (previewImage) context.drawImage(previewImage, 0, 0, canvas.width, canvas.height);
        if (!mark || !font || textError || !previewHasMark) return;

        const item = markSize(mark, font, page.width, size);
        context.globalAlpha = opacity;
        for (const { u, v } of layoutWatermark(page.width, page.height, item.width, item.height, options)) {
            context.save();
            context.translate(u * scale, v * scale);
            context.rotate((-angle * Math.PI) / 180);
            if (mark.kind === 'text') {
                context.font = `bold ${item.fontSize * scale}px Helvetica, Arial, sans-serif`;
                context.fillStyle = mark.color;
                context.textBaseline = 'alphabetic';
                // El ancho máximo iguala la medida de Helvetica del PDF.
                context.fillText(mark.text, (-item.width * scale) / 2, (item.height * scale) / 2, item.width * scale);
            } else if (activeImage) {
                context.drawImage(activeImage.element, (-item.width * scale) / 2, (-item.height * scale) / 2, item.width * scale, item.height * scale);
            }
            context.restore();
        }
        context.globalAlpha = 1;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pdfFile, pageSizes, previewPage, previewImage, mark, font, textError, previewHasMark, layout, anchor, angle, size, opacity, activeImage]);

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
                        description: 'Selecciona el archivo PDF al que deseas agregar una marca de agua. Todo se procesa en tu navegador.',
                        side: 'right',
                        align: 'start',
                    },
                },
                {
                    element: '[data-tour="options"]',
                    popover: {
                        title: 'Paso 2: Configurar Marca de Agua',
                        description:
                            'Elige texto o imagen (el logo del hospital ya está listo), si va una vez o en mosaico, la posición, el ángulo, el tamaño, la opacidad y a qué páginas aplicarla.',
                        side: 'left',
                        align: 'start',
                    },
                },
                {
                    element: '[data-tour="preview"]',
                    popover: {
                        title: 'Paso 3: Revisar',
                        description: 'La vista previa muestra la marca sobre tus páginas reales. Usa las flechas para revisar otras páginas.',
                        side: 'right',
                        align: 'start',
                    },
                },
                {
                    element: '[data-tour="actions"]',
                    popover: {
                        title: 'Paso 4: Aplicar Marca de Agua',
                        description: 'Haz clic en "Agregar Marca de Agua" y descarga el PDF.',
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

    // Cualquier cambio en las opciones invalida el resultado anterior.
    useEffect(() => {
        clearResult();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mark, layout, anchor, angle, size, opacity, targetPages]);

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
                    ? 'Este PDF está protegido con contraseña. Quita la protección antes de agregar la marca de agua.'
                    : 'Error al cargar el PDF. El archivo puede estar dañado.',
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setImageError('Selecciona una imagen (PNG, JPG o WebP).');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setImageError('La imagen es demasiado grande. Máximo 5MB.');
            return;
        }
        setImageSource('custom');
        setCustomImageFile(file);
    };

    const changeLayout = (value: WatermarkLayout) => {
        setLayout(value);
        setSize(defaultSize(value, kind));
    };

    const changeKind = (value: MarkKind) => {
        setKind(value);
        setSize(defaultSize(layout, value));
    };

    const addWatermark = async () => {
        if (!pdfFile || !mark || !targetPages || targetPages.length === 0) return;

        setIsProcessing(true);
        setError('');

        try {
            const pdfDoc = await PDFDocument.load(await pdfFile.arrayBuffer());
            await applyWatermark(pdfDoc, mark, options, opacity, targetPages);
            const bytes = await pdfDoc.save();
            const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
            clearResult();
            setResult({ blob, url: URL.createObjectURL(blob), pages: targetPages.length });
        } catch (err) {
            console.error('Error adding watermark:', err);
            setError(err instanceof Error && err.message.startsWith('El texto') ? err.message : 'Error al agregar la marca de agua. Por favor intenta de nuevo.');
        } finally {
            setIsProcessing(false);
        }
    };

    const downloadWatermarkedPDF = () => {
        if (result && pdfFile) downloadBlob(result.blob, `${pdfBaseName(pdfFile)}_marcado.pdf`);
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

    const canApply = !!pdfFile && !!mark && !textError && !!targetPages && targetPages.length > 0 && !isProcessing;

    return (
        <>
            <Head title="Marca de Agua en PDF - Evaristools" />

            <div className="min-h-screen bg-white dark:bg-[#1d1d1e]">
                <ToolPageHeader
                    title="Marca de Agua en PDF"
                    description="Añade marcas de agua de texto o con el logo del hospital a tus documentos PDF"
                    icon={Droplet}
                />

                <div className="container mx-auto px-4 py-8">
                    <div className="max-w-6xl mx-auto">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                            {/* Left Column: File Upload, Preview & Messages */}
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
                                        <div className="flex items-center justify-between gap-3 p-4 bg-slate-50 dark:bg-[#222322] rounded-lg">
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
                                    description={pdfFile ? undefined : 'Así se verá la marca en una hoja A4. Sube un PDF para verla sobre tus páginas.'}
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
                                                {!previewHasMark && ' · sin marca'}
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
                                            aria-label="Vista previa de la página con la marca de agua"
                                            className="h-auto max-h-[70vh] w-auto max-w-full border border-slate-200 shadow-sm dark:border-slate-700"
                                        />
                                    </div>
                                </ToolCard>

                                {result && (
                                    <ToolCard title="¡Marca de Agua Agregada!">
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-center space-x-3 p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                                <CheckCircle className="h-8 w-8 flex-shrink-0 text-green-600" />
                                                <div>
                                                    <p className="font-medium text-green-800 dark:text-green-200">
                                                        Marca aplicada a {result.pages} {result.pages === 1 ? 'página' : 'páginas'}.
                                                    </p>
                                                    <p className="text-sm text-green-600 dark:text-green-300">{formatFileSize(result.blob.size)}</p>
                                                </div>
                                            </div>

                                            <div className="flex flex-col sm:flex-row gap-3">
                                                <Button onClick={downloadWatermarkedPDF} className="flex-1 bg-institutional hover:bg-institutional/90">
                                                    <Download className="mr-2 h-4 w-4" />
                                                    Descargar PDF
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
                                <ToolCard title="Opciones de Marca de Agua" data-tour="options">
                                    <div className="space-y-5">
                                        <div className="space-y-2">
                                            <Label id="watermark-kind-label">Tipo de marca</Label>
                                            <OptionButtons
                                                labelledBy="watermark-kind-label"
                                                value={kind}
                                                onChange={changeKind}
                                                className="grid-cols-2"
                                                options={[
                                                    { value: 'text', label: 'Texto', icon: Type },
                                                    { value: 'image', label: 'Imagen o logo', icon: ImageIcon },
                                                ]}
                                            />
                                        </div>

                                        {kind === 'text' ? (
                                            <>
                                                <div className="space-y-2">
                                                    <Label htmlFor="watermark-text">Texto</Label>
                                                    <Input
                                                        id="watermark-text"
                                                        type="text"
                                                        value={text}
                                                        onChange={(e) => setText(e.target.value)}
                                                        placeholder="Ej: CONFIDENCIAL, BORRADOR, COPIA CONTROLADA"
                                                        maxLength={60}
                                                        aria-invalid={!!textError}
                                                    />
                                                    {textError && <p className="text-sm text-red-600 dark:text-red-400">{textError}</p>}
                                                </div>

                                                <div className="space-y-2">
                                                    <Label id="watermark-color-label">Color</Label>
                                                    <div className="flex flex-wrap items-center gap-2" role="group" aria-labelledby="watermark-color-label">
                                                        {COLOR_PRESETS.map((preset) => (
                                                            <button
                                                                key={preset.value}
                                                                type="button"
                                                                onClick={() => setColor(preset.value)}
                                                                aria-pressed={color === preset.value}
                                                                title={preset.label}
                                                                className={`h-8 w-8 rounded-full border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-institutional ${
                                                                    color === preset.value
                                                                        ? 'border-institutional ring-2 ring-institutional/40 dark:border-white'
                                                                        : 'border-white shadow dark:border-slate-600'
                                                                }`}
                                                                style={{ backgroundColor: preset.value }}
                                                            >
                                                                <span className="sr-only">{preset.label}</span>
                                                            </button>
                                                        ))}
                                                        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                                                            <Input
                                                                type="color"
                                                                value={color}
                                                                onChange={(e) => setColor(e.target.value)}
                                                                className="h-8 w-12 cursor-pointer p-1"
                                                                aria-label="Otro color"
                                                            />
                                                            Otro
                                                        </label>
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="space-y-3">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => setImageSource('logo')}
                                                        aria-pressed={imageSource === 'logo'}
                                                        className={`flex h-24 items-center justify-center rounded-lg border bg-white p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-institutional ${
                                                            imageSource === 'logo'
                                                                ? 'border-institutional ring-1 ring-institutional dark:border-[#8b9bd6] dark:ring-[#8b9bd6]'
                                                                : 'border-slate-200 dark:border-slate-700'
                                                        }`}
                                                    >
                                                        {logoImage ? (
                                                            <img src={logoImage.url} alt="Logo del Hospital Universitario del Valle" className="max-h-full max-w-full object-contain" />
                                                        ) : (
                                                            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                                                        )}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => (customImage ? setImageSource('custom') : imageInputRef.current?.click())}
                                                        aria-pressed={imageSource === 'custom'}
                                                        className={`flex h-24 flex-col items-center justify-center gap-1 rounded-lg border bg-white p-2 text-sm text-slate-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-institutional dark:bg-[#222322] dark:text-slate-300 ${
                                                            imageSource === 'custom'
                                                                ? 'border-institutional ring-1 ring-institutional dark:border-[#8b9bd6] dark:ring-[#8b9bd6]'
                                                                : 'border-dashed border-slate-300 dark:border-slate-600'
                                                        }`}
                                                    >
                                                        {customImage ? (
                                                            <img src={customImage.url} alt="Imagen propia" className="max-h-full max-w-full object-contain" />
                                                        ) : (
                                                            <>
                                                                <Upload className="h-5 w-5" />
                                                                Subir imagen
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                                <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImageSelect} className="hidden" />
                                                {customImage && (
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                                                            <Checkbox checked={removeWhite} onCheckedChange={(checked) => setRemoveWhite(checked === true)} />
                                                            Quitar fondo blanco
                                                        </label>
                                                        <Button variant="ghost" size="sm" onClick={() => imageInputRef.current?.click()}>
                                                            Cambiar imagen
                                                        </Button>
                                                    </div>
                                                )}
                                                {imageError && <p className="text-sm text-red-600 dark:text-red-400">{imageError}</p>}
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            <Label id="watermark-layout-label">Distribución</Label>
                                            <OptionButtons
                                                labelledBy="watermark-layout-label"
                                                value={layout}
                                                onChange={changeLayout}
                                                className="grid-cols-2"
                                                options={[
                                                    { value: 'single', label: 'Una vez', icon: Square },
                                                    { value: 'tile', label: 'Mosaico', icon: LayoutGrid, hint: 'Repetida por toda la página' },
                                                ]}
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-[auto_1fr]">
                                            {layout === 'single' && (
                                                <div className="space-y-2">
                                                    <Label id="watermark-anchor-label">Posición</Label>
                                                    <div role="radiogroup" aria-labelledby="watermark-anchor-label" className="grid w-28 grid-cols-3 gap-1.5 rounded-lg border border-slate-200 p-2 dark:border-slate-700">
                                                        {ANCHORS.map((value) => (
                                                            <button
                                                                key={value}
                                                                type="button"
                                                                role="radio"
                                                                aria-checked={anchor === value}
                                                                aria-label={ANCHOR_LABELS[value]}
                                                                title={ANCHOR_LABELS[value]}
                                                                onClick={() => setAnchor(value)}
                                                                className={`h-7 rounded transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-institutional ${
                                                                    anchor === value
                                                                        ? 'bg-institutional dark:bg-[#8b9bd6]'
                                                                        : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600'
                                                                }`}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            <div className="space-y-2">
                                                <Label id="watermark-angle-label">Ángulo</Label>
                                                <OptionButtons
                                                    labelledBy="watermark-angle-label"
                                                    value={String(angle)}
                                                    onChange={(value) => setAngle(Number(value))}
                                                    className="grid-cols-2"
                                                    options={ANGLES}
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="watermark-size">Tamaño: {Math.round(size * 100)}% del ancho</Label>
                                                <input
                                                    id="watermark-size"
                                                    type="range"
                                                    min="0.1"
                                                    max="1"
                                                    step="0.05"
                                                    value={size}
                                                    onChange={(e) => setSize(parseFloat(e.target.value))}
                                                    className="w-full accent-institutional"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="opacity">Opacidad: {Math.round(opacity * 100)}%</Label>
                                                <input
                                                    id="opacity"
                                                    type="range"
                                                    min="0.05"
                                                    max="1"
                                                    step="0.05"
                                                    value={opacity}
                                                    onChange={(e) => setOpacity(parseFloat(e.target.value))}
                                                    className="w-full accent-institutional"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label id="watermark-pages-label">Páginas</Label>
                                            <OptionButtons
                                                labelledBy="watermark-pages-label"
                                                value={pageMode}
                                                onChange={setPageMode}
                                                className="grid-cols-3"
                                                options={[
                                                    { value: 'all', label: 'Todas' },
                                                    { value: 'first', label: 'Solo la primera' },
                                                    { value: 'custom', label: 'Elegir' },
                                                ]}
                                            />
                                            {pageMode === 'custom' && (
                                                <>
                                                    <Input
                                                        value={pageList}
                                                        onChange={(e) => setPageList(e.target.value)}
                                                        placeholder="Ej: 1-3, 5, 8"
                                                        aria-label="Páginas a marcar"
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
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <Button onClick={addWatermark} disabled={!canApply} className="flex-1 bg-institutional hover:bg-institutional/90">
                                            {isProcessing ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Agregando Marca de Agua...
                                                </>
                                            ) : (
                                                <>
                                                    <Droplet className="mr-2 h-4 w-4" />
                                                    Agregar Marca de Agua
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
                                </ToolCard>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
