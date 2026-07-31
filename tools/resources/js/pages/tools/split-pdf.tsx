import { useState, useRef } from 'react';
import { Head, Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ArrowLeft, FolderOutput, Download, Upload, Loader2, Building2, X, FileText, Scissors, HelpCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PDFDocument } from 'pdf-lib';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

interface SplitOptions {
    method: 'pages' | 'ranges' | 'size';
    pagesPerSplit?: number;
    customRanges?: string;
    maxSizeMB?: number;
}

interface PageRange {
    start: number;
    end: number;
    name: string;
}

export default function SplitPDF() {
    const [file, setFile] = useState<File | null>(null);
    const [totalPages, setTotalPages] = useState<number>(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState<number>(0);
    const [processingStep, setProcessingStep] = useState<string>('');
    const [splitResults, setSplitResults] = useState<{ name: string; url: string; pages: number }[]>([]);
    const [options, setOptions] = useState<SplitOptions>({
        method: 'pages',
        pagesPerSplit: 1,
        customRanges: '',
        maxSizeMB: 10
    });
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropZoneRef = useRef<HTMLDivElement>(null);

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
                        description: 'Elige cómo dividir el PDF: por número de páginas por archivo o por rangos personalizados (ej: 1-5, 6-10).',
                        side: 'left',
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="actions"]',
                    popover: {
                        title: 'Paso 3: Dividir PDF',
                        description: 'Haz clic en "Dividir PDF" para procesar. Podrás descargar cada archivo individualmente o todos juntos en un ZIP.',
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

    const parseRanges = (rangesStr: string): PageRange[] => {
        const ranges: PageRange[] = [];
        const parts = rangesStr.split(',').map(s => s.trim()).filter(s => s);
        
        parts.forEach((part, index) => {
            if (part.includes('-')) {
                const [start, end] = part.split('-').map(s => parseInt(s.trim()));
                if (start && end && start <= end && start > 0 && end <= totalPages) {
                    ranges.push({
                        start,
                        end,
                        name: `Páginas_${start}-${end}`
                    });
                }
            } else {
                const pageNum = parseInt(part);
                if (pageNum > 0 && pageNum <= totalPages) {
                    ranges.push({
                        start: pageNum,
                        end: pageNum,
                        name: `Página_${pageNum}`
                    });
                }
            }
        });
        
        return ranges;
    };

    const generateRangesByPages = (pagesPerSplit: number): PageRange[] => {
        const ranges: PageRange[] = [];
        let currentStart = 1;
        let rangeIndex = 1;
        
        while (currentStart <= totalPages) {
            const currentEnd = Math.min(currentStart + pagesPerSplit - 1, totalPages);
            ranges.push({
                start: currentStart,
                end: currentEnd,
                name: `Parte_${rangeIndex}`
            });
            currentStart = currentEnd + 1;
            rangeIndex++;
        }
        
        return ranges;
    };

    const splitPDF = async () => {
        if (!file) {
            alert('Por favor selecciona un archivo PDF primero.');
            return;
        }

        let ranges: PageRange[] = [];
        
        // Generate ranges based on method
        if (options.method === 'pages') {
            ranges = generateRangesByPages(options.pagesPerSplit || 1);
        } else if (options.method === 'ranges') {
            if (!options.customRanges?.trim()) {
                alert('Por favor especifica los rangos de páginas (ej: 1-5, 10, 15-20).');
                return;
            }
            ranges = parseRanges(options.customRanges);
            if (ranges.length === 0) {
                alert('Los rangos especificados no son válidos. Formato: 1-5, 10, 15-20');
                return;
            }
        } else {
            // For size-based splitting, we'll use single pages and combine as needed
            ranges = generateRangesByPages(1);
        }

        setIsProcessing(true);
        setProgress(0);
        setProcessingStep('Inicializando división...');
        setSplitResults([]);

        try {
            const arrayBuffer = await file.arrayBuffer();
            const sourcePdf = await PDFDocument.load(arrayBuffer);
            const results: { name: string; url: string; pages: number }[] = [];
            
            for (let i = 0; i < ranges.length; i++) {
                const range = ranges[i];
                setProcessingStep(`Creando ${range.name}... (${i + 1}/${ranges.length})`);
                
                const newPdf = await PDFDocument.create();
                
                // Copy pages in the range
                for (let pageNum = range.start; pageNum <= range.end; pageNum++) {
                    const [copiedPage] = await newPdf.copyPages(sourcePdf, [pageNum - 1]);
                    newPdf.addPage(copiedPage);
                }
                
                // Copy metadata from source
                const title = sourcePdf.getTitle();
                const author = sourcePdf.getAuthor();
                const subject = sourcePdf.getSubject();
                
                if (title) newPdf.setTitle(`${title} - ${range.name}`);
                if (author) newPdf.setAuthor(author);
                if (subject) newPdf.setSubject(`${subject} - Dividido con Evaristools`);
                newPdf.setCreator('Evaristools - Hospital Universitario del Valle');
                
                const pdfBytes = await newPdf.save();
                const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                const url = URL.createObjectURL(blob);
                
                results.push({
                    name: `${range.name}.pdf`,
                    url,
                    pages: range.end - range.start + 1
                });
                
                const progressPercent = Math.round(((i + 1) / ranges.length) * 90);
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
            setTimeout(() => {
                if (splitResults.length === 0) {
                    setIsProcessing(false);
                    setProgress(0);
                    setProcessingStep('');
                }
            }, 2000);
        }
    };

    const downloadFile = (result: { name: string; url: string; pages: number }) => {
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

    const getEstimatedParts = (): number => {
        if (!totalPages) return 0;
        
        if (options.method === 'pages') {
            return Math.ceil(totalPages / (options.pagesPerSplit || 1));
        } else if (options.method === 'ranges') {
            if (!options.customRanges?.trim()) return 0;
            return parseRanges(options.customRanges).length;
        }
        
        return 0;
    };

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
                            <Badge variant="secondary" className="flex items-center space-x-1">
                                <Building2 className="h-3 w-3" />
                                <span>HUV</span>
                            </Badge>
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
                                                <Badge variant="outline">{splitResults.length} archivos</Badge>
                                            </CardTitle>
                                            <CardDescription>
                                                Descarga individual o todos los archivos a la vez
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

                                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                                {splitResults.map((result, index) => (
                                                    <div
                                                        key={index}
                                                        className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-700 rounded-lg"
                                                    >
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-medium text-slate-900 dark:text-white truncate">
                                                                {result.name}
                                                            </p>
                                                            <p className="text-sm text-slate-500">
                                                                {result.pages} {result.pages === 1 ? 'página' : 'páginas'}
                                                            </p>
                                                        </div>
                                                        <Button
                                                            size="sm"
                                                            onClick={() => downloadFile(result)}
                                                            className="ml-2"
                                                        >
                                                            <Download className="h-3 w-3" />
                                                        </Button>
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

                                            {/* Estimated Output */}
                                            {file && totalPages > 0 && getEstimatedParts() > 0 && (
                                                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                                                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                                                        Se generarán aproximadamente {getEstimatedParts()} archivos
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
                    </div>
                </div>
            </div>
        </>
    );
}
