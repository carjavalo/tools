import { useState, useRef, useCallback } from 'react';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload, Download, Trash2, Loader2, Eye, FileText, HelpCircle } from 'lucide-react';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import ToolPageHeader from '@/components/ToolPageHeader';
import ToolCard from '@/components/ToolCard';
import FileUploadZone from '@/components/FileUploadZone';
import ProgressBar from '@/components/ProgressBar';

interface ImageFile {
    id: string;
    file: File;
    url: string;
    name: string;
    extractedText?: string;
    isProcessing?: boolean;
    error?: string;
}

interface DocumentOptions {
    fontSize: number;
    fontFamily: string;
    lineSpacing: number;
    alignment: 'left' | 'center' | 'right' | 'justify';
    includeImageNames: boolean;
    addPageBreaks: boolean;
}

export default function ImagesToWord() {
    const [images, setImages] = useState<ImageFile[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });
    const [documentOptions, setDocumentOptions] = useState<DocumentOptions>({
        fontSize: 12,
        fontFamily: 'Arial',
        lineSpacing: 1.5,
        alignment: 'left',
        includeImageNames: true,
        addPageBreaks: true
    });
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
                        title: 'Paso 1: Subir Imágenes',
                        description: 'Selecciona imágenes con texto que deseas convertir a Word. Usamos OCR.space API de alta calidad para extraer el texto automáticamente.',
                        side: 'right',
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="options"]',
                    popover: {
                        title: 'Paso 2: Configurar Documento',
                        description: 'Ajusta el formato del documento Word: tamaño de fuente, tipo de letra, alineación y espaciado.',
                        side: 'left',
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="actions"]',
                    popover: {
                        title: 'Paso 3: Crear Documento Word',
                        description: 'Haz clic en "Convertir a Word" para procesar las imágenes y generar el documento editable.',
                        side: 'left',
                        align: 'start'
                    }
                }
            ]
        });
        driverObj.drive();
    };

    const handleFileSelect = useCallback(async (files: FileList) => {
        const validImageTypes = ['image/jpeg', 'image/png', 'image/bmp', 'image/tiff'];
        const validFiles = Array.from(files).filter(file => validImageTypes.includes(file.type));

        if (validFiles.length === 0) {
            alert('Por favor, selecciona solo archivos de imagen válidos (JPG, PNG, BMP, TIFF)');
            return;
        }

        const newImages: ImageFile[] = validFiles.map(file => ({
            id: Math.random().toString(36).substr(2, 9),
            file,
            url: URL.createObjectURL(file),
            name: file.name
        }));

        setImages(prev => [...prev, ...newImages]);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelect(files);
        }
    }, [handleFileSelect]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
    }, []);

    const removeImage = (id: string) => {
        setImages(prev => {
            const updated = prev.filter(img => img.id !== id);
            const removed = prev.find(img => img.id === id);
            if (removed) {
                URL.revokeObjectURL(removed.url);
            }
            return updated;
        });
    };

    const clearAll = () => {
        images.forEach(img => URL.revokeObjectURL(img.url));
        setImages([]);
    };

    const extractTextFromImage = async (imageFile: ImageFile): Promise<string> => {
        try {
            // Mark image as processing
            setImages(prev => prev.map(img => 
                img.id === imageFile.id 
                    ? { ...img, isProcessing: true }
                    : img
            ));

            // Create FormData to send file to backend
            const formData = new FormData();
            formData.append('file', imageFile.file);
            formData.append('language', 'spa+eng');
            
            // Send to OCR.space backend
            const response = await axios.post('/tools/ocr-extract/extract', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
                },
                timeout: 120000 // 2 minutes timeout
            });
            
            if (response.data.success) {
                return response.data.text.trim();
            } else {
                throw new Error(response.data.error || 'Error al extraer texto');
            }
        } catch (error: any) {
            console.error(`Error extracting text from ${imageFile.name}:`, error);
            throw new Error(error.response?.data?.error || error.message || 'Error al extraer texto');
        }
    };

    const processImagesAndCreateDocument = async () => {
        if (images.length === 0) {
            alert('Por favor, selecciona al menos una imagen para procesar');
            return;
        }

        setIsProcessing(true);
        setProgress({ current: 0, total: images.length, message: 'Iniciando procesamiento...' });

        try {
            // Extract text from all images - use a temporary array to store results
            const processedImages: ImageFile[] = [];
            
            for (let i = 0; i < images.length; i++) {
                const image = images[i];
                setProgress({ 
                    current: i, 
                    total: images.length, 
                    message: `Extrayendo texto de "${image.name}"...` 
                });

                try {
                    const extractedText = await extractTextFromImage(image);
                    const updatedImage = { ...image, extractedText, isProcessing: false };
                    processedImages.push(updatedImage);
                    
                    // Update UI state
                    setImages(prev => prev.map(img => 
                        img.id === image.id 
                            ? updatedImage
                            : img
                    ));
                } catch (error) {
                    console.error(`Error extracting text from ${image.name}:`, error);
                    const errorImage = { ...image, error: 'Error al extraer texto', isProcessing: false };
                    processedImages.push(errorImage);
                    
                    // Update UI state
                    setImages(prev => prev.map(img => 
                        img.id === image.id 
                            ? errorImage
                            : img
                    ));
                }
            }

            setProgress({ 
                current: images.length, 
                total: images.length, 
                message: 'Creando documento Word...' 
            });

            // Create Word document
            const paragraphs: Paragraph[] = [];

            // Add title
            paragraphs.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "Documento extraído de imágenes",
                            bold: true,
                            size: (documentOptions.fontSize + 4) * 2,
                        }),
                    ],
                    heading: HeadingLevel.HEADING_1,
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 400 },
                })
            );

            // Add creation date
            paragraphs.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: `Creado el: ${new Date().toLocaleDateString('es-ES')}`,
                            italics: true,
                            size: (documentOptions.fontSize - 2) * 2,
                        }),
                    ],
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 600 },
                })
            );

            // Process each image using the temporary array with extracted text
            processedImages.forEach((image, index) => {
                // Add image name if enabled
                if (documentOptions.includeImageNames) {
                    paragraphs.push(
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: `Imagen ${index + 1}: ${image.name}`,
                                    bold: true,
                                    size: (documentOptions.fontSize + 2) * 2,
                                }),
                            ],
                            heading: HeadingLevel.HEADING_2,
                            spacing: { before: 400, after: 200 },
                        })
                    );
                }

                // Add extracted text or error message
                const textContent = image.extractedText || image.error || 'No se pudo extraer texto de esta imagen.';
                
                // Split text into paragraphs
                const textParagraphs = textContent.split('\n').filter(line => line.trim().length > 0);
                
                textParagraphs.forEach(textLine => {
                    paragraphs.push(
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: textLine.trim(),
                                    size: documentOptions.fontSize * 2,
                                    font: documentOptions.fontFamily,
                                }),
                            ],
                            alignment: documentOptions.alignment === 'left' ? AlignmentType.LEFT :
                                      documentOptions.alignment === 'center' ? AlignmentType.CENTER :
                                      documentOptions.alignment === 'right' ? AlignmentType.RIGHT :
                                      AlignmentType.JUSTIFIED,
                            spacing: { 
                                line: Math.round(documentOptions.lineSpacing * 240),
                                after: 120 
                            },
                        })
                    );
                });

                // Add page break if enabled and not the last image
                if (documentOptions.addPageBreaks && index < images.length - 1) {
                    paragraphs.push(
                        new Paragraph({
                            children: [],
                            pageBreakBefore: true,
                        })
                    );
                }
            });

            const doc = new Document({
                sections: [{
                    properties: {},
                    children: paragraphs,
                }],
            });

            setProgress({ 
                current: images.length, 
                total: images.length, 
                message: 'Generando descarga...' 
            });

            // Generate and download (using toBlob for browser compatibility)
            const blob = await Packer.toBlob(doc);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `imagenes-convertidas-${Date.now()}.docx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            setProgress({ 
                current: images.length, 
                total: images.length, 
                message: '¡Documento Word generado exitosamente!' 
            });

        } catch (error: any) {
            console.error('Error creating Word document:', error);
            
            // Get detailed error message
            let errorMessage = 'Error al crear el documento Word.';
            if (error instanceof Error) {
                errorMessage += `\n\nDetalles técnicos: ${error.message}`;
                console.error('Error stack:', error.stack);
            } else if (typeof error === 'object' && error !== null) {
                errorMessage += `\n\nDetalles técnicos: ${JSON.stringify(error)}`;
            } else {
                errorMessage += `\n\nDetalles técnicos: ${String(error)}`;
            }
            
            alert(errorMessage + '\n\nPor favor, revisa la consola para más información.');
        } finally {
            setIsProcessing(false);
        }
    };

    const previewText = (imageId: string) => {
        const image = images.find(img => img.id === imageId);
        if (image?.extractedText) {
            alert(`Texto extraído:\n\n${image.extractedText}`);
        } else {
            alert('Primero debes procesar las imágenes para ver el texto extraído.');
        }
    };

    return (
        <>
            <Head title="Imágenes a Word - Evaristools">
                <meta name="description" content="Convierte imágenes con texto en documentos Word editables - Hospital Universitario del Valle" />
            </Head>

            <div className="min-h-screen bg-white dark:bg-[#1d1d1e]">
                <ToolPageHeader
                    title="Imágenes a Word"
                    description="Convierte imágenes con texto en documentos Word editables"
                    icon={FileText}
                    showPopularBadge={true}
                />

                {/* Main Content */}
                <div className="container mx-auto px-4 py-8">
                    <div className="max-w-6xl mx-auto">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                            {/* Upload Section */}
                            <div className="space-y-6">
                                <ToolCard
                                    title="Subir Imágenes"
                                    description="Selecciona imágenes con texto para convertir a Word. Soporta JPG, PNG, BMP y TIFF."
                                    icon={Upload}
                                    data-tour="upload"
                                >
                                    <FileUploadZone
                                        onFileSelect={handleFileSelect}
                                        acceptedTypes="image/jpeg,image/png,image/bmp,image/tiff"
                                        multiple={true}
                                        dragOver={dragOver}
                                        onDragOver={handleDragOver}
                                        onDragEnter={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                        title="Arrastra imágenes aquí o haz clic para seleccionar"
                                        subtitle="Solo imágenes con texto legible. JPG, PNG, BMP, TIFF"
                                        buttonText="Seleccionar Imágenes"
                                    />
                                </ToolCard>

                                {/* Document Options */}
                                <ToolCard
                                    title="Opciones del Documento"
                                    description="Configura el formato del documento Word resultante"
                                    data-tour="options"
                                >
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="fontSize">Tamaño de fuente</Label>
                                                    <select
                                                        id="fontSize"
                                                        value={documentOptions.fontSize}
                                                        onChange={(e) => setDocumentOptions(prev => ({ ...prev, fontSize: parseInt(e.target.value) }))}
                                                        className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-[#222322] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-institutional focus:border-institutional"
                                                    >
                                                        <option value="10">10pt</option>
                                                        <option value="11">11pt</option>
                                                        <option value="12">12pt</option>
                                                        <option value="14">14pt</option>
                                                        <option value="16">16pt</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="fontFamily">Tipo de fuente</Label>
                                                    <select
                                                        id="fontFamily"
                                                        value={documentOptions.fontFamily}
                                                        onChange={(e) => setDocumentOptions(prev => ({ ...prev, fontFamily: e.target.value }))}
                                                        className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-[#222322] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-institutional focus:border-institutional"
                                                    >
                                                        <option value="Arial">Arial</option>
                                                        <option value="Times New Roman">Times New Roman</option>
                                                        <option value="Calibri">Calibri</option>
                                                        <option value="Helvetica">Helvetica</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="lineSpacing">Espaciado de línea</Label>
                                                    <select
                                                        id="lineSpacing"
                                                        value={documentOptions.lineSpacing}
                                                        onChange={(e) => setDocumentOptions(prev => ({ ...prev, lineSpacing: parseFloat(e.target.value) }))}
                                                        className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-institutional focus:border-institutional"
                                                    >
                                                        <option value="1">Simple</option>
                                                        <option value="1.5">1.5</option>
                                                        <option value="2">Doble</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="alignment">Alineación</Label>
                                                    <select
                                                        id="alignment"
                                                        value={documentOptions.alignment}
                                                        onChange={(e) => setDocumentOptions(prev => ({ ...prev, alignment: e.target.value as any }))}
                                                        className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-institutional focus:border-institutional"
                                                    >
                                                        <option value="left">Izquierda</option>
                                                        <option value="center">Centro</option>
                                                        <option value="right">Derecha</option>
                                                        <option value="justify">Justificado</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-4">
                                                <label className="flex items-center space-x-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={documentOptions.includeImageNames}
                                                        onChange={(e) => setDocumentOptions(prev => ({ ...prev, includeImageNames: e.target.checked }))}
                                                        className="rounded border-slate-300 text-institutional focus:ring-institutional"
                                                    />
                                                    <span className="text-sm text-slate-700 dark:text-slate-300">Incluir nombres de imágenes</span>
                                                </label>
                                                <label className="flex items-center space-x-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={documentOptions.addPageBreaks}
                                                        onChange={(e) => setDocumentOptions(prev => ({ ...prev, addPageBreaks: e.target.checked }))}
                                                        className="rounded border-slate-300 text-institutional focus:ring-institutional"
                                                    />
                                                    <span className="text-sm text-slate-700 dark:text-slate-300">Salto de página entre imágenes</span>
                                                </label>
                                            </div>
                                </ToolCard>
                            </div>

                            {/* Images List & Actions */}
                            <div className="space-y-6">
                                {images.length > 0 && (
                                    <ToolCard
                                        title={`Imágenes seleccionadas (${images.length})`}
                                        description="Las imágenes se procesarán en el orden mostrado"
                                    >
                                        <div className="flex justify-end mb-4">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={clearAll}
                                                className="text-red-600 hover:text-red-700"
                                            >
                                                <Trash2 className="h-4 w-4 mr-1" />
                                                Limpiar todo
                                            </Button>
                                        </div>
                                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                                {images.map((image, index) => (
                                                    <div key={image.id} className="flex items-center space-x-4 p-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800">
                                                        <img
                                                            src={image.url}
                                                            alt={`Imagen ${index + 1}`}
                                                            className="w-16 h-16 object-cover rounded-lg border border-slate-300 dark:border-slate-600"
                                                        />
                                                        <div className="flex-1">
                                                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{image.name}</p>
                                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                                {image.isProcessing && 'Procesando...'}
                                                                {image.extractedText && `${image.extractedText.length} caracteres extraídos`}
                                                                {image.error && <span className="text-red-600">{image.error}</span>}
                                                                {!image.isProcessing && !image.extractedText && !image.error && 'Pendiente de procesar'}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center space-x-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => previewText(image.id)}
                                                                disabled={!image.extractedText}
                                                            >
                                                                <Eye className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => removeImage(image.id)}
                                                                className="text-red-600 hover:text-red-700"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                </ToolCard>
                                )}

                                {/* Progress */}
                                {(progress.total > 0 || isProcessing) && (
                                    <ToolCard title="Progreso">
                                        <ProgressBar
                                            progress={progress.total > 0 ? (progress.current / progress.total) * 100 : 0}
                                            message={progress.message}
                                            showPercentage={progress.total > 0}
                                        />
                                        {progress.total > 0 && (
                                            <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
                                                {progress.current}/{progress.total}
                                            </p>
                                        )}
                                    </ToolCard>
                                )}

                                {/* Actions */}
                                <ToolCard title="Generar Documento" data-tour="actions">
                                    <div className="space-y-3">
                                        <div className="flex flex-col sm:flex-row gap-4">
                                            <Button
                                                onClick={processImagesAndCreateDocument}
                                                disabled={images.length === 0 || isProcessing}
                                                className="flex-1 bg-institutional hover:bg-institutional/90"
                                            >
                                                {isProcessing ? (
                                                    <>
                                                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                                        Procesando...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Download className="h-5 w-5 mr-2" />
                                                        Convertir a Word
                                                    </>
                                                )}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={isProcessing}
                                            >
                                                <Upload className="h-5 w-5 mr-2" />
                                                Agregar más imágenes
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