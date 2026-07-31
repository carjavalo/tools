import { useState, useRef } from 'react';
import { Head, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Loader2, FileDown } from 'lucide-react';
import ToolPageHeader from '@/components/ToolPageHeader';
import ToolCard from '@/components/ToolCard';
import FileUploadZone from '@/components/FileUploadZone';
import ProgressBar from '@/components/ProgressBar';

interface Progress {
    current: number;
    total: number;
    message: string;
}

export default function WordToPDF() {
    const [wordFile, setWordFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState<Progress>({ current: 0, total: 0, message: '' });
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (files: FileList) => {
        const file = files[0];
        if (!file) return;

        // Validate file type
        const validTypes = [
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
            'application/msword' // .doc
        ];
        
        if (!validTypes.includes(file.type)) {
            alert('Por favor selecciona un archivo Word válido (.docx o .doc).');
            return;
        }

        setWordFile(file);
    };

    const extractContent = async (file: File) => {
        setIsProcessing(true);
        setProgress({ current: 0, total: 2, message: 'Extrayendo contenido del documento Word...' });
        
        try {
            // Read the Word file
            const arrayBuffer = await file.arrayBuffer();
            setProgress({ current: 1, total: 2, message: 'Convirtiendo a HTML...' });
            
            // Convert Word to HTML using mammoth
            const result = await mammoth.convertToHtml({ arrayBuffer });
            const html = result.value;
            
            // Clean and enhance HTML for better PDF rendering
            // Use only RGB/hex colors for html2pdf.js compatibility
            const enhancedHtml = `
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>${file.name}</title>
                    <style>
                        * {
                            box-sizing: border-box;
                        }
                        body {
                            font-family: 'Times New Roman', serif;
                            line-height: 1.6;
                            color: #333333;
                            background-color: #ffffff;
                            max-width: 100%;
                            margin: 0;
                            padding: 20px;
                        }
                        p {
                            margin-bottom: 12px;
                            color: #333333;
                        }
                        h1, h2, h3, h4, h5, h6 {
                            color: #2c3e50;
                            margin-top: 20px;
                            margin-bottom: 10px;
                        }
                        h1 { font-size: 24px; }
                        h2 { font-size: 20px; }
                        h3 { font-size: 18px; }
                        h4 { font-size: 16px; }
                        h5 { font-size: 14px; }
                        h6 { font-size: 12px; }
                        table {
                            border-collapse: collapse;
                            width: 100%;
                            margin: 15px 0;
                            background-color: #ffffff;
                        }
                        table, th, td {
                            border: 1px solid #dddddd;
                        }
                        th, td {
                            padding: 8px;
                            text-align: left;
                            color: #333333;
                        }
                        th {
                            background-color: #f2f2f2;
                            font-weight: bold;
                        }
                        ul, ol {
                            margin-left: 20px;
                            color: #333333;
                        }
                        li {
                            margin-bottom: 6px;
                        }
                        img {
                            max-width: 100%;
                            height: auto;
                        }
                        a {
                            color: #0066cc;
                            text-decoration: underline;
                        }
                        strong, b {
                            font-weight: bold;
                            color: #333333;
                        }
                        em, i {
                            font-style: italic;
                        }
                    </style>
                </head>
                <body>
                    ${html}
                </body>
                </html>
            `;
            
            setHtmlContent(enhancedHtml);
            setProgress({ current: 2, total: 2, message: '¡Documento procesado correctamente!' });
            
            // Show warnings if any
            if (result.messages && result.messages.length > 0) {
                console.warn('Conversion warnings:', result.messages);
            }
            
        } catch (error) {
            console.error('Error extracting content:', error);
            alert('Error al procesar el documento Word. Por favor intenta con otro archivo.');
        } finally {
            setIsProcessing(false);
        }
    };

    const convertToPDF = async () => {
        if (!htmlContent || !wordFile) return;

        setIsProcessing(true);
        setProgress({ current: 0, total: 3, message: 'Preparando conversión a PDF...' });
        
        try {
            setProgress({ current: 1, total: 3, message: 'Configurando opciones de PDF...' });
            
            const pdfOptions = {
                margin: options.margin,
                filename: `${wordFile.name.replace(/\.(docx?|doc)$/i, '')}.pdf`,
                image: { type: 'jpeg' as const, quality: options.quality },
                html2canvas: { 
                    scale: 2,
                    useCORS: true,
                    allowTaint: true
                },
                jsPDF: { 
                    unit: 'mm', 
                    format: options.format,
                    orientation: options.orientation
                }
            };

            setProgress({ current: 2, total: 3, message: 'Generando PDF...' });
            
            // Create an isolated iframe to prevent Tailwind CSS conflicts
            const iframe = document.createElement('iframe');
            iframe.style.position = 'absolute';
            iframe.style.left = '-9999px';
            iframe.style.top = '0';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = 'none';
            document.body.appendChild(iframe);

            // Write HTML content to iframe (isolated from global styles)
            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
            if (!iframeDoc) {
                throw new Error('No se pudo crear el documento aislado para la conversión');
            }
            
            iframeDoc.open();
            iframeDoc.write(htmlContent);
            iframeDoc.close();

            // Wait for iframe to load
            await new Promise(resolve => {
                if (iframe.contentWindow) {
                    iframe.contentWindow.addEventListener('load', resolve);
                } else {
                    setTimeout(resolve, 100);
                }
            });

            // Convert to PDF from iframe body
            const iframeBody = iframeDoc.body;
            if (!iframeBody) {
                throw new Error('No se pudo acceder al contenido del documento');
            }

            await html2pdf()
                .set(pdfOptions)
                .from(iframeBody)
                .save();

            // Clean up
            document.body.removeChild(iframe);
            
            setProgress({ current: 3, total: 3, message: '¡PDF generado y descargado exitosamente!' });
            setIsConverted(true);
            
        } catch (error) {
            console.error('Error converting to PDF:', error);
            console.error('Error details:', {
                message: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
                errorType: typeof error,
                fullError: JSON.stringify(error, null, 2)
            });
            
            const errorMessage = error instanceof Error 
                ? `Error al generar el PDF: ${error.message}`
                : 'Error desconocido al generar el PDF. Revisa la consola para más detalles.';
            
            alert(errorMessage);
            setProgress({ current: 0, total: 0, message: 'Error en la conversión' });
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
        setHtmlContent('');
        setIsConverted(false);
        setShowPreview(false);
        setProgress({ current: 0, total: 0, message: '' });
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <>
            <Head title="Word a PDF - Evaristools">
                <meta name="description" content="Convierte documentos Word a PDF manteniendo el formato - Hospital Universitario del Valle" />
            </Head>

            <div className="min-h-screen bg-white dark:bg-slate-900">
                <ToolPageHeader
                    title="Word a PDF"
                    description="Convierte documentos Word a formato PDF manteniendo el formato original"
                    icon={FileDown}
                />

                {/* Main Content */}
                <div className="container mx-auto px-4 py-8">
                    <div className="max-w-6xl mx-auto">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                            {/* Upload Section */}
                            <div className="space-y-6">
                                <ToolCard
                                    title="Subir Documento Word"
                                    description="Selecciona un archivo Word (.docx o .doc) para convertir a PDF."
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
                                        subtitle="Archivos soportados: .docx, .doc"
                                        buttonText="Seleccionar Documento"
                                    />
                                </ToolCard>

                                {/* Conversion Options */}
                                {wordFile && htmlContent && (
                                    <ToolCard
                                        title="Opciones de Conversión"
                                        description="Configura el formato del PDF resultante"
                                    >
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="format">Formato de página</Label>
                                                <Select
                                                    value={options.format}
                                                    onValueChange={(value) => 
                                                        setOptions({ ...options, format: value })
                                                    }
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="a4">A4</SelectItem>
                                                        <SelectItem value="letter">Carta</SelectItem>
                                                        <SelectItem value="legal">Legal</SelectItem>
                                                        <SelectItem value="a3">A3</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="orientation">Orientación</Label>
                                                <Select
                                                    value={options.orientation}
                                                    onValueChange={(value: 'portrait' | 'landscape') => 
                                                        setOptions({ ...options, orientation: value })
                                                    }
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="portrait">Vertical</SelectItem>
                                                        <SelectItem value="landscape">Horizontal</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="margin">Márgenes (mm)</Label>
                                                <Select
                                                    value={options.margin.toString()}
                                                    onValueChange={(value) => 
                                                        setOptions({ ...options, margin: parseInt(value) })
                                                    }
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="5">5mm (Mínimo)</SelectItem>
                                                        <SelectItem value="10">10mm (Pequeño)</SelectItem>
                                                        <SelectItem value="15">15mm (Normal)</SelectItem>
                                                        <SelectItem value="20">20mm (Grande)</SelectItem>
                                                        <SelectItem value="25">25mm (Máximo)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="quality">Calidad</Label>
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
                                                        <SelectItem value="1">Básica</SelectItem>
                                                        <SelectItem value="1.5">Buena</SelectItem>
                                                        <SelectItem value="2">Alta</SelectItem>
                                                        <SelectItem value="3">Máxima</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </ToolCard>
                                )}
                            </div>

                            {/* Results Section */}
                            <div className="space-y-6">
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

                                {/* File Info */}
                                {wordFile && (
                                    <ToolCard
                                        title="Documento Seleccionado"
                                        description="Información del archivo Word"
                                    >
                                        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
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

                                        {/* Preview Toggle */}
                                        {htmlContent && (
                                            <div className="mt-4">
                                                <Button
                                                    onClick={() => setShowPreview(!showPreview)}
                                                    variant="outline"
                                                    size="sm"
                                                    className="w-full"
                                                >
                                                    <Eye className="mr-2 h-4 w-4" />
                                                    {showPreview ? 'Ocultar Vista Previa' : 'Mostrar Vista Previa'}
                                                </Button>
                                            </div>
                                        )}
                                    </ToolCard>
                                )}

                                {/* Preview */}
                                {showPreview && htmlContent && (
                                    <ToolCard
                                        title="Vista Previa"
                                        description="Contenido del documento que será convertido"
                                    >
                                        <div className="max-h-96 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-white dark:bg-slate-800">
                                            <div 
                                                dangerouslySetInnerHTML={{ __html: htmlContent }}
                                                className="prose prose-sm max-w-none dark:prose-invert"
                                            />
                                        </div>
                                    </ToolCard>
                                )}

                                {/* Actions */}
                                {wordFile && htmlContent && (
                                    <ToolCard title="Generar PDF">
                                        <div className="flex flex-col sm:flex-row gap-4">
                                            <Button
                                                onClick={convertToPDF}
                                                disabled={isProcessing}
                                                className="flex-1 bg-institutional hover:bg-institutional/90"
                                            >
                                                {isProcessing ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        Convirtiendo...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Download className="mr-2 h-4 w-4" />
                                                        Convertir a PDF
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

                                        {isConverted && (
                                            <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                                <p className="text-sm text-green-800 dark:text-green-200 text-center">
                                                    ✅ ¡PDF generado y descargado exitosamente!
                                                </p>
                                            </div>
                                        )}
                                    </ToolCard>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
