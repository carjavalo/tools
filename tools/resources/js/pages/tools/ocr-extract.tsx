import { useState, useRef } from 'react';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { FileText, Upload, Download, Copy, Loader2, Eye, HelpCircle, ScanText, StickyNote, Check } from 'lucide-react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import ToolPageHeader from '@/components/ToolPageHeader';
import ToolCard from '@/components/ToolCard';
import FileUploadZone from '@/components/FileUploadZone';
import ProgressBar from '@/components/ProgressBar';

interface OCROptions {
    language: 'spa' | 'eng' | 'spa+eng';
    outputFormat: 'text' | 'json';
}

export default function OCRExtract() {
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState<number>(0);
    const [extractedText, setExtractedText] = useState<string>('');
    const [confidence, setConfidence] = useState<number>(0);
    const [processingStep, setProcessingStep] = useState<string>('');
    const [isCopied, setIsCopied] = useState(false);
    const [options, setOptions] = useState<OCROptions>({
        language: 'spa+eng',
        outputFormat: 'text'
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
                        title: 'Paso 1: Subir Imagen',
                        description: 'Selecciona una imagen (JPG, PNG, etc.) que contenga texto. El sistema usará OCR para extraer el texto automáticamente.',
                        side: 'right',
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="options"]',
                    popover: {
                        title: 'Paso 2: Configurar OCR',
                        description: 'Selecciona el idioma del texto en la imagen. El OCR funciona mejor con imágenes de alta calidad y texto claro.',
                        side: 'left',
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="options"]',
                    popover: {
                        title: 'Paso 3: Extraer y Ver Resultados',
                        description: 'Haz clic en "Extraer Texto" para procesar la imagen. El texto extraído aparecerá debajo y podrás copiarlo o descargarlo.',
                        side: 'left',
                        align: 'start'
                    }
                }
            ]
        });
        driverObj.drive();
    };
    const dropZoneRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const supportedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/bmp', 'image/tiff'];
    const imageFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/bmp', 'image/tiff'];

    const handleFileSelect = (selectedFile: File) => {
        // Check if it's a PDF
        if (selectedFile.type === 'application/pdf') {
            alert('⚠️ Los archivos PDF no son soportados directamente por el OCR.\n\n💡 Sugerencias:\n• Convierte las páginas del PDF a imágenes (JPG/PNG)\n• Usa herramientas como "PDF a Imágenes"\n• Toma capturas de pantalla de las páginas\n\nFormatos soportados: JPG, PNG, BMP, TIFF');
            return;
        }
        
        if (!imageFormats.includes(selectedFile.type)) {
            alert('Por favor selecciona un archivo de imagen válido.\n\nFormatos soportados: JPG, PNG, BMP, TIFF');
            return;
        }
        
        setFile(selectedFile);
        setExtractedText('');
        setConfidence(0);
        setProgress(0);
        
        // Create preview URL
        const url = URL.createObjectURL(selectedFile);
        setPreviewUrl(url);
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

    const extractText = async () => {
        if (!file) return;

        setIsProcessing(true);
        setProgress(0);
        setExtractedText('');
        setConfidence(0);
        
        let progressInterval: NodeJS.Timeout | null = null;

        try {
            setProcessingStep('Preparando archivo...');
            setProgress(10);
            
            // Create FormData to send file to backend
            const formData = new FormData();
            formData.append('file', file);
            formData.append('language', options.language);
            
            setProcessingStep('Extrayendo texto de la imagen... (esto puede tomar hasta 2 minutos)');
            setProgress(30);
            
            // Simulate progress to show activity during long processing
            progressInterval = setInterval(() => {
                setProgress(prev => {
                    if (prev < 85) {
                        return prev + 1;
                    }
                    return prev;
                });
            }, 1000);
            
            // Send to backend
            const response = await axios.post('/tools/ocr-extract/extract', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
                },
                timeout: 120000, // 120 seconds timeout (2 minutes) - OCR processing can take time for large images
                onUploadProgress: (progressEvent) => {
                    if (progressEvent.total) {
                        const uploadProgress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        if (uploadProgress < 100) {
                            setProgress(10 + (uploadProgress * 0.2)); // Upload takes 10-30%
                        }
                    }
                }
            });
            
            if (progressInterval) {
                clearInterval(progressInterval);
            }
            setProgress(90);
            
            if (response.data.success) {
                setExtractedText(response.data.text);
                setConfidence(response.data.confidence);
                setProcessingStep('¡Texto extraído exitosamente!');
                setProgress(100);
            } else {
                throw new Error(response.data.error || 'Error al procesar');
            }

        } catch (error: any) {
            // Clear progress interval if it exists
            if (progressInterval) {
                clearInterval(progressInterval);
            }
            console.error('Error extrayendo texto:', error);
            
            let errorMessage = 'Error al extraer texto de la imagen. Por favor intenta con otra imagen.';
            
            if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
                errorMessage = '⏱️ El procesamiento está tomando más tiempo del esperado.\n\n💡 Sugerencias:\n• Intenta con una imagen más pequeña\n• Asegúrate de que la imagen sea clara y de buena calidad\n• Verifica tu conexión a internet\n• Si el problema persiste, intenta de nuevo en unos momentos';
            } else if (error.response?.data?.error) {
                errorMessage = error.response.data.error;
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            alert(errorMessage);
            setProcessingStep('Error en el procesamiento');
        } finally {
            setIsProcessing(false);
            if (progress !== 100) {
                setProgress(0);
            }
        }
    };

    const downloadText = () => {
        if (!extractedText || !file) return;

        const blob = new Blob([extractedText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const fileName = file.name.replace(/\.[^/.]+$/, '') + '_texto_extraido.txt';
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const copyToClipboard = async () => {
        if (!extractedText) return;

        try {
            await navigator.clipboard.writeText(extractedText);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch (error) {
            console.error('Error copiando al portapapeles:', error);
            // Fallback for older browsers
            if (textareaRef.current) {
                textareaRef.current.select();
                document.execCommand('copy');
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 2000);
            }
        }
    };

    const reset = () => {
        setFile(null);
        setPreviewUrl('');
        setExtractedText('');
        setConfidence(0);
        setProgress(0);
        setProcessingStep('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }
    };

    const getLanguageLabel = (lang: string) => {
        switch (lang) {
            case 'spa': return 'Español';
            case 'eng': return 'Inglés';
            case 'spa+eng': return 'Español + Inglés';
            default: return lang;
        }
    };

    return (
        <>
            <Head title="OCR y Extracción de Texto - Evaristools">
                <meta name="description" content="Extrae texto de imágenes y documentos PDF escaneados - Hospital Universitario del Valle" />
            </Head>

            <div className="min-h-screen bg-white dark:bg-[#1d1d1e]">
                <ToolPageHeader
                    title="OCR y Extracción de Texto"
                    description="Convierte imágenes en texto editable mediante OCR"
                    icon={ScanText}
                    showPopularBadge={true}
                />

                {/* Main Content */}
                <div className="container mx-auto px-4 py-8">
                    <div className="max-w-6xl mx-auto">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                            {/* Upload and Preview Section */}
                            <div className="space-y-6">
                                <ToolCard
                                    title="Subir Imagen"
                                    data-tour="upload"
                                    description="Selecciona una imagen para extraer el texto mediante OCR"
                                    icon={Upload}
                                >
                                    <FileUploadZone
                                        onFileSelect={(files) => handleFileSelect(files[0])}
                                        acceptedTypes=".jpg,.jpeg,.png,.bmp,.tiff"
                                        multiple={false}
                                        hasFiles={!!file}
                                        title="Arrastra tu archivo aquí"
                                        subtitle="Soporta JPG, PNG, BMP, TIFF"
                                        buttonText="Seleccionar Archivo"
                                        fileInfo={file ? (
                                            <div className="space-y-2">
                                                <ScanText className="h-12 w-12 mx-auto text-institutional" />
                                                <p className="font-medium text-slate-900 dark:text-white">
                                                    {file.name}
                                                </p>
                                                <p className="text-sm text-slate-600 dark:text-slate-300">
                                                    Listo para procesar
                                                </p>
                                            </div>
                                        ) : undefined}
                                    />
                                </ToolCard>

                                {/* Preview Section */}
                                {previewUrl && (
                                    <ToolCard
                                        title="Vista Previa"
                                        icon={Eye}
                                    >
                                            <div className="border rounded-lg overflow-hidden">
                                                {file?.type === 'application/pdf' ? (
                                                    <div className="p-8 text-center bg-slate-50 dark:bg-[#222322]">
                                                        <StickyNote className="h-16 w-16 mx-auto text-slate-400 mb-4" />
                                                        <p className="text-slate-600 dark:text-slate-300">
                                                            Archivo PDF listo para procesar
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <img
                                                        src={previewUrl}
                                                        alt="Vista previa"
                                                        className="w-full h-auto max-h-96 object-contain"
                                                    />
                                                )}
                                            </div>
                                    </ToolCard>
                                )}
                            </div>

                            {/* Options and Results Section */}
                            <div className="space-y-6">
                                {/* Results Section */}
                                {extractedText && (
                                    <ToolCard
                                        title="Texto Extraído"
                                        description={`Idioma: ${getLanguageLabel(options.language)} - Confianza: ${confidence}%`}
                                        icon={ScanText}
                                    >
                                            <textarea
                                                ref={textareaRef}
                                                value={extractedText}
                                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setExtractedText(e.target.value)}
                                                placeholder="El texto extraído aparecerá aquí..."
                                                className="min-h-48 resize-vertical w-full p-3 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-institutional focus:border-transparent"
                                                rows={12}
                                            />

                                            <div className="flex gap-2">
                                                <Button
                                                    onClick={copyToClipboard}
                                                    variant="outline"
                                                    className="flex-1"
                                                    disabled={isCopied}
                                                >
                                                    {isCopied ? (
                                                        <>
                                                            <Check className="h-4 w-4 mr-2" />
                                                            Copiado
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Copy className="h-4 w-4 mr-2" />
                                                            Copiar
                                                        </>
                                                    )}
                                                </Button>
                                                <Button
                                                    onClick={downloadText}
                                                    className="flex-1 bg-institutional hover:bg-institutional/90 text-white"
                                                >
                                                    <Download className="h-4 w-4 mr-2" />
                                                    Descargar
                                                </Button>
                                            </div>
                                        </ToolCard>
                                )}
                                <ToolCard
                                    title="Opciones de OCR"
                                    data-tour="options"
                                    description="Configura el reconocimiento óptico de caracteres"
                                    icon={ScanText}
                                >
                                        <div>
                                            <Label htmlFor="language">Idioma de Reconocimiento</Label>
                                            <Select
                                                value={options.language}
                                                onValueChange={(value: 'spa' | 'eng' | 'spa+eng') =>
                                                    setOptions({ ...options, language: value })
                                                }
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="spa+eng">Español + Inglés</SelectItem>
                                                    <SelectItem value="spa">Solo Español</SelectItem>
                                                    <SelectItem value="eng">Solo Inglés</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                    <Button
                                        onClick={extractText}
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
                                                <ScanText className="h-4 w-4 mr-2" />
                                                Extraer Texto
                                            </>
                                        )}
                                    </Button>

                                    {/* Progress Bar */}
                                    {isProcessing && (
                                        <ProgressBar
                                            progress={progress}
                                            message="Progreso"
                                            showPercentage={true}
                                        />
                                    )}
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