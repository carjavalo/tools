import { useRef, useState } from 'react';
import { Head } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    AlertCircle,
    CheckCircle,
    ChevronLeft,
    ChevronRight,
    Download,
    Eye,
    FileImage,
    HelpCircle,
    ImagePlus,
    Loader2,
    RotateCw,
    Trash2,
    Upload,
} from 'lucide-react';
import { PDFDocument, degrees } from 'pdf-lib';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import ToolPageHeader from '@/components/ToolPageHeader';
import ToolCard from '@/components/ToolCard';
import FileUploadZone from '@/components/FileUploadZone';
import OptionButtons from '@/components/OptionButtons';
import { loadImageFile, revokeImage, type LoadedImage } from '@/lib/image-tools';
import { centeredPlacement, downloadBlob, formatFileSize, normalizeRotation, type PageRotation } from '@/lib/pdf-pages';

type PageSizeKey = 'A4' | 'Letter' | 'Oficio' | 'Image';
type Orientation = 'auto' | 'portrait' | 'landscape';
type QualityKey = 'high' | 'medium' | 'low';

interface ImageItem {
    id: string;
    file: File;
    // Miniatura ya enderezada (giro EXIF y HEIC resueltos).
    preview: LoadedImage;
    // Giro extra que le da el usuario, en sentido horario.
    turn: PageRotation;
}

interface FailedImage {
    name: string;
    reason: string;
}

interface PdfResult {
    blob: Blob;
    url: string;
    pages: number;
}

const POINTS_PER_MM = 72 / 25.4;
const MAX_IMAGES = 200;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

// Ancho × alto en puntos, en vertical.
const PAGE_SIZES: Record<Exclude<PageSizeKey, 'Image'>, [number, number]> = {
    A4: [595.28, 841.89],
    Letter: [612, 792],
    // Oficio colombiano: 216 × 330 mm.
    Oficio: [612.28, 935.43],
};

const PAGE_SIZE_LABELS: Record<PageSizeKey, string> = {
    A4: 'A4 (210 × 297 mm)',
    Letter: 'Carta (216 × 279 mm)',
    Oficio: 'Oficio (216 × 330 mm)',
    Image: 'Igual a cada imagen',
};

const QUALITY: Record<QualityKey, { maxDimension: number; jpegQuality: number; label: string; hint: string }> = {
    high: { maxDimension: 3200, jpegQuality: 0.9, label: 'Alta', hint: 'Para documentos que se van a imprimir.' },
    medium: { maxDimension: 2200, jpegQuality: 0.8, label: 'Media', hint: 'Buena calidad y tamaño moderado.' },
    low: { maxDimension: 1500, jpegQuality: 0.7, label: 'Compacta', hint: 'Archivo liviano para enviar por correo.' },
};

let idCounter = 0;

export default function ImagesToPDF() {
    const [images, setImages] = useState<ImageItem[]>([]);
    const [failed, setFailed] = useState<FailedImage[]>([]);
    const [isLoadingImages, setIsLoadingImages] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState('');
    const [pageSize, setPageSize] = useState<PageSizeKey>('A4');
    const [orientation, setOrientation] = useState<Orientation>('auto');
    const [marginMm, setMarginMm] = useState(10);
    const [quality, setQuality] = useState<QualityKey>('medium');
    const [result, setResult] = useState<PdfResult | null>(null);
    const [error, setError] = useState('');
    const [dragOver, setDragOver] = useState(false);
    const [dropTarget, setDropTarget] = useState<{ id: string; after: boolean } | null>(null);
    const draggedIdRef = useRef<string | null>(null);
    const addInputRef = useRef<HTMLInputElement>(null);

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
                        title: 'Paso 1: Agregar Imágenes',
                        description: 'Arrastra o selecciona tus imágenes (JPG, PNG, WebP o fotos HEIC del iPhone). Cada imagen será una página.',
                        side: 'right',
                        align: 'start',
                    },
                },
                {
                    element: '[data-tour="images"]',
                    popover: {
                        title: 'Paso 2: Ordenar y Girar',
                        description: 'Arrastra las imágenes para cambiar el orden. Usa los botones para girarlas o quitarlas.',
                        side: 'top',
                        align: 'start',
                    },
                },
                {
                    element: '[data-tour="options"]',
                    popover: {
                        title: 'Paso 3: Configurar Páginas',
                        description: 'Elige el tamaño de página, la orientación, el margen y la calidad.',
                        side: 'left',
                        align: 'start',
                    },
                },
                {
                    element: '[data-tour="actions"]',
                    popover: {
                        title: 'Paso 4: Crear PDF',
                        description: 'Haz clic en "Crear PDF" y descárgalo. Todo se procesa en tu navegador.',
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

    const updateImages = (next: ImageItem[]) => {
        clearResult();
        setImages(next);
    };

    const addFiles = async (files: FileList) => {
        const incoming = Array.from(files);
        if (incoming.length === 0) return;

        setError('');
        setIsLoadingImages(true);
        const added: ImageItem[] = [];
        const errors: FailedImage[] = [];

        for (const file of incoming) {
            if (images.length + added.length >= MAX_IMAGES) {
                errors.push({ name: file.name, reason: `Máximo ${MAX_IMAGES} imágenes por PDF.` });
                continue;
            }
            if (file.size > MAX_IMAGE_BYTES) {
                errors.push({ name: file.name, reason: 'Pesa más de 25MB.' });
                continue;
            }
            try {
                const preview = await loadImageFile(file, { maxDimension: 360, jpegQuality: 0.8 });
                added.push({ id: `img${++idCounter}`, file, preview, turn: 0 });
            } catch (err) {
                errors.push({ name: file.name, reason: err instanceof Error ? err.message : 'No se pudo leer.' });
            }
        }

        if (added.length) updateImages([...images, ...added]);
        setFailed(errors);
        setIsLoadingImages(false);
    };

    const removeImage = (id: string) => {
        const image = images.find((item) => item.id === id);
        revokeImage(image?.preview ?? null);
        updateImages(images.filter((item) => item.id !== id));
    };

    const clearAll = () => {
        images.forEach((item) => revokeImage(item.preview));
        updateImages([]);
        setFailed([]);
    };

    const turnImage = (id: string) => updateImages(images.map((item) => (item.id === id ? { ...item, turn: normalizeRotation(item.turn + 90) } : item)));

    const shiftImage = (index: number, offset: number) => {
        const target = index + offset;
        if (target < 0 || target >= images.length) return;
        const next = [...images];
        [next[index], next[target]] = [next[target], next[index]];
        updateImages(next);
    };

    const sortByName = () => updateImages([...images].sort((a, b) => a.file.name.localeCompare(b.file.name, 'es', { numeric: true })));

    const handleItemDrop = () => {
        const draggedId = draggedIdRef.current;
        if (draggedId && dropTarget && draggedId !== dropTarget.id) {
            const moving = images.find((item) => item.id === draggedId)!;
            const rest = images.filter((item) => item.id !== draggedId);
            const at = rest.findIndex((item) => item.id === dropTarget.id) + (dropTarget.after ? 1 : 0);
            updateImages([...rest.slice(0, at), moving, ...rest.slice(at)]);
        }
        draggedIdRef.current = null;
        setDropTarget(null);
    };

    /** Tamaño de la página para una imagen de ancho × alto (ya girada). */
    const pageDimensions = (imageWidth: number, imageHeight: number): [number, number] => {
        const landscapeImage = imageWidth > imageHeight;
        if (pageSize === 'Image') {
            // El lado mayor como el de una hoja A4, para que se imprima bien.
            const scale = PAGE_SIZES.A4[1] / Math.max(imageWidth, imageHeight);
            return [imageWidth * scale, imageHeight * scale];
        }
        const [width, height] = PAGE_SIZES[pageSize];
        const landscape = orientation === 'landscape' || (orientation === 'auto' && landscapeImage);
        return landscape ? [height, width] : [width, height];
    };

    const createPDF = async () => {
        if (images.length === 0) return;

        setIsProcessing(true);
        setError('');

        try {
            const pdfDoc = await PDFDocument.create();
            pdfDoc.setTitle('Imágenes');
            pdfDoc.setCreator('Evaristools - Hospital Universitario del Valle');
            const settings = QUALITY[quality];

            for (const [index, item] of images.entries()) {
                setProgress(`Procesando imagen ${index + 1} de ${images.length}...`);
                // Se vuelve a leer a la calidad elegida: endereza, reduce y comprime.
                const image = await loadImageFile(item.file, { maxDimension: settings.maxDimension, jpegQuality: settings.jpegQuality });
                const embedded = await pdfDoc.embedJpg(image.bytes);
                revokeImage(image);

                const sideways = item.turn % 180 !== 0;
                const shownWidth = sideways ? image.height : image.width;
                const shownHeight = sideways ? image.width : image.height;
                const [pageWidth, pageHeight] = pageDimensions(shownWidth, shownHeight);
                const page = pdfDoc.addPage([pageWidth, pageHeight]);

                const margin = pageSize === 'Image' ? 0 : marginMm * POINTS_PER_MM;
                const scale = Math.min((pageWidth - margin * 2) / shownWidth, (pageHeight - margin * 2) / shownHeight);
                const width = image.width * scale;
                const height = image.height * scale;
                // Centrada en la página; el giro del usuario es horario.
                const frame = { x: 0, y: 0, width: pageWidth, height: pageHeight, rotation: 0 as const };
                const origin = centeredPlacement(frame, pageWidth / 2, pageHeight / 2, width, height, -item.turn);
                page.drawImage(embedded, { x: origin.x, y: origin.y, width, height, rotate: degrees(origin.rotate) });
            }

            setProgress('Guardando el PDF...');
            const bytes = await pdfDoc.save();
            const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
            clearResult();
            setResult({ blob, url: URL.createObjectURL(blob), pages: images.length });
            downloadBlob(blob, 'imagenes.pdf');
        } catch (err) {
            console.error('Error creating PDF:', err);
            setError(err instanceof Error && err.message.startsWith('No se pudo') ? err.message : 'Error al crear el PDF. Intenta de nuevo.');
        } finally {
            setIsProcessing(false);
            setProgress('');
        }
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
        if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
    };

    const acceptedTypes = 'image/jpeg,image/png,image/webp,image/gif,image/bmp,.heic,.heif,image/heic,image/heif';

    return (
        <>
            <Head title="Imágenes a PDF - Evaristools" />

            <div className="min-h-screen bg-white dark:bg-[#1d1d1e]">
                <ToolPageHeader title="Imágenes a PDF" description="Convierte tus imágenes en un documento PDF" icon={FileImage} />

                <div className="container mx-auto px-4 py-8">
                    <div className="max-w-6xl mx-auto">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                            {/* Left Column: Upload & Messages */}
                            <div className="space-y-6" data-tour="upload">
                                <ToolCard title="Agregar Imágenes" description="JPG, PNG, WebP o fotos HEIC del iPhone. Máximo 25MB por imagen.">
                                    <FileUploadZone
                                        onFileSelect={addFiles}
                                        acceptedTypes={acceptedTypes}
                                        multiple
                                        dragOver={dragOver}
                                        onDragOver={handleDragOver}
                                        onDragEnter={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                        title="Arrastra tus imágenes aquí"
                                        subtitle="o haz clic para seleccionarlas"
                                        buttonText="Seleccionar Imágenes"
                                    />
                                    {isLoadingImages && (
                                        <p className="flex items-center text-sm text-slate-600 dark:text-slate-300">
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Leyendo imágenes...
                                        </p>
                                    )}
                                    {failed.length > 0 && (
                                        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-100">
                                            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                                            <div>
                                                <p className="font-medium">{failed.length === 1 ? 'No se agregó una imagen' : `No se agregaron ${failed.length} imágenes`}:</p>
                                                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                                                    {failed.map((item, index) => (
                                                        <li key={index}>
                                                            <span className="break-all">{item.name}</span>: {item.reason}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    )}
                                </ToolCard>

                                {error && (
                                    <ToolCard title="Error">
                                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                            <p className="text-red-800 dark:text-red-200">{error}</p>
                                        </div>
                                    </ToolCard>
                                )}

                                {result && (
                                    <ToolCard title="¡PDF Creado Exitosamente!">
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-center space-x-3 p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                                <CheckCircle className="h-8 w-8 flex-shrink-0 text-green-600" />
                                                <div>
                                                    <p className="font-medium text-green-800 dark:text-green-200">
                                                        PDF de {result.pages} {result.pages === 1 ? 'página' : 'páginas'} descargado.
                                                    </p>
                                                    <p className="text-sm text-green-600 dark:text-green-300">{formatFileSize(result.blob.size)}</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col sm:flex-row gap-3">
                                                <Button
                                                    onClick={() => downloadBlob(result.blob, 'imagenes.pdf')}
                                                    variant="outline"
                                                    className="flex-1"
                                                >
                                                    <Download className="mr-2 h-4 w-4" />
                                                    Descargar de nuevo
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
                                <ToolCard title="Opciones de Página" data-tour="options">
                                    <div className="space-y-5">
                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label htmlFor="pageSize">Tamaño de página</Label>
                                                <Select
                                                    value={pageSize}
                                                    onValueChange={(value) => {
                                                        setPageSize(value as PageSizeKey);
                                                        clearResult();
                                                    }}
                                                >
                                                    <SelectTrigger id="pageSize">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {(Object.keys(PAGE_SIZE_LABELS) as PageSizeKey[]).map((key) => (
                                                            <SelectItem key={key} value={key}>
                                                                {PAGE_SIZE_LABELS[key]}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="margin">Margen: {pageSize === 'Image' ? 'sin margen' : `${marginMm} mm`}</Label>
                                                <input
                                                    id="margin"
                                                    type="range"
                                                    min="0"
                                                    max="30"
                                                    step="1"
                                                    value={marginMm}
                                                    disabled={pageSize === 'Image'}
                                                    onChange={(e) => {
                                                        setMarginMm(parseInt(e.target.value, 10));
                                                        clearResult();
                                                    }}
                                                    className="w-full accent-institutional disabled:opacity-50"
                                                />
                                            </div>
                                        </div>

                                        {pageSize !== 'Image' && (
                                            <div className="space-y-2">
                                                <Label id="orientation-label">Orientación</Label>
                                                <OptionButtons
                                                    labelledBy="orientation-label"
                                                    value={orientation}
                                                    onChange={(value) => {
                                                        setOrientation(value);
                                                        clearResult();
                                                    }}
                                                    className="grid-cols-3"
                                                    options={[
                                                        { value: 'auto', label: 'Automática', hint: 'Horizontal para las fotos apaisadas' },
                                                        { value: 'portrait', label: 'Vertical' },
                                                        { value: 'landscape', label: 'Horizontal' },
                                                    ]}
                                                />
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            <Label id="quality-label">Calidad</Label>
                                            <OptionButtons
                                                labelledBy="quality-label"
                                                value={quality}
                                                onChange={(value) => {
                                                    setQuality(value);
                                                    clearResult();
                                                }}
                                                className="grid-cols-3"
                                                options={(Object.keys(QUALITY) as QualityKey[]).map((key) => ({ value: key, label: QUALITY[key].label }))}
                                            />
                                            <p className="text-xs text-slate-600 dark:text-slate-400">{QUALITY[quality].hint}</p>
                                        </div>
                                    </div>
                                </ToolCard>

                                <ToolCard title="Acciones" data-tour="actions">
                                    <div className="space-y-3">
                                        <Button
                                            onClick={createPDF}
                                            disabled={isProcessing || isLoadingImages || images.length === 0}
                                            className="w-full bg-institutional hover:bg-institutional/90"
                                        >
                                            {isProcessing ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    {progress || 'Creando PDF...'}
                                                </>
                                            ) : (
                                                <>
                                                    <FileImage className="mr-2 h-4 w-4" />
                                                    Crear PDF {images.length > 0 && `(${images.length} ${images.length === 1 ? 'página' : 'páginas'})`}
                                                </>
                                            )}
                                        </Button>
                                        <p className="text-xs text-slate-600 dark:text-slate-400">Las imágenes se procesan en tu navegador: no se suben a ningún servidor.</p>
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

                        {images.length > 0 && (
                            <ToolCard
                                title={`Imágenes (${images.length})`}
                                description="Arrastra para cambiar el orden. Cada imagen será una página."
                                icon={Eye}
                                className="mt-8"
                                data-tour="images"
                            >
                                <div className="flex flex-wrap items-center gap-2">
                                    <Button size="sm" variant="outline" onClick={() => addInputRef.current?.click()} disabled={isProcessing}>
                                        <ImagePlus className="mr-1 h-4 w-4" />
                                        Agregar más
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={sortByName} disabled={images.length < 2 || isProcessing}>
                                        Ordenar por nombre
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={clearAll} disabled={isProcessing} className="text-red-600 dark:text-red-400">
                                        <Trash2 className="mr-1 h-4 w-4" />
                                        Quitar todas
                                    </Button>
                                    <input
                                        ref={addInputRef}
                                        type="file"
                                        multiple
                                        accept={acceptedTypes}
                                        className="hidden"
                                        onChange={(e) => {
                                            const copy = new DataTransfer();
                                            Array.from(e.target.files ?? []).forEach((file) => copy.items.add(file));
                                            e.target.value = '';
                                            addFiles(copy.files);
                                        }}
                                    />
                                </div>
                                <div
                                    className="grid max-h-[70vh] grid-cols-2 gap-4 overflow-y-auto p-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
                                    onDragLeave={(e) => {
                                        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null);
                                    }}
                                >
                                    {images.map((item, index) => (
                                        <div
                                            key={item.id}
                                            draggable
                                            onDragStart={(e) => {
                                                draggedIdRef.current = item.id;
                                                e.dataTransfer.effectAllowed = 'move';
                                                e.dataTransfer.setData('text/plain', item.id);
                                            }}
                                            onDragOver={(e) => {
                                                if (!draggedIdRef.current) return;
                                                e.preventDefault();
                                                e.stopPropagation();
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                const after = e.clientX > rect.left + rect.width / 2;
                                                if (dropTarget?.id !== item.id || dropTarget.after !== after) setDropTarget({ id: item.id, after });
                                            }}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleItemDrop();
                                            }}
                                            onDragEnd={() => {
                                                draggedIdRef.current = null;
                                                setDropTarget(null);
                                            }}
                                            className="relative flex cursor-grab flex-col overflow-hidden rounded-lg border border-slate-200 bg-white active:cursor-grabbing dark:border-[#3f3f40] dark:bg-[#2a2a2b]"
                                        >
                                            {dropTarget?.id === item.id && (
                                                <span
                                                    className={`absolute inset-y-1 z-10 w-1 rounded bg-institutional dark:bg-[#8b9bd6] ${dropTarget.after ? 'right-0' : 'left-0'}`}
                                                />
                                            )}
                                            <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-slate-100 p-2 dark:bg-[#1d1d1e]">
                                                <img
                                                    src={item.preview.url}
                                                    alt={item.file.name}
                                                    draggable={false}
                                                    className="max-h-full max-w-full object-contain shadow-sm transition-transform duration-200"
                                                    style={{ transform: `rotate(${item.turn}deg)` }}
                                                />
                                                <span className="absolute top-2 left-2 rounded bg-slate-900/75 px-1.5 py-0.5 text-xs font-medium text-white">
                                                    {index + 1}
                                                </span>
                                            </div>
                                            <p className="truncate px-2 pt-1 text-xs text-slate-600 dark:text-slate-300" title={item.file.name}>
                                                {item.file.name}
                                            </p>
                                            <div className="flex items-center justify-between gap-1 px-1 pb-1">
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7"
                                                    onClick={() => shiftImage(index, -1)}
                                                    disabled={index === 0}
                                                    aria-label={`Mover la imagen ${index + 1} hacia atrás`}
                                                >
                                                    <ChevronLeft className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7"
                                                    onClick={() => turnImage(item.id)}
                                                    aria-label={`Girar la imagen ${index + 1}`}
                                                    title="Girar 90°"
                                                >
                                                    <RotateCw className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7 text-red-600 hover:text-red-700 dark:text-red-400"
                                                    onClick={() => removeImage(item.id)}
                                                    aria-label={`Quitar la imagen ${index + 1}`}
                                                    title="Quitar"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7"
                                                    onClick={() => shiftImage(index, 1)}
                                                    disabled={index === images.length - 1}
                                                    aria-label={`Mover la imagen ${index + 1} hacia adelante`}
                                                >
                                                    <ChevronRight className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ToolCard>
                        )}

                        {images.length === 0 && !isLoadingImages && (
                            <p className="mt-8 flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                                <Upload className="h-4 w-4" />
                                Agrega imágenes para empezar.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
