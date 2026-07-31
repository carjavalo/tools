import { useState, useRef } from 'react';
import { Head } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Loader2, Download, FileDown, CheckCircle, AlertCircle, HelpCircle } from 'lucide-react';
import ToolPageHeader from '@/components/ToolPageHeader';
import ToolCard from '@/components/ToolCard';
import FileUploadZone from '@/components/FileUploadZone';
import ProgressBar from '@/components/ProgressBar';
import axios from 'axios';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

interface Progress {
    current: number;
    total: number;
    message: string;
}

export default function WordToPDF() {
    const [wordFile, setWordFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isConverted, setIsConverted] = useState(false);
    const [progress, setProgress] = useState<Progress>({ current: 0, total: 0, message: '' });
    const [dragOver, setDragOver] = useState(false);
    const [error, setError] = useState<string>('');
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
                    element: '[data-tour="left-column"]',
                    popover: {
                        title: 'Paso 1: Seleccionar Word',
                        description: 'Arrastra tu documento Word (.doc o .docx) aquí o haz clic para seleccionarlo. Tamaño máximo: 25MB.',
                        side: 'right',
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="actions"]',
                    popover: {
                        title: 'Paso 2: Convertir a PDF',
                        description: 'Una vez cargado tu documento, haz clic en "Convertir a PDF" para procesarlo. El archivo PDF se descargará automáticamente.',
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

        // Validate file type
        const validTypes = [
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
            'application/msword' // .doc
        ];
        
        if (!validTypes.includes(file.type)) {
            setError('Por favor selecciona un archivo Word válido (.docx o .doc).');
            return;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            setError('El archivo es demasiado grande. Máximo 10MB permitido.');
            return;
        }

        setWordFile(file);
        setError('');
        setIsConverted(false);
    };

    const convertToPDF = async () => {
        if (!wordFile) return;

        setIsProcessing(true);
        setError('');
        setProgress({ current: 1, total: 3, message: 'Subiendo archivo Word...' });

        try {
            // Create FormData to send the file
            const formData = new FormData();
            formData.append('file', wordFile);

            setProgress({ current: 2, total: 3, message: 'Convirtiendo Word a PDF...' });

            // Send to Laravel backend
            const response = await axios.post('/tools/word-to-pdf/convert', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
                },
                responseType: 'blob', // Important for file download
                onUploadProgress: (progressEvent) => {
                    if (progressEvent.total) {
                        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        setProgress({ 
                            current: 2, 
                            total: 3, 
                            message: `Subiendo archivo... ${percentCompleted}%` 
                        });
                    }
                }
            });

            setProgress({ current: 3, total: 3, message: 'Descargando PDF...' });

            // Create blob URL and trigger download
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${wordFile.name.replace(/\.(docx?|doc)$/i, '')}_converted.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            setProgress({ current: 3, total: 3, message: '¡PDF descargado exitosamente!' });
            setIsConverted(true);

        } catch (err: any) {
            console.error('Error converting to PDF:', err);
            
            let errorMessage = 'Error al convertir el documento.';
            
            if (err.response) {
                // Server responded with error
                if (err.response.data instanceof Blob) {
                    // Try to read error from blob
                    const text = await err.response.data.text();
                    try {
                        const json = JSON.parse(text);
                        errorMessage = json.error || json.message || errorMessage;
                    } catch {
                        errorMessage = text || errorMessage;
                    }
                } else {
                    errorMessage = err.response.data?.error || err.response.data?.message || errorMessage;
                }
            } else if (err.request) {
                errorMessage = 'No se pudo conectar con el servidor. Verifica tu conexión.';
            }
            
            setError(errorMessage);
            setProgress({ current: 0, total: 0, message: '' });
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
        setWordFile(null);
        setIsConverted(false);
        setError('');
        setProgress({ current: 0, total: 0, message: '' });
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <>
            <Head title="Word a PDF - Evaristools">
                <meta name="description" content="Convierte documentos Word a PDF manteniendo el formato - Hospital Universitario del Valle" />
                <meta name="csrf-token" content={document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''} />
            </Head>

            <div className="min-h-screen bg-white dark:bg-[#1d1d1e]">
                <ToolPageHeader
                    title="Word a PDF"
                    description="Convierte documentos Word a PDF manteniendo todos los estilos, imágenes y formato original"
                    icon={FileDown}
                />

                {/* Main Content */}
                <div className="container mx-auto px-4 py-8">
                    <div className="max-w-6xl mx-auto">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                            {/* Left Column: File Upload & Messages */}
                            <div className="space-y-6" data-tour="left-column">
                                <ToolCard
                                    title="Subir Documento Word"
                                    description="Selecciona un archivo Word (.docx o .doc) para convertir a PDF. Máximo 10MB."
                                    icon={Upload}
                                >
                                    <FileUploadZone
                                        onFileSelect={handleFileSelect}
                                        acceptedTypes=".docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
                                        multiple={false}
                                        dragOver={dragOver}
                                        onDragOver={handleDragOver}
                                        onDragEnter={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                        title="Arrastra un documento Word aquí o haz clic para seleccionar"
                                        subtitle="Archivos soportados: .docx, .doc (Máx. 10MB)"
                                        buttonText="Seleccionar Documento"
                                    />
                                    
                                    {error && (
                                        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                            <p className="text-sm text-red-800 dark:text-red-200">
                                                ⚠️ {error}
                                            </p>
                                        </div>
                                    )}
                                </ToolCard>

                                {/* File Info */}
                                {wordFile && (
                                    <ToolCard
                                        title="Documento Seleccionado"
                                        description="Información del archivo Word"
                                    >
                                        <div className="bg-slate-50 dark:bg-[#222322] rounded-lg p-4">
                                            <div className="flex items-center space-x-3">
                                                <FileText className="h-8 w-8 text-blue-600" />
                                                <div className="flex-1">
                                                    <p className="font-medium text-slate-900 dark:text-white">
                                                        {wordFile.name}
                                                    </p>
                                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                                        {(wordFile.size / 1024 / 1024).toFixed(2)} MB
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                            <p className="text-sm text-blue-800 dark:text-blue-200">
                                                ℹ️ La conversión preservará todos los estilos, imágenes, tablas y formato del documento original.
                                            </p>
                                        </div>
                                    </ToolCard>
                                )}

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
                                                Paso {progress.current}/{progress.total}
                                            </p>
                                        )}
                                    </ToolCard>
                                )}

                                {/* Success Message */}
                                {isConverted && !isProcessing && (
                                    <ToolCard title="¡Conversión Exitosa!">
                                        <div className="flex items-center justify-center space-x-3 p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                            <CheckCircle className="h-8 w-8 text-green-600" />
                                            <div>
                                                <p className="font-medium text-green-800 dark:text-green-200">
                                                    ¡PDF generado y descargado exitosamente!
                                                </p>
                                                <p className="text-sm text-green-600 dark:text-green-300">
                                                    El archivo se ha guardado en tu carpeta de descargas.
                                                </p>
                                            </div>
                                        </div>
                                    </ToolCard>
                                )}
                            </div>

                            {/* Right Column: Actions and Instructions */}
                            <div className="space-y-6">
                                <ToolCard title="Acciones" data-tour="actions">
                                        <div className="space-y-3">
                                                <Button
                                                    onClick={convertToPDF}
                                                    disabled={isProcessing || !wordFile}
                                                    className="w-full bg-institutional hover:bg-institutional/90"
                                                >
                                                    {isProcessing ? (
                                                        <>
                                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                            Convirtiendo...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <FileDown className="mr-2 h-4 w-4" />
                                                            Convertir a PDF
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
