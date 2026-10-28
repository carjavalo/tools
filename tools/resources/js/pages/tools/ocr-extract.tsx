import { useState } from 'react';
import { Head } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Check, CheckCircle, Copy, Download, FileText, HelpCircle, Loader2, ScanText, ShieldAlert, Upload } from 'lucide-react';
import ToolPageHeader from '@/components/ToolPageHeader';
import ToolCard from '@/components/ToolCard';
import FileUploadZone from '@/components/FileUploadZone';
import OptionButtons from '@/components/OptionButtons';
import { loadPdfDocument, renderPageToBlob } from '@/hooks/use-pdf-thumbnails';
import { isHeicFile, loadImageFile } from '@/lib/image-tools';
import { OCR_LANGUAGES, prepareImageForOcr, runOcr, type OcrLanguage } from '@/lib/ocr';
import { downloadBlob, formatFileSize, isPdfFile } from '@/lib/pdf-pages';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

// Cada página consume una consulta de OCR.space.
const MAX_PDF_PAGES = 20;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

interface OcrPart {
    label: string;
    text: string;
    error?: string;
}

export default function OCRExtract() {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [language, setLanguage] = useState<OcrLanguage>('spa');
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState('');
    const [parts, setParts] = useState<OcrPart[]>([]);
    const [text, setText] = useState('');
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState('');
    const [dragOver, setDragOver] = useState(false);

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
                        title: 'Paso 1: Subir Archivo',
                        description: `Sube una imagen (JPG, PNG, WebP o foto HEIC del iPhone) o un PDF escaneado de hasta ${MAX_PDF_PAGES} páginas.`,
                        side: 'right',
                        align: 'start',
                    },
                },
                {
                    element: '[data-tour="options"]',
                    popover: {
                        title: 'Paso 2: Idioma',
                        description: 'Elige el idioma del texto y haz clic en "Extraer Texto".',
                        side: 'left',
                        align: 'start',
                    },
                },
                {
                    element: '[data-tour="result"]',
                    popover: {
                        title: 'Paso 3: Revisar el Texto',
                        description: 'Corrige lo que haga falta en el recuadro y cópialo o descárgalo como archivo de texto.',
                        side: 'top',
                        align: 'start',
                    },
                },
            ],
        });
        driverObj.drive();
    };

    const handleFileSelect = async (files: FileList) => {
        const selected = files[0];
        if (!selected) return;

        const pdf = isPdfFile(selected);
        if (!pdf && !selected.type.startsWith('image/') && !(await isHeicFile(selected))) {
            setError('Selecciona una imagen (JPG, PNG, WebP o HEIC) o un PDF.');
            return;
        }
        if (selected.size > MAX_FILE_BYTES) {
            setError('El archivo es demasiado grande. Máximo 25MB.');
            return;
        }

        setError('');
        setParts([]);
        setText('');
        if (preview) URL.revokeObjectURL(preview);
        setPreview(null);
        setFile(selected);

        if (!pdf) {
            try {
                // Miniatura ya derecha, aunque sea HEIC o venga girada.
                const image = await loadImageFile(selected, { maxDimension: 900, jpegQuality: 0.85 });
                setPreview(image.url);
            } catch (err) {
                setFile(null);
                setError(err instanceof Error ? err.message : 'No se pudo leer la imagen.');
            }
        }
    };

    const extractText = async () => {
        if (!file) return;

        setIsProcessing(true);
        setError('');
        setParts([]);
        setText('');
        const results: OcrPart[] = [];

        try {
            if (isPdfFile(file)) {
                setProgress('Abriendo el PDF...');
                const pdf = await loadPdfDocument(file).catch(() => {
                    throw new Error('No se pudo abrir el PDF. Si está protegido con contraseña, quítale la protección primero.');
                });
                try {
                    if (pdf.numPages > MAX_PDF_PAGES) {
                        throw new Error(`El PDF tiene ${pdf.numPages} páginas. El máximo es ${MAX_PDF_PAGES}: divídelo primero con "Dividir PDF".`);
                    }
                    for (let page = 1; page <= pdf.numPages; page++) {
                        setProgress(`Leyendo página ${page} de ${pdf.numPages}...`);
                        const image = await prepareImageForOcr(await renderPageToBlob(pdf, page, 200, 'image/jpeg', 0.85));
                        try {
                            results.push({ label: `Página ${page}`, text: await runOcr(image, language) });
                        } catch (err) {
                            results.push({ label: `Página ${page}`, text: '', error: (err as Error).message });
                        }
                        setParts([...results]);
                    }
                } finally {
                    pdf.destroy();
                }
            } else {
                setProgress('Preparando la imagen...');
                const image = await prepareImageForOcr(file);
                setProgress('Extrayendo texto...');
                results.push({ label: file.name, text: await runOcr(image, language) });
            }

            const failed = results.filter((part) => part.error);
            if (failed.length === results.length) throw new Error(failed[0]?.error ?? 'No se pudo extraer el texto.');

            const multiple = results.length > 1;
            const combined = results
                .map((part) => (multiple ? `--- ${part.label} ---\n${part.error ? `[No se pudo leer: ${part.error}]` : part.text}` : part.text))
                .join('\n\n')
                .trim();
            setParts(results);
            setText(combined);
            if (!combined) setError('No se encontró texto en el archivo. Revisa que la imagen sea nítida y esté derecha.');
        } catch (err) {
            console.error('Error extracting text:', err);
            setError(err instanceof Error ? err.message : 'No se pudo extraer el texto.');
        } finally {
            setIsProcessing(false);
            setProgress('');
        }
    };

    const copyText = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setCopied(false);
        }
    };

    const downloadText = () => {
        const base = file?.name.replace(/\.[^.]+$/, '') ?? 'texto';
        downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${base}_texto.txt`);
    };

    const reset = () => {
        if (preview) URL.revokeObjectURL(preview);
        setPreview(null);
        setFile(null);
        setParts([]);
        setText('');
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

    const failedParts = parts.filter((part) => part.error).length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;

    return (
        <>
            <Head title="OCR y Extracción de Texto - Evaristools">
                <meta name="description" content="Extrae texto de imágenes y PDF escaneados - Hospital Universitario del Valle" />
            </Head>

            <div className="min-h-screen bg-white dark:bg-[#1d1d1e]">
                <ToolPageHeader
                    title="OCR y Extracción de Texto"
                    description="Convierte imágenes y PDF escaneados en texto editable"
                    icon={ScanText}
                    showPopularBadge={true}
                />

                <div className="container mx-auto px-4 py-8">
                    <div className="max-w-6xl mx-auto">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                            {/* Left Column: Upload & Preview */}
                            <div className="space-y-6" data-tour="upload">
                                <div
                                    role="note"
                                    className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 sm:p-4 dark:border-amber-700/60 dark:bg-amber-900/20"
                                >
                                    <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700 dark:text-amber-400" />
                                    <div className="space-y-1 text-sm text-amber-900 dark:text-amber-100">
                                        <p className="font-semibold">No uses documentos con datos de pacientes</p>
                                        <p>El texto lo extrae un servicio externo (OCR.space): la imagen sale del hospital.</p>
                                    </div>
                                </div>

                                {!file ? (
                                    <ToolCard title="Seleccionar Archivo">
                                        <FileUploadZone
                                            onFileSelect={handleFileSelect}
                                            acceptedTypes="image/jpeg,image/png,image/webp,image/gif,image/bmp,.heic,.heif,.pdf,application/pdf"
                                            dragOver={dragOver}
                                            onDragOver={handleDragOver}
                                            onDragEnter={handleDragOver}
                                            onDragLeave={handleDragLeave}
                                            onDrop={handleDrop}
                                            title="Arrastra una imagen o un PDF escaneado"
                                            subtitle={`o haz clic para seleccionar (PDF de hasta ${MAX_PDF_PAGES} páginas)`}
                                        />
                                    </ToolCard>
                                ) : (
                                    <ToolCard title="Archivo Seleccionado">
                                        <div className="flex items-center justify-between gap-3 p-4 bg-slate-50 dark:bg-[#222322] rounded-lg">
                                            <div className="flex min-w-0 items-center space-x-3">
                                                <FileText className="h-8 w-8 flex-shrink-0 text-institutional" />
                                                <div className="min-w-0">
                                                    <p className="truncate font-medium text-slate-900 dark:text-white">{file.name}</p>
                                                    <p className="text-sm text-slate-600 dark:text-slate-300">{formatFileSize(file.size)}</p>
                                                </div>
                                            </div>
                                        </div>
                                        {preview && (
                                            <div className="flex justify-center rounded-lg bg-slate-100 p-3 dark:bg-[#1d1d1e]">
                                                <img src={preview} alt="Vista previa" className="max-h-80 max-w-full object-contain shadow-sm" />
                                            </div>
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
                            </div>

                            {/* Right Column: Options & Actions */}
                            <div className="space-y-6">
                                <ToolCard title="Opciones" data-tour="options">
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
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <Button onClick={extractText} disabled={!file || isProcessing} className="flex-1 bg-institutional hover:bg-institutional/90">
                                            {isProcessing ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    {progress || 'Extrayendo...'}
                                                </>
                                            ) : (
                                                <>
                                                    <ScanText className="mr-2 h-4 w-4" />
                                                    Extraer Texto
                                                </>
                                            )}
                                        </Button>
                                        <Button onClick={reset} variant="outline" className="flex-1" disabled={isProcessing || !file}>
                                            <Upload className="mr-2 h-4 w-4" />
                                            Otro Archivo
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

                                {(text || isProcessing) && (
                                    <ToolCard title="Texto Extraído" data-tour="result">
                                        {text && (
                                            <>
                                                <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
                                                    <CheckCircle className="h-4 w-4" />
                                                    {words} {words === 1 ? 'palabra' : 'palabras'}
                                                    {failedParts > 0 && (
                                                        <span className="text-amber-700 dark:text-amber-300">
                                                            · {failedParts} {failedParts === 1 ? 'página no se pudo leer' : 'páginas no se pudieron leer'}
                                                        </span>
                                                    )}
                                                </div>
                                                <Textarea
                                                    value={text}
                                                    onChange={(e) => setText(e.target.value)}
                                                    aria-label="Texto extraído (puedes corregirlo)"
                                                    className="min-h-80 font-mono text-sm"
                                                />
                                                <p className="text-xs text-slate-600 dark:text-slate-400">
                                                    Revisa el texto: el OCR puede confundir letras en imágenes borrosas o manuscritas.
                                                </p>
                                                <div className="flex flex-col sm:flex-row gap-3">
                                                    <Button onClick={copyText} variant="outline" className="flex-1">
                                                        {copied ? <Check className="mr-2 h-4 w-4 text-green-600" /> : <Copy className="mr-2 h-4 w-4" />}
                                                        {copied ? 'Copiado' : 'Copiar'}
                                                    </Button>
                                                    <Button onClick={downloadText} variant="outline" className="flex-1">
                                                        <Download className="mr-2 h-4 w-4" />
                                                        Descargar .txt
                                                    </Button>
                                                </div>
                                            </>
                                        )}
                                        {!text && isProcessing && parts.length > 0 && (
                                            <p className="text-sm text-slate-600 dark:text-slate-300">
                                                {parts.length} {parts.length === 1 ? 'página leída' : 'páginas leídas'}...
                                            </p>
                                        )}
                                    </ToolCard>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
