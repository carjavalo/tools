import { useEffect, useRef, useState } from 'react';
import { Head } from '@inertiajs/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Ban, CheckCheck, CheckCircle, Download, Eye, FileArchive, FileText, HelpCircle, Image as ImageIcon, Loader2, Upload } from 'lucide-react';
import ToolPageHeader from '@/components/ToolPageHeader';
import ToolCard from '@/components/ToolCard';
import FileUploadZone from '@/components/FileUploadZone';
import OptionButtons from '@/components/OptionButtons';
import { usePdfThumbnails } from '@/hooks/use-pdf-thumbnails';
import { downloadBlob, formatFileSize, isPdfFile, pdfBaseName } from '@/lib/pdf-pages';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

type ImageFormat = 'jpeg' | 'png';

interface PageImage {
    page: number;
    blob: Blob;
    name: string;
}

const DPI_OPTIONS = [
    { value: '72', label: '72 DPI (pantalla)' },
    { value: '150', label: '150 DPI (normal)' },
    { value: '300', label: '300 DPI (impresión)' },
];

const pageSequence = (total: number) => Array.from({ length: total }, (_, index) => index + 1);

export default function PDFToImages() {
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [format, setFormat] = useState<ImageFormat>('jpeg');
    const [dpi, setDpi] = useState('150');
    const [quality, setQuality] = useState('0.9');
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState('');
    const [results, setResults] = useState<PageImage[]>([]);
    const [error, setError] = useState('');
    const [dragOver, setDragOver] = useState(false);
    const lastClickedRef = useRef<number | null>(null);

    const { thumbnails, isRendering, error: thumbnailsError, exportPage } = usePdfThumbnails(pdfFile, 140);
    const totalPages = thumbnails.length;
    const renderedCount = thumbnails.filter(Boolean).length;
    const extension = format === 'png' ? 'png' : 'jpg';

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
                        description: 'Selecciona el PDF. Verás sus páginas abajo; todas quedan seleccionadas.',
                        side: 'right',
                        align: 'start',
                    },
                },
                {
                    element: '[data-tour="options"]',
                    popover: {
                        title: 'Paso 2: Configurar',
                        description: 'Elige JPG (más liviano) o PNG (sin pérdida) y la resolución. 300 DPI sirve para imprimir.',
                        side: 'left',
                        align: 'start',
                    },
                },
                {
                    element: '[data-tour="pages"]',
                    popover: {
                        title: 'Paso 3: Elegir Páginas',
                        description: 'Haz clic en las páginas para incluirlas o quitarlas (Shift + clic para un rango).',
                        side: 'top',
                        align: 'start',
                    },
                },
                {
                    element: '[data-tour="actions"]',
                    popover: {
                        title: 'Paso 4: Convertir',
                        description: 'Haz clic en "Convertir a Imágenes". Varias páginas se descargan juntas en un ZIP.',
                        side: 'left',
                        align: 'start',
                    },
                },
            ],
        });
        driverObj.drive();
    };

    const handleFileSelect = (files: FileList) => {
        const file = files[0];
        if (!file) return;

        if (!isPdfFile(file)) {
            setError('Por favor selecciona un archivo PDF válido.');
            return;
        }

        if (file.size > 100 * 1024 * 1024) {
            setError('El archivo es demasiado grande. Máximo 100MB permitido.');
            return;
        }

        setError('');
        setResults([]);
        setSelected(new Set());
        lastClickedRef.current = null;
        setPdfFile(file);
    };

    // Al terminar de leer el PDF, todas las páginas quedan seleccionadas.
    useEffect(() => {
        setSelected(new Set(pageSequence(totalPages)));
        lastClickedRef.current = null;
    }, [totalPages]);

    const togglePage = (page: number, extendRange: boolean) => {
        const anchor = lastClickedRef.current;
        lastClickedRef.current = page;
        setResults([]);
        setSelected((prev) => {
            const next = new Set(prev);
            const select = !prev.has(page);
            const [from, to] = extendRange && anchor ? [Math.min(anchor, page), Math.max(anchor, page)] : [page, page];
            for (let current = from; current <= to; current++) {
                if (select) next.add(current);
                else next.delete(current);
            }
            return next;
        });
    };

    const convert = async () => {
        if (!pdfFile || selected.size === 0) return;

        setIsProcessing(true);
        setError('');
        setResults([]);
        const base = pdfBaseName(pdfFile);
        const pages = [...selected].sort((a, b) => a - b);
        const type = format === 'png' ? 'image/png' : 'image/jpeg';
        const converted: PageImage[] = [];

        try {
            for (const [index, page] of pages.entries()) {
                setProgress(`Convirtiendo página ${index + 1} de ${pages.length}...`);
                const blob = await exportPage(page, parseInt(dpi, 10), type, parseFloat(quality));
                converted.push({ page, blob, name: `${base}_pagina_${String(page).padStart(3, '0')}.${extension}` });
            }
            setResults(converted);

            if (converted.length === 1) {
                downloadBlob(converted[0].blob, converted[0].name);
            } else {
                setProgress('Armando el ZIP...');
                await downloadZip(converted, `${base}_imagenes.zip`);
            }
        } catch (err) {
            console.error('Error converting PDF to images:', err);
            setError('No se pudieron convertir las páginas. Si el PDF es muy grande, prueba con una resolución menor.');
        } finally {
            setIsProcessing(false);
            setProgress('');
        }
    };

    // Un solo ZIP en vez de una descarga por página (el navegador bloquea las descargas múltiples).
    const downloadZip = async (images: PageImage[], name: string) => {
        const { default: JSZip } = await import('jszip');
        const zip = new JSZip();
        images.forEach((image) => zip.file(image.name, image.blob));
        // Las imágenes ya vienen comprimidas: no vale la pena recomprimir.
        downloadBlob(await zip.generateAsync({ type: 'blob', compression: 'STORE' }), name);
    };

    const resetTool = () => {
        setPdfFile(null);
        setSelected(new Set());
        setResults([]);
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

    const totalSize = results.reduce((sum, item) => sum + item.blob.size, 0);

    return (
        <>
            <Head title="PDF a Imágenes - Evaristools" />

            <div className="min-h-screen bg-white dark:bg-[#1d1d1e]">
                <ToolPageHeader title="PDF a Imágenes" description="Convierte las páginas de un PDF en imágenes JPG o PNG" icon={ImageIcon} />

                <div className="container mx-auto px-4 py-8">
                    <div className="max-w-6xl mx-auto">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                            {/* Left Column: Upload & Messages */}
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
                                            subtitle="o haz clic para seleccionar (máximo 100MB)"
                                        />
                                    </ToolCard>
                                )}

                                {(error || thumbnailsError) && (
                                    <ToolCard title="Error">
                                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                            <p className="text-red-800 dark:text-red-200">
                                                {error || 'No se pudo abrir este PDF. Si está protegido con contraseña, quítale la protección primero.'}
                                            </p>
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
                                                        {totalPages > 0 ? `${totalPages} ${totalPages === 1 ? 'página' : 'páginas'} · ` : ''}
                                                        {formatFileSize(pdfFile.size)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </ToolCard>
                                )}

                                {results.length > 0 && (
                                    <ToolCard title="¡Imágenes Listas!">
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-center space-x-3 p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                                <CheckCircle className="h-8 w-8 flex-shrink-0 text-green-600" />
                                                <div>
                                                    <p className="font-medium text-green-800 dark:text-green-200">
                                                        {results.length === 1 ? 'Se descargó 1 imagen.' : `Se descargaron ${results.length} imágenes en un ZIP.`}
                                                    </p>
                                                    <p className="text-sm text-green-600 dark:text-green-300">{formatFileSize(totalSize)} en total</p>
                                                </div>
                                            </div>
                                            {results.length > 1 && (
                                                <Button
                                                    onClick={() => pdfFile && downloadZip(results, `${pdfBaseName(pdfFile)}_imagenes.zip`)}
                                                    variant="outline"
                                                    className="w-full"
                                                >
                                                    <FileArchive className="mr-2 h-4 w-4" />
                                                    Descargar el ZIP de nuevo
                                                </Button>
                                            )}
                                            <ul className="max-h-60 divide-y divide-slate-200 overflow-y-auto rounded-lg border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
                                                {results.map((item) => (
                                                    <li key={item.page} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                                                        <span className="truncate text-slate-700 dark:text-slate-200">{item.name}</span>
                                                        <span className="flex flex-shrink-0 items-center gap-2">
                                                            <span className="text-xs text-slate-500">{formatFileSize(item.blob.size)}</span>
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-7 w-7"
                                                                onClick={() => downloadBlob(item.blob, item.name)}
                                                                aria-label={`Descargar ${item.name}`}
                                                            >
                                                                <Download className="h-4 w-4" />
                                                            </Button>
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </ToolCard>
                                )}
                            </div>

                            {/* Right Column: Options & Actions */}
                            <div className="space-y-6">
                                <ToolCard title="Opciones de Conversión" data-tour="options">
                                    <div className="space-y-5">
                                        <div className="space-y-2">
                                            <Label id="format-label">Formato</Label>
                                            <OptionButtons
                                                labelledBy="format-label"
                                                value={format}
                                                onChange={(value) => {
                                                    setFormat(value);
                                                    setResults([]);
                                                }}
                                                className="grid-cols-2"
                                                options={[
                                                    { value: 'jpeg', label: 'JPG (más liviano)' },
                                                    { value: 'png', label: 'PNG (sin pérdida)' },
                                                ]}
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label htmlFor="dpi">Resolución</Label>
                                                <Select
                                                    value={dpi}
                                                    onValueChange={(value) => {
                                                        setDpi(value);
                                                        setResults([]);
                                                    }}
                                                >
                                                    <SelectTrigger id="dpi">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {DPI_OPTIONS.map((option) => (
                                                            <SelectItem key={option.value} value={option.value}>
                                                                {option.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            {format === 'jpeg' && (
                                                <div className="space-y-2">
                                                    <Label htmlFor="quality">Calidad JPG</Label>
                                                    <Select
                                                        value={quality}
                                                        onValueChange={(value) => {
                                                            setQuality(value);
                                                            setResults([]);
                                                        }}
                                                    >
                                                        <SelectTrigger id="quality">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="0.7">70% (liviana)</SelectItem>
                                                            <SelectItem value="0.8">80% (buena)</SelectItem>
                                                            <SelectItem value="0.9">90% (alta)</SelectItem>
                                                            <SelectItem value="1">100% (máxima)</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </ToolCard>

                                <ToolCard title="Acciones" data-tour="actions">
                                    <div className="space-y-3">
                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <Button
                                                onClick={convert}
                                                disabled={!pdfFile || selected.size === 0 || isProcessing || totalPages === 0}
                                                className="flex-1 bg-institutional hover:bg-institutional/90"
                                            >
                                                {isProcessing ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        {progress || 'Convirtiendo...'}
                                                    </>
                                                ) : (
                                                    <>
                                                        <ImageIcon className="mr-2 h-4 w-4" />
                                                        Convertir a Imágenes {selected.size > 0 && `(${selected.size})`}
                                                    </>
                                                )}
                                            </Button>
                                            <Button onClick={resetTool} variant="outline" className="flex-1" disabled={isProcessing || !pdfFile}>
                                                <Upload className="mr-2 h-4 w-4" />
                                                Seleccionar Otro PDF
                                            </Button>
                                        </div>
                                        <p className="text-xs text-slate-600 dark:text-slate-400">Todo se procesa en tu navegador: el PDF no se sube a ningún servidor.</p>
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

                        {pdfFile && totalPages > 0 && (
                            <ToolCard
                                title="Páginas"
                                description="Haz clic para incluir o quitar páginas (Shift + clic para un rango)."
                                icon={Eye}
                                className="mt-8"
                                data-tour="pages"
                            >
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline">
                                        {selected.size} de {totalPages} seleccionadas
                                    </Badge>
                                    <Button size="sm" variant="ghost" onClick={() => setSelected(new Set(pageSequence(totalPages)))}>
                                        <CheckCheck className="mr-1 h-4 w-4" />
                                        Todas
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} disabled={selected.size === 0}>
                                        <Ban className="mr-1 h-4 w-4" />
                                        Ninguna
                                    </Button>
                                    {isRendering && (
                                        <span className="flex items-center text-sm text-slate-600 dark:text-slate-300">
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Generando vista previa... {renderedCount}/{totalPages}
                                        </span>
                                    )}
                                </div>
                                <div className="grid max-h-[70vh] grid-cols-3 gap-3 overflow-y-auto p-1 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                                    {pageSequence(totalPages).map((page) => {
                                        const isSelected = selected.has(page);
                                        const thumbnail = thumbnails[page - 1];
                                        return (
                                            <button
                                                key={page}
                                                type="button"
                                                onClick={(e) => togglePage(page, e.shiftKey)}
                                                aria-pressed={isSelected}
                                                aria-label={`Página ${page}: ${isSelected ? 'incluida' : 'no incluida'}`}
                                                className={`flex flex-col overflow-hidden rounded-lg border bg-white text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-institutional dark:bg-[#2a2a2b] ${
                                                    isSelected
                                                        ? 'border-transparent ring-2 ring-institutional dark:ring-[#8b9bd6]'
                                                        : 'border-dashed border-slate-300 dark:border-slate-600'
                                                }`}
                                            >
                                                <span className="relative flex aspect-[3/4] items-center justify-center bg-slate-100 p-1 dark:bg-[#1d1d1e]">
                                                    {thumbnail ? (
                                                        <img
                                                            src={thumbnail}
                                                            alt=""
                                                            className={`max-h-full max-w-full object-contain ${isSelected ? '' : 'opacity-40 grayscale'}`}
                                                        />
                                                    ) : (
                                                        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                                                    )}
                                                    {isSelected && (
                                                        <CheckCircle className="absolute top-1 right-1 h-4 w-4 rounded-full bg-white text-institutional dark:bg-[#1d1d1e] dark:text-[#8b9bd6]" />
                                                    )}
                                                </span>
                                                <span className="border-t border-slate-200 px-2 py-1 text-center text-xs font-medium text-slate-700 dark:border-[#3f3f40] dark:text-slate-200">
                                                    {page}
                                                </span>
                                            </button>
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
