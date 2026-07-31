import { useState, useRef } from 'react';
import { Head } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PenTool, Upload, Download, Loader2, FileText, CheckCircle, HelpCircle, AlertCircle, FileSignature } from 'lucide-react';
import ToolPageHeader from '@/components/ToolPageHeader';
import ToolCard from '@/components/ToolCard';
import FileUploadZone from '@/components/FileUploadZone';
import axios from 'axios';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

export default function SignPDF() {
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [certificateFile, setCertificateFile] = useState<File | null>(null);
    const [password, setPassword] = useState<string>('');
    const [signerName, setSignerName] = useState<string>('');
    const [reason, setReason] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSigned, setIsSigned] = useState(false);
    const [error, setError] = useState<string>('');
    const pdfInputRef = useRef<HTMLInputElement>(null);
    const certInputRef = useRef<HTMLInputElement>(null);

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
                        description: 'Selecciona el archivo PDF que deseas firmar digitalmente.',
                        side: 'right',
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="certificate"]',
                    popover: {
                        title: 'Paso 2: Subir Certificado',
                        description: 'Sube tu certificado digital (.pfx, .p12 o .pem) y ingresa la contraseña.',
                        side: 'left',
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="actions"]',
                    popover: {
                        title: 'Paso 3: Firmar PDF',
                        description: 'Haz clic en "Firmar PDF" para agregar tu firma al documento. El archivo se descargará automáticamente.',
                        side: 'left',
                        align: 'start'
                    }
                }
            ]
        });
        driverObj.drive();
    };

    const handlePdfSelect = (files: FileList) => {
        const file = files[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            setError('Por favor selecciona un archivo PDF válido.');
            return;
        }

        if (file.size > 50 * 1024 * 1024) {
            setError('El archivo PDF es demasiado grande. Máximo 50MB permitido.');
            return;
        }

        setPdfFile(file);
        setError('');
        setIsSigned(false);
    };

    const handleCertificateSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const validExtensions = ['.pfx', '.p12', '.pem'];
        const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

        if (!validExtensions.includes(fileExtension)) {
            setError('Por favor selecciona un certificado válido (.pfx, .p12 o .pem).');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setError('El certificado es demasiado grande. Máximo 5MB permitido.');
            return;
        }

        setCertificateFile(file);
        setError('');
    };

    const signPDF = async () => {
        if (!pdfFile || !certificateFile || !password) {
            setError('Por favor completa todos los campos requeridos.');
            return;
        }

        setIsProcessing(true);
        setError('');

        try {
            const formData = new FormData();
            formData.append('pdf', pdfFile);
            formData.append('certificate', certificateFile);
            formData.append('password', password);
            formData.append('signer_name', signerName || 'Firmante');
            formData.append('reason', reason || 'Firma digital');

            const response = await axios.post('/tools/sign-pdf/sign', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
                },
                responseType: 'blob',
                timeout: 120000
            });

            // Create blob URL and trigger download
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${pdfFile.name.replace('.pdf', '')}_firmado.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            setIsSigned(true);

        } catch (err: any) {
            console.error('Error signing PDF:', err);
            
            let errorMessage = 'Error al firmar el documento.';
            
            if (err.response?.status === 404) {
                errorMessage = 'La función de firma de PDF requiere configuración adicional en el servidor. Contacta al administrador.';
            } else if (err.response?.status === 400) {
                errorMessage = err.response?.data?.error || 'Contraseña incorrecta o certificado inválido.';
            } else if (err.response?.status === 500) {
                errorMessage = err.response?.data?.error || 'Error en el servidor al firmar el PDF.';
            } else if (err.code === 'ECONNABORTED') {
                errorMessage = 'La firma está tardando demasiado. Intenta con un archivo más pequeño.';
            }
            
            setError(errorMessage);
        } finally {
            setIsProcessing(false);
        }
    };

    const resetTool = () => {
        setPdfFile(null);
        setCertificateFile(null);
        setPassword('');
        setSignerName('');
        setReason('');
        setIsSigned(false);
        setError('');
    };

    return (
        <>
            <Head title="Firmar PDF - Evaristools" />
            
            <div className="min-h-screen bg-white dark:bg-[#1d1d1e]">
                <ToolPageHeader
                    title="Firmar PDF"
                    description="Añade firmas digitales legalmente válidas a tus documentos PDF"
                    icon={FileText}
                />

                <div className="container mx-auto px-4 py-8">
                    <div className="max-w-6xl mx-auto">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">

                            {/* Left Column: File Upload and Info */}
                            <div className="space-y-6">
                                {!pdfFile && (
                                    <ToolCard title="Seleccionar PDF a Firmar" data-tour="upload">
                                    <FileUploadZone
                                        onFileSelect={handlePdfSelect}
                                        acceptedTypes=".pdf"
                                        title="Arrastra tu PDF aquí"
                                        subtitle="o haz clic para seleccionar (máximo 50MB)"
                                    />
                                    <input
                                        ref={pdfInputRef}
                                        type="file"
                                        accept=".pdf"
                                        onChange={(e) => e.target.files && handlePdfSelect(e.target.files)}
                                        className="hidden"
                                    />
                                </ToolCard>
                            )}

                            {/* Error Message */}
                            {error && (
                                <ToolCard title="Error">
                                    <div className="flex items-start space-x-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                        <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                                        <p className="text-red-800 dark:text-red-200">{error}</p>
                                    </div>
                                </ToolCard>
                            )}

                                {pdfFile && (
                                    <ToolCard title="Archivo PDF Seleccionado">
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
                            </div>

                            {/* Right Column: Options and Actions */}
                            <div className="space-y-6">
                                <ToolCard title="Certificado Digital" data-tour="certificate">
                                        <div className="space-y-4">
                                            <div>
                                                <Label htmlFor="certificate">Subir Certificado (.pfx, .p12, .pem) *</Label>
                                                <div className="mt-2 flex items-center gap-2">
                                                    <Input
                                                        ref={certInputRef}
                                                        id="certificate"
                                                        type="file"
                                                        accept=".pfx,.p12,.pem"
                                                        onChange={handleCertificateSelect}
                                                        className="flex-1"
                                                    />
                                                    {certificateFile && (
                                                        <CheckCircle className="h-5 w-5 text-green-600" />
                                                    )}
                                                </div>
                                                {certificateFile && (
                                                    <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                                                        ✓ {certificateFile.name}
                                                    </p>
                                                )}
                                            </div>

                                            <div>
                                                <Label htmlFor="password">Contraseña del Certificado *</Label>
                                                <Input
                                                    id="password"
                                                    type="password"
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    placeholder="Ingresa la contraseña de tu certificado"
                                                    className="mt-2"
                                                />
                                            </div>
                                        </div>
                                </ToolCard>

                                <ToolCard title="Detalles de la Firma (Opcional)">
                                        <div className="space-y-4">
                                            <div>
                                                <Label htmlFor="signer-name">Nombre del Firmante</Label>
                                                <Input
                                                    id="signer-name"
                                                    type="text"
                                                    value={signerName}
                                                    onChange={(e) => setSignerName(e.target.value)}
                                                    placeholder="Ej: Juan Pérez"
                                                    className="mt-2"
                                                />
                                            </div>

                                            <div>
                                                <Label htmlFor="reason">Motivo de la Firma</Label>
                                                <Input
                                                    id="reason"
                                                    type="text"
                                                    value={reason}
                                                    onChange={(e) => setReason(e.target.value)}
                                                    placeholder="Ej: Aprobación de documento"
                                                    className="mt-2"
                                                />
                                            </div>
                                        </div>
                                </ToolCard>

                                <ToolCard title="Acciones" data-tour="actions">
                                        <div className="flex flex-col sm:flex-row gap-4">
                                            <Button
                                                onClick={signPDF}
                                                disabled={isProcessing || !certificateFile || !password}
                                                className="flex-1 bg-institutional hover:bg-institutional/90"
                                            >
                                                {isProcessing ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        Firmando...
                                                    </>
                                                ) : (
                                                    <>
                                                        <FileSignature className="mr-2 h-4 w-4" />
                                                        Firmar PDF
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
                                        <Button
                                            onClick={startTour}
                                            variant="outline"
                                            className="w-full border-institutional text-institutional hover:bg-institutional/10"
                                        >
                                            <HelpCircle className="mr-2 h-4 w-4" />
                                            ¿Cómo funciona? - Tour Interactivo
                                        </Button>
                                </ToolCard>

                                {isSigned && (
                                    <ToolCard title="¡PDF Firmado Exitosamente!">
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-center space-x-3 p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                                <CheckCircle className="h-8 w-8 text-green-600" />
                                                <div>
                                                    <p className="font-medium text-green-800 dark:text-green-200">
                                                        ¡El PDF se firmó digitalmente y se descargó!
                                                    </p>
                                                    <p className="text-sm text-green-600 dark:text-green-300">
                                                        El archivo ahora contiene tu firma digital verificable.
                                                    </p>
                                                </div>
                                            </div>

                                            <Button
                                                onClick={resetTool}
                                                variant="outline"
                                                className="w-full"
                                            >
                                                <Upload className="mr-2 h-4 w-4" />
                                                Firmar Otro PDF
                                            </Button>
                                        </div>
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