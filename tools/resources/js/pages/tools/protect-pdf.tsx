import { useState, useRef } from 'react';
import { Head } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, FileText, Loader2, Download, Lock, CheckCircle, Eye, EyeOff, HelpCircle, AlertCircle } from 'lucide-react';
import ToolPageHeader from '@/components/ToolPageHeader';
import ToolCard from '@/components/ToolCard';
import FileUploadZone from '@/components/FileUploadZone';
import axios from 'axios';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

export default function ProtectPDF() {
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [userPassword, setUserPassword] = useState<string>('');
    const [ownerPassword, setOwnerPassword] = useState<string>('');
    const [showUserPassword, setShowUserPassword] = useState(false);
    const [showOwnerPassword, setShowOwnerPassword] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isProtected, setIsProtected] = useState(false);
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
                    element: '[data-tour="upload"]',
                    popover: {
                        title: 'Paso 1: Subir PDF',
                        description: 'Selecciona el archivo PDF que deseas proteger con contraseña.',
                        side: 'right',
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="password"]',
                    popover: {
                        title: 'Paso 2: Crear Contraseña',
                        description: 'Ingresa y confirma una contraseña segura. Asegúrate de recordarla, ya que la necesitarás para abrir el PDF.',
                        side: 'left',
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="actions"]',
                    popover: {
                        title: 'Paso 3: Proteger PDF',
                        description: 'Haz clic en "Proteger PDF" para aplicar la contraseña. El archivo protegido se descargará automáticamente.',
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
        setIsProtected(false);
    };

    const protectPDF = async () => {
        if (!pdfFile || !userPassword) {
            setError('Por favor ingresa al menos la contraseña de usuario.');
            return;
        }

        if (userPassword.length < 4) {
            setError('La contraseña debe tener al menos 4 caracteres.');
            return;
        }

        setIsProcessing(true);
        setError('');

        try {
            const formData = new FormData();
            formData.append('pdf', pdfFile);
            formData.append('user_password', userPassword);
            formData.append('owner_password', ownerPassword || userPassword);

            const response = await axios.post('/tools/protect-pdf/protect', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
                },
                responseType: 'blob',
                timeout: 120000
            });

            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${pdfFile.name.replace('.pdf', '')}_protegido.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            setIsProtected(true);

        } catch (err: any) {
            console.error('Error protecting PDF:', err);
            let errorMessage = 'Error al proteger el documento.';
            if (err.response?.status === 404) {
                errorMessage = 'La función de protección de PDF requiere configuración adicional.';
            } else if (err.response?.data?.error) {
                errorMessage = err.response.data.error;
            }
            setError(errorMessage);
        } finally {
            setIsProcessing(false);
        }
    };

    const resetTool = () => {
        setPdfFile(null);
        setUserPassword('');
        setOwnerPassword('');
        setIsProtected(false);
        setError('');
    };

    return (
        <>
            <Head title="Proteger PDF - Evaristools" />
            <div className="min-h-screen bg-white dark:bg-slate-900">
                <ToolPageHeader
                    title="Proteger PDF"
                    description="Añade protección por contraseña a tus documentos PDF"
                    icon={Lock}
                />
                
                <div className="container mx-auto px-4 py-8">
                    <div className="max-w-6xl mx-auto">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">

                            {/* Left Column: File Upload & Messages */}
                            <div className="space-y-6" data-tour="upload">
                                {!pdfFile && (
                                    <ToolCard title="Seleccionar PDF">
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
                            {error && (
                                <ToolCard title="Error">
                                    <div className="flex items-start space-x-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                        <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                                        <p className="text-red-800 dark:text-red-200">{error}</p>
                                    </div>
                                </ToolCard>
                            )}
                            {pdfFile && (
                                <ToolCard title="Archivo Seleccionado">
                                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                        <div className="flex items-center space-x-3">
                                            <FileText className="h-8 w-8 text-institutional" />
                                            <div>
                                                <p className="font-medium text-slate-900 dark:text-white">{pdfFile.name}</p>
                                                <p className="text-sm text-slate-600 dark:text-slate-300">
                                                    {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </ToolCard>
                            )}
                            {isProtected && (
                                <ToolCard title="¡PDF Protegido Exitosamente!">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-center space-x-3 p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                            <CheckCircle className="h-8 w-8 text-green-600" />
                                            <div>
                                                <p className="font-medium text-green-800 dark:text-green-200">
                                                    ¡El PDF está protegido y descargado!
                                                </p>
                                                <p className="text-sm text-green-600 dark:text-green-300">
                                                    Ahora el documento requiere contraseña para abrirse.
                                                </p>
                                            </div>
                                        </div>
                                        <Button onClick={resetTool} variant="outline" className="w-full">
                                            <Upload className="mr-2 h-4 w-4" />
                                            Proteger Otro PDF
                                        </Button>
                                    </div>
                                </ToolCard>
                            )}
                            </div>

                            {/* Right Column: Always visible */}
                            <div className="space-y-6">
                                <ToolCard title="Configurar Contraseña" data-tour="password">
                                    <div className="space-y-4">
                                        <div>
                                            <Label htmlFor="user-password">Contraseña de Usuario *</Label>
                                            <div className="relative mt-2">
                                                <Input
                                                    id="user-password"
                                                    type={showUserPassword ? 'text' : 'password'}
                                                    value={userPassword}
                                                    onChange={(e) => setUserPassword(e.target.value)}
                                                    placeholder="Mínimo 4 caracteres"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowUserPassword(!showUserPassword)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2"
                                                >
                                                    {showUserPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </button>
                                            </div>
                                        </div>

                                        <div>
                                            <Label htmlFor="owner-password">Contraseña de Propietario (Opcional)</Label>
                                            <div className="relative mt-2">
                                                <Input
                                                    id="owner-password"
                                                    type={showOwnerPassword ? 'text' : 'password'}
                                                    value={ownerPassword}
                                                    onChange={(e) => setOwnerPassword(e.target.value)}
                                                    placeholder="Deja vacío para usar la misma"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowOwnerPassword(!showOwnerPassword)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2"
                                                >
                                                    {showOwnerPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </ToolCard>

                                <ToolCard title="Acciones" data-tour="actions">
                                    <div className="flex flex-col sm:flex-row gap-4">
                                        <Button
                                            onClick={protectPDF}
                                            disabled={isProcessing || !userPassword}
                                            className="flex-1 bg-institutional hover:bg-institutional/90"
                                        >
                                            {isProcessing ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Protegiendo...
                                                </>
                                            ) : (
                                                <>
                                                    <Lock className="mr-2 h-4 w-4" />
                                                    Proteger PDF
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
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}