import { useState, useRef } from 'react';
import { Head } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Upload, Loader2, Zap, HelpCircle, Info, ShieldCheck } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import ToolPageHeader from '@/components/ToolPageHeader';
import ToolCard from '@/components/ToolCard';
import FileUploadZone from '@/components/FileUploadZone';
import { recompressImages, removeMetadata, type ImageCompressionLevel, type ImageCompressionResult } from '@/lib/pdf-compression';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

interface CompressionOptions {
    quality: 'low' | 'medium' | 'high';
    removeMetadata: boolean;
    optimizeImages: boolean;
}

// Cuánto se reducen las fotos y escaneos en cada nivel.
const COMPRESSION_LEVELS: Record<CompressionOptions['quality'], ImageCompressionLevel & { hint: string }> = {
    low: { maxDimension: 1200, quality: 0.5, hint: 'Ideal para enviar por correo o WhatsApp. Las fotos se ven algo menos nítidas.' },
    medium: { maxDimension: 1600, quality: 0.65, hint: 'Buen equilibrio entre tamaño y calidad para la mayoría de documentos.' },
    high: { maxDimension: 2200, quality: 0.8, hint: 'Las imágenes quedan casi intactas; el tamaño se reduce menos.' },
};

export default function PDFCompress() {
    const [file, setFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progressMessage, setProgressMessage] = useState<string>('');
    const [compressedPdf, setCompressedPdf] = useState<Uint8Array | null>(null);
    const [originalSize, setOriginalSize] = useState<number>(0);
    const [compressedSize, setCompressedSize] = useState<number>(0);
    const [compressionRatio, setCompressionRatio] = useState<number>(0);
    const [imageStats, setImageStats] = useState<ImageCompressionResult | null>(null);
    const [notice, setNotice] = useState<string>('');
    const [options, setOptions] = useState<CompressionOptions>({
        quality: 'medium',
        removeMetadata: true,
        optimizeImages: true
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
                        description: 'Arrastra tu archivo PDF aquí o haz clic para seleccionarlo. El sistema analizará el tamaño original para mostrar la reducción.',
                        side: 'right',
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="options"]',
                    popover: {
                        title: 'Paso 2: Configurar Compresión',
                        description: 'Elige el nivel de compresión: define cuánto se reducen las fotos y escaneos del PDF. El texto no se toca y sigue siendo seleccionable.',
                        side: 'left',
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="actions"]',
                    popover: {
                        title: 'Paso 3: Comprimir y Descargar',
                        description: 'Haz clic en "Comprimir PDF" para procesar. Verás el porcentaje de reducción y podrás descargar el archivo comprimido.',
                        side: 'left',
                        align: 'start'
                    }
                }
            ]
        });
        driverObj.drive();
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const handleFileSelect = (selectedFile: File) => {
        // En Windows el tipo MIME a veces llega vacío: también vale la extensión.
        if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
            alert('Por favor selecciona un archivo PDF válido.');
            return;
        }

        setFile(selectedFile);
        setOriginalSize(selectedFile.size);
        setCompressedPdf(null);
        setCompressedSize(0);
        setCompressionRatio(0);
        setImageStats(null);
        setNotice('');
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

    const compressPDF = async () => {
        if (!file) return;

        setIsProcessing(true);
        setCompressedPdf(null);
        setCompressedSize(0);
        setCompressionRatio(0);
        setImageStats(null);
        setNotice('');

        try {
            setProgressMessage('Leyendo el PDF...');
            const pdfDoc = await PDFDocument.load(await file.arrayBuffer());

            if (options.removeMetadata) {
                removeMetadata(pdfDoc);
            }

            // Lo que más pesa en un PDF son las fotos y los escaneos.
            let images: ImageCompressionResult = { total: 0, optimized: 0 };
            if (options.optimizeImages) {
                images = await recompressImages(pdfDoc, COMPRESSION_LEVELS[options.quality], (done, total) => {
                    setProgressMessage(`Optimizando imágenes ${done}/${total}...`);
                });
            }
            setImageStats(images);

            setProgressMessage('Guardando el PDF...');
            const pdfBytes = await pdfDoc.save({
                useObjectStreams: true,
                addDefaultPage: false,
                updateFieldAppearances: false
            });

            if (pdfBytes.length >= originalSize) {
                setNotice(images.total === 0
                    ? 'Este PDF no tiene fotos ni escaneos que se puedan recomprimir y ya está optimizado: no se pudo reducir su tamaño.'
                    : 'Este PDF ya está optimizado: no se pudo reducir su tamaño con este nivel. Prueba con un nivel de mayor compresión.');
                return;
            }

            setCompressedPdf(pdfBytes);
            setCompressedSize(pdfBytes.length);
            setCompressionRatio(((originalSize - pdfBytes.length) / originalSize) * 100);

        } catch (error) {
            console.error('Error comprimiendo PDF:', error);
            const encrypted = error instanceof Error && error.message.toLowerCase().includes('encrypted');
            alert(encrypted
                ? 'El PDF está protegido con contraseña. Quítale la protección e inténtalo de nuevo.'
                : 'Error al comprimir el PDF. Por favor intenta con otro archivo.');
        } finally {
            setIsProcessing(false);
            setProgressMessage('');
        }
    };

    const downloadCompressed = () => {
        if (!compressedPdf || !file) return;

        const blob = new Blob([compressedPdf], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.name.replace(/\.pdf$/i, '') + '_comprimido.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const reset = () => {
        setFile(null);
        setCompressedPdf(null);
        setOriginalSize(0);
        setCompressedSize(0);
        setCompressionRatio(0);
        setImageStats(null);
        setNotice('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <>
            <Head title="Compresor de PDF - Evaristools">
                <meta name="description" content="Comprime archivos PDF reduciendo su tamaño sin perder calidad - Hospital Universitario del Valle" />
            </Head>

            <div className="min-h-screen bg-white dark:bg-[#1d1d1e]">
                <ToolPageHeader
                    title="Compresor de PDF"
                    description="Reduce el tamaño de tus archivos PDF sin perder calidad"
                    icon={Zap}
                />

                {/* Main Content */}
                <div className="container mx-auto px-4 py-8">
                    <div className="max-w-6xl mx-auto">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                            {/* Left Column: File Upload & Messages */}
                            <div className="space-y-6" data-tour="upload">
                                <ToolCard
                                    title="Subir PDF"
                                    description="Selecciona o arrastra tu archivo PDF para comprimir"
                                    icon={Upload}
                                >
                                    <FileUploadZone
                                        onFileSelect={(files) => handleFileSelect(files[0])}
                                        acceptedTypes=".pdf"
                                    />

                                    {file && (
                                        <div className="mt-4 space-y-2">
                                            <p className="text-sm text-slate-600 dark:text-slate-300">
                                                <span className="font-medium">Archivo:</span> {file.name}
                                            </p>
                                            <p className="text-sm text-slate-600 dark:text-slate-300">
                                                <span className="font-medium">Tamaño original:</span> {formatFileSize(originalSize)}
                                            </p>
                                            <Button
                                                onClick={reset}
                                                variant="outline"
                                                className="w-full"
                                            >
                                                Cambiar Archivo
                                            </Button>
                                        </div>
                                    )}
                                </ToolCard>
                            </div>

                            {/* Right Column: Options & Actions */}
                            <div className="space-y-6">
                                <ToolCard title="Opciones de Compresión" data-tour="options">
                                    <div className="space-y-4">
                                        <div>
                                            <Label htmlFor="quality">Nivel de Compresión</Label>
                                            <Select
                                                value={options.quality}
                                                onValueChange={(value: 'low' | 'medium' | 'high') =>
                                                    setOptions({ ...options, quality: value })
                                                }
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="low">Baja (Mayor compresión)</SelectItem>
                                                    <SelectItem value="medium">Media (Balanceada)</SelectItem>
                                                    <SelectItem value="high">Alta (Mejor calidad)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                                                {COMPRESSION_LEVELS[options.quality].hint}
                                            </p>
                                        </div>

                                        <div className="flex items-center space-x-2">
                                            <input
                                                type="checkbox"
                                                id="removeMetadata"
                                                checked={options.removeMetadata}
                                                onChange={(e) =>
                                                    setOptions({ ...options, removeMetadata: e.target.checked })
                                                }
                                                className="rounded"
                                            />
                                            <Label htmlFor="removeMetadata">Remover metadatos</Label>
                                        </div>

                                        <div className="flex items-center space-x-2">
                                            <input
                                                type="checkbox"
                                                id="optimizeImages"
                                                checked={options.optimizeImages}
                                                onChange={(e) =>
                                                    setOptions({ ...options, optimizeImages: e.target.checked })
                                                }
                                                className="rounded"
                                            />
                                            <Label htmlFor="optimizeImages">Recomprimir fotos y escaneos</Label>
                                        </div>

                                        <p className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                                            <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600 dark:text-green-400" />
                                            Todo se procesa en tu navegador: el PDF no se sube a ningún servidor.
                                        </p>
                                    </div>
                                </ToolCard>

                                <ToolCard title="Acciones">

                                    <div className="space-y-3" data-tour="actions">
                                        <Button
                                            onClick={compressPDF}
                                            disabled={!file || isProcessing}
                                            className="w-full bg-institutional hover:bg-institutional/90"
                                        >
                                            {isProcessing ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                    {progressMessage || 'Comprimiendo...'}
                                                </>
                                            ) : (
                                                <>
                                                    <Zap className="h-4 w-4 mr-2" />
                                                    Comprimir PDF
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

                                    {notice && (
                                        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-100">
                                            <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
                                            <p>{notice}</p>
                                        </div>
                                    )}

                                    {/* Results */}
                                    {compressedPdf && (
                                        <div className="space-y-4 pt-4 border-t">
                                            <h3 className="font-semibold text-slate-900 dark:text-white">
                                                Resultado de la Compresión
                                            </h3>
                                            
                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                <div>
                                                    <p className="text-slate-600 dark:text-slate-300">Tamaño Original</p>
                                                    <p className="font-medium">{formatFileSize(originalSize)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-600 dark:text-slate-300">Tamaño Comprimido</p>
                                                    <p className="font-medium">{formatFileSize(compressedSize)}</p>
                                                </div>
                                            </div>

                                            <div className="bg-institutional/10 p-3 rounded-lg">
                                                <p className="text-sm text-slate-600 dark:text-slate-300">Reducción de tamaño</p>
                                                <p className="text-lg font-bold text-institutional dark:text-[#8b9bd6]">
                                                    {compressionRatio.toFixed(1)}%
                                                </p>
                                            </div>

                                            {imageStats && imageStats.total > 0 && (
                                                <p className="text-sm text-slate-600 dark:text-slate-300">
                                                    Imágenes optimizadas: {imageStats.optimized} de {imageStats.total}
                                                </p>
                                            )}

                                            <Button
                                                onClick={downloadCompressed}
                                                className="w-full bg-institutional hover:bg-institutional/90 text-white"
                                            >
                                                <Download className="h-4 w-4 mr-2" />
                                                Descargar PDF Comprimido
                                            </Button>
                                        </div>
                                    )}
                                </ToolCard>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}