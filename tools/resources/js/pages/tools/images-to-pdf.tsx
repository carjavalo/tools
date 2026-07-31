import { useState, useRef, useCallback } from 'react';
import { Head } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { FileImage, Upload, Download, Trash2, ArrowUp, ArrowDown, Loader2, HelpCircle } from 'lucide-react';
import { PDFDocument, PageSizes } from 'pdf-lib';
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
    width: number;
    height: number;
}

interface PageOptions {
    size: keyof typeof PageSizes;
    orientation: 'portrait' | 'landscape';
    margin: number;
    quality: number;
}

export default function ImagesToPDF() {
    const [images, setImages] = useState<ImageFile[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });
    const [pageOptions, setPageOptions] = useState<PageOptions>({
        size: 'A4',
        orientation: 'portrait',
        margin: 50,
        quality: 85
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
                        description: 'Selecciona múltiples imágenes (JPG, PNG, etc.) que deseas convertir en un solo PDF. Puedes arrastrarlas o hacer clic para seleccionar.',
                        side: 'right',
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="options"]',
                    popover: {
                        title: 'Paso 2: Configurar PDF',
                        description: 'Ajusta el tamaño de página, orientación y márgenes. Puedes reordenar las imágenes arrastrándolas en la lista.',
                        side: 'left',
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="actions"]',
                    popover: {
                        title: 'Paso 3: Crear PDF',
                        description: 'Haz clic en "Crear PDF" para generar el documento. El PDF se descargará automáticamente con todas tus imágenes.',
                        side: 'left',
                        align: 'start'
                    }
                }
            ]
        });
        driverObj.drive();
    };

    const loadImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
        return new Promise((resolve) => {
            const img = document.createElement('img');
            img.onload = () => {
                resolve({ width: img.width, height: img.height });
            };
            img.src = URL.createObjectURL(file);
        });
    };

    const handleFileSelect = useCallback(async (files: FileList) => {
        const validImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/tiff'];
        const validFiles = Array.from(files).filter(file => validImageTypes.includes(file.type));

        if (validFiles.length === 0) {
            alert('Por favor, selecciona solo archivos de imagen válidos (JPG, PNG, WEBP, BMP, TIFF)');
            return;
        }

        setProgress({ current: 0, total: validFiles.length, message: 'Cargando imágenes...' });

        const newImages: ImageFile[] = [];
        for (let i = 0; i < validFiles.length; i++) {
            const file = validFiles[i];
            const dimensions = await loadImageDimensions(file);
            const imageFile: ImageFile = {
                id: Math.random().toString(36).substr(2, 9),
                file,
                url: URL.createObjectURL(file),
                width: dimensions.width,
                height: dimensions.height
            };
            newImages.push(imageFile);
            setProgress({ current: i + 1, total: validFiles.length, message: `Cargando imagen ${i + 1} de ${validFiles.length}` });
        }

        setImages(prev => [...prev, ...newImages]);
        setProgress({ current: 0, total: 0, message: '' });
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

    const moveImage = (id: string, direction: 'up' | 'down') => {
        setImages(prev => {
            const index = prev.findIndex(img => img.id === id);
            if (index === -1) return prev;
            
            const newIndex = direction === 'up' ? index - 1 : index + 1;
            if (newIndex < 0 || newIndex >= prev.length) return prev;
            
            const newImages = [...prev];
            [newImages[index], newImages[newIndex]] = [newImages[newIndex], newImages[index]];
            return newImages;
        });
    };

    const clearAll = () => {
        images.forEach(img => URL.revokeObjectURL(img.url));
        setImages([]);
    };

    const convertToPDF = async () => {
        if (images.length === 0) {
            alert('Por favor, selecciona al menos una imagen para convertir a PDF');
            return;
        }

        setIsProcessing(true);
        setProgress({ current: 0, total: images.length, message: 'Creando documento PDF...' });

        try {
            const pdfDoc = await PDFDocument.create();
            const pageSize = PageSizes[pageOptions.size];
            
            for (let i = 0; i < images.length; i++) {
                const imageFile = images[i];
                setProgress({ 
                    current: i + 1, 
                    total: images.length, 
                    message: `Procesando imagen ${i + 1} de ${images.length}...` 
                });

                const page = pdfDoc.addPage(
                    pageOptions.orientation === 'landscape' 
                        ? [pageSize[1], pageSize[0]] 
                        : pageSize
                );

                const { width: pageWidth, height: pageHeight } = page.getSize();
                const availableWidth = pageWidth - (pageOptions.margin * 2);
                const availableHeight = pageHeight - (pageOptions.margin * 2);

                const imageBytes = await imageFile.file.arrayBuffer();
                let image;
                
                if (imageFile.file.type === 'image/png') {
                    image = await pdfDoc.embedPng(imageBytes);
                } else {
                    image = await pdfDoc.embedJpg(imageBytes);
                }

                const imageAspectRatio = imageFile.width / imageFile.height;
                const availableAspectRatio = availableWidth / availableHeight;

                let drawWidth, drawHeight;
                if (imageAspectRatio > availableAspectRatio) {
                    drawWidth = availableWidth;
                    drawHeight = availableWidth / imageAspectRatio;
                } else {
                    drawHeight = availableHeight;
                    drawWidth = availableHeight * imageAspectRatio;
                }

                const x = (pageWidth - drawWidth) / 2;
                const y = (pageHeight - drawHeight) / 2;

                page.drawImage(image, {
                    x,
                    y,
                    width: drawWidth,
                    height: drawHeight,
                });
            }

            setProgress({ current: images.length, total: images.length, message: 'Generando PDF final...' });

            const pdfBytes = await pdfDoc.save();
            
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `imagenes-convertidas-${Date.now()}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            setProgress({ current: 0, total: 0, message: '¡PDF generado exitosamente!' });
            
        } catch (error) {
            console.error('Error al convertir imágenes a PDF:', error);
            alert('Error al convertir las imágenes a PDF. Por favor, inténtalo de nuevo.');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <>
            <Head title="Imágenes a PDF - Evaristools">
                <meta name="description" content="Convierte múltiples imágenes en un documento PDF - Hospital Universitario del Valle" />
            </Head>

            <div className="min-h-screen bg-white dark:bg-[#1d1d1e]">
                <ToolPageHeader
                    title="Imágenes a PDF"
                    description="Convierte múltiples imágenes en un documento PDF"
                    icon={FileImage}
                />

                {/* Main Content */}
                <div className="container mx-auto px-4 py-8">
                    <div className="max-w-6xl mx-auto">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                            {/* Left Column: Upload & Image List */}
                            <div className="space-y-6">
                                <ToolCard title="Seleccionar Imágenes" data-tour="upload">
                                    <FileUploadZone
                                        onFileSelect={handleFileSelect}
                                        acceptedTypes="image/*"
                                        multiple={true}
                                        dragOver={dragOver}
                                        onDragOver={handleDragOver}
                                        onDragEnter={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                        title="Arrastra imágenes aquí o haz clic para seleccionar"
                                        subtitle="Formatos soportados: JPG, PNG, WEBP, BMP, TIFF"
                                        buttonText="Seleccionar Imágenes"
                                    />
                                </ToolCard>

                                {/* Page Options */}
                                <ToolCard title="Opciones de PDF" data-tour="options">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="pageSize">Tamaño de página</Label>
                                                <select
                                                    id="pageSize"
                                                    value={pageOptions.size}
                                                    onChange={(e) => setPageOptions(prev => ({ ...prev, size: e.target.value as 'A4' | 'Letter' | 'Legal' }))}
                                                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-[#222322] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-institutional focus:border-institutional"
                                                >
                                                    <option value="A4">A4</option>
                                                    <option value="Letter">Letter</option>
                                                    <option value="A5">A5</option>
                                                    <option value="Letter">Letter</option>
                                                    <option value="Legal">Legal</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="orientation">Orientación</Label>
                                                <select
                                                    id="orientation"
                                                    value={pageOptions.orientation}
                                                    onChange={(e) => setPageOptions(prev => ({ ...prev, orientation: e.target.value as 'portrait' | 'landscape' }))}
                                                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-[#222322] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-institutional focus:border-institutional"
                                                >
                                                    <option value="portrait">Vertical</option>
                                                    <option value="landscape">Horizontal</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="margin">Margen (px)</Label>
                                                <input
                                                    id="margin"
                                                    type="number"
                                                    min="0"
                                                    max="200"
                                                    value={pageOptions.margin}
                                                    onChange={(e) => setPageOptions(prev => ({ ...prev, margin: parseInt(e.target.value) || 50 }))}
                                                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-[#222322] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-institutional focus:border-institutional"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="quality">Calidad (%)</Label>
                                                <input
                                                    id="quality"
                                                    type="number"
                                                    min="50"
                                                    max="100"
                                                    value={pageOptions.quality}
                                                    onChange={(e) => setPageOptions(prev => ({ ...prev, quality: parseInt(e.target.value) || 85 }))}
                                                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-[#222322] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-institutional focus:border-institutional"
                                                />
                                            </div>
                                        </div>
                                </ToolCard>
                            </div>

                            {/* Right Column: Always visible */}
                            <div className="space-y-6">
                                {images.length > 0 && (
                                    <ToolCard title={`Imágenes seleccionadas (${images.length})`}>
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
                                                <div key={image.id} className="flex items-center space-x-4 p-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-[#222322]">
                                                    <img
                                                        src={image.url}
                                                        alt={`Imagen ${index + 1}`}
                                                        className="w-16 h-16 object-cover rounded-lg border border-slate-300 dark:border-slate-600"
                                                    />
                                                    <div className="flex-1">
                                                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{image.file.name}</p>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                                            {image.width} × {image.height} px • {(image.file.size / 1024 / 1024).toFixed(2)} MB
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center space-x-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => moveImage(image.id, 'up')}
                                                            disabled={index === 0}
                                                        >
                                                            <ArrowUp className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => moveImage(image.id, 'down')}
                                                            disabled={index === images.length - 1}
                                                        >
                                                            <ArrowDown className="h-4 w-4" />
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
                                <ToolCard title="Generar PDF" data-tour="actions">
                                    <div className="space-y-3">
                                        <div className="flex flex-col sm:flex-row gap-4">
                                        <Button
                                            onClick={convertToPDF}
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
                                                    Convertir a PDF
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