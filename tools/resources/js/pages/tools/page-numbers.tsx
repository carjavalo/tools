import { useState, useRef } from 'react';
import { Head } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileText, Loader2, Download, Hash, HelpCircle, CheckCircle } from 'lucide-react';
import ToolPageHeader from '@/components/ToolPageHeader';
import ToolCard from '@/components/ToolCard';
import FileUploadZone from '@/components/FileUploadZone';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

interface PageNumberOptions {
    position: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
    startNumber: number;
    format: 'number' | 'page-of-total' | 'roman';
    fontSize: number;
}

export default function PageNumbers() {
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isNumbered, setIsNumbered] = useState(false);
    const [numberedPdfUrl, setNumberedPdfUrl] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [dragOver, setDragOver] = useState(false);
    const [options, setOptions] = useState<PageNumberOptions>({
        position: 'bottom-center',
        startNumber: 1,
        format: 'page-of-total',
        fontSize: 12
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
                    element: '[data-tour="upload-zone"]',
                    popover: {
                        title: 'Paso 1: Seleccionar PDF',
                        description: 'Arrastra tu archivo PDF aquí o haz clic para seleccionarlo. El archivo debe ser menor a 50MB.',
                        side: 'bottom',
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="options"]',
                    popover: {
                        title: 'Paso 2: Configurar Opciones',
                        description: 'Personaliza la posición, formato, tamaño de fuente y número de inicio para los números de página.',
                        side: 'left',
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="actions"]',
                    popover: {
                        title: 'Paso 3: Aplicar Números',
                        description: 'Haz clic en "Agregar Números de Página" para procesar tu documento. Una vez completado, podrás descargarlo.',
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
        setIsNumbered(false);
        setNumberedPdfUrl('');
    };

    const toRoman = (num: number): string => {
        const romanNumerals: [number, string][] = [
            [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
            [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
            [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
        ];
        
        let result = '';
        for (const [value, numeral] of romanNumerals) {
            while (num >= value) {
                result += numeral;
                num -= value;
            }
        }
        return result.toLowerCase();
    };

    const formatPageNumber = (pageNum: number, totalPages: number): string => {
        switch (options.format) {
            case 'number':
                return `${pageNum}`;
            case 'page-of-total':
                return `${pageNum} de ${totalPages}`;
            case 'roman':
                return toRoman(pageNum);
            default:
                return `${pageNum}`;
        }
    };

    const getPositionCoordinates = (pageWidth: number, pageHeight: number, textWidth: number) => {
        const margin = 30;
        
        switch (options.position) {
            case 'top-left':
                return { x: margin, y: pageHeight - margin };
            case 'top-center':
                return { x: (pageWidth - textWidth) / 2, y: pageHeight - margin };
            case 'top-right':
                return { x: pageWidth - textWidth - margin, y: pageHeight - margin };
            case 'bottom-left':
                return { x: margin, y: margin };
            case 'bottom-center':
                return { x: (pageWidth - textWidth) / 2, y: margin };
            case 'bottom-right':
                return { x: pageWidth - textWidth - margin, y: margin };
            default:
                return { x: (pageWidth - textWidth) / 2, y: margin };
        }
    };

    const addPageNumbers = async () => {
        if (!pdfFile) return;

        setIsProcessing(true);
        setError('');

        try {
            const arrayBuffer = await pdfFile.arrayBuffer();
            const pdfDoc = await PDFDocument.load(arrayBuffer);
            const pages = pdfDoc.getPages();
            const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const totalPages = pages.length;

            pages.forEach((page, index) => {
                const pageNum = index + options.startNumber;
                const pageText = formatPageNumber(pageNum, totalPages + options.startNumber - 1);
                const textWidth = font.widthOfTextAtSize(pageText, options.fontSize);
                const { width, height } = page.getSize();
                const { x, y } = getPositionCoordinates(width, height, textWidth);

                page.drawText(pageText, {
                    x,
                    y,
                    size: options.fontSize,
                    font,
                    color: rgb(0, 0, 0),
                });
            });

            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);

            setNumberedPdfUrl(url);
            setIsNumbered(true);

        } catch (err) {
            console.error('Error adding page numbers:', err);
            setError('Error al agregar números de página. Por favor intenta de nuevo.');
        } finally {
            setIsProcessing(false);
        }
    };

    const downloadNumberedPDF = () => {
        if (!numberedPdfUrl || !pdfFile) return;

        const link = document.createElement('a');
        link.href = numberedPdfUrl;
        link.download = `${pdfFile.name.replace('.pdf', '')}_numerado.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const resetTool = () => {
        setPdfFile(null);
        setIsNumbered(false);
        setNumberedPdfUrl('');
        setError('');
        if (numberedPdfUrl) {
            URL.revokeObjectURL(numberedPdfUrl);
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
            <Head title="Números de Página - Evaristools" />
            
            <div className="min-h-screen bg-white dark:bg-[#1d1d1e]">
                <ToolPageHeader
                    title="Números de Página"
                    description="Añade números de página personalizados a tus documentos PDF"
                    icon={Hash}
                />

                <div className="container mx-auto px-4 py-8">
                    <div className="max-w-6xl mx-auto">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                            {/* Left Column: File Upload & Messages */}
                            <div className="space-y-6" data-tour="upload">
                                {/* Upload Section */}
                                {!pdfFile && (
                                    <ToolCard title="Seleccionar PDF" data-tour="upload-zone">
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
                                {pdfFile && !isNumbered && (
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
                                {isNumbered && numberedPdfUrl && (
                                    <ToolCard title="¡Números de Página Agregados!">
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-center space-x-3 p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                                <CheckCircle className="h-8 w-8 text-green-600" />
                                                <div>
                                                    <p className="font-medium text-green-800 dark:text-green-200">
                                                        ¡Los números de página se agregaron correctamente!
                                                    </p>
                                                    <p className="text-sm text-green-600 dark:text-green-300">
                                                        Descarga tu PDF numerado o procesa otro archivo.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex flex-col sm:flex-row gap-4">
                                                <Button
                                                    onClick={downloadNumberedPDF}
                                                    className="flex-1 bg-institutional hover:bg-institutional/90 text-white"
                                                >
                                                    <Download className="mr-2 h-4 w-4" />
                                                    Descargar PDF Numerado
                                                </Button>
                                                <Button
                                                    onClick={resetTool}
                                                    variant="outline"
                                                    className="flex-1"
                                                >
                                                    <Upload className="mr-2 h-4 w-4" />
                                                    Numerar Otro PDF
                                                </Button>
                                            </div>
                                        </div>
                                    </ToolCard>
                                )}
                            </div>

                            {/* Right Column: Always visible Options, Actions & Instructions */}
                            <div className="space-y-6">
                                {/* Options */}
                                <ToolCard title="Opciones de Numeración" data-tour="options">
                                    <div className="space-y-4">
                                        {/* Position */}
                                        <div className="space-y-2">
                                            <Label>Posición</Label>
                                            <Select
                                                value={options.position}
                                                onValueChange={(value) => setOptions({ ...options, position: value as any })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="top-left">Superior Izquierda</SelectItem>
                                                    <SelectItem value="top-center">Superior Centro</SelectItem>
                                                    <SelectItem value="top-right">Superior Derecha</SelectItem>
                                                    <SelectItem value="bottom-left">Inferior Izquierda</SelectItem>
                                                    <SelectItem value="bottom-center">Inferior Centro</SelectItem>
                                                    <SelectItem value="bottom-right">Inferior Derecha</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Format */}
                                        <div className="space-y-2">
                                            <Label>Formato</Label>
                                            <Select
                                                value={options.format}
                                                onValueChange={(value) => setOptions({ ...options, format: value as any })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="number">Solo Número (1, 2, 3...)</SelectItem>
                                                    <SelectItem value="page-of-total">Página de Total (1 de 10)</SelectItem>
                                                    <SelectItem value="roman">Números Romanos (i, ii, iii...)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Font Size */}
                                        <div className="space-y-2">
                                            <Label>Tamaño de Fuente</Label>
                                            <Select
                                                value={options.fontSize.toString()}
                                                onValueChange={(value) => setOptions({ ...options, fontSize: parseInt(value) })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="10">10pt</SelectItem>
                                                    <SelectItem value="12">12pt</SelectItem>
                                                    <SelectItem value="14">14pt</SelectItem>
                                                    <SelectItem value="16">16pt</SelectItem>
                                                    <SelectItem value="18">18pt</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Start Number */}
                                        <div className="space-y-2">
                                            <Label>Número de Inicio</Label>
                                            <Select
                                                value={options.startNumber.toString()}
                                                onValueChange={(value) => setOptions({ ...options, startNumber: parseInt(value) })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="1">1</SelectItem>
                                                    <SelectItem value="0">0</SelectItem>
                                                    <SelectItem value="2">2</SelectItem>
                                                    <SelectItem value="3">3</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </ToolCard>

                                {/* Action Buttons */}
                                <ToolCard title="Acciones" data-tour="actions">
                                    <div className="space-y-3">
                                        <Button
                                            onClick={addPageNumbers}
                                            disabled={isProcessing || !pdfFile}
                                            className="w-full bg-institutional hover:bg-institutional/90"
                                        >
                                            {isProcessing ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Agregando Números...
                                                </>
                                            ) : (
                                                <>
                                                    <Hash className="mr-2 h-4 w-4" />
                                                    Agregar Números de Página
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