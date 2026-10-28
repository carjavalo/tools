import { useState, useRef, useEffect } from 'react';
import { Head } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ToolPageHeader from '@/components/ToolPageHeader';
import ToolCard from '@/components/ToolCard';
import {
    FileUp,
    Upload,
    Loader2,
    X,
    GripVertical,
    Plus,
    Trash2,
    HelpCircle,
    FileText,
    LayoutGrid,
    CheckCheck,
    Ban,
    Repeat,
    ZoomIn,
    ChevronLeft,
    ChevronRight,
    Undo2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PDFDocument } from 'pdf-lib';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { renderFirstPageThumbnail, usePdfThumbnails } from '@/hooks/use-pdf-thumbnails';

interface MergeOptions {
    preserveMetadata: boolean;
    addPageNumbers: boolean;
}

interface PDFFile {
    id: string;
    file: File;
    name: string;
    size: number;
    pages: number;
    // Páginas (desde 1) que el usuario quitó: no entran en la unión.
    excluded: Set<number>;
    thumbnail: string | null;
}

const PAGE_PREVIEW_WIDTH = 800;

const pageSequence = (start: number, end: number): number[] =>
    Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => start + i);

const includedCount = (pdf: PDFFile) => pdf.pages - pdf.excluded.size;

/**
 * Cuadrícula con las páginas de un PDF para quitar las que no deben unirse.
 * Va en su propio componente porque genera las miniaturas solo mientras está abierta.
 */
function PagePicker({ pdf, onChange }: { pdf: PDFFile; onChange: (excluded: Set<number>) => void }) {
    const { thumbnails, isRendering, error, renderPage } = usePdfThumbnails(pdf.file, 220);
    const [zoomPage, setZoomPage] = useState<number | null>(null);
    const [zoomImage, setZoomImage] = useState<string | null>(null);
    // Última página marcada, para Shift + clic.
    const lastToggledRef = useRef<number | null>(null);

    useEffect(() => {
        setZoomImage(null);
        if (zoomPage === null) return;

        let cancelled = false;
        renderPage(zoomPage, PAGE_PREVIEW_WIDTH)
            .then((url) => {
                if (!cancelled) setZoomImage(url);
            })
            .catch((err) => console.error('Error ampliando la página:', err));

        return () => {
            cancelled = true;
        };
    }, [zoomPage, renderPage]);

    const togglePage = (pageNumber: number, extendRange: boolean) => {
        const anchor = lastToggledRef.current;
        lastToggledRef.current = pageNumber;

        const next = new Set(pdf.excluded);
        const remove = !pdf.excluded.has(pageNumber);
        const [from, to] = extendRange && anchor !== null
            ? [Math.min(anchor, pageNumber), Math.max(anchor, pageNumber)]
            : [pageNumber, pageNumber];

        for (let page = from; page <= to; page++) {
            if (remove) next.add(page);
            else next.delete(page);
        }
        onChange(next);
    };

    const renderedCount = thumbnails.filter(Boolean).length;

    if (zoomPage !== null) {
        const removed = pdf.excluded.has(zoomPage);
        const src = zoomImage ?? thumbnails[zoomPage - 1];

        return (
            <div
                className="space-y-3"
                onKeyDown={(e) => {
                    if (e.key === 'ArrowLeft' && zoomPage > 1) setZoomPage(zoomPage - 1);
                    if (e.key === 'ArrowRight' && zoomPage < pdf.pages) setZoomPage(zoomPage + 1);
                }}
            >
                <div className="flex items-center justify-between gap-2">
                    <Button variant="outline" size="sm" onClick={() => setZoomPage(null)}>
                        <LayoutGrid className="h-4 w-4" />
                        Todas las páginas
                    </Button>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        Página {zoomPage} de {pdf.pages}{removed ? ' · quitada' : ''}
                    </span>
                </div>
                <div className="flex min-h-[40vh] items-center justify-center overflow-hidden rounded-md bg-slate-100 dark:bg-[#1d1d1e]">
                    {src ? (
                        <img
                            src={src}
                            alt={`Página ${zoomPage}`}
                            className={`max-h-[60vh] w-auto object-contain ${removed ? 'opacity-40 grayscale' : ''}`}
                        />
                    ) : (
                        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                    )}
                </div>
                <div className="flex items-center justify-between gap-2">
                    <Button variant="outline" size="sm" onClick={() => setZoomPage(zoomPage - 1)} disabled={zoomPage <= 1}>
                        <ChevronLeft className="h-4 w-4" />
                        Anterior
                    </Button>
                    <Button
                        size="sm"
                        variant={removed ? 'default' : 'destructive'}
                        onClick={() => togglePage(zoomPage, false)}
                        className={removed ? 'bg-institutional hover:bg-institutional/90' : ''}
                    >
                        {removed ? <Undo2 className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                        {removed ? 'Incluir esta página' : 'Quitar esta página'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setZoomPage(zoomPage + 1)} disabled={zoomPage >= pdf.pages}>
                        Siguiente
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => onChange(new Set())} disabled={pdf.excluded.size === 0}>
                    <CheckCheck className="h-4 w-4" />
                    Incluir todas
                </Button>
                <Button size="sm" variant="outline" onClick={() => onChange(new Set(pageSequence(1, pdf.pages)))} disabled={includedCount(pdf) === 0}>
                    <Ban className="h-4 w-4" />
                    Quitar todas
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onChange(new Set(pageSequence(1, pdf.pages).filter(page => !pdf.excluded.has(page))))}
                >
                    <Repeat className="h-4 w-4" />
                    Invertir selección
                </Button>
                {isRendering && (
                    <span className="flex items-center text-sm text-slate-600 dark:text-slate-300">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generando vista previa... {renderedCount}/{pdf.pages}
                    </span>
                )}
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <div className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto p-1 sm:grid-cols-3 md:grid-cols-4">
                {pageSequence(1, pdf.pages).map((pageNumber) => {
                    const removed = pdf.excluded.has(pageNumber);
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
                                        : 'border-transparent ring-2 ring-institutional dark:ring-[#8b9bd6]'
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
                                    ) : error ? (
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
                                <span className="border-t border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-700 dark:border-[#3f3f40] dark:text-slate-200">
                                    Pág. {pageNumber}
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setZoomPage(pageNumber)}
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
        </div>
    );
}

export default function MergePDFs() {
    const [files, setFiles] = useState<PDFFile[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingStep, setProcessingStep] = useState<string>('');
    const [pickerId, setPickerId] = useState<string | null>(null);
    const [options, setOptions] = useState<MergeOptions>({
        preserveMetadata: true,
        addPageNumbers: false
    });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropZoneRef = useRef<HTMLDivElement>(null);
    const draggedIndex = useRef<number | null>(null);

    const pickerFile = files.find(f => f.id === pickerId) ?? null;

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
                        title: 'Paso 1: Agregar PDFs',
                        description: 'Arrastra múltiples archivos PDF aquí o usa el botón "Agregar PDFs". Verás la primera página de cada uno; arrástralos para cambiar el orden y usa "Páginas" para ver un PDF completo y quitar las páginas que no quieras unir.',
                        side: 'right',
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="options"]',
                    popover: {
                        title: 'Paso 2: Configurar Opciones',
                        description: 'Elige si deseas conservar los metadatos del primer PDF o agregar números de página al PDF combinado.',
                        side: 'left',
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="actions"]',
                    popover: {
                        title: 'Paso 3: Unir PDFs',
                        description: 'Una vez agregados al menos 2 archivos PDF, haz clic en "Unir PDFs" para combinarlos en un solo documento.',
                        side: 'left',
                        align: 'start'
                    }
                }
            ]
        });
        driverObj.drive();
    };

    const generateId = () => Math.random().toString(36).substr(2, 9);

    const handleFileSelect = async (selectedFiles: FileList) => {
        // Copia antes del primer await: el FileList del input se vacía cuando
        // se limpia su valor.
        const incoming = Array.from(selectedFiles);
        const validFiles: PDFFile[] = [];

        for (const file of incoming) {

            // En Windows el tipo MIME a veces llega vacío: también vale la extensión.
            if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
                alert(`"${file.name}" no es un archivo PDF válido. Solo se permiten archivos PDF.`);
                continue;
            }

            // Check for duplicates
            const isDuplicate = [...files, ...validFiles].some(f => f.name === file.name && f.size === file.size);
            if (isDuplicate) {
                alert(`"${file.name}" ya está en la lista.`);
                continue;
            }

            try {
                // Get page count
                const arrayBuffer = await file.arrayBuffer();
                const pdfDoc = await PDFDocument.load(arrayBuffer);

                validFiles.push({
                    id: generateId(),
                    file,
                    name: file.name,
                    size: file.size,
                    pages: pdfDoc.getPageCount(),
                    excluded: new Set(),
                    thumbnail: null
                });
            } catch (error) {
                console.error(`Error loading PDF "${file.name}":`, error);
                const encrypted = error instanceof Error && error.message.toLowerCase().includes('encrypted');
                alert(encrypted
                    ? `"${file.name}" está protegido con contraseña. Quítale la protección e inténtalo de nuevo.`
                    : `Error al cargar "${file.name}". El archivo PDF podría estar dañado.`);
            }
        }

        if (validFiles.length > 0) {
            setFiles(prev => [...prev, ...validFiles]);

            // Miniaturas de a una, sin bloquear la lista.
            for (const pdf of validFiles) {
                const thumbnail = await renderFirstPageThumbnail(pdf.file);
                setFiles(prev => prev.map(f => (f.id === pdf.id ? { ...f, thumbnail } : f)));
            }
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

        const droppedFiles = e.dataTransfer.files;
        if (droppedFiles.length > 0) {
            handleFileSelect(droppedFiles);
        }
    };

    const removeFile = (id: string) => {
        setFiles(prev => prev.filter(f => f.id !== id));
    };

    const clearAllFiles = () => {
        setFiles([]);
    };

    const setExcludedPages = (id: string, excluded: Set<number>) => {
        setFiles(prev => prev.map(f => (f.id === id ? { ...f, excluded } : f)));
    };

    // Drag and drop reordering
    const handleDragStart = (e: React.DragEvent, index: number) => {
        draggedIndex.current = index;
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOverItem = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex.current === null) return;

        const draggedOverIndex = index;
        if (draggedIndex.current === draggedOverIndex) return;

        const newFiles = [...files];
        const draggedItem = newFiles[draggedIndex.current];

        // Remove dragged item
        newFiles.splice(draggedIndex.current, 1);
        // Insert at new position
        newFiles.splice(draggedOverIndex, 0, draggedItem);

        setFiles(newFiles);
        draggedIndex.current = draggedOverIndex;
    };

    const handleDragEnd = () => {
        draggedIndex.current = null;
    };

    const moveUp = (index: number) => {
        if (index === 0) return;
        const newFiles = [...files];
        [newFiles[index], newFiles[index - 1]] = [newFiles[index - 1], newFiles[index]];
        setFiles(newFiles);
    };

    const moveDown = (index: number) => {
        if (index === files.length - 1) return;
        const newFiles = [...files];
        [newFiles[index], newFiles[index + 1]] = [newFiles[index + 1], newFiles[index]];
        setFiles(newFiles);
    };

    // Los PDF a los que les quitaron todas las páginas no participan.
    const filesToMerge = files.filter(f => includedCount(f) > 0);

    const mergePDFs = async () => {
        if (filesToMerge.length < 2) {
            alert(files.length < 2
                ? 'Necesitas al menos 2 archivos PDF para unir.'
                : 'Necesitas al menos 2 PDFs con páginas incluidas para unir.');
            return;
        }

        setIsProcessing(true);
        setProcessingStep('Inicializando...');

        try {
            const mergedPdf = await PDFDocument.create();

            for (let i = 0; i < filesToMerge.length; i++) {
                const file = filesToMerge[i];
                setProcessingStep(`Procesando ${file.name}... (${i + 1}/${filesToMerge.length})`);

                try {
                    const arrayBuffer = await file.file.arrayBuffer();
                    const pdf = await PDFDocument.load(arrayBuffer);

                    const pageIndices = pdf.getPageIndices().filter(index => !file.excluded.has(index + 1));
                    const copiedPages = await mergedPdf.copyPages(pdf, pageIndices);
                    copiedPages.forEach(page => mergedPdf.addPage(page));

                    // Copy metadata from first file
                    if (i === 0 && options.preserveMetadata) {
                        const title = pdf.getTitle();
                        const author = pdf.getAuthor();
                        const subject = pdf.getSubject();
                        const creator = pdf.getCreator();

                        if (title) mergedPdf.setTitle(title);
                        if (author) mergedPdf.setAuthor(author);
                        if (subject) mergedPdf.setSubject(subject);
                        if (creator) mergedPdf.setCreator(`${creator} - Unido con Evaristools`);
                    }

                } catch (error) {
                    console.error(`Error processing ${file.name}:`, error);
                    throw new Error(`Error al procesar "${file.name}". El archivo podría estar dañado.`);
                }
            }

            setProcessingStep('Finalizando PDF unificado...');

            // Add page numbers if requested
            if (options.addPageNumbers) {
                const pages = mergedPdf.getPages();
                pages.forEach((page, index) => {
                    const { width } = page.getSize();
                    page.drawText(`${index + 1}`, {
                        x: width - 50,
                        y: 30,
                        size: 10,
                    });
                });
            }

            setProcessingStep('Generando descarga...');

            const pdfBytes = await mergedPdf.save();

            // Create download
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `PDFs_Unidos_${new Date().getTime()}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            setProcessingStep('¡PDF unificado creado exitosamente!');

        } catch (error) {
            console.error('Error uniendo PDFs:', error);
            alert(`Error al unir PDFs: ${error instanceof Error ? error.message : 'Error desconocido'}`);
            setProcessingStep('Error en el procesamiento');
        } finally {
            setTimeout(() => {
                setIsProcessing(false);
                setProcessingStep('');
            }, 2000);
        }
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getTotalPages = () => files.reduce((total, file) => total + includedCount(file), 0);
    const getTotalSize = () => files.reduce((total, file) => total + file.size, 0);

    return (
        <>
            <Head title="Unir PDFs - Evaristools">
                <meta name="description" content="Une múltiples archivos PDF en un solo documento - Hospital Universitario del Valle" />
            </Head>

            <div className="min-h-screen bg-layer-base">
                <ToolPageHeader
                    title="Unir PDFs"
                    description="Combina múltiples archivos PDF en un solo documento"
                    icon={FileUp}
                />

                {/* Main Content - Responsive grid */}
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                    <div className="max-w-7xl mx-auto">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
                            {/* Upload Section - Priority on mobile */}
                            <div className="space-y-4 sm:space-y-6">
                                <ToolCard
                                    title="Subir Archivos PDF"
                                    description="Selecciona múltiples archivos PDF para unir en un solo documento"
                                    icon={Upload}
                                    data-tour="upload"
                                >
                                        {/* Drag & Drop Zone - Responsive padding */}
                                        <div
                                            ref={dropZoneRef}
                                            className={`border-2 border-dashed rounded-lg p-6 sm:p-8 text-center transition-colors ${
                                                files.length > 0 ? 'border-institutional bg-institutional/5' : 'border-slate-300 hover:border-institutional'
                                            }`}
                                            onDragOver={handleDragOver}
                                            onDragEnter={handleDragEnter}
                                            onDragLeave={handleDragLeave}
                                            onDrop={handleDrop}
                                        >
                                            <div className="space-y-3 sm:space-y-4">
                                                <FileUp className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-slate-400" />
                                                <div>
                                                    <p className="text-base sm:text-lg font-medium text-slate-900 dark:text-white">
                                                        Arrastra múltiples PDFs aquí
                                                    </p>
                                                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                                                        Solo archivos PDF (máximo recomendado: 10 archivos)
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".pdf"
                                            multiple
                                            onChange={(e) => {
                                                const selectedFiles = e.target.files;
                                                if (selectedFiles) handleFileSelect(selectedFiles);
                                                // Permite volver a elegir el mismo archivo después de quitarlo.
                                                e.target.value = '';
                                            }}
                                            className="hidden"
                                        />

                                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                                            <Button
                                                onClick={() => fileInputRef.current?.click()}
                                                variant="outline"
                                                className="flex-1"
                                            >
                                                <Plus className="h-4 w-4 mr-2" />
                                                Agregar PDFs
                                            </Button>
                                            {files.length > 0 && (
                                                <Button
                                                    onClick={clearAllFiles}
                                                    variant="outline"
                                                    className="px-4"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>

                                        {/* Summary - Responsive grid */}
                                        {files.length > 0 && (
                                            <div className="bg-layer-3 rounded-lg p-3 sm:p-4 shadow-layer-1">
                                                <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
                                                    <div>
                                                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">Archivos</p>
                                                        <p className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">{files.length}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">Páginas</p>
                                                        <p className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">{getTotalPages()}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">Tamaño</p>
                                                        <p className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white truncate">{formatFileSize(getTotalSize())}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                </ToolCard>

                                {/* File List */}
                                {files.length > 0 && (
                                    <ToolCard
                                        title="Archivos Seleccionados"
                                        description="Arrastra para reordenar. El orden determina cómo se unirán los PDFs. Usa «Páginas» para quitar páginas de un PDF."
                                        icon={FileUp}
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <Badge variant="outline" className="text-xs sm:text-sm">
                                                {files.length} {files.length === 1 ? 'archivo' : 'archivos'}
                                            </Badge>
                                        </div>
                                            <div className="space-y-2 max-h-[60vh] sm:max-h-[28rem] overflow-y-auto">
                                                {files.map((file, index) => {
                                                    const included = includedCount(file);

                                                    return (
                                                    <div
                                                        key={file.id}
                                                        draggable
                                                        onDragStart={(e) => handleDragStart(e, index)}
                                                        onDragOver={(e) => handleDragOverItem(e, index)}
                                                        onDragEnd={handleDragEnd}
                                                        className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 border rounded-lg hover:bg-layer-3 cursor-move transition-colors ${
                                                            included === 0 ? 'border-red-300 dark:border-red-800' : 'border-slate-200 dark:border-slate-700'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                                                            <span className="text-xs sm:text-sm font-medium text-slate-500 min-w-[16px] sm:min-w-[20px]">
                                                                {index + 1}
                                                            </span>
                                                            <GripVertical className="h-3 w-3 sm:h-4 sm:w-4 text-slate-400" />
                                                        </div>

                                                        <button
                                                            type="button"
                                                            onClick={() => setPickerId(file.id)}
                                                            title="Ver páginas"
                                                            aria-label={`Ver las páginas de ${file.name}`}
                                                            className="flex h-14 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded border border-slate-200 bg-white dark:border-slate-700 dark:bg-[#1d1d1e]"
                                                        >
                                                            {file.thumbnail ? (
                                                                <img src={file.thumbnail} alt="" draggable={false} className="h-full w-full object-contain" />
                                                            ) : (
                                                                <FileText className="h-5 w-5 text-slate-400" />
                                                            )}
                                                        </button>

                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm sm:text-base font-medium text-slate-900 dark:text-white truncate">
                                                                {file.name}
                                                            </p>
                                                            <p className={`text-xs sm:text-sm truncate ${included === 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-500'}`}>
                                                                {included === 0
                                                                    ? 'Ninguna página incluida'
                                                                    : file.excluded.size > 0
                                                                      ? `${included} de ${file.pages} pág`
                                                                      : `${file.pages} pág`}
                                                                {' • '}{formatFileSize(file.size)}
                                                            </p>
                                                        </div>

                                                        <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => setPickerId(file.id)}
                                                                className="h-7 px-2"
                                                            >
                                                                <LayoutGrid className="h-3 w-3" />
                                                                <span className="hidden sm:inline">Páginas</span>
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => moveUp(index)}
                                                                disabled={index === 0}
                                                                aria-label="Subir"
                                                                className="h-7 w-7 sm:h-6 sm:w-6 p-0"
                                                            >
                                                                ↑
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => moveDown(index)}
                                                                disabled={index === files.length - 1}
                                                                aria-label="Bajar"
                                                                className="h-7 w-7 sm:h-6 sm:w-6 p-0"
                                                            >
                                                                ↓
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => removeFile(file.id)}
                                                                aria-label={`Quitar ${file.name}`}
                                                                className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    );
                                                })}
                                            </div>
                                    </ToolCard>
                                )}
                            </div>

                            {/* Options and Process Section - Flows below on mobile */}
                            <div className="space-y-4 sm:space-y-6">
                                <ToolCard
                                    title="Opciones de Unión"
                                    description="Configura cómo se unirán los archivos PDF"
                                    icon={FileUp}
                                    data-tour="options"
                                >
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div className="space-y-1">
                                                    <Label htmlFor="metadata">Preservar Metadatos</Label>
                                                    <p className="text-sm text-slate-600 dark:text-slate-300">
                                                        Mantener título, autor y propiedades del primer PDF
                                                    </p>
                                                </div>
                                                <input
                                                    id="metadata"
                                                    type="checkbox"
                                                    checked={options.preserveMetadata}
                                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                                        setOptions({ ...options, preserveMetadata: e.target.checked })
                                                    }
                                                    className="h-4 w-4 text-institutional border-gray-300 rounded focus:ring-institutional"
                                                />
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <div className="space-y-1">
                                                    <Label htmlFor="pageNumbers">Agregar Números de Página</Label>
                                                    <p className="text-sm text-slate-600 dark:text-slate-300">
                                                        Numerar las páginas en el PDF unificado
                                                    </p>
                                                </div>
                                                <input
                                                    id="pageNumbers"
                                                    type="checkbox"
                                                    checked={options.addPageNumbers}
                                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                                        setOptions({ ...options, addPageNumbers: e.target.checked })
                                                    }
                                                    className="h-4 w-4 text-institutional border-gray-300 rounded focus:ring-institutional"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-3" data-tour="actions">
                                            <Button
                                                onClick={mergePDFs}
                                                disabled={files.length < 2 || isProcessing}
                                                className="w-full bg-institutional hover:bg-institutional/90"
                                            >
                                                {isProcessing ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                        {processingStep}
                                                    </>
                                                ) : (
                                                    <>
                                                        <FileUp className="h-4 w-4 mr-2" />
                                                        Unir PDFs
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
                                </ToolCard>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Páginas de un PDF */}
            <Dialog open={pickerFile !== null} onOpenChange={(open) => !open && setPickerId(null)}>
                <DialogContent className="sm:max-w-4xl">
                    {pickerFile && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="truncate pr-6">{pickerFile.name}</DialogTitle>
                                <DialogDescription>
                                    Haz clic en una página para quitarla o volver a incluirla (Shift + clic marca varias seguidas).{' '}
                                    {includedCount(pickerFile)} de {pickerFile.pages} páginas incluidas.
                                </DialogDescription>
                            </DialogHeader>
                            <PagePicker
                                key={pickerFile.id}
                                pdf={pickerFile}
                                onChange={(excluded) => setExcludedPages(pickerFile.id, excluded)}
                            />
                            <DialogFooter>
                                <Button onClick={() => setPickerId(null)} className="bg-institutional hover:bg-institutional/90">
                                    Listo
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
