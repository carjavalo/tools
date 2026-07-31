import { useState, useRef } from 'react';
import { Head } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import ToolPageHeader from '@/components/ToolPageHeader';
import ToolCard from '@/components/ToolCard';
import { FileUp, Upload, Loader2, X, GripVertical, Plus, Trash2, HelpCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PDFDocument } from 'pdf-lib';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

interface MergeOptions {
    preserveBookmarks: boolean;
    preserveMetadata: boolean;
    addPageNumbers: boolean;
}

interface PDFFile {
    id: string;
    file: File;
    name: string;
    size: number;
    pages?: number;
}

export default function MergePDFs() {
    const [files, setFiles] = useState<PDFFile[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState<number>(0);
    const [processingStep, setProcessingStep] = useState<string>('');
    const [options, setOptions] = useState<MergeOptions>({
        preserveBookmarks: true,
        preserveMetadata: true,
        addPageNumbers: false
    });
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropZoneRef = useRef<HTMLDivElement>(null);
    const draggedIndex = useRef<number | null>(null);

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
                        description: 'Arrastra múltiples archivos PDF aquí o usa el botón "Agregar PDFs". Puedes añadir tantos archivos como necesites y reordenarlos.',
                        side: 'right',
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="options"]',
                    popover: {
                        title: 'Paso 2: Configurar Opciones',
                        description: 'Elige si deseas preservar marcadores y metadatos, o agregar números de página al PDF combinado.',
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
        const validFiles: PDFFile[] = [];
        
        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            
            if (file.type !== 'application/pdf') {
                alert(`"${file.name}" no es un archivo PDF válido. Solo se permiten archivos PDF.`);
                continue;
            }
            
            // Check for duplicates
            const isDuplicate = files.some(f => f.name === file.name && f.size === file.size);
            if (isDuplicate) {
                alert(`"${file.name}" ya está en la lista.`);
                continue;
            }

            try {
                // Get page count
                const arrayBuffer = await file.arrayBuffer();
                const pdfDoc = await PDFDocument.load(arrayBuffer);
                const pageCount = pdfDoc.getPageCount();
                
                validFiles.push({
                    id: generateId(),
                    file,
                    name: file.name,
                    size: file.size,
                    pages: pageCount
                });
            } catch (error) {
                console.error(`Error loading PDF "${file.name}":`, error);
                alert(`Error al cargar "${file.name}". El archivo PDF podría estar dañado.`);
            }
        }
        
        if (validFiles.length > 0) {
            setFiles(prev => [...prev, ...validFiles]);
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

    const mergePDFs = async () => {
        if (files.length < 2) {
            alert('Necesitas al menos 2 archivos PDF para unir.');
            return;
        }

        setIsProcessing(true);
        setProgress(0);
        setProcessingStep('Inicializando...');

        try {
            const mergedPdf = await PDFDocument.create();
            let totalPages = 0;
            
            // Calculate total pages for progress
            files.forEach(f => totalPages += f.pages || 0);
            let processedPages = 0;

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                setProcessingStep(`Procesando ${file.name}... (${i + 1}/${files.length})`);
                
                try {
                    const arrayBuffer = await file.file.arrayBuffer();
                    const pdf = await PDFDocument.load(arrayBuffer);
                    
                    const pageIndices = pdf.getPageIndices();
                    const copiedPages = await mergedPdf.copyPages(pdf, pageIndices);
                    
                    copiedPages.forEach(page => {
                        mergedPdf.addPage(page);
                        processedPages++;
                        const progress = Math.round((processedPages / totalPages) * 90);
                        setProgress(progress);
                    });

                    // Copy metadata from first file
                    if (i === 0 && options.preserveMetadata) {
                        const title = pdf.getTitle();
                        const author = pdf.getAuthor();
                        const subject = pdf.getSubject();
                        const creator = pdf.getCreator();
                        
                        if (title) mergedPdf.setTitle(title);
                        if (author) mergedPdf.setAuthor(author);
                        if (subject) mergedPdf.setSubject(subject);
                        if (creator) mergedPdf.setCreator(`${creator} - Merged by Evaristools`);
                    }

                } catch (error) {
                    console.error(`Error processing ${file.name}:`, error);
                    throw new Error(`Error al procesar "${file.name}". El archivo podría estar dañado.`);
                }
            }

            setProcessingStep('Finalizando PDF unificado...');
            setProgress(95);

            // Add page numbers if requested
            if (options.addPageNumbers) {
                const pages = mergedPdf.getPages();
                pages.forEach((page, index) => {
                    const { width, height } = page.getSize();
                    page.drawText(`${index + 1}`, {
                        x: width - 50,
                        y: 30,
                        size: 10,
                    });
                });
            }

            setProcessingStep('Generando descarga...');
            setProgress(98);

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

            setProgress(100);
            setProcessingStep('¡PDF unificado creado exitosamente!');

        } catch (error) {
            console.error('Error uniendo PDFs:', error);
            alert(`Error al unir PDFs: ${error instanceof Error ? error.message : 'Error desconocido'}`);
            setProcessingStep('Error en el procesamiento');
        } finally {
            setTimeout(() => {
                setIsProcessing(false);
                setProgress(0);
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

    const getTotalPages = () => files.reduce((total, file) => total + (file.pages || 0), 0);
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
                                        description="Arrastra para reordenar. El orden determina cómo se unirán los PDFs."
                                        icon={FileUp}
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <Badge variant="outline" className="text-xs sm:text-sm">{files.length} archivos</Badge>
                                        </div>
                                            <div className="space-y-2 max-h-[60vh] sm:max-h-96 overflow-y-auto">
                                                {files.map((file, index) => (
                                                    <div
                                                        key={file.id}
                                                        draggable
                                                        onDragStart={(e) => handleDragStart(e, index)}
                                                        onDragOver={(e) => handleDragOverItem(e, index)}
                                                        onDragEnd={handleDragEnd}
                                                        className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-layer-3 cursor-move transition-colors"
                                                    >
                                                        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                                                            <span className="text-xs sm:text-sm font-medium text-slate-500 min-w-[16px] sm:min-w-[20px]">
                                                                {index + 1}
                                                            </span>
                                                            <GripVertical className="h-3 w-3 sm:h-4 sm:w-4 text-slate-400" />
                                                        </div>
                                                        
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm sm:text-base font-medium text-slate-900 dark:text-white truncate">
                                                                {file.name}
                                                            </p>
                                                            <p className="text-xs sm:text-sm text-slate-500 truncate">
                                                                {file.pages} pág • {formatFileSize(file.size)}
                                                            </p>
                                                        </div>

                                                        <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => moveUp(index)}
                                                                disabled={index === 0}
                                                                className="h-7 w-7 sm:h-6 sm:w-6 p-0"
                                                            >
                                                                ↑
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => moveDown(index)}
                                                                disabled={index === files.length - 1}
                                                                className="h-7 w-7 sm:h-6 sm:w-6 p-0"
                                                            >
                                                                ↓
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => removeFile(file.id)}
                                                                className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
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
                                            <div className="flex items-start sm:items-center justify-between gap-3">
                                                <div className="space-y-0.5 sm:space-y-1 flex-1">
                                                    <Label htmlFor="bookmarks" className="text-sm sm:text-base">Preservar Marcadores</Label>
                                                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                                                        Mantener los marcadores del primer PDF
                                                    </p>
                                                </div>
                                                <input
                                                    id="bookmarks"
                                                    type="checkbox"
                                                    checked={options.preserveBookmarks}
                                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                                        setOptions({ ...options, preserveBookmarks: e.target.checked })
                                                    }
                                                    className="h-4 w-4 sm:h-5 sm:w-5 text-institutional border-gray-300 rounded focus:ring-institutional flex-shrink-0"
                                                />
                                            </div>

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
        </>
    );
}
