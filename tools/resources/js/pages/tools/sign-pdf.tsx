import { useEffect, useMemo, useRef, useState } from 'react';
import { Head } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    AlertCircle,
    BadgeCheck,
    CheckCircle,
    ChevronLeft,
    ChevronRight,
    Download,
    Eye,
    EyeOff,
    FileSignature,
    FileText,
    HelpCircle,
    ImageUp,
    Info,
    Loader2,
    Move,
    PenLine,
    PenTool,
    Plus,
    ShieldAlert,
    Type,
    Upload,
} from 'lucide-react';
import ToolPageHeader from '@/components/ToolPageHeader';
import ToolCard from '@/components/ToolCard';
import FileUploadZone from '@/components/FileUploadZone';
import OptionButtons from '@/components/OptionButtons';
import SignaturePad from '@/components/SignaturePad';
import axios from 'axios';
import { usePdfRenderer } from '@/hooks/use-pdf-thumbnails';
import { conversionErrorMessage } from '@/lib/conversion';
import { canvasToImage, loadImageFile, revokeImage, trimCanvas, type LoadedImage } from '@/lib/image-tools';
import { downloadBlob, formatFileSize, isPdfFile, pdfBaseName } from '@/lib/pdf-pages';
import {
    inspectPdf,
    prepareCertificateSignature,
    stampHandwrittenSignature,
    type PdfSignatureInfo,
    type StampPosition,
} from '@/lib/pdf-signature';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

type SignMode = 'handwritten' | 'certificate';
type SignatureSource = 'draw' | 'type' | 'upload';

interface CertificateInfo {
    name: string;
    organization: string | null;
    issuer: string;
    validTo: string;
    selfSigned: boolean;
}

interface SignedResult {
    blob: Blob;
    url: string;
    mode: SignMode;
}

const PEN_COLORS = [
    { value: '#1e3a8a', label: 'Azul' },
    { value: '#111827', label: 'Negro' },
];

// Fuentes de Windows con aspecto manuscrito; el navegador usa la primera que tenga.
const SIGNATURE_FONTS = [
    { label: 'Clásica', css: '"Segoe Script", "Brush Script MT", "Lucida Handwriting", cursive' },
    { label: 'Elegante', css: '"Lucida Handwriting", "Segoe Script", cursive' },
    { label: 'Sencilla', css: '"Ink Free", "Segoe Print", "Comic Sans MS", cursive' },
];

const PAGE_PREVIEW_WIDTH = 720;
const LOCATION = 'Hospital Universitario del Valle';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

const formatDate = (date: Date, withTime: boolean) =>
    date.toLocaleString('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    });

function renderTypedSignature(text: string, fontCss: string, color: string): HTMLCanvasElement | null {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    const font = `96px ${fontCss}`;
    context.font = font;
    const width = Math.ceil(context.measureText(text).width) + 80;
    canvas.width = Math.min(width, 2400);
    canvas.height = 200;
    context.font = font;
    context.fillStyle = color;
    context.textBaseline = 'middle';
    context.fillText(text, 40, 100, canvas.width - 80);
    return trimCanvas(canvas, 6);
}

/**
 * Sello que se pone en el PDF: la firma manuscrita (si hay) y debajo las
 * líneas de texto. Se arma como una sola imagen para que el PDF quede igual
 * a la vista previa.
 */
function composeStamp(signature: HTMLImageElement | null, lines: string[]): HTMLCanvasElement | null {
    if (!signature && lines.length === 0) return null;

    const padding = 12;
    const lineHeight = 44;
    const gap = signature && lines.length ? 10 : 0;
    const fontFor = (index: number) => `${index === 0 ? 'bold 34px' : '30px'} Arial, Helvetica, sans-serif`;

    // La firma va a una altura fija y el texto en proporción, así se lee igual
    // de bien con firmas anchas o angostas.
    const signatureHeight = signature ? Math.min(200, signature.naturalHeight) : 0;
    const signatureWidth = signature ? Math.min(900, (signature.naturalWidth * signatureHeight) / signature.naturalHeight) : 0;
    const drawnHeight = signature ? (signature.naturalHeight * signatureWidth) / signature.naturalWidth : 0;

    const measure = document.createElement('canvas').getContext('2d')!;
    const textWidth = Math.max(0, ...lines.map((line, index) => {
        measure.font = fontFor(index);
        return measure.measureText(line).width;
    }));

    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(Math.max(signatureWidth, textWidth, 200) + padding * 2);
    canvas.height = Math.ceil(padding * 2 + drawnHeight + gap + lines.length * lineHeight);
    const context = canvas.getContext('2d')!;

    if (signature) context.drawImage(signature, (canvas.width - signatureWidth) / 2, padding, signatureWidth, drawnHeight);

    context.fillStyle = '#1f2937';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    lines.forEach((line, index) => {
        context.font = fontFor(index);
        context.fillText(line, canvas.width / 2, padding + drawnHeight + gap + lineHeight * (index + 0.5));
    });

    return canvas;
}

export default function SignPDF() {
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [info, setInfo] = useState<PdfSignatureInfo | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [dragOver, setDragOver] = useState(false);

    const [mode, setMode] = useState<SignMode>('handwritten');
    const [source, setSource] = useState<SignatureSource>('draw');
    const [penColor, setPenColor] = useState(PEN_COLORS[0].value);
    const [drawnCanvas, setDrawnCanvas] = useState<HTMLCanvasElement | null>(null);
    const [drawVersion, setDrawVersion] = useState(0);
    const [typedName, setTypedName] = useState('');
    const [typedFont, setTypedFont] = useState(0);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [removeWhite, setRemoveWhite] = useState(true);
    const [signatureImage, setSignatureImage] = useState<LoadedImage | null>(null);
    const [signatureError, setSignatureError] = useState('');

    const [includeName, setIncludeName] = useState(false);
    const [signerName, setSignerName] = useState('');
    const [includeDate, setIncludeDate] = useState(true);
    const [extraLine, setExtraLine] = useState('');
    const [includeHandwritten, setIncludeHandwritten] = useState(true);

    const [certificateFile, setCertificateFile] = useState<File | null>(null);
    const [certificatePassword, setCertificatePassword] = useState('');
    const [showCertificatePassword, setShowCertificatePassword] = useState(false);
    const [certificate, setCertificate] = useState<CertificateInfo | null>(null);
    const [certificateError, setCertificateError] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [reason, setReason] = useState('');

    const [stamp, setStamp] = useState<LoadedImage | null>(null);
    const [pageIndex, setPageIndex] = useState(0);
    const [position, setPosition] = useState<StampPosition>({ left: 0.6, top: 0.75, width: 0.3 });
    const [allPages, setAllPages] = useState(false);
    const [pageImage, setPageImage] = useState<string | null>(null);

    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState<SignedResult | null>(null);

    const uploadInputRef = useRef<HTMLInputElement>(null);
    const certificateInputRef = useRef<HTMLInputElement>(null);
    const pageRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<{ kind: 'move' | 'resize'; x: number; y: number; start: StampPosition } | null>(null);

    const { pageCount, renderPage } = usePdfRenderer(pdfFile);
    const pageSize = info?.pageSizes[pageIndex];
    // Alto del sello como fracción del alto de la página.
    const stampHeight = stamp && pageSize ? (position.width * pageSize.width * stamp.height) / stamp.width / pageSize.height : 0;

    // Firma manuscrita a partir de la opción elegida.
    useEffect(() => {
        let cancelled = false;
        const publish = (image: LoadedImage | null) => {
            if (cancelled) return revokeImage(image);
            setSignatureImage((previous) => {
                revokeImage(previous);
                return image;
            });
        };

        setSignatureError('');
        if (source === 'draw') {
            const trimmed = drawnCanvas ? trimCanvas(drawnCanvas) : null;
            if (!trimmed) publish(null);
            else canvasToImage(trimmed).then(publish);
        } else if (source === 'type') {
            const canvas = typedName.trim() ? renderTypedSignature(typedName.trim(), SIGNATURE_FONTS[typedFont].css, penColor) : null;
            if (!canvas) publish(null);
            else canvasToImage(canvas).then(publish);
        } else if (uploadedFile) {
            loadImageFile(uploadedFile, { removeWhite, trim: true, maxDimension: 1200 })
                .then(publish)
                .catch((err) => {
                    publish(null);
                    if (!cancelled) setSignatureError(err instanceof Error ? err.message : 'No se pudo leer la imagen.');
                });
        } else {
            publish(null);
        }

        return () => {
            cancelled = true;
        };
    }, [source, drawnCanvas, drawVersion, typedName, typedFont, penColor, uploadedFile, removeWhite]);

    const stampLines = useMemo(() => {
        if (mode === 'certificate') {
            return [
                certificate ? `Firmado digitalmente por ${certificate.name}` : 'Firmado digitalmente',
                `Fecha: ${formatDate(new Date(), true)}`,
                ...(reason.trim() ? [`Motivo: ${reason.trim()}`] : []),
            ];
        }
        return [includeName ? signerName.trim() : '', includeDate ? formatDate(new Date(), false) : '', extraLine.trim()].filter(Boolean);
    }, [mode, certificate, reason, includeName, signerName, includeDate, extraLine]);

    const useHandwritten = mode === 'handwritten' || includeHandwritten;

    // Sello final (firma + textos).
    useEffect(() => {
        let cancelled = false;
        const canvas = composeStamp(useHandwritten ? (signatureImage?.element ?? null) : null, stampLines);
        if (!canvas) {
            setStamp((previous) => {
                revokeImage(previous);
                return null;
            });
            return;
        }
        canvasToImage(canvas).then((image) => {
            if (cancelled) return revokeImage(image);
            setStamp((previous) => {
                revokeImage(previous);
                return image;
            });
        });
        return () => {
            cancelled = true;
        };
    }, [signatureImage, stampLines, useHandwritten]);

    // Página donde se ubica la firma.
    useEffect(() => {
        setPageImage(null);
        if (!pageCount) return;
        let cancelled = false;
        renderPage(pageIndex + 1, PAGE_PREVIEW_WIDTH).then((url) => !cancelled && setPageImage(url));
        return () => {
            cancelled = true;
        };
    }, [pageCount, pageIndex, renderPage]);

    // El sello no puede salirse de la página al cambiar de tamaño o de página.
    useEffect(() => {
        if (!stampHeight) return;
        setPosition((previous) => ({ ...previous, top: clamp(previous.top, 0, 1 - stampHeight) }));
    }, [stampHeight]);

    const clearResult = () => {
        if (result) URL.revokeObjectURL(result.url);
        setResult(null);
    };

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
                        description: 'Selecciona el archivo PDF que deseas firmar.',
                        side: 'right',
                        align: 'start',
                    },
                },
                {
                    element: '[data-tour="mode"]',
                    popover: {
                        title: 'Paso 2: Tipo de firma',
                        description:
                            'Firma manuscrita: dibujas, escribes o subes tu firma. Con certificado digital: además se firma con tu certificado (.pfx/.p12), lo que permite verificar que el documento no cambió.',
                        side: 'left',
                        align: 'start',
                    },
                },
                {
                    element: '[data-tour="signature"]',
                    popover: {
                        title: 'Paso 3: Tu firma',
                        description: 'Dibújala con el mouse o el dedo, escribe tu nombre o sube una foto de tu firma. Puedes agregar nombre y fecha.',
                        side: 'left',
                        align: 'start',
                    },
                },
                {
                    element: '[data-tour="placement"]',
                    popover: {
                        title: 'Paso 4: Ubicar la firma',
                        description: 'Arrastra el recuadro hasta donde va la firma y usa la esquina para cambiar su tamaño. También puedes hacer clic en la página.',
                        side: 'top',
                        align: 'start',
                    },
                },
                {
                    element: '[data-tour="actions"]',
                    popover: {
                        title: 'Paso 5: Firmar PDF',
                        description: 'Haz clic en "Firmar PDF" y descarga el documento firmado.',
                        side: 'left',
                        align: 'start',
                    },
                },
            ],
        });
        driverObj.drive();
    };

    const loadPdf = async (file: File) => {
        setError('');
        setIsLoading(true);
        try {
            const inspected = await inspectPdf(await file.arrayBuffer());
            if (inspected.encrypted) {
                setError('Este PDF está protegido con contraseña. Quita la protección antes de firmarlo.');
                return;
            }
            clearResult();
            setInfo(inspected);
            setPdfFile(file);
            // Las firmas suelen ir al final del documento.
            setPageIndex(inspected.pageSizes.length - 1);
        } catch (err) {
            console.error('Error loading PDF:', err);
            setError('Error al leer el PDF. El archivo puede estar dañado.');
        } finally {
            setIsLoading(false);
        }
    };

    const handlePdfSelect = (files: FileList) => {
        const file = files[0];
        if (!file) return;

        if (!isPdfFile(file)) {
            setError('Por favor selecciona un archivo PDF válido.');
            return;
        }

        if (file.size > 50 * 1024 * 1024) {
            setError('El archivo PDF es demasiado grande. Máximo 50MB permitido.');
            return;
        }

        loadPdf(file);
    };

    const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setSignatureError('Selecciona una imagen (PNG, JPG o WebP) de tu firma.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setSignatureError('La imagen es demasiado grande. Máximo 5MB.');
            return;
        }
        setUploadedFile(file);
    };

    const handleCertificateSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
        if (!['pfx', 'p12', 'pem'].includes(extension)) {
            setCertificateError('Selecciona un certificado .pfx, .p12 o .pem.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setCertificateError('El certificado es demasiado grande. Máximo 5MB.');
            return;
        }

        setCertificateFile(file);
        setCertificate(null);
        setCertificateError('');
    };

    const verifyCertificate = async () => {
        if (!certificateFile) return;
        setIsVerifying(true);
        setCertificateError('');
        try {
            const formData = new FormData();
            formData.append('certificate', certificateFile);
            formData.append('password', certificatePassword);
            const response = await axios.post<CertificateInfo>('/tools/sign-pdf/certificate', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                timeout: 30000,
            });
            setCertificate(response.data);
        } catch (err) {
            setCertificate(null);
            setCertificateError(await conversionErrorMessage(err, 'No se pudo verificar el certificado.'));
        } finally {
            setIsVerifying(false);
        }
    };

    // Arrastrar o cambiar el tamaño del sello sobre la página.
    const startDrag = (kind: 'move' | 'resize') => (e: React.PointerEvent<HTMLElement>) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        dragRef.current = { kind, x: e.clientX, y: e.clientY, start: position };
    };

    const handleDrag = (e: React.PointerEvent<HTMLElement>) => {
        const drag = dragRef.current;
        const rect = pageRef.current?.getBoundingClientRect();
        if (!drag || !rect || !stamp || !pageSize) return;

        const dx = (e.clientX - drag.x) / rect.width;
        const dy = (e.clientY - drag.y) / rect.height;
        if (drag.kind === 'move') {
            setPosition({
                ...drag.start,
                left: clamp(drag.start.left + dx, 0, 1 - drag.start.width),
                top: clamp(drag.start.top + dy, 0, 1 - stampHeight),
            });
        } else {
            // El alto crece con el ancho: también se limita para no salirse por abajo.
            const ratio = (pageSize.width * stamp.height) / stamp.width / pageSize.height;
            const maxWidth = Math.min(1 - drag.start.left, (1 - drag.start.top) / ratio);
            setPosition({ ...drag.start, width: clamp(drag.start.width + dx, 0.06, maxWidth) });
        }
        clearResult();
    };

    const endDrag = () => {
        dragRef.current = null;
    };

    // Clic en la página: el sello se centra ahí.
    const placeAt = (e: React.PointerEvent<HTMLDivElement>) => {
        const rect = pageRef.current?.getBoundingClientRect();
        if (!rect || !stamp) return;
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        setPosition((previous) => ({
            ...previous,
            left: clamp(x - previous.width / 2, 0, 1 - previous.width),
            top: clamp(y - stampHeight / 2, 0, 1 - stampHeight),
        }));
        clearResult();
    };

    const moveWithKeys = (e: React.KeyboardEvent<HTMLDivElement>) => {
        const step = e.shiftKey ? 0.05 : 0.01;
        const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
        const move = moves[e.key];
        if (!move) return;
        e.preventDefault();
        setPosition((previous) => ({
            ...previous,
            left: clamp(previous.left + move[0], 0, 1 - previous.width),
            top: clamp(previous.top + move[1], 0, 1 - stampHeight),
        }));
        clearResult();
    };

    const handwrittenMissing = mode === 'handwritten' && !signatureImage;
    const certificateMissing = mode === 'certificate' && !certificate;
    const canSign = !!pdfFile && !!stamp && !handwrittenMissing && !certificateMissing && !isProcessing;

    const signPDF = async () => {
        if (!pdfFile || !info || !stamp || !canSign) return;

        setIsProcessing(true);
        setError('');

        try {
            const bytes = await pdfFile.arrayBuffer();
            let signed: Blob;

            if (mode === 'handwritten') {
                const pages = allPages ? info.pageSizes.map((_, index) => index) : [pageIndex];
                const output = await stampHandwrittenSignature(bytes, stamp, position, pages, info.signatureCount > 0);
                signed = new Blob([output as BlobPart], { type: 'application/pdf' });
            } else {
                const prepared = await prepareCertificateSignature(bytes, stamp, position, pageIndex, {
                    name: certificate!.name,
                    reason: reason.trim(),
                    location: LOCATION,
                });
                const formData = new FormData();
                formData.append('pdf', new Blob([prepared as BlobPart], { type: 'application/pdf' }), 'documento.pdf');
                formData.append('certificate', certificateFile!);
                formData.append('password', certificatePassword);
                const response = await axios.post('/tools/sign-pdf/sign', formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                    },
                    responseType: 'blob',
                    timeout: 120000,
                });
                signed = new Blob([response.data], { type: 'application/pdf' });
            }

            clearResult();
            setResult({ blob: signed, url: URL.createObjectURL(signed), mode });
            downloadBlob(signed, `${pdfBaseName(pdfFile)}_firmado.pdf`);
        } catch (err) {
            console.error('Error signing PDF:', err);
            setError(await conversionErrorMessage(err, 'No se pudo firmar el documento. Intenta de nuevo.'));
        } finally {
            setIsProcessing(false);
        }
    };

    // Para que firme otra persona sobre el documento ya firmado.
    const signAgain = () => {
        if (!result || !pdfFile) return;
        const name = pdfFile.name.replace(/(_firmado)?\.pdf$/i, '_firmado.pdf');
        loadPdf(new File([result.blob], name, { type: 'application/pdf' }));
    };

    const resetTool = () => {
        clearResult();
        setPdfFile(null);
        setInfo(null);
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
        if (e.dataTransfer.files.length > 0) handlePdfSelect(e.dataTransfer.files);
    };

    const totalPages = info?.pageSizes.length ?? 0;
    const existingSignatures = info?.signatureCount ?? 0;

    return (
        <>
            <Head title="Firmar PDF - Evaristools" />

            <div className="min-h-screen bg-white dark:bg-[#1d1d1e]">
                <ToolPageHeader
                    title="Firmar PDF"
                    description="Firma tus documentos PDF a mano o con tu certificado digital"
                    icon={FileSignature}
                />

                <div className="container mx-auto px-4 py-8">
                    <div className="max-w-6xl mx-auto">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                            {/* Left Column: File Upload, Messages and Result */}
                            <div className="space-y-6" data-tour="upload">
                                {!pdfFile && (
                                    <ToolCard title="Seleccionar PDF a Firmar">
                                        <FileUploadZone
                                            onFileSelect={handlePdfSelect}
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
                                    <ToolCard title="Archivo PDF Seleccionado">
                                        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-[#222322] rounded-lg">
                                            <div className="flex min-w-0 items-center space-x-3">
                                                <FileText className="h-8 w-8 flex-shrink-0 text-institutional" />
                                                <div className="min-w-0">
                                                    <p className="truncate font-medium text-slate-900 dark:text-white">{pdfFile.name}</p>
                                                    <p className="text-sm text-slate-600 dark:text-slate-300">
                                                        {totalPages} {totalPages === 1 ? 'página' : 'páginas'} · {formatFileSize(pdfFile.size)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        {existingSignatures > 0 && (
                                            <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-100">
                                                <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
                                                <p>
                                                    Este PDF ya tiene {existingSignatures === 1 ? 'una firma digital' : `${existingSignatures} firmas digitales`}. La nueva firma
                                                    se agrega sin modificar lo anterior, así que {existingSignatures === 1 ? 'sigue siendo válida' : 'siguen siendo válidas'}.
                                                </p>
                                            </div>
                                        )}
                                    </ToolCard>
                                )}

                                {result && (
                                    <ToolCard title="¡PDF Firmado Exitosamente!">
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-center space-x-3 p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                                <CheckCircle className="h-8 w-8 flex-shrink-0 text-green-600" />
                                                <div>
                                                    <p className="font-medium text-green-800 dark:text-green-200">¡El PDF se firmó y se descargó!</p>
                                                    <p className="text-sm text-green-600 dark:text-green-300">
                                                        {result.mode === 'certificate'
                                                            ? 'En Adobe Reader verás la firma en el panel de firmas.'
                                                            : 'La firma quedó dibujada en el documento.'}{' '}
                                                        {formatFileSize(result.blob.size)}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex flex-col sm:flex-row gap-3">
                                                <Button
                                                    onClick={() => pdfFile && downloadBlob(result.blob, `${pdfBaseName(pdfFile)}_firmado.pdf`)}
                                                    className="flex-1 bg-institutional hover:bg-institutional/90"
                                                >
                                                    <Download className="mr-2 h-4 w-4" />
                                                    Descargar
                                                </Button>
                                                <Button asChild variant="outline" className="flex-1">
                                                    <a href={result.url} target="_blank" rel="noopener noreferrer">
                                                        <Eye className="mr-2 h-4 w-4" />
                                                        Ver PDF
                                                    </a>
                                                </Button>
                                            </div>
                                            <Button onClick={signAgain} variant="outline" className="w-full">
                                                <Plus className="mr-2 h-4 w-4" />
                                                Agregar otra firma a este documento
                                            </Button>
                                        </div>
                                    </ToolCard>
                                )}
                            </div>

                            {/* Right Column: Options and Actions */}
                            <div className="space-y-6">
                                <ToolCard title="Tipo de Firma" data-tour="mode">
                                    <OptionButtons
                                        labelledBy="sign-mode-label"
                                        value={mode}
                                        onChange={(value) => {
                                            setMode(value);
                                            clearResult();
                                        }}
                                        className="grid-cols-1 sm:grid-cols-2"
                                        options={[
                                            { value: 'handwritten', label: 'Firma manuscrita', icon: PenLine },
                                            { value: 'certificate', label: 'Con certificado digital', icon: BadgeCheck },
                                        ]}
                                    />
                                    <p id="sign-mode-label" className="text-sm text-slate-600 dark:text-slate-300">
                                        {mode === 'handwritten'
                                            ? 'Tu firma queda dibujada en el documento. Todo se procesa en tu navegador.'
                                            : 'Además del sello visible, el PDF se firma con tu certificado (.pfx o .p12): cualquiera puede verificar quién firmó y que el documento no cambió después.'}
                                    </p>
                                </ToolCard>

                                <ToolCard title={mode === 'handwritten' ? 'Tu Firma' : 'Firma Manuscrita (opcional)'} data-tour="signature">
                                    {mode === 'certificate' && (
                                        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                                            <Checkbox checked={includeHandwritten} onCheckedChange={(checked) => setIncludeHandwritten(checked === true)} />
                                            Incluir mi firma manuscrita en el sello
                                        </label>
                                    )}

                                    <div className={useHandwritten ? 'space-y-4' : 'hidden'}>
                                        <OptionButtons
                                            labelledBy="signature-source-label"
                                            value={source}
                                            onChange={setSource}
                                            className="grid-cols-3"
                                            options={[
                                                { value: 'draw', label: 'Dibujar', icon: PenTool },
                                                { value: 'type', label: 'Escribir', icon: Type },
                                                { value: 'upload', label: 'Subir imagen', icon: ImageUp },
                                            ]}
                                        />
                                        <span id="signature-source-label" className="sr-only">
                                            Cómo crear la firma
                                        </span>

                                        {source !== 'upload' && (
                                            <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200">
                                                <span>Color:</span>
                                                {PEN_COLORS.map((pen) => (
                                                    <button
                                                        key={pen.value}
                                                        type="button"
                                                        onClick={() => setPenColor(pen.value)}
                                                        aria-pressed={penColor === pen.value}
                                                        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-institutional ${
                                                            penColor === pen.value
                                                                ? 'border-institutional bg-institutional/10 dark:border-[#8b9bd6] dark:bg-[#8b9bd6]/15'
                                                                : 'border-slate-200 dark:border-slate-700'
                                                        }`}
                                                    >
                                                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: pen.value }} />
                                                        {pen.label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {/* El recuadro sigue montado al cambiar de pestaña para no perder el trazo. */}
                                        <div className={source === 'draw' ? '' : 'hidden'}>
                                            <SignaturePad
                                                color={penColor}
                                                onChange={(canvas) => {
                                                    setDrawnCanvas(canvas);
                                                    setDrawVersion((version) => version + 1);
                                                    clearResult();
                                                }}
                                            />
                                        </div>

                                        {source === 'type' && (
                                            <div className="space-y-3">
                                                <Input
                                                    value={typedName}
                                                    onChange={(e) => setTypedName(e.target.value)}
                                                    placeholder="Escribe tu nombre"
                                                    maxLength={60}
                                                    aria-label="Nombre para la firma"
                                                />
                                                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Estilo de letra">
                                                    {SIGNATURE_FONTS.map((font, index) => (
                                                        <button
                                                            key={font.label}
                                                            type="button"
                                                            role="radio"
                                                            aria-checked={typedFont === index}
                                                            onClick={() => setTypedFont(index)}
                                                            className={`truncate rounded-md border bg-white px-2 py-2 text-lg text-slate-900 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-institutional ${
                                                                typedFont === index
                                                                    ? 'border-institutional ring-1 ring-institutional dark:border-[#8b9bd6] dark:ring-[#8b9bd6]'
                                                                    : 'border-slate-200 dark:border-slate-700'
                                                            }`}
                                                            style={{ fontFamily: font.css, color: penColor }}
                                                        >
                                                            {typedName.trim() || font.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {source === 'upload' && (
                                            <div className="space-y-3">
                                                <button
                                                    type="button"
                                                    onClick={() => uploadInputRef.current?.click()}
                                                    className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-600 transition hover:border-institutional focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-institutional dark:border-slate-600"
                                                >
                                                    {signatureImage && uploadedFile ? (
                                                        <img src={signatureImage.url} alt="Firma subida" className="max-h-full max-w-full object-contain" />
                                                    ) : (
                                                        <>
                                                            <Upload className="h-5 w-5" />
                                                            Foto o escaneo de tu firma (PNG o JPG)
                                                        </>
                                                    )}
                                                </button>
                                                <input
                                                    ref={uploadInputRef}
                                                    type="file"
                                                    accept="image/png,image/jpeg,image/webp"
                                                    onChange={handleSignatureUpload}
                                                    className="hidden"
                                                />
                                                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                                                    <Checkbox checked={removeWhite} onCheckedChange={(checked) => setRemoveWhite(checked === true)} />
                                                    Quitar el fondo blanco del papel
                                                </label>
                                            </div>
                                        )}
                                        {signatureError && <p className="text-sm text-red-600 dark:text-red-400">{signatureError}</p>}
                                    </div>

                                    {mode === 'handwritten' && (
                                        <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700">
                                            <p className="text-sm font-medium text-slate-900 dark:text-white">Texto bajo la firma</p>
                                            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                                                <Checkbox checked={includeName} onCheckedChange={(checked) => setIncludeName(checked === true)} />
                                                Nombre
                                            </label>
                                            {includeName && (
                                                <Input
                                                    value={signerName}
                                                    onChange={(e) => setSignerName(e.target.value)}
                                                    placeholder="Ej: Dra. Ana Gómez"
                                                    maxLength={80}
                                                    aria-label="Nombre del firmante"
                                                />
                                            )}
                                            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                                                <Checkbox checked={includeDate} onCheckedChange={(checked) => setIncludeDate(checked === true)} />
                                                Fecha de hoy ({formatDate(new Date(), false)})
                                            </label>
                                            <Input
                                                value={extraLine}
                                                onChange={(e) => setExtraLine(e.target.value)}
                                                placeholder="Cargo o texto adicional (opcional)"
                                                maxLength={80}
                                                aria-label="Cargo o texto adicional"
                                            />
                                        </div>
                                    )}
                                </ToolCard>

                                {mode === 'certificate' && (
                                    <ToolCard title="Certificado Digital">
                                        <div className="space-y-4">
                                            <div>
                                                <Label htmlFor="certificate-button">Certificado (.pfx, .p12 o .pem) *</Label>
                                                <div className="mt-2 flex items-center gap-2">
                                                    <Button
                                                        id="certificate-button"
                                                        type="button"
                                                        variant="outline"
                                                        onClick={() => certificateInputRef.current?.click()}
                                                        className="min-w-0 flex-1 justify-start"
                                                    >
                                                        <Upload className="mr-2 h-4 w-4 flex-shrink-0" />
                                                        <span className="truncate">{certificateFile ? certificateFile.name : 'Seleccionar certificado'}</span>
                                                    </Button>
                                                </div>
                                                <input
                                                    ref={certificateInputRef}
                                                    type="file"
                                                    accept=".pfx,.p12,.pem"
                                                    onChange={handleCertificateSelect}
                                                    className="hidden"
                                                />
                                            </div>

                                            <div>
                                                <Label htmlFor="certificate-password">Contraseña del certificado</Label>
                                                <div className="relative mt-2">
                                                    <Input
                                                        id="certificate-password"
                                                        type={showCertificatePassword ? 'text' : 'password'}
                                                        value={certificatePassword}
                                                        onChange={(e) => {
                                                            setCertificatePassword(e.target.value);
                                                            setCertificate(null);
                                                        }}
                                                        onKeyDown={(e) => e.key === 'Enter' && verifyCertificate()}
                                                        autoComplete="off"
                                                        className="pr-10"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowCertificatePassword(!showCertificatePassword)}
                                                        aria-label={showCertificatePassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                                                    >
                                                        {showCertificatePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                    </button>
                                                </div>
                                            </div>

                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={verifyCertificate}
                                                disabled={!certificateFile || isVerifying}
                                                className="w-full border-institutional text-institutional hover:bg-institutional/10 dark:border-[#8b9bd6] dark:text-[#8b9bd6]"
                                            >
                                                {isVerifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BadgeCheck className="mr-2 h-4 w-4" />}
                                                Verificar certificado
                                            </Button>

                                            {certificateError && <p className="text-sm text-red-600 dark:text-red-400">{certificateError}</p>}

                                            {certificate && (
                                                <div className="space-y-1 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900 dark:border-green-800 dark:bg-green-900/20 dark:text-green-100">
                                                    <p className="font-semibold">{certificate.name}</p>
                                                    {certificate.organization && certificate.organization !== certificate.name && <p>{certificate.organization}</p>}
                                                    <p>Emitido por: {certificate.issuer}</p>
                                                    <p>Vigente hasta: {new Date(`${certificate.validTo}T12:00:00`).toLocaleDateString('es-CO')}</p>
                                                </div>
                                            )}
                                            {certificate?.selfSigned && (
                                                <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-100">
                                                    <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
                                                    <p>
                                                        Es un certificado autofirmado: sirve para comprobar que el documento no cambió, pero los lectores lo mostrarán como
                                                        "no verificado".
                                                    </p>
                                                </div>
                                            )}

                                            <div>
                                                <Label htmlFor="reason">Motivo de la firma (opcional)</Label>
                                                <Input
                                                    id="reason"
                                                    value={reason}
                                                    onChange={(e) => setReason(e.target.value)}
                                                    placeholder="Ej: Aprobación del documento"
                                                    maxLength={120}
                                                    className="mt-2"
                                                />
                                            </div>

                                            <p className="text-xs text-slate-600 dark:text-slate-400">
                                                El certificado y su contraseña se envían al servidor del hospital solo para calcular la firma y no se guardan. Para que
                                                la firma tenga validez jurídica, el certificado debe emitirlo una entidad de certificación acreditada por la ONAC.
                                            </p>
                                        </div>
                                    </ToolCard>
                                )}

                                <ToolCard title="Acciones" data-tour="actions">
                                    {pdfFile && !canSign && !isProcessing && (
                                        <p className="text-sm text-slate-600 dark:text-slate-300">
                                            {handwrittenMissing
                                                ? 'Crea tu firma para continuar.'
                                                : certificateMissing
                                                  ? 'Verifica tu certificado para continuar.'
                                                  : 'Preparando la firma...'}
                                        </p>
                                    )}
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <Button onClick={signPDF} disabled={!canSign} className="flex-1 bg-institutional hover:bg-institutional/90">
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

                        {/* Placement */}
                        {pdfFile && totalPages > 0 && (
                            <ToolCard
                                title="Ubicar la Firma"
                                description="Arrastra el recuadro hasta donde va la firma y usa la esquina para cambiar el tamaño. También puedes hacer clic en la página."
                                icon={Move}
                                className="mt-8"
                                data-tour="placement"
                            >
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPageIndex(pageIndex - 1)}
                                            disabled={pageIndex <= 0}
                                            aria-label="Página anterior"
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        <span className="min-w-28 text-center text-sm text-slate-700 dark:text-slate-200">
                                            Página {pageIndex + 1} de {totalPages}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPageIndex(pageIndex + 1)}
                                            disabled={pageIndex >= totalPages - 1}
                                            aria-label="Página siguiente"
                                        >
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    {mode === 'handwritten' && totalPages > 1 && (
                                        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                                            <Checkbox
                                                checked={allPages}
                                                onCheckedChange={(checked) => {
                                                    setAllPages(checked === true);
                                                    clearResult();
                                                }}
                                            />
                                            Poner la firma en todas las páginas (misma posición)
                                        </label>
                                    )}
                                </div>

                                <div className="flex justify-center overflow-hidden rounded-lg bg-slate-100 p-3 dark:bg-[#1d1d1e]">
                                    <div
                                        ref={pageRef}
                                        className="relative w-full max-w-[720px] cursor-crosshair touch-none select-none bg-white shadow-sm"
                                        style={pageSize ? { aspectRatio: `${pageSize.width} / ${pageSize.height}` } : undefined}
                                        onPointerDown={placeAt}
                                    >
                                        {pageImage ? (
                                            <img src={pageImage} alt={`Página ${pageIndex + 1}`} draggable={false} className="absolute inset-0 h-full w-full" />
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                                            </div>
                                        )}

                                        {stamp ? (
                                            <div
                                                role="slider"
                                                tabIndex={0}
                                                aria-label="Posición de la firma (usa las flechas para moverla)"
                                                aria-valuetext={`${Math.round(position.left * 100)}% desde la izquierda, ${Math.round(position.top * 100)}% desde arriba`}
                                                onPointerDown={startDrag('move')}
                                                onPointerMove={handleDrag}
                                                onPointerUp={endDrag}
                                                onPointerCancel={endDrag}
                                                onKeyDown={moveWithKeys}
                                                className="absolute cursor-move rounded-sm outline-2 outline-offset-2 outline-institutional outline-dashed focus-visible:outline-solid dark:outline-[#8b9bd6]"
                                                style={{
                                                    left: `${position.left * 100}%`,
                                                    top: `${position.top * 100}%`,
                                                    width: `${position.width * 100}%`,
                                                }}
                                            >
                                                <img src={stamp.url} alt="Firma" draggable={false} className="pointer-events-none block h-auto w-full" />
                                                <span
                                                    onPointerDown={startDrag('resize')}
                                                    onPointerMove={handleDrag}
                                                    onPointerUp={endDrag}
                                                    onPointerCancel={endDrag}
                                                    aria-hidden="true"
                                                    title="Cambiar tamaño"
                                                    className="absolute -right-2.5 -bottom-2.5 h-5 w-5 cursor-nwse-resize rounded-full border-2 border-white bg-institutional shadow dark:bg-[#8b9bd6]"
                                                />
                                            </div>
                                        ) : (
                                            <p className="pointer-events-none absolute inset-x-4 bottom-4 rounded-md bg-white/90 p-2 text-center text-sm text-slate-600 shadow">
                                                {mode === 'handwritten' ? 'Crea tu firma para ubicarla en la página.' : 'Preparando el sello...'}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </ToolCard>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
