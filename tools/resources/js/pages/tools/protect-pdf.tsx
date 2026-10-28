import { useState } from 'react';
import { Head } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    AlertCircle,
    AlertTriangle,
    Check,
    CheckCircle,
    ChevronDown,
    Copy,
    Download,
    Eye,
    EyeOff,
    FileText,
    HelpCircle,
    KeyRound,
    Loader2,
    Lock,
    ShieldCheck,
    Upload,
} from 'lucide-react';
import ToolPageHeader from '@/components/ToolPageHeader';
import ToolCard from '@/components/ToolCard';
import FileUploadZone from '@/components/FileUploadZone';
import { downloadBlob, formatFileSize, isPdfFile, pdfBaseName } from '@/lib/pdf-pages';
import { generatePassword, isEncryptedPdf, passwordStrength, protectPdf, type ProtectPermissions } from '@/lib/pdf-security';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

const MIN_PASSWORD_LENGTH = 6;

const PERMISSION_OPTIONS: { key: keyof ProtectPermissions; label: string; hint: string }[] = [
    { key: 'printing', label: 'Imprimir', hint: 'Imprimir el documento en alta calidad.' },
    { key: 'copying', label: 'Copiar texto e imágenes', hint: 'Seleccionar y copiar el contenido.' },
    { key: 'annotating', label: 'Comentar y llenar formularios', hint: 'Agregar comentarios, firmar y llenar campos.' },
    { key: 'modifying', label: 'Editar el documento', hint: 'Cambiar el contenido, agregar o quitar páginas.' },
];

const STRENGTH_LABELS = [
    { label: 'Débil', bar: 'w-1/4 bg-red-500', text: 'text-red-600 dark:text-red-400' },
    { label: 'Aceptable', bar: 'w-2/4 bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
    { label: 'Buena', bar: 'w-3/4 bg-lime-500', text: 'text-lime-700 dark:text-lime-400' },
    { label: 'Fuerte', bar: 'w-full bg-green-600', text: 'text-green-700 dark:text-green-400' },
];

interface ProtectedResult {
    blob: Blob;
    restricted: boolean;
}

function PasswordInput({
    id,
    value,
    onChange,
    visible,
    onToggleVisible,
    placeholder,
    invalid,
}: {
    id: string;
    value: string;
    onChange: (value: string) => void;
    visible: boolean;
    onToggleVisible: () => void;
    placeholder?: string;
    invalid?: boolean;
}) {
    return (
        <div className="relative mt-2">
            <Input
                id={id}
                type={visible ? 'text' : 'password'}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                autoComplete="new-password"
                spellCheck={false}
                aria-invalid={invalid}
                className="pr-10"
            />
            <button
                type="button"
                onClick={onToggleVisible}
                aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-institutional dark:text-slate-400 dark:hover:text-white"
            >
                {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
        </div>
    );
}

export default function ProtectPDF() {
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [userPassword, setUserPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [ownerPassword, setOwnerPassword] = useState('');
    const [showPasswords, setShowPasswords] = useState(false);
    const [showOwnerPassword, setShowOwnerPassword] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [permissions, setPermissions] = useState<ProtectPermissions>({
        printing: true,
        copying: true,
        annotating: true,
        modifying: false,
    });
    const [copied, setCopied] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState<ProtectedResult | null>(null);
    const [error, setError] = useState('');
    const [dragOver, setDragOver] = useState(false);

    const strength = userPassword ? passwordStrength(userPassword) : null;
    const tooShort = userPassword.length > 0 && userPassword.length < MIN_PASSWORD_LENGTH;
    const mismatch = confirmPassword.length > 0 && confirmPassword !== userPassword;
    const ownerSameAsUser = ownerPassword.length > 0 && ownerPassword === userPassword;
    const restricted = Object.values(permissions).some((allowed) => !allowed);
    const canProtect =
        !!pdfFile && userPassword.length >= MIN_PASSWORD_LENGTH && confirmPassword === userPassword && !ownerSameAsUser && !isProcessing;

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
                        description: 'Selecciona el archivo PDF que deseas proteger. Se procesa en tu navegador: no se sube a ningún servidor.',
                        side: 'right',
                        align: 'start',
                    },
                },
                {
                    element: '[data-tour="password"]',
                    popover: {
                        title: 'Paso 2: Crear Contraseña',
                        description:
                            'Escribe la contraseña dos veces o genera una segura. Guárdala bien: sin ella no se puede abrir el documento y no hay forma de recuperarla.',
                        side: 'left',
                        align: 'start',
                    },
                },
                {
                    element: '[data-tour="permissions"]',
                    popover: {
                        title: 'Paso 3: Permisos',
                        description: 'Elige qué podrá hacer quien abra el PDF con la contraseña: imprimir, copiar, comentar o editar.',
                        side: 'left',
                        align: 'start',
                    },
                },
                {
                    element: '[data-tour="actions"]',
                    popover: {
                        title: 'Paso 4: Proteger PDF',
                        description: 'Haz clic en "Proteger PDF". Se cifra con AES-256 y se descarga automáticamente.',
                        side: 'left',
                        align: 'start',
                    },
                },
            ],
        });
        driverObj.drive();
    };

    const handleFileSelect = async (files: FileList) => {
        const file = files[0];
        if (!file) return;

        if (!isPdfFile(file)) {
            setError('Por favor selecciona un archivo PDF válido.');
            return;
        }

        if (file.size > 50 * 1024 * 1024) {
            setError('El archivo es demasiado grande. Máximo 50MB permitido.');
            return;
        }

        setError('');
        setResult(null);
        setIsLoading(true);
        try {
            if (await isEncryptedPdf(await file.arrayBuffer())) {
                setError('Este PDF ya está protegido con contraseña.');
                return;
            }
            setPdfFile(file);
        } catch (err) {
            console.error('Error loading PDF:', err);
            setError('Error al leer el PDF. El archivo puede estar dañado.');
        } finally {
            setIsLoading(false);
        }
    };

    const fillGeneratedPassword = () => {
        const password = generatePassword();
        setUserPassword(password);
        setConfirmPassword(password);
        setShowPasswords(true);
        setCopied(false);
    };

    const copyPassword = async () => {
        try {
            await navigator.clipboard.writeText(userPassword);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setCopied(false);
        }
    };

    const protect = async () => {
        if (!pdfFile || !canProtect) return;

        setIsProcessing(true);
        setError('');

        try {
            const bytes = await protectPdf(await pdfFile.arrayBuffer(), { userPassword, ownerPassword, permissions });
            const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
            downloadBlob(blob, `${pdfBaseName(pdfFile)}_protegido.pdf`);
            setResult({ blob, restricted });
        } catch (err) {
            console.error('Error protecting PDF:', err);
            setError('No se pudo proteger el documento. Verifica que el PDF no esté dañado e intenta de nuevo.');
        } finally {
            setIsProcessing(false);
        }
    };

    const downloadAgain = () => {
        if (result && pdfFile) downloadBlob(result.blob, `${pdfBaseName(pdfFile)}_protegido.pdf`);
    };

    const resetTool = () => {
        setPdfFile(null);
        setUserPassword('');
        setConfirmPassword('');
        setOwnerPassword('');
        setShowPasswords(false);
        setResult(null);
        setError('');
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
        if (e.dataTransfer.files.length > 0) handleFileSelect(e.dataTransfer.files);
    };

    return (
        <>
            <Head title="Proteger PDF - Evaristools" />
            <div className="min-h-screen bg-white dark:bg-[#1d1d1e]">
                <ToolPageHeader title="Proteger PDF" description="Añade protección por contraseña a tus documentos PDF" icon={Lock} />

                <div className="container mx-auto px-4 py-8">
                    <div className="max-w-6xl mx-auto">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                            {/* Left Column: File Upload & Messages */}
                            <div className="space-y-6" data-tour="upload">
                                {!pdfFile && (
                                    <ToolCard title="Seleccionar PDF">
                                        <FileUploadZone
                                            onFileSelect={handleFileSelect}
                                            acceptedTypes=".pdf,application/pdf"
                                            dragOver={dragOver}
                                            onDragOver={handleDragOver}
                                            onDragEnter={handleDragOver}
                                            onDragLeave={handleDragLeave}
                                            onDrop={handleDrop}
                                            title="Arrastra tu PDF aquí"
                                            subtitle="o haz clic para seleccionar (máximo 50MB)"
                                        />
                                        {isLoading && (
                                            <p className="flex items-center text-sm text-slate-600 dark:text-slate-300">
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Leyendo el PDF...
                                            </p>
                                        )}
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
                                        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-[#222322] rounded-lg">
                                            <div className="flex min-w-0 items-center space-x-3">
                                                <FileText className="h-8 w-8 flex-shrink-0 text-institutional" />
                                                <div className="min-w-0">
                                                    <p className="truncate font-medium text-slate-900 dark:text-white">{pdfFile.name}</p>
                                                    <p className="text-sm text-slate-600 dark:text-slate-300">{formatFileSize(pdfFile.size)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </ToolCard>
                                )}

                                <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-[#222322] dark:text-slate-200">
                                    <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400" />
                                    <p>
                                        Se cifra con <strong>AES-256</strong> directamente en tu navegador: el documento no se sube a ningún servidor.
                                        Se conservan los enlaces, marcadores y formularios del PDF.
                                    </p>
                                </div>

                                {result && (
                                    <ToolCard title="¡PDF Protegido Exitosamente!">
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-center space-x-3 p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                                <CheckCircle className="h-8 w-8 flex-shrink-0 text-green-600" />
                                                <div>
                                                    <p className="font-medium text-green-800 dark:text-green-200">¡El PDF está protegido y se descargó!</p>
                                                    <p className="text-sm text-green-600 dark:text-green-300">
                                                        Ahora pide la contraseña para abrirse
                                                        {result.restricted ? ' y tiene restricciones de uso' : ''}. {formatFileSize(result.blob.size)}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col sm:flex-row gap-3">
                                                <Button onClick={downloadAgain} variant="outline" className="flex-1">
                                                    <Download className="mr-2 h-4 w-4" />
                                                    Descargar de nuevo
                                                </Button>
                                                <Button onClick={resetTool} variant="outline" className="flex-1">
                                                    <Upload className="mr-2 h-4 w-4" />
                                                    Proteger Otro PDF
                                                </Button>
                                            </div>
                                        </div>
                                    </ToolCard>
                                )}
                            </div>

                            {/* Right Column */}
                            <div className="space-y-6">
                                <ToolCard title="Configurar Contraseña" data-tour="password">
                                    <div className="space-y-4">
                                        <div>
                                            <div className="flex items-center justify-between gap-2">
                                                <Label htmlFor="user-password">Contraseña para abrir *</Label>
                                                <Button type="button" variant="ghost" size="sm" onClick={fillGeneratedPassword} className="h-7 px-2">
                                                    <KeyRound className="mr-1 h-4 w-4" />
                                                    Generar una segura
                                                </Button>
                                            </div>
                                            <PasswordInput
                                                id="user-password"
                                                value={userPassword}
                                                onChange={(value) => {
                                                    setUserPassword(value);
                                                    setCopied(false);
                                                }}
                                                visible={showPasswords}
                                                onToggleVisible={() => setShowPasswords(!showPasswords)}
                                                placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
                                                invalid={tooShort}
                                            />
                                            {strength !== null && (
                                                <div className="mt-2 space-y-1" aria-live="polite">
                                                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                                                        <div className={`h-full rounded-full transition-all ${STRENGTH_LABELS[strength].bar}`} />
                                                    </div>
                                                    <p className={`text-xs ${STRENGTH_LABELS[strength].text}`}>
                                                        {tooShort
                                                            ? `Muy corta: usa al menos ${MIN_PASSWORD_LENGTH} caracteres.`
                                                            : `Seguridad: ${STRENGTH_LABELS[strength].label}`}
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            <Label htmlFor="confirm-password">Repite la contraseña *</Label>
                                            <PasswordInput
                                                id="confirm-password"
                                                value={confirmPassword}
                                                onChange={setConfirmPassword}
                                                visible={showPasswords}
                                                onToggleVisible={() => setShowPasswords(!showPasswords)}
                                                invalid={mismatch}
                                            />
                                            {mismatch && <p className="mt-1 text-sm text-red-600 dark:text-red-400">Las contraseñas no coinciden.</p>}
                                        </div>

                                        {userPassword && showPasswords && (
                                            <Button type="button" variant="outline" size="sm" onClick={copyPassword}>
                                                {copied ? <Check className="mr-2 h-4 w-4 text-green-600" /> : <Copy className="mr-2 h-4 w-4" />}
                                                {copied ? 'Copiada' : 'Copiar contraseña'}
                                            </Button>
                                        )}

                                        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-100">
                                            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-700 dark:text-amber-400" />
                                            <p>Guarda la contraseña en un lugar seguro: si se pierde, el documento no se puede recuperar.</p>
                                        </div>
                                    </div>
                                </ToolCard>

                                <ToolCard title="Permisos" description="Qué podrá hacer quien abra el PDF con la contraseña." data-tour="permissions">
                                    <div className="space-y-3">
                                        {PERMISSION_OPTIONS.map(({ key, label, hint }) => (
                                            <label key={key} className="flex cursor-pointer items-start gap-3">
                                                <Checkbox
                                                    checked={permissions[key]}
                                                    onCheckedChange={(checked) => setPermissions({ ...permissions, [key]: checked === true })}
                                                    className="mt-0.5"
                                                />
                                                <span>
                                                    <span className="block text-sm font-medium text-slate-900 dark:text-white">{label}</span>
                                                    <span className="block text-xs text-slate-600 dark:text-slate-400">{hint}</span>
                                                </span>
                                            </label>
                                        ))}
                                        {restricted && (
                                            <p className="text-xs text-slate-600 dark:text-slate-400">
                                                Adobe Reader, Chrome y Edge respetan estas restricciones, pero algunos programas las ignoran. Lo que impide leer el
                                                documento es la contraseña.
                                            </p>
                                        )}

                                        <button
                                            type="button"
                                            onClick={() => setShowAdvanced(!showAdvanced)}
                                            aria-expanded={showAdvanced}
                                            className="flex items-center gap-1 text-sm font-medium text-institutional hover:underline dark:text-[#8b9bd6]"
                                        >
                                            <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                                            Contraseña para quitar las restricciones (opcional)
                                        </button>
                                        {showAdvanced && (
                                            <div>
                                                <Label htmlFor="owner-password">Contraseña de propietario</Label>
                                                <PasswordInput
                                                    id="owner-password"
                                                    value={ownerPassword}
                                                    onChange={setOwnerPassword}
                                                    visible={showOwnerPassword}
                                                    onToggleVisible={() => setShowOwnerPassword(!showOwnerPassword)}
                                                    placeholder="Distinta de la contraseña para abrir"
                                                    invalid={ownerSameAsUser}
                                                />
                                                <p className={`mt-1 text-xs ${ownerSameAsUser ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>
                                                    {ownerSameAsUser
                                                        ? 'Debe ser distinta: con la misma contraseña cualquiera tendría todos los permisos.'
                                                        : 'Permite abrir el PDF sin restricciones. Si la dejas vacía, nadie podrá quitarlas.'}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </ToolCard>

                                <ToolCard title="Acciones" data-tour="actions">
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <Button onClick={protect} disabled={!canProtect} className="flex-1 bg-institutional hover:bg-institutional/90">
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
                                        <Button onClick={resetTool} variant="outline" className="flex-1" disabled={isProcessing || !pdfFile}>
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
