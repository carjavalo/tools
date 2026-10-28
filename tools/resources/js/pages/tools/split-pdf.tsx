import { useState, useRef, useEffect } from 'react';
import { Head, Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
    ArrowLeft,
    FolderOutput,
    Download,
    Upload,
    Loader2,
    X,
    FileText,
    Scissors,
    HelpCircle,
    Eye,
    ZoomIn,
    ChevronLeft,
    ChevronRight,
    CheckCheck,
    Ban,
    Repeat,
    Trash2,
    Undo2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PDFDocument } from 'pdf-lib';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { usePdfThumbnails } from '@/hooks/use-pdf-thumbnails';

interface SplitOptions {
    method: 'pages' | 'ranges' | 'selected';
    pagesPerSplit?: number;
    customRanges?: string;
    maxSizeMB?: number;
}

interface PageGroup {
    name: string;
    // Números de página (desde 1) del PDF original, en el orden de salida.
    pages: number[];
}

interface SplitResult {
    name: string;
    url: string;
    pages: number;
    firstPage: number;
}

// Un color por archivo de salida, para ver en la cuadrícula a cuál va cada página.
const PART_COLORS = [
    { ring: 'ring-blue-600', badge: 'bg-blue-700' },
    { ring: 'ring-emerald-600', badge: 'bg-emerald-700' },
    { ring: 'ring-amber-500', badge: 'bg-amber-700' },
    { ring: 'ring-violet-600', badge: 'bg-violet-700' },
    { ring: 'ring-rose-600', badge: 'bg-rose-700' },
    { ring: 'ring-cyan-600', badge: 'bg-cyan-700' },
    { ring: 'ring-lime-600', badge: 'bg-lime-700' },
    { ring: 'ring-fuchsia-600', badge: 'bg-fuchsia-700' },
];

const PREVIEW_WIDTH = 900;

const pageSequence = (start: number, end: number): number[] =>
    Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => start + i);

export default function SplitPDF() {
    const [file, setFile] = useState<File | null>(null);
    const [totalPages, setTotalPages] = useState<number>(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState<number>(0);
    const [processingStep, setProcessingStep] = useState<string>('');
    const [splitResults, setSplitResults] = useState<SplitResult[]>([]);
    const [options, setOptions] = useState<SplitOptions>({
        method: 'pages',
        pagesPerSplit: 1,
        customRanges: '',
        maxSizeMB: 10
    });
    const [removedPages, setRemovedPages] = useState<Set<number>>(new Set());
    const [previewPage, setPreviewPage] = useState<number | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropZoneRef = useRef<HTMLDivElement>(null);
    // Última página marcada, para Shift + clic.
    const lastToggledRef = useRef<number | null>(null);

    const { thumbnails, isRendering: isRenderingThumbnails, error: thumbnailsError, renderPage } = usePdfThumbnails(file);

    // Vista ampliada: mientras se pinta en grande se muestra la miniatura.
    useEffect(() => {
        setPreviewImage(null);
        if (previewPage === null) return;

        let cancelled = false;
        renderPage(previewPage, PREVIEW_WIDTH)
            .then((url) => {
                if (!cancelled) setPreviewImage(url);
            })
            .catch((error) => console.error('Error ampliando la página:', error));

        return () => {
            cancelled = true;
        };
    }, [previewPage, renderPage]);

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
                        description: 'Arrastra tu archivo PDF aquí o haz clic para subirlo. El sistema detectará automáticamente el número total de páginas.',
                        side: 'right',
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="options"]',
                    popover: {
                        title: 'Paso 2: Configurar División',
                        description: 'Elige cómo dividir el PDF: por número de páginas por archivo, por rangos personalizados (ej: 1-5, 6-10) o en una sola PDF con las páginas que dejes.',
                        side: 'left',
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="preview"]',
                    popover: {
                        title: 'Paso 3: Revisar Páginas',
                        description: 'Cuando cargues el PDF verás todas sus páginas. Haz clic en una para quitarla o volver a incluirla, usa la lupa para verla en grande y fíjate en la etiqueta de color: indica en qué archivo quedará cada página.',
                        side: 'top',
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="actions"]',
                    popover: {
                        title: 'Paso 4: Dividir PDF',
                        description: 'Haz clic en "Dividir PDF" para procesar. Podrás ver cada archivo generado, descartar los que no necesites y descargar el resto.',
                        side: 'left',
                        align: 'start'
                    }
                }
            ]
        });
        driverObj.drive();
    };

    const handleFileSelect = async (selectedFile: File) => {
        if (selectedFile.type !== 'application/pdf') {
            alert('Por favor selecciona un archivo PDF válido.');
            return;
        }

        setFile(selectedFile);
        setSplitResults([]);
        setProgress(0);
        setRemovedPages(new Set());
        lastToggledRef.current = null;

        try {
            // Get page count
            const arrayBuffer = await selectedFile.arrayBuffer();
            const pdfDoc = await PDFDocument.load(arrayBuffer);
            const pageCount = pdfDoc.getPageCount();
            setTotalPages(pageCount);
        } catch (error) {
            console.error('Error loading PDF:', error);
            alert('Error al cargar el PDF. El archivo podría estar dañado.');
            setFile(null);
            setTotalPages(0);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            handleFileSelect(files[0]);
        }
    };

    const parseRanges = (rangesStr: string): PageGroup[] => {
        const groups: PageGroup[] = [];
        const parts = rangesStr.split(',').map(s => s.trim()).filter(s => s);

        parts.forEach((part) => {
            if (part.includes('-')) {
                const [start, end] = part.split('-').map(s => parseInt(s.trim()));
                if (start && end && start <= end && start > 0 && end <= totalPages) {
                    groups.push({
                        name: `Páginas_${start}-${end}`,
                        pages: pageSequence(start, end)
                    });
                }
            } else {
                const pageNum = parseInt(part);
                if (pageNum > 0 && pageNum <= totalPages) {
                    groups.push({
                        name: `Página_${pageNum}`,
                        pages: [pageNum]
                    });
                }
            }
        });

        return groups;
    };

    // Archivos que se generarán con el método elegido. Las páginas quitadas en
    // la vista previa no entran en ninguno.
    const buildGroups = (): PageGroup[] => {
        if (!totalPages) return [];

        const keptPages = pageSequence(1, totalPages).filter(page => !removedPages.has(page));

        if (options.method === 'pages') {
            const pagesPerSplit = Math.max(1, options.pagesPerSplit || 1);
            const groups: PageGroup[] = [];
            for (let i = 0; i < keptPages.length; i += pagesPerSplit) {
                groups.push({
                    name: `Parte_${groups.length + 1}`,
                    pages: keptPages.slice(i, i + pagesPerSplit)
                });
            }
            return groups;
        }

        if (options.method === 'ranges') {
            return parseRanges(options.customRanges || '')
                .map(group => ({ ...group, pages: group.pages.filter(page => !removedPages.has(page)) }))
                .filter(group => group.pages.length > 0);
        }

        return keptPages.length > 0 ? [{ name: 'Páginas_seleccionadas', pages: keptPages }] : [];
    };

    const groups = buildGroups();
    const keptCount = totalPages - removedPages.size;
    const renderedCount = thumbnails.filter(Boolean).length;

    // Índices de los archivos en que queda cada página (en rangos puede ser más de uno).
    const partsByPage = new Map<number, number[]>();
    groups.forEach((group, index) => {
        group.pages.forEach(page => {
            partsByPage.set(page, [...(partsByPage.get(page) ?? []), index]);
        });
    });

    const togglePage = (pageNumber: number, extendRange: boolean) => {
        const anchor = lastToggledRef.current;
        lastToggledRef.current = pageNumber;

        setRemovedPages(prev => {
            const next = new Set(prev);
            const remove = !prev.has(pageNumber);
            const [from, to] = extendRange && anchor !== null
                ? [Math.min(anchor, pageNumber), Math.max(anchor, pageNumber)]
                : [pageNumber, pageNumber];

            for (let page = from; page <= to; page++) {
                if (remove) next.add(page);
                else next.delete(page);
            }
            return next;
        });
    };

    const includeAllPages = () => setRemovedPages(new Set());

    const removeAllPages = () => setRemovedPages(new Set(pageSequence(1, totalPages)));

    const invertSelection = () => {
        setRemovedPages(prev => new Set(pageSequence(1, totalPages).filter(page => !prev.has(page))));
    };

    const handlePreviewKeyDown = (e: React.KeyboardEvent) => {
        if (previewPage === null) return;
        if (e.key === 'ArrowLeft' && previewPage > 1) setPreviewPage(previewPage - 1);
        if (e.key === 'ArrowRight' && previewPage < totalPages) setPreviewPage(previewPage + 1);
    };

    const splitPDF = async () => {
        if (!file) {
            alert('Por favor selecciona un archivo PDF primero.');
            return;
        }

        if (options.method === 'ranges' && !options.customRanges?.trim()) {
            alert('Por favor especifica los rangos de páginas (ej: 1-5, 10, 15-20).');
            return;
        }

        if (groups.length === 0) {
            alert(options.method === 'ranges'
                ? 'Los rangos especificados no son válidos o quitaste todas sus páginas. Formato: 1-5, 10, 15-20'
                : 'Quitaste todas las páginas. Incluye al menos una para generar el PDF.');
            return;
        }

        setIsProcessing(true);
        setProgress(0);
        setProcessingStep('Inicializando división...');
        setSplitResults([]);

        try {
            const arrayBuffer = await file.arrayBuffer();
            const sourcePdf = await PDFDocument.load(arrayBuffer);
            const results: SplitResult[] = [];

            for (let i = 0; i < groups.length; i++) {
                const group = groups[i];
                setProcessingStep(`Creando ${group.name}... (${i + 1}/${groups.length})`);

                const newPdf = await PDFDocument.create();

                const copiedPages = await newPdf.copyPages(sourcePdf, group.pages.map(page => page - 1));
                copiedPages.forEach(page => newPdf.addPage(page));

                // Copy metadata from source
                const title = sourcePdf.getTitle();
                const author = sourcePdf.getAuthor();
                const subject = sourcePdf.getSubject();

                if (title) newPdf.setTitle(`${title} - ${group.name}`);
                if (author) newPdf.setAuthor(author);
                if (subject) newPdf.setSubject(`${subject} - Dividido con Evaristools`);
                newPdf.setCreator('Evaristools - Hospital Universitario del Valle');

                const pdfBytes = await newPdf.save();
                const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                const url = URL.createObjectURL(blob);

                results.push({
                    name: `${group.name}.pdf`,
                    url,
                    pages: group.pages.length,
                    firstPage: group.pages[0]
                });

                const progressPercent = Math.round(((i + 1) / groups.length) * 90);
                setProgress(progressPercent);
            }

            setSplitResults(results);
            setProgress(100);
            setProcessingStep(`¡${results.length} archivos PDF creados exitosamente!`);

        } catch (error) {
            console.error('Error dividiendo PDF:', error);
            alert(`Error al dividir PDF: ${error instanceof Error ? error.message : 'Error desconocido'}`);
            setProcessingStep('Error en el procesamiento');
        } finally {
            // Deja ver el mensaje final un momento antes de reactivar el botón.
            setTimeout(() => {
                setIsProcessing(false);
                setProgress(0);
                setProcessingStep('');
            }, 2000);
        }
    };

    const downloadFile = (result: SplitResult) => {
        const link = document.createElement('a');
        link.href = result.url;
        link.download = result.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const downloadAll = () => {
        splitResults.forEach((result, index) => {
            setTimeout(() => {
                downloadFile(result);
            }, index * 100); // Small delay between downloads
        });
    };

    const discardResult = (result: SplitResult) => {
        URL.revokeObjectURL(result.url);
        setSplitResults(prev => prev.filter(item => item.url !== result.url));
    };

    const clearResults = () => {
        splitResults.forEach(result => URL.revokeObjectURL(result.url));
        setSplitResults([]);
        setIsProcessing(false);
        setProgress(0);
        setProcessingStep('');
    };

    const reset = () => {
        clearResults();
        setFile(null);
        setTotalPages(0);
        setRemovedPages(new Set());
        lastToggledRef.current = null;
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const describePreviewPage = (pageNumber: number): string => {
        if (removedPages.has(pageNumber)) return 'Esta página está quitada: no irá en ningún archivo.';
        const parts = partsByPage.get(pageNumber) ?? [];
        if (parts.length === 0) return 'Esta página no está en ninguno de los rangos indicados.';
        return `Irá en: ${parts.map(index => `${groups[index].name}.pdf`).join(', ')}`;
    };

    const previewRemoved = previewPage !== null && removedPages.has(previewPage);
    const previewSrc = previewPage !== null ? previewImage ?? thumbnails[previewPage - 1] : null;

    return (
        <>
            <Head title="Dividir PDF - Evaristools">
                <meta name="description" content="Divide archivos PDF en múltiples documentos más pequeños - Hospital Universitario del Valle" />
            </Head>

            <div className="min-h-screen bg-white dark:bg-[#1d1d1e]">
                {/* Header */}
                <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 dark:bg-[#222322] dark:border-[#3f3f40]">
                    <div className="container mx-auto px-4 py-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <Link href="/">
                                    <Button variant="outline" size="sm" className="flex items-center space-x-2">
                                        <ArrowLeft className="h-4 w-4" />
                                        <span>Volver</span>
                                    </Button>
                                </Link>
                                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-institutional/10 text-institutional">
                                    <FolderOutput className="h-6 w-6" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                                        Dividir PDF
                                    </h1>
                                    <p className="text-slate-600 dark:text-slate-300">
                                        Separa un PDF en múltiples archivos más pequeños
                                    </p>
                                </div>
                            </div>
                            <img
                                src="/images/logo.png"
                                alt="Hospital Universitario del Valle"
                                className="hidden sm:block h-14 w-auto flex-shrink-0 object-contain dark:brightness-0 dark:invert"
                            />
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="container mx-auto px-4 py-8">
                    <div className="max-w-6xl mx-auto">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                            {/* Upload Section */}
                            <div className="space-y-6">
                                <Card data-tour="upload">
                                    <CardHeader>
                                        <CardTitle className="flex items-center space-x-2">
                                            <Upload className="h-5 w-5" />
                                            <span>Subir Archivo PDF</span>
                                        </CardTitle>
                                        <CardDescription>
                                            Selecciona el archivo PDF que deseas dividir
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {/* Drag & Drop Zone */}
                                        <div
                                            ref={dropZoneRef}
                                            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                                                file ? 'border-institutional bg-institutional/5' : 'border-slate-300 hover:border-institutional'
                                            }`}
                                            onDragOver={handleDragOver}
                                            onDragEnter={handleDragEnter}
                                            onDragLeave={handleDragLeave}
                                            onDrop={handleDrop}
                                        >
                                            {file ? (
                                                <div className="space-y-2">
                                                    <FileText className="h-12 w-12 mx-auto text-institutional" />
                                                    <p className="font-medium text-slate-900 dark:text-white">
                                                        {file.name}
                                                    </p>
                                                    <p className="text-sm text-slate-600 dark:text-slate-300">
                                                        {totalPages} páginas • {formatFileSize(file.size)}
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    <FolderOutput className="h-12 w-12 mx-auto text-slate-400" />
                                                    <div>
                                                        <p className="text-lg font-medium text-slate-900 dark:text-white">
                                                            Arrastra tu archivo PDF aquí
                                                        </p>
                                                        <p className="text-sm text-slate-600 dark:text-slate-300">
                                                            Solo archivos PDF
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".pdf"
                                            onChange={(e) => {
                                                const selectedFile = e.target.files?.[0];
                                                if (selectedFile) handleFileSelect(selectedFile);
                                            }}
                                            className="hidden"
                                        />

                                        <div className="flex gap-2">
                                            <Button
                                                onClick={() => fileInputRef.current?.click()}
                                                variant="outline"
                                                className="flex-1"
                                            >
                                                Seleccionar PDF
                                            </Button>
                                            {file && (
                                                <Button
                                                    onClick={reset}
                                                    variant="outline"
                                                    className="px-4"
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>

                                        {/* File Info */}
                                        {file && totalPages > 0 && (
                                            <div className="bg-slate-50 dark:bg-[#222322] rounded-lg p-4">
                                                <div className="grid grid-cols-2 gap-4 text-center">
                                                    <div>
                                                        <p className="text-sm text-slate-600 dark:text-slate-300">Total Páginas</p>
                                                        <p className="font-semibold text-slate-900 dark:text-white">{totalPages}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-slate-600 dark:text-slate-300">Tamaño</p>
                                                        <p className="font-semibold text-slate-900 dark:text-white">{formatFileSize(file.size)}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Split Results */}
                                {splitResults.length > 0 && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center justify-between">
                                                <div className="flex items-center space-x-2">
                                                    <FolderOutput className="h-5 w-5" />
                                                    <span>Archivos Generados</span>
                                                </div>
                                                <Badge variant="outline">{splitResults.length} {splitResults.length === 1 ? 'archivo' : 'archivos'}</Badge>
                                            </CardTitle>
                                            <CardDescription>
                                                Revisa cada archivo, descarta los que no necesites y descarga el resto
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="flex gap-2">
                                                <Button
                                                    onClick={downloadAll}
                                                    className="flex-1 bg-institutional hover:bg-institutional/90"
                                                >
                                                    <Download className="h-4 w-4 mr-2" />
                                                    Descargar Todos
                                                </Button>
                                                <Button
                                                    onClick={clearResults}
                                                    variant="outline"
                                                    className="px-4"
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>

                                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                                {splitResults.map((result) => (
                                                    <div
                                                        key={result.url}
                                                        className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-lg"
                                                    >
                                                        <div className="flex h-14 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-[#1d1d1e]">
                                                            {thumbnails[result.firstPage - 1] ? (
                                                                <img
                                                                    src={thumbnails[result.firstPage - 1]!}
                                                                    alt=""
                                                                    className="h-full w-full object-contain"
                                                                />
                                                            ) : (
                                                                <FileText className="h-5 w-5 text-slate-400" />
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-medium text-slate-900 dark:text-white truncate">
                                                                {result.name}
                                                            </p>
                                                            <p className="text-sm text-slate-500">
                                                                {result.pages} {result.pages === 1 ? 'página' : 'páginas'}
                                                            </p>
                                                        </div>
                                                        <div className="flex gap-1">
                                                            <Button asChild size="sm" variant="outline" title="Ver PDF">
                                                                <a
                                                                    href={result.url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    aria-label={`Ver ${result.name}`}
                                                                >
                                                                    <Eye className="h-3 w-3" />
                                                                </a>
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                onClick={() => downloadFile(result)}
                                                                title="Descargar"
                                                                aria-label={`Descargar ${result.name}`}
                                                            >
                                                                <Download className="h-3 w-3" />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => discardResult(result)}
                                                                title="Descartar"
                                                                aria-label={`Descartar ${result.name}`}
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>

                            {/* Options and Process Section */}
                            <div className="space-y-6">
                                <Card data-tour="options">
                                    <CardHeader>
                                        <CardTitle className="flex items-center space-x-2">
                                            <Scissors className="h-5 w-5" />
                                            <span>Opciones de División</span>
                                        </CardTitle>
                                        <CardDescription>
                                            Configura cómo dividir el archivo PDF
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-4">
                                            {/* Method Selection */}
                                            <div>
                                                <Label>Método de División</Label>
                                                <div className="mt-2 space-y-2">
                                                    <label className="flex items-center space-x-2">
                                                        <input
                                                            type="radio"
                                                            name="method"
                                                            value="pages"
                                                            checked={options.method === 'pages'}
                                                            onChange={(e) => setOptions({ ...options, method: e.target.value as 'pages' })}
                                                            className="text-institutional border-gray-300 focus:ring-institutional"
                                                        />
                                                        <span>Por número de páginas</span>
                                                    </label>
                                                    <label className="flex items-center space-x-2">
                                                        <input
                                                            type="radio"
                                                            name="method"
                                                            value="ranges"
                                                            checked={options.method === 'ranges'}
                                                            onChange={(e) => setOptions({ ...options, method: e.target.value as 'ranges' })}
                                                            className="text-institutional border-gray-300 focus:ring-institutional"
                                                        />
                                                        <span>Por rangos específicos</span>
                                                    </label>
                                                    <label className="flex items-center space-x-2">
                                                        <input
                                                            type="radio"
                                                            name="method"
                                                            value="selected"
                                                            checked={options.method === 'selected'}
                                                            onChange={(e) => setOptions({ ...options, method: e.target.value as 'selected' })}
                                                            className="text-institutional border-gray-300 focus:ring-institutional"
                                                        />
                                                        <span>Una sola PDF con las páginas que dejes</span>
                                                    </label>
                                                </div>
                                            </div>

                                            {/* Pages Per Split */}
                                            {options.method === 'pages' && (
                                                <div>
                                                    <Label htmlFor="pagesPerSplit">Páginas por archivo</Label>
                                                    <input
                                                        id="pagesPerSplit"
                                                        type="number"
                                                        min="1"
                                                        max={totalPages || 100}
                                                        value={options.pagesPerSplit || 1}
                                                        onChange={(e) => setOptions({ ...options, pagesPerSplit: parseInt(e.target.value) || 1 })}
                                                        className="mt-1 w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800"
                                                    />
                                                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                                                        Cada archivo contendrá esta cantidad de páginas
                                                    </p>
                                                </div>
                                            )}

                                            {/* Custom Ranges */}
                                            {options.method === 'ranges' && (
                                                <div>
                                                    <Label htmlFor="customRanges">Rangos de páginas</Label>
                                                    <input
                                                        id="customRanges"
                                                        type="text"
                                                        placeholder="1-5, 10, 15-20"
                                                        value={options.customRanges || ''}
                                                        onChange={(e) => setOptions({ ...options, customRanges: e.target.value })}
                                                        className="mt-1 w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800"
                                                    />
                                                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                                                        Formato: 1-5, 10, 15-20 (separar con comas)
                                                    </p>
                                                </div>
                                            )}

                                            {options.method === 'selected' && (
                                                <p className="text-xs text-slate-600 dark:text-slate-300">
                                                    Quita en la vista previa las páginas que no necesites: las demás quedarán juntas en un solo PDF.
                                                </p>
                                            )}

                                            {/* Estimated Output */}
                                            {file && totalPages > 0 && groups.length > 0 && (
                                                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                                                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                                                        Se {groups.length === 1 ? 'generará 1 archivo' : `generarán ${groups.length} archivos`}
                                                        {removedPages.size > 0 && ` (${removedPages.size} ${removedPages.size === 1 ? 'página quitada' : 'páginas quitadas'})`}
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-3" data-tour="actions">
                                            <Button
                                                onClick={splitPDF}
                                                disabled={!file || isProcessing}
                                                className="w-full bg-institutional hover:bg-institutional/90"
                                            >
                                                {isProcessing ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                        {processingStep}
                                                    </>
                                                ) : (
                                                    <>
                                                        <Scissors className="h-4 w-4 mr-2" />
                                                        Dividir PDF
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
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>

                        {/* Page Preview */}
                        {file && totalPages > 0 && (
                            <Card className="mt-8" data-tour="preview">
                                <CardHeader>
                                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                        <div className="space-y-1.5">
                                            <CardTitle className="flex items-center space-x-2">
                                                <Eye className="h-5 w-5" />
                                                <span>Vista Previa de Páginas</span>
                                            </CardTitle>
                                            <CardDescription>
                                                Haz clic en una página para quitarla o volver a incluirla (Shift + clic marca varias seguidas).
                                                La etiqueta de color indica en qué archivo quedará.
                                            </CardDescription>
                                        </div>
                                        <Badge variant="outline" className="self-start whitespace-nowrap">
                                            {keptCount} de {totalPages} páginas incluidas
                                        </Badge>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 pt-2">
                                        <Button size="sm" variant="outline" onClick={includeAllPages} disabled={removedPages.size === 0}>
                                            <CheckCheck className="h-4 w-4 mr-1" />
                                            Incluir todas
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={removeAllPages} disabled={keptCount === 0}>
                                            <Ban className="h-4 w-4 mr-1" />
                                            Quitar todas
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={invertSelection}>
                                            <Repeat className="h-4 w-4 mr-1" />
                                            Invertir selección
                                        </Button>
                                        {isRenderingThumbnails && (
                                            <span className="flex items-center text-sm text-slate-600 dark:text-slate-300">
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                Generando vista previa... {renderedCount}/{totalPages}
                                            </span>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {thumbnailsError && (
                                        <p className="mb-4 text-sm text-red-600 dark:text-red-400">
                                            {thumbnailsError} Aún puedes dividirlo con las opciones de arriba.
                                        </p>
                                    )}
                                    <div className="grid max-h-[70vh] grid-cols-2 gap-4 overflow-y-auto p-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                                        {pageSequence(1, totalPages).map((pageNumber) => {
                                            const removed = removedPages.has(pageNumber);
                                            const parts = partsByPage.get(pageNumber) ?? [];
                                            const color = parts.length > 0 ? PART_COLORS[parts[0] % PART_COLORS.length] : null;
                                            const thumbnail = thumbnails[pageNumber - 1];

                                            return (
                                                <div key={pageNumber} className="group relative">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => togglePage(pageNumber, e.shiftKey)}
                                                        aria-pressed={!removed}
                                                        aria-label={`Página ${pageNumber}: ${removed ? 'quitada, clic para incluirla' : 'incluida, clic para quitarla'}`}
                                                        className={`flex w-full flex-col overflow-hidden rounded-lg border bg-white text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-institutional dark:bg-[#2a2a2b] ${
                                                            removed
                                                                ? 'border-dashed border-slate-300 dark:border-slate-600'
                                                                : color
                                                                  ? `border-transparent ring-2 ${color.ring}`
                                                                  : 'border-slate-200 dark:border-[#3f3f40]'
                                                        }`}
                                                    >
                                                        <div className="relative flex aspect-[3/4] items-center justify-center bg-slate-100 dark:bg-[#1d1d1e]">
                                                            {thumbnail ? (
                                                                <img
                                                                    src={thumbnail}
                                                                    alt=""
                                                                    draggable={false}
                                                                    className={`h-full w-full object-contain transition ${removed ? 'opacity-30 grayscale' : ''}`}
                                                                />
                                                            ) : thumbnailsError ? (
                                                                <FileText className="h-8 w-8 text-slate-400" />
                                                            ) : (
                                                                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                                                            )}
                                                            {removed && (
                                                                <span className="absolute inset-0 flex items-center justify-center">
                                                                    <span className="flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-1 text-xs font-semibold text-white shadow">
                                                                        <Trash2 className="h-3 w-3" />
                                                                        Quitada
                                                                    </span>
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-2 py-1.5 text-xs dark:border-[#3f3f40]">
                                                            <span className="font-medium text-slate-700 dark:text-slate-200">
                                                                Pág. {pageNumber}
                                                            </span>
                                                            {color ? (
                                                                <span className={`truncate rounded px-1.5 py-0.5 font-semibold text-white ${color.badge}`}>
                                                                    Archivo {parts.map(index => index + 1).join(', ')}
                                                                </span>
                                                            ) : !removed ? (
                                                                <span className="truncate text-slate-500 dark:text-slate-400">Fuera de rangos</span>
                                                            ) : null}
                                                        </div>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setPreviewPage(pageNumber)}
                                                        title="Ver en grande"
                                                        aria-label={`Ver la página ${pageNumber} en grande`}
                                                        className="absolute top-2 right-2 rounded-md bg-white/90 p-1.5 text-slate-700 opacity-0 shadow transition group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100 dark:bg-[#222322]/90 dark:text-slate-200"
                                                    >
                                                        <ZoomIn className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </div>

            {/* Enlarged page */}
            <Dialog open={previewPage !== null} onOpenChange={(open) => !open && setPreviewPage(null)}>
                <DialogContent className="sm:max-w-3xl" onKeyDown={handlePreviewKeyDown}>
                    {previewPage !== null && (
                        <>
                            <DialogHeader>
                                <DialogTitle>Página {previewPage} de {totalPages}</DialogTitle>
                                <DialogDescription>{describePreviewPage(previewPage)}</DialogDescription>
                            </DialogHeader>
                            <div className="flex min-h-[40vh] items-center justify-center overflow-hidden rounded-md bg-slate-100 dark:bg-[#1d1d1e]">
                                {previewSrc ? (
                                    <img
                                        src={previewSrc}
                                        alt={`Página ${previewPage}`}
                                        className={`max-h-[65vh] w-auto object-contain ${previewRemoved ? 'opacity-40 grayscale' : ''}`}
                                    />
                                ) : (
                                    <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                                )}
                            </div>
                            <div className="flex items-center justify-between gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPreviewPage(previewPage - 1)}
                                    disabled={previewPage <= 1}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    Anterior
                                </Button>
                                <Button
                                    size="sm"
                                    variant={previewRemoved ? 'default' : 'destructive'}
                                    onClick={() => togglePage(previewPage, false)}
                                    className={previewRemoved ? 'bg-institutional hover:bg-institutional/90' : ''}
                                >
                                    {previewRemoved ? (
                                        <>
                                            <Undo2 className="h-4 w-4" />
                                            Incluir esta página
                                        </>
                                    ) : (
                                        <>
                                            <Trash2 className="h-4 w-4" />
                                            Quitar esta página
                                        </>
                                    )}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPreviewPage(previewPage + 1)}
                                    disabled={previewPage >= totalPages}
                                >
                                    Siguiente
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
