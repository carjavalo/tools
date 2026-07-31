import { useState, useRef } from 'react';
import { Head } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Download, FileImage, Loader2, FileDown, Archive, HelpCircle } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import ToolPageHeader from '@/components/ToolPageHeader';
import ToolCard from '@/components/ToolCard';
import FileUploadZone from '@/components/FileUploadZone';
import ProgressBar from '@/components/ProgressBar';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

// Configure PDF.js worker using unpkg CDN (compatible with Vite)
// Using the same version as the installed pdfjs-dist package
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface ImageData {
    id: string;
    pageNumber: number;
    canvas: HTMLCanvasElement;
    dataUrl: string;
    filename: string;
}

interface ConversionOptions {
    format: 'png' | 'jpeg';
    quality: number;
    dpi: number;
}

interface Progress {
    current: number;
    total: number;
    message: string;
}

export default function PDFToImages() {
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [images, setImages] = useState<ImageData[]>([]);
    const [options, setOptions] = useState<ConversionOptions>({
        format: 'png',
        quality: 0.9,
        dpi: 150
    });
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState<Progress>({ current: 0, total: 0, message: '' });
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const startTour = () => {
        const driverObj = driver({
            showProgress: true,
            steps: [
                {
                    element: '[data-tour="upload-zone"]',
                    popover: {
                        title: 'Paso 1: Subir PDF',
                        description: 'Arrastra tu archivo PDF aquí o haz clic para seleccionarlo. El archivo se convertirá página por página.',
                        side: 'right',
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="options"]',
                    popover: {
                        title: 'Paso 2: Configurar Opciones',
                        description: 'Selecciona el formato (PNG o JPEG), la resolución DPI y la calidad de compresión para las imágenes resultantes.',
                        side: 'left',
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="actions"]',
                    popover: {
                        title: 'Paso 3: Convertir',
                        description: 'Haz clic en "Convertir a Imágenes" para iniciar el proceso. Verás una vista previa de cada página convertida que podrás descargar.',
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
        if (!file || file.type !== 'application/pdf') {
            alert('Por favor selecciona un archivo PDF válido.');
            return;
        }

        setPdfFile(file);
        setImages([]);
        await convertPDFToImages(file);
    };

    const convertPDFToImages = async (file: File) => {
        setIsProcessing(true);
        setProgress({ current: 0, total: 0, message: 'Cargando PDF...' });
        
        try {
            // Read PDF file
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const numPages = pdf.numPages;
            
            setProgress({ current: 0, total: numPages, message: 'Convirtiendo páginas...' });
            
            const newImages: ImageData[] = [];
            const scale = options.dpi / 72; // Convert DPI to scale factor

            for (let pageNum = 1; pageNum <= numPages; pageNum++) {
                setProgress({ current: pageNum - 1, total: numPages, message: `Convirtiendo página ${pageNum} de ${numPages}...` });
                
                const page = await pdf.getPage(pageNum);
                const viewport = page.getViewport({ scale });
                
                // Create canvas
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d')!;
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                
                // Render page
                await page.render({ canvasContext: context, viewport, canvas }).promise;
                
                // Convert to desired format
                const quality = options.format === 'jpeg' ? options.quality : undefined;
                const dataUrl = canvas.toDataURL(`image/${options.format}`, quality);
                
                const imageData: ImageData = {
                    id: `page-${pageNum}`,
                    pageNumber: pageNum,
                    canvas,
                    dataUrl,
                    filename: `${file.name.replace('.pdf', '')}_page_${pageNum.toString().padStart(3, '0')}.${options.format}`
                };
                
                newImages.push(imageData);
            }
            
            setImages(newImages);
            setProgress({ current: numPages, total: numPages, message: `¡Conversión completada! ${numPages} imágenes generadas.` });
            
        } catch (error) {
            console.error('Error converting PDF:', error);
            alert('Error al convertir el PDF. Por favor intenta con otro archivo.');
        } finally {
            setIsProcessing(false);
        }
    };

    const downloadSingleImage = (image: ImageData) => {
        const link = document.createElement('a');
        link.href = image.dataUrl;
        link.download = image.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const downloadAllImages = async () => {
        if (images.length === 0) return;

        setIsProcessing(true);
        setProgress({ current: 0, total: images.length, message: 'Preparando descarga...' });

        try {
            // For multiple images, we'll trigger individual downloads
            // In a real implementation, you might want to use JSZip to create a ZIP file
            for (let i = 0; i < images.length; i++) {
                setProgress({ current: i, total: images.length, message: `Descargando imagen ${i + 1} de ${images.length}...` });
                downloadSingleImage(images[i]);
                // Small delay to prevent browser blocking multiple downloads
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            setProgress({ current: images.length, total: images.length, message: '¡Descarga completada!' });
        } catch (error) {
            console.error('Error downloading images:', error);
            alert('Error al descargar las imágenes.');
        } finally {
            setIsProcessing(false);
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
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileSelect(e.dataTransfer.files);
        }
    };

    const resetTool = () => {
        setPdfFile(null);
        setImages([]);
        setProgress({ current: 0, total: 0, message: '' });
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <>
            <Head title="PDF a Imágenes - Evaristools">
                <meta name="description" content="Convierte páginas de PDF a imágenes JPG o PNG - Hospital Universitario del Valle" />
            </Head>

            <div className="min-h-screen bg-white dark:bg-[#1d1d1e]">
                <ToolPageHeader
                    title="PDF a Imágenes"
                    description="Convierte cada página de tu PDF en imágenes individuales"
                    icon={FileImage}
                />

                {/* Main Content */}
                <div className="container mx-auto px-4 py-8">
                    <div className="max-w-6xl mx-auto">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                            {/* Left Column: Upload, Progress & Results */}
                            <div className="space-y-6">
                                {/* Upload Section */}
                                <ToolCard
                                    title="Subir PDF"
                                    description="Selecciona un archivo PDF para convertir sus páginas a imágenes."
                                    icon={Upload}
                                    data-tour="upload-zone"
                                >
                                    <FileUploadZone
                                        onFileSelect={handleFileSelect}
                                        acceptedTypes="application/pdf"
                                        multiple={false}
                                        dragOver={dragOver}
                                        onDragOver={handleDragOver}
                                        onDragEnter={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                        title="Arrastra un archivo PDF aquí o haz clic para seleccionar"
                                        subtitle="Solo archivos PDF"
                                        buttonText="Seleccionar PDF"
                                    />
                                </ToolCard>

                                {/* Progress */}
                                {isProcessing && (
                                    <ToolCard title="Progreso de Conversión">
                                        <ProgressBar
                                            progress={progress.total > 0 ? (progress.current / progress.total) * 100 : 0}
                                            message={progress.message}
                                            showPercentage={progress.total > 0}
                                        />
                                        {progress.total > 0 && (
                                            <p className="text-sm text-slate-500 dark:text-slate-400 text-center mt-2">
                                                {progress.current}/{progress.total} páginas
                                            </p>
                                        )}
                                    </ToolCard>
                                )}

                                {/* Images Preview */}
                                {images.length > 0 && (
                                    <ToolCard
                                        title={`Imágenes Generadas (${images.length})`}
                                        description="Vista previa de las páginas convertidas"
                                    >
                                        <div className="space-y-4">
                                            {/* Download All Button */}
                                            <div className="flex justify-between items-center">
                                                <p className="text-sm text-slate-600 dark:text-slate-300">
                                                    {images.length} imagen{images.length !== 1 ? 'es' : ''} lista{images.length !== 1 ? 's' : ''} para descargar
                                                </p>
                                                <Button
                                                    onClick={downloadAllImages}
                                                    disabled={isProcessing}
                                                    className="bg-institutional hover:bg-institutional/90"
                                                    size="sm"
                                                >
                                                    {isProcessing ? (
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Archive className="mr-2 h-4 w-4" />
                                                    )}
                                                    Descargar Todas
                                                </Button>
                                            </div>

                                            {/* Images Grid */}
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                                                {images.map((image) => (
                                                    <div
                                                        key={image.id}
                                                        className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-800"
                                                    >
                                                        <div className="aspect-[3/4] relative">
                                                            <img
                                                                src={image.dataUrl}
                                                                alt={`Página ${image.pageNumber}`}
                                                                className="w-full h-full object-contain"
                                                            />
                                                        </div>
                                                        <div className="p-2">
                                                            <p className="text-xs text-slate-600 dark:text-slate-300 mb-2 truncate">
                                                                Página {image.pageNumber}
                                                            </p>
                                                            <Button
                                                                onClick={() => downloadSingleImage(image)}
                                                                size="sm"
                                                                className="w-full bg-institutional hover:bg-institutional/90"
                                                            >
                                                                <Download className="h-3 w-3 mr-1" />
                                                                Descargar
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </ToolCard>
                                )}
                            </div>

                            {/* Right Column: Always visible Options, Actions & Instructions */}
                            <div className="space-y-6">
                                {/* Conversion Options */}
                                <ToolCard
                                    title="Opciones de Conversión"
                                    description="Configura el formato y calidad de las imágenes"
                                    data-tour="options"
                                >
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="format">Formato</Label>
                                                <Select
                                                    value={options.format}
                                                    onValueChange={(value: 'png' | 'jpeg') => 
                                                        setOptions({ ...options, format: value })
                                                    }
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="png">PNG (sin pérdida)</SelectItem>
                                                        <SelectItem value="jpeg">JPEG (comprimido)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="dpi">Resolución (DPI)</Label>
                                                <Select
                                                    value={options.dpi.toString()}
                                                    onValueChange={(value) => 
                                                        setOptions({ ...options, dpi: parseInt(value) })
                                                    }
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="72">72 DPI (Web)</SelectItem>
                                                        <SelectItem value="150">150 DPI (Normal)</SelectItem>
                                                        <SelectItem value="300">300 DPI (Alta)</SelectItem>
                                                        <SelectItem value="600">600 DPI (Máxima)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {options.format === 'jpeg' && (
                                                <div className="space-y-2">
                                                    <Label htmlFor="quality">Calidad JPEG</Label>
                                                    <Select
                                                        value={options.quality.toString()}
                                                        onValueChange={(value) => 
                                                            setOptions({ ...options, quality: parseFloat(value) })
                                                        }
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="0.6">60% (Básica)</SelectItem>
                                                            <SelectItem value="0.8">80% (Buena)</SelectItem>
                                                            <SelectItem value="0.9">90% (Alta)</SelectItem>
                                                            <SelectItem value="1.0">100% (Máxima)</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )}
                                        </div>
                                </ToolCard>

                                {/* Actions */}
                                <ToolCard title="Acciones" data-tour="actions">
                                    <div className="space-y-3">
                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <Button
                                                onClick={() => pdfFile && convertPDFToImages(pdfFile)}
                                                disabled={isProcessing || !pdfFile}
                                                className="flex-1 bg-institutional hover:bg-institutional/90"
                                             >
                                                {isProcessing ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        Convirtiendo...
                                                    </>
                                                ) : (
                                                    <>
                                                        <FileImage className="mr-2 h-4 w-4" />
                                                        Convertir a Imágenes
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
