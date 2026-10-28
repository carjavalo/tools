import { useRef, useState } from 'react';
import { Head } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
    AlertCircle,
    CheckCircle,
    ChevronDown,
    Clock,
    Download,
    FileText,
    HelpCircle,
    ImagePlus,
    Loader2,
    RotateCcw,
    ShieldAlert,
    Trash2,
} from 'lucide-react';
import { AlignmentType, Document, HeadingLevel, ImageRun, Packer, Paragraph, TextRun } from 'docx';
import ToolPageHeader from '@/components/ToolPageHeader';
import ToolCard from '@/components/ToolCard';
import FileUploadZone from '@/components/FileUploadZone';
import OptionButtons from '@/components/OptionButtons';
import { loadImageFile, revokeImage, type LoadedImage } from '@/lib/image-tools';
import { OCR_LANGUAGES, prepareImageForOcr, runOcr, type OcrLanguage } from '@/lib/ocr';
import { downloadBlob } from '@/lib/pdf-pages';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

type Status = 'pending' | 'processing' | 'done' | 'error';

interface ImageItem {
    id: string;
    file: File;
    preview: LoadedImage;
    status: Status;
    text: string;
    error?: string;
    // Imagen ya preparada para OCR (también sirve para incluirla en el Word).
    prepared?: { blob: Blob; width: number; height: number };
}

interface DocumentOptions {
    fontSize: number;
    fontFamily: string;
    lineSpacing: number;
    alignment: 'left' | 'justify';
    includeImageNames: boolean;
    includeImages: boolean;
    addPageBreaks: boolean;
}

const MAX_IMAGES = 30;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
// Ancho máximo de una imagen en el Word, en píxeles (cabe en una hoja carta con márgenes).
const DOC_IMAGE_WIDTH = 560;

let idCounter = 0;

export default function ImagesToWord() {
    const [images, setImages] = useState<ImageItem[]>([]);
    const [language, setLanguage] = useState<OcrLanguage>('spa');
    const [options, setOptions] = useState<DocumentOptions>({
        fontSize: 12,
        fontFamily: 'Arial',
        lineSpacing: 1.5,
        alignment: 'left',
        includeImageNames: true,
        includeImages: false,
        addPageBreaks: true,
    });
    const [expanded, setExpanded] = useState<string | null>(null);
    const [isLoadingImages, setIsLoadingImages] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState('');
    const [notice, setNotice] = useState('');
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const addInputRef = useRef<HTMLInputElement>(null);
    // Copia viva de la lista para el proceso largo (el estado se actualiza por partes).
    const imagesRef = useRef<ImageItem[]>([]);

    const commit = (next: ImageItem[]) => {
        imagesRef.current = next;
        setImages(next);
    };

    const updateItem = (id: string, changes: Partial<ImageItem>) =>
        commit(imagesRef.current.map((item) => (item.id === id ? { ...item, ...changes } : item)));

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
                        description: 'Arrastra o selecciona imágenes con texto (JPG, PNG, WebP o fotos HEIC del iPhone).',
                        side: 'right',
                        align: 'start',
                    },
                },
                {
                    element: '[data-tour="options"]',
                    popover: {
                        title: 'Paso 2: Configurar el Documento',
                        description: 'Elige el idioma del texto y el formato del Word. Puedes incluir también las imágenes.',
                        side: 'left',
                        align: 'start',
                    },
                },
                {
                    element: '[data-tour="actions"]',
                    popover: {
                        title: 'Paso 3: Crear el Word',
                        description:
                            'Se extrae el texto de cada imagen. Puedes revisarlo y corregirlo en la lista antes de descargar el Word otra vez: las imágenes ya leídas no se vuelven a enviar.',
                        side: 'left',
                        align: 'start',
                    },
                },
            ],
        });
        driverObj.drive();
    };

    const addFiles = async (files: FileList) => {
        const incoming = Array.from(files);
        if (incoming.length === 0) return;
        setIsLoadingImages(true);
        setError('');
        setNotice('');
        setDone(false);

        const added: ImageItem[] = [];
        const rejected: string[] = [];
        for (const file of incoming) {
            if (imagesRef.current.length + added.length >= MAX_IMAGES) {
                rejected.push(`${file.name} (máximo ${MAX_IMAGES} imágenes)`);
                continue;
            }
            if (file.size > MAX_IMAGE_BYTES) {
                rejected.push(`${file.name} (pesa más de 25MB)`);
                continue;
            }
            try {
                const preview = await loadImageFile(file, { maxDimension: 320, jpegQuality: 0.8 });
                added.push({ id: `img${++idCounter}`, file, preview, status: 'pending', text: '' });
            } catch (err) {
                rejected.push(`${file.name} (${err instanceof Error ? err.message : 'no se pudo leer'})`);
            }
        }

        commit([...imagesRef.current, ...added]);
        if (rejected.length) setNotice(`No se agregaron: ${rejected.join('; ')}`);
        setIsLoadingImages(false);
    };

    const removeImage = (id: string) => {
        const item = imagesRef.current.find((image) => image.id === id);
        revokeImage(item?.preview ?? null);
        commit(imagesRef.current.filter((image) => image.id !== id));
        setDone(false);
    };

    const clearAll = () => {
        imagesRef.current.forEach((item) => revokeImage(item.preview));
        commit([]);
        setNotice('');
        setError('');
        setDone(false);
    };

    // Solo se envían a OCR las imágenes que aún no tienen texto (o fallaron).
    const extractPending = async () => {
        const pending = imagesRef.current.filter((item) => item.status === 'pending' || item.status === 'error');
        for (const [index, item] of pending.entries()) {
            setProgress(`Extrayendo texto ${index + 1} de ${pending.length}...`);
            updateItem(item.id, { status: 'processing', error: undefined });
            try {
                const blob = item.prepared?.blob ?? (await prepareImageForOcr(item.file));
                const bitmap = await createImageBitmap(blob);
                const prepared = { blob, width: bitmap.width, height: bitmap.height };
                bitmap.close();
                const text = await runOcr(blob, language);
                updateItem(item.id, { status: 'done', text, prepared });
            } catch (err) {
                updateItem(item.id, { status: 'error', error: err instanceof Error ? err.message : 'No se pudo extraer el texto.' });
            }
        }
    };

    const buildDocument = async (items: ImageItem[]) => {
        const paragraphs: Paragraph[] = [
            new Paragraph({
                children: [new TextRun({ text: 'Documento extraído de imágenes', bold: true, size: (options.fontSize + 4) * 2 })],
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER,
                spacing: { after: 200 },
            }),
            new Paragraph({
                children: [new TextRun({ text: `Creado el ${new Date().toLocaleDateString('es-CO')}`, italics: true, size: (options.fontSize - 2) * 2 })],
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 },
            }),
        ];

        for (const [index, item] of items.entries()) {
            if (index > 0 && options.addPageBreaks) paragraphs.push(new Paragraph({ children: [], pageBreakBefore: true }));

            if (options.includeImageNames) {
                paragraphs.push(
                    new Paragraph({
                        children: [new TextRun({ text: `Imagen ${index + 1}: ${item.file.name}`, bold: true, size: (options.fontSize + 2) * 2 })],
                        heading: HeadingLevel.HEADING_2,
                        spacing: { before: 300, after: 200 },
                    }),
                );
            }

            if (options.includeImages && item.prepared) {
                const scale = Math.min(1, DOC_IMAGE_WIDTH / item.prepared.width);
                paragraphs.push(
                    new Paragraph({
                        children: [
                            new ImageRun({
                                type: 'jpg',
                                data: new Uint8Array(await item.prepared.blob.arrayBuffer()),
                                transformation: { width: Math.round(item.prepared.width * scale), height: Math.round(item.prepared.height * scale) },
                            }),
                        ],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 200 },
                    }),
                );
            }

            const lines = item.text.split('\n').filter((line) => line.trim().length > 0);
            if (lines.length === 0) {
                paragraphs.push(new Paragraph({ children: [new TextRun({ text: '(Sin texto reconocido)', italics: true, size: options.fontSize * 2 })] }));
            }
            for (const line of lines) {
                paragraphs.push(
                    new Paragraph({
                        children: [new TextRun({ text: line.trim(), size: options.fontSize * 2, font: options.fontFamily })],
                        alignment: options.alignment === 'justify' ? AlignmentType.JUSTIFIED : AlignmentType.LEFT,
                        spacing: { line: Math.round(options.lineSpacing * 240), after: 120 },
                    }),
                );
            }
        }

        return Packer.toBlob(new Document({ creator: 'Evaristools - Hospital Universitario del Valle', sections: [{ children: paragraphs }] }));
    };

    const createWord = async () => {
        if (imagesRef.current.length === 0) return;
        setIsProcessing(true);
        setError('');
        setNotice('');
        setDone(false);

        try {
            await extractPending();
            const ready = imagesRef.current.filter((item) => item.status === 'done');
            const failed = imagesRef.current.filter((item) => item.status === 'error');

            if (ready.length === 0) {
                setError(failed[0]?.error ?? 'No se pudo extraer texto de ninguna imagen.');
                return;
            }

            setProgress('Armando el documento Word...');
            downloadBlob(await buildDocument(ready), 'texto_de_imagenes.docx');
            setDone(true);
            if (failed.length) {
                setNotice(
                    `${failed.length === 1 ? 'Una imagen no se incluyó' : `${failed.length} imágenes no se incluyeron`} porque no se pudo leer su texto. Puedes reintentarlo.`,
                );
            }
        } catch (err) {
            console.error('Error creating Word document:', err);
            setError('No se pudo crear el documento Word. Intenta de nuevo.');
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
    const pendingCount = images.filter((item) => item.status !== 'done').length;

    const statusBadge = (item: ImageItem) => {
        switch (item.status) {
            case 'processing':
                return (
                    <span className="flex items-center gap-1 text-xs text-blue-700 dark:text-blue-300">
                        <Loader2 className="h-3 w-3 animate-spin" /> Leyendo...
                    </span>
                );
            case 'done':
                return (
                    <span className="flex items-center gap-1 text-xs text-green-700 dark:text-green-300">
                        <CheckCircle className="h-3 w-3" /> Texto listo
                    </span>
                );
            case 'error':
                return (
                    <span className="flex items-center gap-1 text-xs text-red-700 dark:text-red-300" title={item.error}>
                        <AlertCircle className="h-3 w-3" /> {item.error}
                    </span>
                );
            default:
                return (
                    <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <Clock className="h-3 w-3" /> Pendiente
                    </span>
                );
        }
    };

    return (
        <>
            <Head title="Imágenes a Word - Evaristools" />

            <div className="min-h-screen bg-white dark:bg-[#1d1d1e]">
                <ToolPageHeader
                    title="Imágenes a Word"
                    description="Convierte imágenes con texto en documentos Word editables"
                    icon={FileText}
                    showPopularBadge={true}
                />

                <div className="container mx-auto px-4 py-8">
                    <div className="max-w-6xl mx-auto">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                            {/* Left Column: Upload & images */}
                            <div className="space-y-6" data-tour="upload">
                                <div
                                    role="note"
                                    className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 sm:p-4 dark:border-amber-700/60 dark:bg-amber-900/20"
                                >
                                    <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700 dark:text-amber-400" />
                                    <div className="space-y-1 text-sm text-amber-900 dark:text-amber-100">
                                        <p className="font-semibold">No uses imágenes con datos de pacientes</p>
                                        <p>El texto lo extrae un servicio externo (OCR.space): las imágenes salen del hospital.</p>
                                    </div>
                                </div>

                                {images.length === 0 ? (
                                    <ToolCard title="Agregar Imágenes" description={`Hasta ${MAX_IMAGES} imágenes de máximo 25MB cada una.`}>
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
                                            subtitle="JPG, PNG, WebP o fotos HEIC del iPhone"
                                            buttonText="Seleccionar Imágenes"
                                        />
                                        {isLoadingImages && (
                                            <p className="flex items-center text-sm text-slate-600 dark:text-slate-300">
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Leyendo imágenes...
                                            </p>
                                        )}
                                    </ToolCard>
                                ) : (
                                    <ToolCard title={`Imágenes (${images.length})`} description="Revisa y corrige el texto de cada imagen antes de descargar.">
                                        <div className="flex flex-wrap gap-2">
                                            <Button size="sm" variant="outline" onClick={() => addInputRef.current?.click()} disabled={isProcessing}>
                                                <ImagePlus className="mr-1 h-4 w-4" />
                                                Agregar más
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
                                        <ul className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                                            {images.map((item, index) => (
                                                <li key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-[#222322]">
                                                    <div className="flex items-center gap-3">
                                                        <img src={item.preview.url} alt="" className="h-14 w-14 flex-shrink-0 rounded object-cover" />
                                                        <div className="min-w-0 flex-1">
                                                            <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                                                                {index + 1}. {item.file.name}
                                                            </p>
                                                            <div className="truncate">{statusBadge(item)}</div>
                                                        </div>
                                                        {item.status === 'done' && (
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                                                                aria-expanded={expanded === item.id}
                                                            >
                                                                Texto
                                                                <ChevronDown className={`ml-1 h-4 w-4 transition-transform ${expanded === item.id ? 'rotate-180' : ''}`} />
                                                            </Button>
                                                        )}
                                                        {item.status === 'done' && (
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-8 w-8"
                                                                onClick={() => updateItem(item.id, { status: 'pending', text: '' })}
                                                                disabled={isProcessing}
                                                                aria-label={`Volver a leer ${item.file.name}`}
                                                                title="Volver a leer"
                                                            >
                                                                <RotateCcw className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-8 w-8 text-red-600 dark:text-red-400"
                                                            onClick={() => removeImage(item.id)}
                                                            disabled={isProcessing}
                                                            aria-label={`Quitar ${item.file.name}`}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                    {expanded === item.id && item.status === 'done' && (
                                                        <Textarea
                                                            value={item.text}
                                                            onChange={(e) => {
                                                                updateItem(item.id, { text: e.target.value });
                                                                setDone(false);
                                                            }}
                                                            aria-label={`Texto de ${item.file.name}`}
                                                            className="mt-2 min-h-40 text-sm"
                                                        />
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    </ToolCard>
                                )}

                                {notice && (
                                    <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-100">
                                        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                                        <p>{notice}</p>
                                    </div>
                                )}

                                {error && (
                                    <ToolCard title="Error">
                                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                            <p className="text-red-800 dark:text-red-200">{error}</p>
                                        </div>
                                    </ToolCard>
                                )}
                            </div>

                            {/* Right Column: Options & Actions */}
                            <div className="space-y-6">
                                <ToolCard title="Opciones del Documento" data-tour="options">
                                    <div className="space-y-5">
                                        <div className="space-y-2">
                                            <Label id="language-label">Idioma del texto</Label>
                                            <OptionButtons
                                                labelledBy="language-label"
                                                value={language}
                                                onChange={setLanguage}
                                                className="grid-cols-2"
                                                options={OCR_LANGUAGES}
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label htmlFor="font-family">Fuente</Label>
                                                <Select value={options.fontFamily} onValueChange={(value) => setOptions({ ...options, fontFamily: value })}>
                                                    <SelectTrigger id="font-family">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {['Arial', 'Calibri', 'Times New Roman'].map((font) => (
                                                            <SelectItem key={font} value={font}>
                                                                {font}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="font-size">Tamaño</Label>
                                                <Select value={String(options.fontSize)} onValueChange={(value) => setOptions({ ...options, fontSize: Number(value) })}>
                                                    <SelectTrigger id="font-size">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {[10, 11, 12, 14].map((size) => (
                                                            <SelectItem key={size} value={String(size)}>
                                                                {size} pt
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="line-spacing">Interlineado</Label>
                                                <Select value={String(options.lineSpacing)} onValueChange={(value) => setOptions({ ...options, lineSpacing: Number(value) })}>
                                                    <SelectTrigger id="line-spacing">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="1">Sencillo</SelectItem>
                                                        <SelectItem value="1.15">1,15</SelectItem>
                                                        <SelectItem value="1.5">1,5</SelectItem>
                                                        <SelectItem value="2">Doble</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="alignment">Alineación</Label>
                                                <Select
                                                    value={options.alignment}
                                                    onValueChange={(value) => setOptions({ ...options, alignment: value as DocumentOptions['alignment'] })}
                                                >
                                                    <SelectTrigger id="alignment">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="left">Izquierda</SelectItem>
                                                        <SelectItem value="justify">Justificada</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            {(
                                                [
                                                    ['includeImageNames', 'Título con el nombre de cada imagen'],
                                                    ['includeImages', 'Incluir las imágenes en el documento'],
                                                    ['addPageBreaks', 'Cada imagen en una página nueva'],
                                                ] as const
                                            ).map(([key, label]) => (
                                                <label key={key} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                                                    <Checkbox checked={options[key]} onCheckedChange={(checked) => setOptions({ ...options, [key]: checked === true })} />
                                                    {label}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </ToolCard>

                                <ToolCard title="Acciones" data-tour="actions">
                                    {done && (
                                        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200">
                                            <CheckCircle className="h-4 w-4 flex-shrink-0" />
                                            El documento Word se descargó. Si corriges algún texto, vuelve a descargarlo.
                                        </div>
                                    )}
                                    <Button
                                        onClick={createWord}
                                        disabled={images.length === 0 || isProcessing || isLoadingImages}
                                        className="w-full bg-institutional hover:bg-institutional/90"
                                    >
                                        {isProcessing ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                {progress || 'Procesando...'}
                                            </>
                                        ) : (
                                            <>
                                                <Download className="mr-2 h-4 w-4" />
                                                {pendingCount > 0 ? 'Extraer Texto y Crear Word' : 'Descargar Word'}
                                            </>
                                        )}
                                    </Button>
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
