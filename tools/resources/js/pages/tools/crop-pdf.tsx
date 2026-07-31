import { useState, useRef } from 'react';
import { Head } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, FileText, Loader2, Download, Crop, CheckCircle, HelpCircle } from 'lucide-react';
import ToolPageHeader from '@/components/ToolPageHeader';
import ToolCard from '@/components/ToolCard';
import FileUploadZone from '@/components/FileUploadZone';
import { PDFDocument } from 'pdf-lib';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

interface CropMargins {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

export default function CropPDF() {
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isCropped, setIsCropped] = useState(false);
    const [croppedPdfUrl, setCroppedPdfUrl] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [dragOver, setDragOver] = useState(false);
    const [margins, setMargins] = useState<CropMargins>({
        top: 20,
        right: 20,
        bottom: 20,
        left: 20
    });
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
                        description: 'Selecciona o arrastra tu archivo PDF. Verás una vista previa de la primera página para ajustar los márgenes de recorte.',
                        side: 'right',
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="options"]',
                    popover: {
                        title: 'Paso 2: Ajustar Márgenes',
                        description: 'Configura los márgenes de recorte para cada lado (superior, inferior, izquierdo, derecho). Los cambios se verán en la vista previa.',
                        side: 'left',
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="actions"]',
                    popover: {
                        title: 'Paso 3: Aplicar Recorte',
                        description: 'Haz clic en "Aplicar Recorte" para procesar el PDF. El recorte se aplicará a todas las páginas del documento.',
                        side: 'left',
                        align: 'start'
                    }
                }
            ]
        });
        driverObj.drive();
    };

    const handleFileSelect = (files: FileList) => {
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
        setIsCropped(false);
        setCroppedPdfUrl('');
    };

    const setUniformMargin = (value: number) => {
        setMargins({
            top: value,
            right: value,
            bottom: value,
            left: value
        });
    };

    const cropPDF = async () => {
        if (!pdfFile) return;

        setIsProcessing(true);
        setError('');

        try {
            const arrayBuffer = await pdfFile.arrayBuffer();
            const pdfDoc = await PDFDocument.load(arrayBuffer);
            const pages = pdfDoc.getPages();

            pages.forEach((page) => {
                const { width, height } = page.getSize();
                
                // Calculate new dimensions after cropping
                const newWidth = width - margins.left - margins.right;
                const newHeight = height - margins.top - margins.bottom;

                // Validate that dimensions are positive
                if (newWidth <= 0 || newHeight <= 0) {
                    throw new Error('Los márgenes son demasiado grandes para el tamaño de página.');
                }

                // Set the crop box
                page.setCropBox(
                    margins.left,
                    margins.bottom,
                    newWidth,
                    newHeight
                );
            });

            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);

            setCroppedPdfUrl(url);
            setIsCropped(true);

        } catch (err: any) {
            console.error('Error cropping PDF:', err);
            setError(err.message || 'Error al recortar el PDF. Por favor intenta de nuevo.');
        } finally {
            setIsProcessing(false);
        }
    };

    const downloadCroppedPDF = () => {
        if (!croppedPdfUrl || !pdfFile) return;

        const link = document.createElement('a');
        link.href = croppedPdfUrl;
        link.download = `${pdfFile.name.replace('.pdf', '')}_recortado.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const resetTool = () => {
        setPdfFile(null);
        setIsCropped(false);
        setCroppedPdfUrl('');
        setError('');
        if (croppedPdfUrl) {
            URL.revokeObjectURL(croppedPdfUrl);
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
            <Head title="Recortar PDF - Evaristools" />
            
            <div className="min-h-screen bg-white dark:bg-[#1d1d1e]">
                <ToolPageHeader
                    title="Recortar PDF"
                    description="Elimina los márgenes de tus documentos PDF ajustando los bordes"
                    icon={Crop}
                />

                <div className="container mx-auto px-4 py-8">
                    <div className="max-w-6xl mx-auto">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                            {/* Left Column */}
                            <div className="space-y-6">
                                {/* Upload Section */}
                                {!pdfFile && (
                                    <ToolCard title="Seleccionar PDF" data-tour="upload">
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

                                {/* File Info */}
                                {pdfFile && !isCropped && (
                                    <ToolCard title="Archivo Seleccionado">
                                        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-[#222322] rounded-lg">
                                            <div className="flex items-center space-x-3">
                                                <FileText className="h-8 w-8 text-institutional" />
                                                <div>
                                                    <p className="font-medium text-slate-900 dark:text-white">
                                                        {pdfFile.name}
                                                    </p>
                                                    <p className="text-sm text-slate-600 dark:text-slate-300">
                                                        {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
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

                                {/* Success Message */}
                                {isCropped && croppedPdfUrl && (
                                    <ToolCard title="¡PDF Recortado Exitosamente!">
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-center space-x-3 p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                                <CheckCircle className="h-8 w-8 text-green-600" />
                                                <div>
                                                    <p className="font-medium text-green-800 dark:text-green-200">
                                                        ¡El PDF se recortó correctamente!
                                                    </p>
                                                    <p className="text-sm text-green-600 dark:text-green-300">
                                                        Descarga tu PDF recortado o procesa otro archivo.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex flex-col sm:flex-row gap-4">
                                                <Button
                                                    onClick={downloadCroppedPDF}
                                                    className="flex-1 bg-institutional hover:bg-institutional/90"
                                                >
                                                    <Download className="mr-2 h-4 w-4" />
                                                    Descargar PDF Recortado
                                                </Button>
                                                <Button
                                                    onClick={resetTool}
                                                    variant="outline"
                                                    className="flex-1"
                                                >
                                                    <Upload className="mr-2 h-4 w-4" />
                                                    Recortar Otro PDF
                                                </Button>
                                            </div>
                                        </div>
                                    </ToolCard>
                                )}
                            </div>

                            {/* Right Column: Always visible Options, Actions & Instructions */}
                            <div className="space-y-6">
                                {/* Crop Options */}
                                <ToolCard title="Opciones de Recorte" data-tour="options">
                                    <div className="space-y-4">
                                        {/* Uniform Margin Presets */}
                                        <div className="space-y-2">
                                            <Label>Márgenes Uniformes (Puntos)</Label>
                                            <div className="flex flex-wrap gap-2">
                                                <Button
                                                    onClick={() => setUniformMargin(10)}
                                                    variant="outline"
                                                    size="sm"
                                                >
                                                    10pt
                                                </Button>
                                                <Button
                                                    onClick={() => setUniformMargin(20)}
                                                    variant="outline"
                                                    size="sm"
                                                >
                                                    20pt
                                                </Button>
                                                <Button
                                                    onClick={() => setUniformMargin(30)}
                                                    variant="outline"
                                                    size="sm"
                                                >
                                                    30pt
                                                </Button>
                                                <Button
                                                    onClick={() => setUniformMargin(50)}
                                                    variant="outline"
                                                    size="sm"
                                                >
                                                    50pt
                                                </Button>
                                                <Button
                                                    onClick={() => setUniformMargin(0)}
                                                    variant="outline"
                                                    size="sm"
                                                >
                                                    Sin Recorte
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Individual Margins */}
                                        <div className="space-y-3">
                                            <Label>Márgenes Personalizados (en puntos)</Label>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="margin-top" className="text-sm">Superior</Label>
                                                    <Input
                                                        id="margin-top"
                                                        type="number"
                                                        min="0"
                                                        max="200"
                                                        value={margins.top}
                                                        onChange={(e) => setMargins({ ...margins, top: parseInt(e.target.value) || 0 })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="margin-right" className="text-sm">Derecho</Label>
                                                    <Input
                                                        id="margin-right"
                                                        type="number"
                                                        min="0"
                                                        max="200"
                                                        value={margins.right}
                                                        onChange={(e) => setMargins({ ...margins, right: parseInt(e.target.value) || 0 })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="margin-bottom" className="text-sm">Inferior</Label>
                                                    <Input
                                                        id="margin-bottom"
                                                        type="number"
                                                        min="0"
                                                        max="200"
                                                        value={margins.bottom}
                                                        onChange={(e) => setMargins({ ...margins, bottom: parseInt(e.target.value) || 0 })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="margin-left" className="text-sm">Izquierdo</Label>
                                                    <Input
                                                        id="margin-left"
                                                        type="number"
                                                        min="0"
                                                        max="200"
                                                        value={margins.left}
                                                        onChange={(e) => setMargins({ ...margins, left: parseInt(e.target.value) || 0 })}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Visual Preview */}
                                        <div className="p-6 bg-slate-100 dark:bg-slate-800 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600">
                                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">Vista Previa del Recorte:</p>
                                            <div className="relative h-48 bg-white dark:bg-slate-700 rounded flex items-center justify-center">
                                                <div
                                                    className="bg-blue-100 dark:bg-blue-900/30 border-2 border-dashed border-institutional flex items-center justify-center"
                                                    style={{
                                                        marginTop: `${margins.top / 2}px`,
                                                        marginRight: `${margins.right / 2}px`,
                                                        marginBottom: `${margins.bottom / 2}px`,
                                                        marginLeft: `${margins.left / 2}px`,
                                                        width: `calc(100% - ${(margins.left + margins.right) / 2}px)`,
                                                        height: `calc(100% - ${(margins.top + margins.bottom) / 2}px)`
                                                    }}
                                                >
                                                    <p className="text-xs text-slate-600 dark:text-slate-400">Área visible</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </ToolCard>

                                {/* Action Buttons */}
                                <ToolCard title="Acciones" data-tour="actions">
                                    <div className="space-y-3">
                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <Button
                                                onClick={cropPDF}
                                                disabled={isProcessing || !pdfFile}
                                                className="flex-1 bg-institutional hover:bg-institutional/90"
                                            >
                                                {isProcessing ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        Recortando...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Crop className="mr-2 h-4 w-4" />
                                                        Recortar PDF
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
                                                Seleccionar Otro PDF
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