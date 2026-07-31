import { useState, useRef } from 'react';
import { Head } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RotateCw, RotateCcw, Upload, Download, Loader2, FileText, HelpCircle, CheckCircle } from 'lucide-react';
import ToolPageHeader from '@/components/ToolPageHeader';
import ToolCard from '@/components/ToolCard';
import FileUploadZone from '@/components/FileUploadZone';
import { PDFDocument, degrees } from 'pdf-lib';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

interface PageRotation {
    pageNumber: number;
    rotation: number;
}

export default function RotatePDF() {
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isRotated, setIsRotated] = useState(false);
    const [pageCount, setPageCount] = useState(0);
    const [pageRotations, setPageRotations] = useState<Map<number, number>>(new Map());
    const [rotatedPdfUrl, setRotatedPdfUrl] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
                        description: 'Selecciona o arrastra tu archivo PDF. El sistema cargará el documento para rotación.',
                        side: 'right',
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="options"]',
                    popover: {
                        title: 'Paso 2: Elegir Rotación',
                        description: 'Selecciona el ángulo de rotación (90°, 180°, 270°). Puedes aplicarlo a todas las páginas o solo páginas específicas.',
                        side: 'left',
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="actions"]',
                    popover: {
                        title: 'Paso 3: Aplicar Rotación',
                        description: 'Haz clic en "Aplicar Rotación" para procesar el PDF. El archivo rotado se descargará automáticamente.',
                        side: 'left',
                        align: 'start'
                    }
                }
            ]
        });
        driverObj.drive();
    };

    const handleFileSelect = async (files: FileList) => {
        const file = files[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            setError('Por favor selecciona un archivo PDF válido.');
            return;
        }

        if (file.size > 50 * 1024 * 1024) {
            setError('El archivo es demasiado grande. Máximo 50MB permitido.');
            return;
        }

        setPdfFile(file);
        setError('');
        setIsRotated(false);
        setRotatedPdfUrl('');

        // Load PDF to get page count
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdfDoc = await PDFDocument.load(arrayBuffer);
            const pages = pdfDoc.getPages();
            setPageCount(pages.length);
            
            // Initialize rotations to 0 for all pages
            const initialRotations = new Map<number, number>();
            for (let i = 0; i < pages.length; i++) {
                initialRotations.set(i, 0);
            }
            setPageRotations(initialRotations);
        } catch (err) {
            console.error('Error loading PDF:', err);
            setError('Error al cargar el PDF. El archivo puede estar corrupto.');
        }
    };

    const rotatePage = (pageIndex: number, degrees: number) => {
        const newRotations = new Map(pageRotations);
        const currentRotation = newRotations.get(pageIndex) || 0;
        const newRotation = (currentRotation + degrees) % 360;
        newRotations.set(pageIndex, newRotation);
        setPageRotations(newRotations);
    };

    const rotateAllPages = (degrees: number) => {
        const newRotations = new Map<number, number>();
        for (let i = 0; i < pageCount; i++) {
            const currentRotation = pageRotations.get(i) || 0;
            const newRotation = (currentRotation + degrees) % 360;
            newRotations.set(i, newRotation);
        }
        setPageRotations(newRotations);
    };

    const applyRotations = async () => {
        if (!pdfFile) return;

        setIsProcessing(true);
        setError('');

        try {
            const arrayBuffer = await pdfFile.arrayBuffer();
            const pdfDoc = await PDFDocument.load(arrayBuffer);
            const pages = pdfDoc.getPages();

            // Apply rotations to each page
            pages.forEach((page, index) => {
                const rotation = pageRotations.get(index) || 0;
                if (rotation !== 0) {
                    page.setRotation(degrees(rotation));
                }
            });

            // Save the rotated PDF
            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);

            setRotatedPdfUrl(url);
            setIsRotated(true);

        } catch (err) {
            console.error('Error rotating PDF:', err);
            setError('Error al rotar el PDF. Por favor intenta de nuevo.');
        } finally {
            setIsProcessing(false);
        }
    };

    const downloadRotatedPDF = () => {
        if (!rotatedPdfUrl || !pdfFile) return;

        const link = document.createElement('a');
        link.href = rotatedPdfUrl;
        link.download = `${pdfFile.name.replace('.pdf', '')}_rotado.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const resetTool = () => {
        setPdfFile(null);
        setIsRotated(false);
        setRotatedPdfUrl('');
        setPageCount(0);
        setPageRotations(new Map());
        setError('');
        if (rotatedPdfUrl) {
            URL.revokeObjectURL(rotatedPdfUrl);
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
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelect(files);
        }
    };

    return (
        <>
            <Head title="Rotar PDF - Evaristools" />
            
            <div className="min-h-screen bg-white dark:bg-[#1d1d1e]">
                <ToolPageHeader
                    title="Rotar PDF"
                    description="Rota las páginas de tus documentos PDF de forma individual o todas a la vez"
                    icon={RotateCw}
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
                                        acceptedTypes=".pdf"
                                        title="Arrastra tu PDF aquí"
                                        subtitle="o haz clic para seleccionar (máximo 50MB)"
                                    />
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".pdf"
                                        onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
                                        className="hidden"
                                    />
                                </ToolCard>
                            )}

                            {/* Error Message */}
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
                                            <div className="flex items-center space-x-3">
                                                <FileText className="h-8 w-8 text-institutional" />
                                                <div>
                                                    <p className="font-medium text-slate-900 dark:text-white">
                                                        {pdfFile.name}
                                                    </p>
                                                    <p className="text-sm text-slate-600 dark:text-slate-300">
                                                        {pageCount} {pageCount === 1 ? 'página' : 'páginas'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </ToolCard>
                                )}

                                {isRotated && rotatedPdfUrl && (
                                    <ToolCard title="¡PDF Rotado Exitosamente!">
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-center space-x-3 p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                                <CheckCircle className="h-8 w-8 text-green-600" />
                                                <div>
                                                    <p className="font-medium text-green-800 dark:text-green-200">
                                                        ¡Las rotaciones se aplicaron correctamente!
                                                    </p>
                                                    <p className="text-sm text-green-600 dark:text-green-300">
                                                        Descarga tu PDF rotado o procesa otro archivo.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex flex-col sm:flex-row gap-4">
                                                <Button
                                                    onClick={downloadRotatedPDF}
                                                    className="flex-1 bg-institutional hover:bg-institutional/90"
                                                >
                                                    <Download className="mr-2 h-4 w-4" />
                                                    Descargar PDF Rotado
                                                </Button>
                                                <Button
                                                    onClick={resetTool}
                                                    variant="outline"
                                                    className="flex-1"
                                                >
                                                    <Upload className="mr-2 h-4 w-4" />
                                                    Rotar Otro PDF
                                                </Button>
                                            </div>
                                        </div>
                                    </ToolCard>
                                )}
                            </div>

                            {/* Right Column: Always visible */}
                            <div className="space-y-6">
                                <ToolCard title="Opciones de Rotación" data-tour="options">
                                        <div className="space-y-4">
                                            {/* Rotate All Pages */}
                                            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                                <Label className="text-base mb-3 block">
                                                    Rotar Todas las Páginas
                                                </Label>
                                                <div className="flex gap-2">
                                                    <Button
                                                        onClick={() => rotateAllPages(90)}
                                                        variant="outline"
                                                        size="sm"
                                                    >
                                                        <RotateCw className="h-4 w-4 mr-2" />
                                                        90° Derecha
                                                    </Button>
                                                    <Button
                                                        onClick={() => rotateAllPages(-90)}
                                                        variant="outline"
                                                        size="sm"
                                                    >
                                                        <RotateCw className="h-4 w-4 mr-2 transform scale-x-[-1]" />
                                                        90° Izquierda
                                                    </Button>
                                                    <Button
                                                        onClick={() => rotateAllPages(180)}
                                                        variant="outline"
                                                        size="sm"
                                                    >
                                                        180°
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Individual Page Controls */}
                                            <div>
                                                <Label className="text-base mb-3 block">
                                                    Rotar Páginas Individuales
                                                </Label>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                                                    {Array.from({ length: pageCount }, (_, i) => (
                                                        <div
                                                            key={i}
                                                            className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
                                                        >
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="text-sm font-medium text-slate-900 dark:text-white">
                                                                    Página {i + 1}
                                                                </span>
                                                                <span className="text-xs text-slate-600 dark:text-slate-300">
                                                                    {pageRotations.get(i) || 0}°
                                                                </span>
                                                            </div>
                                                            <div className="flex gap-1">
                                                                <Button
                                                                    onClick={() => rotatePage(i, 90)}
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="flex-1 text-xs"
                                                                >
                                                                    90°
                                                                </Button>
                                                                <Button
                                                                    onClick={() => rotatePage(i, -90)}
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="flex-1 text-xs"
                                                                >
                                                                    -90°
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                </ToolCard>

                                <ToolCard title="Acciones" data-tour="actions">
                                    <div className="space-y-3">
                                        <div className="flex flex-col sm:flex-row gap-4">
                                            <Button
                                                onClick={applyRotations}
                                                disabled={isProcessing || !pdfFile}
                                                className="flex-1 bg-institutional hover:bg-institutional/90"
                                            >
                                                {isProcessing ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        Aplicando Rotaciones...
                                                    </>
                                                ) : (
                                                    <>
                                                        <RotateCw className="mr-2 h-4 w-4" />
                                                        Aplicar Rotaciones
                                                    </>
                                                )}
                                            </Button>
                                            <Button
                                                onClick={resetTool}
                                                variant="outline"
                                                className="flex-1"
                                                disabled={isProcessing}
                                            >
                                                <Upload className="mr-2 h-4 w-4" />
                                                Seleccionar Otro
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