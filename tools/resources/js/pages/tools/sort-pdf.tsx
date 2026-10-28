import { useRef, useState } from 'react';
import { Head } from '@inertiajs/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
    ArrowUpDown,
    Ban,
    CheckCheck,
    CheckCircle,
    ChevronLeft,
    ChevronRight,
    Download,
    Eye,
    FilePlus2,
    FileText,
    HelpCircle,
    Loader2,
    Shuffle,
    Trash2,
    Undo2,
    Upload,
} from 'lucide-react';
import ToolPageHeader from '@/components/ToolPageHeader';
import ToolCard from '@/components/ToolCard';
import FileUploadZone from '@/components/FileUploadZone';
import { PDFDocument } from 'pdf-lib';
import { usePdfThumbnails } from '@/hooks/use-pdf-thumbnails';
import { displaySize, downloadBlob, formatFileSize, isEncryptedPdfError, isPdfFile, pageFrame, pdfBaseName } from '@/lib/pdf-pages';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

interface PageItem {
    id: string;
    // Índice de la página original, o null si es una página en blanco nueva.
    source: number | null;
}

interface SortedResult {
    blob: Blob;
    url: string;
    pages: number;
}

// Tamaño de una hoja A4 en puntos, para páginas en blanco sin vecina.
const A4 = { width: 595, height: 842 };

const originalItems = (count: number): PageItem[] => Array.from({ length: count }, (_, index) => ({ id: `p${index}`, source: index }));

export default function SortPDF() {
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [pageSizes, setPageSizes] = useState<{ width: number; height: number }[]>([]);
    const [items, setItems] = useState<PageItem[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [backsReversed, setBacksReversed] = useState(true);
    const [dropTarget, setDropTarget] = useState<{ id: string; after: boolean } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState<SortedResult | null>(null);
    const [error, setError] = useState('');
    const [dragOver, setDragOver] = useState(false);
    const draggedIdsRef = useRef<string[]>([]);
    const lastClickedRef = useRef<string | null>(null);
    const blankCounterRef = useRef(0);

    const { thumbnails, isRendering, error: thumbnailsError } = usePdfThumbnails(pdfFile, 160);

    const pageCount = pageSizes.length;
    const renderedCount = thumbnails.filter(Boolean).length;
    const isOriginalOrder = items.length === pageCount && items.every((item, index) => item.source === index);

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
                        description: 'Arrastra tu archivo PDF aquí o haz clic para seleccionarlo. Verás todas sus páginas abajo.',
                        side: 'right',
                        align: 'start',
                    },
                },
                {
                    element: '[data-tour="pages"]',
                    popover: {
                        title: 'Paso 2: Ordenar Páginas',
                        description:
                            'Arrastra las páginas para cambiarlas de lugar o usa las flechas. Haz clic para seleccionar varias (Shift + clic para un rango) y moverlas o eliminarlas juntas.',
                        side: 'top',
                        align: 'start',
                    },
                },
                {
                    element: '[data-tour="quick-actions"]',
                    popover: {
                        title: 'Paso 3: Acciones Rápidas',
                        description:
                            'Invierte el orden, intercala las caras de un escaneo a doble cara, inserta páginas en blanco o vuelve al orden original.',
                        side: 'left',
                        align: 'start',
                    },
                },
                {
                    element: '[data-tour="actions"]',
                    popover: {
                        title: 'Paso 4: Guardar',
                        description: 'Haz clic en "Aplicar Orden" y descarga el PDF. Se conservan los formularios y enlaces del documento.',
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

    const updateItems = (next: PageItem[]) => {
        clearResult();
        setItems(next);
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
            const sizes = pdfDoc.getPages().map((page) => displaySize(pageFrame(page)));
            clearResult();
            setPdfFile(file);
            setPageSizes(sizes);
            setItems(originalItems(sizes.length));
            setSelected(new Set());
            lastClickedRef.current = null;
        } catch (err) {
            console.error('Error loading PDF:', err);
            setError(
                isEncryptedPdfError(err)
                    ? 'Este PDF está protegido con contraseña. Quita la protección antes de ordenarlo.'
                    : 'Error al cargar el PDF. El archivo puede estar dañado.',
            );
        } finally {
            setIsLoading(false);
        }
    };

    const toggleSelected = (id: string, extendRange: boolean) => {
        const anchor = lastClickedRef.current;
        lastClickedRef.current = id;

        setSelected((prev) => {
            const next = new Set(prev);
            const select = !prev.has(id);
            const from = items.findIndex((item) => item.id === anchor);
            const to = items.findIndex((item) => item.id === id);
            const range = extendRange && from >= 0 ? items.slice(Math.min(from, to), Math.max(from, to) + 1) : [items[to]];
            range.forEach((item) => (select ? next.add(item.id) : next.delete(item.id)));
            return next;
        });
    };

    /** Mueve las páginas indicadas para que queden antes (o después) de `targetId`. */
    const moveItems = (ids: string[], targetId: string, after: boolean) => {
        if (ids.includes(targetId)) return;
        const moving = items.filter((item) => ids.includes(item.id));
        const rest = items.filter((item) => !ids.includes(item.id));
        const targetIndex = rest.findIndex((item) => item.id === targetId) + (after ? 1 : 0);
        updateItems([...rest.slice(0, targetIndex), ...moving, ...rest.slice(targetIndex)]);
    };

    const shiftItem = (index: number, offset: number) => {
        const target = index + offset;
        if (target < 0 || target >= items.length) return;
        const next = [...items];
        [next[index], next[target]] = [next[target], next[index]];
        updateItems(next);
    };

    const moveSelectionTo = (edge: 'start' | 'end') => {
        const moving = items.filter((item) => selected.has(item.id));
        const rest = items.filter((item) => !selected.has(item.id));
        updateItems(edge === 'start' ? [...moving, ...rest] : [...rest, ...moving]);
    };

    const deleteItems = (ids: string[]) => {
        const remaining = items.filter((item) => !ids.includes(item.id));
        if (remaining.length === 0) {
            setError('El PDF debe conservar al menos una página.');
            return;
        }
        setError('');
        updateItems(remaining);
        setSelected((prev) => new Set([...prev].filter((id) => !ids.includes(id))));
    };

    const insertBlankPage = () => {
        blankCounterRef.current += 1;
        const blank: PageItem = { id: `b${blankCounterRef.current}`, source: null };
        // Después de la última seleccionada, o al final.
        const lastSelected = items.reduce((last, item, index) => (selected.has(item.id) ? index : last), -1);
        const at = lastSelected >= 0 ? lastSelected + 1 : items.length;
        updateItems([...items.slice(0, at), blank, ...items.slice(at)]);
    };

    /**
     * Escaneo a doble cara en dos pasadas: primero todas las caras de
     * adelante y luego las de atrás (normalmente en orden inverso, porque se
     * voltea el fajo). Se intercalan: 1 adelante, 1 atrás, 2 adelante...
     */
    const interleave = () => {
        const half = Math.ceil(items.length / 2);
        const fronts = items.slice(0, half);
        const backs = items.slice(half);
        if (backsReversed) backs.reverse();
        updateItems(fronts.flatMap((front, index) => (backs[index] ? [front, backs[index]] : [front])));
    };

    const restoreOriginal = () => {
        updateItems(originalItems(pageCount));
        setSelected(new Set());
        setError('');
    };

    // Arrastrar y soltar (si la página arrastrada está seleccionada, se mueve toda la selección).
    const handleItemDragStart = (e: React.DragEvent, id: string) => {
        draggedIdsRef.current = selected.has(id) ? items.filter((item) => selected.has(item.id)).map((item) => item.id) : [id];
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);
    };

    const handleItemDragOver = (e: React.DragEvent, id: string) => {
        if (draggedIdsRef.current.length === 0) return;
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        const after = e.clientX > rect.left + rect.width / 2;
        if (dropTarget?.id !== id || dropTarget.after !== after) setDropTarget({ id, after });
    };

    const handleItemDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (dropTarget) moveItems(draggedIdsRef.current, dropTarget.id, dropTarget.after);
        handleItemDragEnd();
    };

    const handleItemDragEnd = () => {
        draggedIdsRef.current = [];
        setDropTarget(null);
    };

    // Tamaño de una página en blanco: el de la página anterior, o A4.
    const blankSize = (index: number) => {
        for (let i = index - 1; i >= 0; i--) {
            const source = items[i].source;
            if (source !== null) return pageSizes[source];
        }
        const firstReal = items.find((item) => item.source !== null);
        return firstReal ? pageSizes[firstReal.source!] : A4;
    };

    const applySort = async () => {
        if (!pdfFile || items.length === 0) return;

        setIsProcessing(true);
        setError('');

        try {
            // Se reordena dentro del mismo documento, así se conservan los
            // formularios, enlaces y marcadores (antes se copiaba a uno nuevo).
            const pdfDoc = await PDFDocument.load(await pdfFile.arrayBuffer());
            const original = pdfDoc.getPages();
            for (let index = pdfDoc.getPageCount() - 1; index >= 0; index--) pdfDoc.removePage(index);
            items.forEach((item, index) => {
                if (item.source !== null) {
                    pdfDoc.addPage(original[item.source]);
                } else {
                    const size = blankSize(index);
                    pdfDoc.addPage([size.width, size.height]);
                }
            });

            const bytes = await pdfDoc.save();
            const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
            clearResult();
            setResult({ blob, url: URL.createObjectURL(blob), pages: items.length });
        } catch (err) {
            console.error('Error sorting PDF:', err);
            setError('Error al ordenar el PDF. Por favor intenta de nuevo.');
        } finally {
            setIsProcessing(false);
        }
    };

    const downloadSortedPDF = () => {
        if (result && pdfFile) downloadBlob(result.blob, `${pdfBaseName(pdfFile)}_ordenado.pdf`);
    };

    const resetTool = () => {
        clearResult();
        setPdfFile(null);
        setPageSizes([]);
        setItems([]);
        setSelected(new Set());
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

    const deletedCount = pageCount - items.filter((item) => item.source !== null).length;
    const blankCount = items.filter((item) => item.source === null).length;

    return (
        <>
            <Head title="Ordenar PDF - Evaristools" />

            <div className="min-h-screen bg-white dark:bg-[#1d1d1e]">
                <ToolPageHeader
                    title="Ordenar PDF"
                    description="Reorganiza, elimina o reordena las páginas de tus documentos PDF"
                    icon={ArrowUpDown}
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
                                    <ToolCard title="¡PDF Ordenado Exitosamente!">
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-center space-x-3 p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                                <CheckCircle className="h-8 w-8 flex-shrink-0 text-green-600" />
                                                <div>
                                                    <p className="font-medium text-green-800 dark:text-green-200">
                                                        El PDF quedó con {result.pages} {result.pages === 1 ? 'página' : 'páginas'}.
                                                    </p>
                                                    <p className="text-sm text-green-600 dark:text-green-300">
                                                        {formatFileSize(result.blob.size)} · puedes seguir ajustando el orden.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex flex-col sm:flex-row gap-3">
                                                <Button onClick={downloadSortedPDF} className="flex-1 bg-institutional hover:bg-institutional/90">
                                                    <Download className="mr-2 h-4 w-4" />
                                                    Descargar PDF Ordenado
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

                            {/* Right Column: Quick actions & Actions */}
                            <div className="space-y-6">
                                <ToolCard title="Acciones Rápidas" data-tour="quick-actions">
                                    <div className="space-y-4">
                                        <div className="flex flex-wrap gap-2">
                                            <Button onClick={() => updateItems([...items].reverse())} variant="outline" size="sm" disabled={items.length < 2}>
                                                <ArrowUpDown className="h-4 w-4 mr-2" />
                                                Invertir Orden
                                            </Button>
                                            <Button onClick={insertBlankPage} variant="outline" size="sm" disabled={!pdfFile}>
                                                <FilePlus2 className="h-4 w-4 mr-2" />
                                                Insertar Página en Blanco
                                            </Button>
                                            <Button onClick={restoreOriginal} variant="outline" size="sm" disabled={!pdfFile || isOriginalOrder}>
                                                <Undo2 className="h-4 w-4 mr-2" />
                                                Restablecer Original
                                            </Button>
                                        </div>

                                        <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                                            <Label className="block">Escaneo a doble cara</Label>
                                            <p className="text-xs text-slate-600 dark:text-slate-400">
                                                Si escaneaste primero todas las caras de adelante y luego las de atrás, esto las intercala en el orden correcto.
                                            </p>
                                            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                                                <Checkbox checked={backsReversed} onCheckedChange={(checked) => setBacksReversed(checked === true)} />
                                                Las caras de atrás quedaron en orden inverso
                                            </label>
                                            <Button onClick={interleave} variant="outline" size="sm" disabled={items.length < 2}>
                                                <Shuffle className="h-4 w-4 mr-2" />
                                                Intercalar Caras
                                            </Button>
                                        </div>

                                        {selected.size > 0 && (
                                            <div className="space-y-2">
                                                <Label className="block">
                                                    {selected.size} {selected.size === 1 ? 'página seleccionada' : 'páginas seleccionadas'}
                                                </Label>
                                                <div className="flex flex-wrap gap-2">
                                                    <Button onClick={() => moveSelectionTo('start')} variant="outline" size="sm">
                                                        Mover al Inicio
                                                    </Button>
                                                    <Button onClick={() => moveSelectionTo('end')} variant="outline" size="sm">
                                                        Mover al Final
                                                    </Button>
                                                    <Button
                                                        onClick={() => deleteItems([...selected])}
                                                        variant="outline"
                                                        size="sm"
                                                        className="text-red-600 hover:text-red-700 dark:text-red-400"
                                                    >
                                                        <Trash2 className="h-4 w-4 mr-2" />
                                                        Eliminar
                                                    </Button>
                                                </div>
                                            </div>
                                        )}

                                        {pdfFile && (
                                            <p className="text-sm text-slate-600 dark:text-slate-300">
                                                {isOriginalOrder
                                                    ? 'Aún no hay cambios.'
                                                    : [
                                                          `El PDF quedará con ${items.length} ${items.length === 1 ? 'página' : 'páginas'}`,
                                                          deletedCount > 0 ? `${deletedCount} ${deletedCount === 1 ? 'eliminada' : 'eliminadas'}` : '',
                                                          blankCount > 0 ? `${blankCount} en blanco` : '',
                                                      ]
                                                          .filter(Boolean)
                                                          .join(' · ') + '.'}
                                            </p>
                                        )}
                                    </div>
                                </ToolCard>

                                <ToolCard title="Acciones" data-tour="actions">
                                    <div className="space-y-3">
                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <Button
                                                onClick={applySort}
                                                disabled={isProcessing || !pdfFile || isOriginalOrder}
                                                className="flex-1 bg-institutional hover:bg-institutional/90"
                                            >
                                                {isProcessing ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                        Procesando...
                                                    </>
                                                ) : (
                                                    <>
                                                        <ArrowUpDown className="h-4 w-4 mr-2" />
                                                        Aplicar Orden
                                                    </>
                                                )}
                                            </Button>
                                            <Button onClick={resetTool} variant="outline" className="flex-1" disabled={isProcessing || !pdfFile}>
                                                <Upload className="h-4 w-4 mr-2" />
                                                Seleccionar Otro PDF
                                            </Button>
                                        </div>
                                        <Button
                                            onClick={startTour}
                                            variant="outline"
                                            className="w-full border-institutional text-institutional hover:bg-institutional/10"
                                        >
                                            <HelpCircle className="h-4 w-4 mr-2" />
                                            ¿Cómo funciona? - Tour Interactivo
                                        </Button>
                                    </div>
                                </ToolCard>
                            </div>
                        </div>

                        {/* Page grid */}
                        {pdfFile && items.length > 0 && (
                            <ToolCard
                                title="Páginas"
                                description="Arrastra las páginas para cambiarlas de lugar. Haz clic para seleccionar varias (Shift + clic para un rango)."
                                icon={Eye}
                                className="mt-8"
                                data-tour="pages"
                            >
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline">{selected.size} seleccionadas</Badge>
                                    <Button size="sm" variant="ghost" onClick={() => setSelected(new Set(items.map((item) => item.id)))}>
                                        <CheckCheck className="h-4 w-4 mr-1" />
                                        Todas
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} disabled={selected.size === 0}>
                                        <Ban className="h-4 w-4 mr-1" />
                                        Ninguna
                                    </Button>
                                    {isRendering && (
                                        <span className="flex items-center text-sm text-slate-600 dark:text-slate-300">
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Generando vista previa... {renderedCount}/{pageCount}
                                        </span>
                                    )}
                                </div>
                                {thumbnailsError && (
                                    <p className="text-sm text-red-600 dark:text-red-400">{thumbnailsError} Aún puedes ordenar las páginas por su número.</p>
                                )}
                                <div
                                    className="grid max-h-[70vh] grid-cols-2 gap-4 overflow-y-auto p-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
                                    onDragLeave={(e) => {
                                        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null);
                                    }}
                                >
                                    {items.map((item, index) => {
                                        const isSelected = selected.has(item.id);
                                        const thumbnail = item.source !== null ? thumbnails[item.source] : null;
                                        const moved = item.source !== index;
                                        const showDropBefore = dropTarget?.id === item.id && !dropTarget.after;
                                        const showDropAfter = dropTarget?.id === item.id && dropTarget.after;

                                        return (
                                            <div
                                                key={item.id}
                                                draggable
                                                onDragStart={(e) => handleItemDragStart(e, item.id)}
                                                onDragOver={(e) => handleItemDragOver(e, item.id)}
                                                onDrop={handleItemDrop}
                                                onDragEnd={handleItemDragEnd}
                                                className={`relative flex cursor-grab flex-col overflow-hidden rounded-lg border bg-white active:cursor-grabbing dark:bg-[#2a2a2b] ${
                                                    isSelected
                                                        ? 'border-transparent ring-2 ring-institutional dark:ring-[#8b9bd6]'
                                                        : 'border-slate-200 dark:border-[#3f3f40]'
                                                }`}
                                            >
                                                {showDropBefore && <span className="absolute inset-y-1 left-0 z-10 w-1 rounded bg-institutional dark:bg-[#8b9bd6]" />}
                                                {showDropAfter && <span className="absolute inset-y-1 right-0 z-10 w-1 rounded bg-institutional dark:bg-[#8b9bd6]" />}
                                                <button
                                                    type="button"
                                                    onClick={(e) => toggleSelected(item.id, e.shiftKey)}
                                                    aria-pressed={isSelected}
                                                    aria-label={`Posición ${index + 1}: ${item.source !== null ? `página original ${item.source + 1}` : 'página en blanco'}. ${isSelected ? 'Seleccionada' : 'Clic para seleccionarla'}`}
                                                    className="relative flex aspect-[3/4] items-center justify-center overflow-hidden bg-slate-100 p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-institutional dark:bg-[#1d1d1e]"
                                                >
                                                    {item.source === null ? (
                                                        <span className="flex h-full w-full items-center justify-center border border-dashed border-slate-300 bg-white text-xs text-slate-400">
                                                            En blanco
                                                        </span>
                                                    ) : thumbnail ? (
                                                        <img src={thumbnail} alt="" draggable={false} className="max-h-full max-w-full object-contain shadow-sm" />
                                                    ) : thumbnailsError ? (
                                                        <FileText className="h-8 w-8 text-slate-400" />
                                                    ) : (
                                                        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                                                    )}
                                                    {moved && item.source !== null && (
                                                        <span className="absolute top-2 left-2 rounded bg-slate-900/75 px-1.5 py-0.5 text-xs font-medium text-white">
                                                            Orig. {item.source + 1}
                                                        </span>
                                                    )}
                                                    {isSelected && (
                                                        <CheckCircle className="absolute top-2 right-2 h-5 w-5 rounded-full bg-white text-institutional dark:bg-[#1d1d1e] dark:text-[#8b9bd6]" />
                                                    )}
                                                </button>
                                                <div className="flex items-center justify-between gap-1 border-t border-slate-200 px-1 py-1 text-xs dark:border-[#3f3f40]">
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-7 w-7"
                                                        onClick={() => shiftItem(index, -1)}
                                                        disabled={index === 0}
                                                        aria-label={`Mover la posición ${index + 1} hacia atrás`}
                                                        title="Mover hacia atrás"
                                                    >
                                                        <ChevronLeft className="h-4 w-4" />
                                                    </Button>
                                                    <span className="font-medium text-slate-700 dark:text-slate-200">{index + 1}</span>
                                                    <div className="flex">
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-7 w-7 text-red-600 hover:text-red-700 dark:text-red-400"
                                                            onClick={() => deleteItems([item.id])}
                                                            aria-label={`Eliminar la posición ${index + 1}`}
                                                            title="Eliminar"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-7 w-7"
                                                            onClick={() => shiftItem(index, 1)}
                                                            disabled={index === items.length - 1}
                                                            aria-label={`Mover la posición ${index + 1} hacia adelante`}
                                                            title="Mover hacia adelante"
                                                        >
                                                            <ChevronRight className="h-4 w-4" />
                                                        </Button>
                                                    </div>
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
