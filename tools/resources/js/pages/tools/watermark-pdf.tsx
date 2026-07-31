import { useState, useRef } from 'react';
import { Head } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Droplet, Upload, Download, Loader2, FileText, Type, Image as ImageIcon, HelpCircle, CheckCircle } from 'lucide-react';
import ToolPageHeader from '@/components/ToolPageHeader';
import ToolCard from '@/components/ToolCard';
import FileUploadZone from '@/components/FileUploadZone';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

interface WatermarkOptions {
    text: string;
    position: 'center' | 'diagonal' | 'top' | 'bottom';
    opacity: number;
    fontSize: number;
    color: string;
}

export default function WatermarkPDF() {
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isWatermarked, setIsWatermarked] = useState(false);
    const [watermarkedPdfUrl, setWatermarkedPdfUrl] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [dragOver, setDragOver] = useState(false);
    const [options, setOptions] = useState<WatermarkOptions>({
        text: 'CONFIDENCIAL',
        position: 'diagonal',
        opacity: 0.3,
        fontSize: 48,
        color: '#808080'
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
                        description: 'Selecciona el archivo PDF al que deseas agregar una marca de agua.',
                        side: 'right',
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="options"]',
                    popover: {
                        title: 'Paso 2: Configurar Marca de Agua',
                        description: 'Escribe el texto de la marca de agua, ajusta su posición, tamaño, opacidad y rotación.',
                        side: 'left',
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="actions"]',
                    popover: {
                        title: 'Paso 3: Aplicar Marca de Agua',
                        description: 'Haz clic en "Aplicar Marca de Agua" para procesar. La marca se aplicará a todas las páginas del PDF.',
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
        setIsWatermarked(false);
        setWatermarkedPdfUrl('');
    };

    const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16) / 255,
            g: parseInt(result[2], 16) / 255,
            b: parseInt(result[3], 16) / 255
        } : { r: 0.5, g: 0.5, b: 0.5 };
    };

    const addWatermark = async () => {
        if (!pdfFile || !options.text.trim()) {
            setError('Por favor ingresa el texto de la marca de agua.');
            return;
        }

        setIsProcessing(true);
        setError('');

        try {
            const arrayBuffer = await pdfFile.arrayBuffer();
            const pdfDoc = await PDFDocument.load(arrayBuffer);
            const pages = pdfDoc.getPages();
            const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            const color = hexToRgb(options.color);

            pages.forEach((page) => {
                const { width, height } = page.getSize();
                const textWidth = font.widthOfTextAtSize(options.text, options.fontSize);
                const textHeight = options.fontSize;

                let x: number, y: number, rotation: number;

                switch (options.position) {
                    case 'center':
                        x = (width - textWidth) / 2;
                        y = (height - textHeight) / 2;
                        rotation = 0;
                        break;
                    case 'diagonal':
                        x = width / 2 - textWidth / 2;
                        y = height / 2;
                        rotation = 45;
                        break;
                    case 'top':
                        x = (width - textWidth) / 2;
                        y = height - textHeight - 50;
                        rotation = 0;
                        break;
                    case 'bottom':
                        x = (width - textWidth) / 2;
                        y = 50;
                        rotation = 0;
                        break;
                    default:
                        x = (width - textWidth) / 2;
                        y = height / 2;
                        rotation = 45;
                }

                page.drawText(options.text, {
                    x,
                    y,
                    size: options.fontSize,
                    font,
                    color: rgb(color.r, color.g, color.b),
                    opacity: options.opacity,
                    rotate: degrees(rotation),
                });
            });

            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);

            setWatermarkedPdfUrl(url);
            setIsWatermarked(true);

        } catch (err) {
            console.error('Error adding watermark:', err);
            setError('Error al agregar la marca de agua. Por favor intenta de nuevo.');
        } finally {
            setIsProcessing(false);
        }
    };

    const downloadWatermarkedPDF = () => {
        if (!watermarkedPdfUrl || !pdfFile) return;

        const link = document.createElement('a');
        link.href = watermarkedPdfUrl;
        link.download = `${pdfFile.name.replace('.pdf', '')}_marcado.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const resetTool = () => {
        setPdfFile(null);
        setIsWatermarked(false);
        setWatermarkedPdfUrl('');
        setError('');
        if (watermarkedPdfUrl) {
            URL.revokeObjectURL(watermarkedPdfUrl);
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
            <Head title="Marca de Agua en PDF - Evaristools" />
            
            <div className="min-h-screen bg-white dark:bg-[#1d1d1e]">
                <ToolPageHeader
                    title="Marca de Agua en PDF"
                    description="Añade marcas de agua personalizadas a tus documentos PDF"
                    icon={Droplet}
                />

                <div className="container mx-auto px-4 py-8">
                    <div className="max-w-6xl mx-auto">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">

                            {/* Left Column: File Upload & Messages */}
                            <div className="space-y-6">
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
                                                        {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </ToolCard>
                                )}

                                {isWatermarked && watermarkedPdfUrl && (
                                    <ToolCard title="¡Marca de Agua Agregada!">
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-center space-x-3 p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                                <CheckCircle className="h-8 w-8 text-green-600" />
                                                <div>
                                                    <p className="font-medium text-green-800 dark:text-green-200">
                                                        ¡La marca de agua se agregó correctamente!
                                                    </p>
                                                    <p className="text-sm text-green-600 dark:text-green-300">
                                                        Descarga tu PDF marcado o procesa otro archivo.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex flex-col sm:flex-row gap-4">
                                                <Button
                                                    onClick={downloadWatermarkedPDF}
                                                    className="flex-1 bg-institutional hover:bg-institutional/90"
                                                >
                                                    <Download className="mr-2 h-4 w-4" />
                                                    Descargar PDF con Marca de Agua
                                                </Button>
                                                <Button
                                                    onClick={resetTool}
                                                    variant="outline"
                                                    className="flex-1"
                                                >
                                                    <Upload className="mr-2 h-4 w-4" />
                                                    Marcar Otro PDF
                                                </Button>
                                            </div>
                                        </div>
                                    </ToolCard>
                                )}
                            </div>

                            {/* Right Column: Always visible */}
                            <div className="space-y-6">
                                <ToolCard title="Opciones de Marca de Agua" data-tour="options">

                                        <div className="space-y-4">
                                            {/* Text */}
                                            <div className="space-y-2">
                                                <Label htmlFor="watermark-text">Texto de la Marca de Agua</Label>
                                                <Input
                                                    id="watermark-text"
                                                    type="text"
                                                    value={options.text}
                                                    onChange={(e) => setOptions({ ...options, text: e.target.value })}
                                                    placeholder="Ej: CONFIDENCIAL, BORRADOR, etc."
                                                    maxLength={50}
                                                />
                                            </div>

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
                                                        <SelectItem value="diagonal">Diagonal (Centro)</SelectItem>
                                                        <SelectItem value="center">Centro Horizontal</SelectItem>
                                                        <SelectItem value="top">Superior</SelectItem>
                                                        <SelectItem value="bottom">Inferior</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                                            <SelectItem value="24">24pt - Pequeño</SelectItem>
                                                            <SelectItem value="36">36pt - Mediano</SelectItem>
                                                            <SelectItem value="48">48pt - Grande</SelectItem>
                                                            <SelectItem value="60">60pt - Muy Grande</SelectItem>
                                                            <SelectItem value="72">72pt - Extra Grande</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                {/* Opacity */}
                                                <div className="space-y-2">
                                                    <Label htmlFor="opacity">Opacidad: {Math.round(options.opacity * 100)}%</Label>
                                                    <input
                                                        id="opacity"
                                                        type="range"
                                                        min="0.1"
                                                        max="1"
                                                        step="0.1"
                                                        value={options.opacity}
                                                        onChange={(e) => setOptions({ ...options, opacity: parseFloat(e.target.value) })}
                                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                                                    />
                                                </div>
                                            </div>

                                            {/* Color */}
                                            <div className="space-y-2">
                                                <Label htmlFor="color">Color</Label>
                                                <div className="flex gap-2">
                                                    <Input
                                                        id="color"
                                                        type="color"
                                                        value={options.color}
                                                        onChange={(e) => setOptions({ ...options, color: e.target.value })}
                                                        className="w-20 h-10"
                                                    />
                                                    <Input
                                                        type="text"
                                                        value={options.color}
                                                        onChange={(e) => setOptions({ ...options, color: e.target.value })}
                                                        placeholder="#808080"
                                                        className="flex-1"
                                                    />
                                                </div>
                                            </div>

                                            {/* Preview */}
                                            <div className="p-6 bg-slate-100 dark:bg-slate-800 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600">
                                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Vista Previa:</p>
                                                <div className="relative h-40 bg-white dark:bg-slate-700 rounded flex items-center justify-center overflow-hidden">
                                                    <p
                                                        className="font-bold"
                                                        style={{
                                                            fontSize: `${options.fontSize * 0.5}px`,
                                                            color: options.color,
                                                            opacity: options.opacity,
                                                            transform: options.position === 'diagonal' ? 'rotate(-45deg)' : 'none'
                                                        }}
                                                    >
                                                        {options.text || 'MARCA DE AGUA'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                </ToolCard>

                                <ToolCard title="Acciones" data-tour="actions">
                                        <div className="flex flex-col sm:flex-row gap-4">
                                            <Button
                                                onClick={addWatermark}
                                                disabled={isProcessing || !pdfFile || !options.text.trim()}
                                                className="flex-1 bg-institutional hover:bg-institutional/90"
                                            >
                                                {isProcessing ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        Agregando Marca de Agua...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Droplet className="mr-2 h-4 w-4" />
                                                        Agregar Marca de Agua
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
                                </ToolCard>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}