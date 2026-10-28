import { useState, useRef, type ReactNode } from 'react';
import { Head } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileText, Loader2, Sparkles, AlertCircle, Copy, HelpCircle, ShieldAlert, AlignLeft, List, ClipboardList, Info, CheckCircle2 } from 'lucide-react';
import ToolPageHeader from '@/components/ToolPageHeader';
import ToolCard from '@/components/ToolCard';
import FileUploadZone from '@/components/FileUploadZone';
import axios from 'axios';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

type SummaryLength = 'short' | 'medium' | 'long';
type SummaryStyle = 'paragraphs' | 'bullets' | 'executive';

interface SummaryOptions {
    length: SummaryLength;
    language: string;
    style: SummaryStyle;
    instructions: string;
}

interface SummaryMeta {
    words: number;
    complete: boolean;
    percent: number;
    pagesUsed: number | null;
    totalPages: number | null;
}

const STYLE_OPTIONS: { value: SummaryStyle; label: string; description: string; icon: typeof AlignLeft }[] = [
    { value: 'paragraphs', label: 'Párrafos', description: 'Texto corrido para leer de principio a fin', icon: AlignLeft },
    { value: 'bullets', label: 'Puntos clave', description: 'Las ideas más importantes en viñetas', icon: List },
    { value: 'executive', label: 'Resumen ejecutivo', description: 'Propósito, puntos principales, conclusiones y recomendaciones', icon: ClipboardList },
];

const LENGTH_LABELS: Record<SummaryStyle, Record<SummaryLength, string>> = {
    paragraphs: { short: 'Breve (2-3 párrafos)', medium: 'Medio (4-6 párrafos)', long: 'Detallado (7-10 párrafos)' },
    bullets: { short: 'Breve (5-7 puntos)', medium: 'Medio (8-12 puntos)', long: 'Detallado (13-20 puntos)' },
    executive: { short: 'Breve (1-2 frases por sección)', medium: 'Medio (2-4 frases por sección)', long: 'Detallado' },
};

const ACCEPTED_EXTENSIONS = ['pdf', 'docx', 'txt'];
const MAX_INSTRUCTIONS = 500;

// Negritas (**texto**) dentro de una línea.
function renderInline(text: string): ReactNode[] {
    return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) =>
        part.startsWith('**') && part.endsWith('**') && part.length > 4
            ? <strong key={index} className="font-semibold">{part.slice(2, -2)}</strong>
            : part
    );
}

// El modelo responde en Markdown sencillo: títulos (##), viñetas (- o 1.) y negritas.
function SummaryContent({ markdown }: { markdown: string }) {
    const blocks: ReactNode[] = [];
    let list: { ordered: boolean; items: string[] } | null = null;

    const flushList = () => {
        if (!list) return;
        const { ordered, items } = list;
        const ListTag = ordered ? 'ol' : 'ul';
        blocks.push(
            <ListTag key={blocks.length} className={`${ordered ? 'list-decimal' : 'list-disc'} space-y-1.5 pl-5 marker:text-institutional`}>
                {items.map((item, index) => <li key={index} className="leading-relaxed">{renderInline(item)}</li>)}
            </ListTag>
        );
        list = null;
    };

    for (const rawLine of markdown.split('\n')) {
        const line = rawLine.trim();
        const heading = line.match(/^#{1,6}\s+(.*)$/);
        const bullet = line.match(/^[-*•]\s+(.*)$/);
        const numbered = line.match(/^\d+[.)]\s+(.*)$/);

        if (!line || /^(-{3,}|\*{3,})$/.test(line)) {
            flushList();
        } else if (heading) {
            flushList();
            blocks.push(
                <h3 key={blocks.length} className="pt-2 text-base font-semibold text-institutional first:pt-0 dark:text-[#8b9bd6]">
                    {renderInline(heading[1].replace(/\*\*/g, ''))}
                </h3>
            );
        } else if (bullet || numbered) {
            const ordered = Boolean(numbered);
            if (list && list.ordered !== ordered) flushList();
            if (!list) list = { ordered, items: [] };
            list.items.push((bullet ?? numbered)![1]);
        } else {
            flushList();
            blocks.push(<p key={blocks.length} className="leading-relaxed">{renderInline(line)}</p>);
        }
    }
    flushList();

    return <div className="space-y-3 text-sm text-slate-900 sm:text-base dark:text-white">{blocks}</div>;
}

// Para pegar en Word o en un correo sin los símbolos de Markdown.
const toPlainText = (markdown: string): string =>
    markdown
        .split('\n')
        .map(line => line.replace(/^\s*#{1,6}\s+/, '').replace(/^\s*[-*]\s+/, '• ').replace(/\*\*(.+?)\*\*/g, '$1'))
        .join('\n')
        .trim();

const describeCoverage = (meta: SummaryMeta): string => {
    if (meta.totalPages !== null && meta.pagesUsed !== null) {
        return meta.pagesUsed <= 1
            ? `Por el límite del servicio de IA solo se resumió parte de la primera página (de ${meta.totalPages}).`
            : `Por el límite del servicio de IA se resumieron las primeras ${meta.pagesUsed} de ${meta.totalPages} páginas.`;
    }
    return `Por el límite del servicio de IA se resumió aproximadamente el ${meta.percent}% inicial del documento.`;
};

export default function ResumeDocument() {
    const [file, setFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [summary, setSummary] = useState<string>('');
    const [summaryMeta, setSummaryMeta] = useState<SummaryMeta | null>(null);
    const [summaryStyle, setSummaryStyle] = useState<SummaryStyle>('paragraphs');
    const [error, setError] = useState<string>('');
    const [copied, setCopied] = useState(false);
    const [options, setOptions] = useState<SummaryOptions>({
        length: 'medium',
        language: 'es',
        style: 'paragraphs',
        instructions: ''
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
                    element: '[data-tour="left-column"]',
                    popover: {
                        title: 'Paso 1: Seleccionar Documento',
                        description: 'En esta columna, arrastra tu documento o haz clic en la zona de carga. Acepta PDF, Word (.docx) y archivos de texto (.txt) hasta 10MB. Aquí también verás el resumen generado.',
                        side: 'right',
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="options"]',
                    popover: {
                        title: 'Paso 2: Configurar Resumen',
                        description: 'Elige el tipo de resumen (párrafos, puntos clave o resumen ejecutivo), su longitud y el idioma. Si quieres, agrega indicaciones, por ejemplo: "enfócate en los costos y plazos".',
                        side: 'left',
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="actions"]',
                    popover: {
                        title: 'Paso 3: Generar Resumen',
                        description: 'Haz clic en "Generar Resumen" para procesar tu documento. El resumen aparecerá en la columna izquierda y podrás copiarlo con un solo clic. Puedes cambiar las opciones y generarlo de nuevo.',
                        side: 'left',
                        align: 'start'
                    }
                }
            ]
        });
        driverObj.drive();
    };

    const handleFileSelect = (files: FileList) => {
        const selectedFile = files[0];
        if (!selectedFile) return;

        // Se valida por extensión: en Windows el tipo MIME de .docx y .txt a veces llega vacío.
        const extension = selectedFile.name.split('.').pop()?.toLowerCase() ?? '';
        if (!ACCEPTED_EXTENSIONS.includes(extension)) {
            setError('Por favor selecciona un archivo válido (.pdf, .docx o .txt). Nota: archivos .doc antiguos no son soportados, convierte a .docx.');
            return;
        }

        // Validate file size (max 10MB)
        if (selectedFile.size > 10 * 1024 * 1024) {
            setError('El archivo es demasiado grande. Máximo 10MB permitido.');
            return;
        }

        setFile(selectedFile);
        setError('');
        setSummary('');
        setSummaryMeta(null);
    };

    const generateSummary = async () => {
        if (!file) return;

        setIsProcessing(true);
        setError('');
        setSummary('');
        setSummaryMeta(null);

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('length', options.length);
            formData.append('language', options.language);
            formData.append('style', options.style);
            formData.append('instructions', options.instructions.trim());

            const response = await axios.post('/tools/resume-document/generate', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
                },
                timeout: 180000 // el servidor puede esperar y reintentar si Groq está saturado
            });

            setSummary(response.data.summary);
            setSummaryMeta(response.data.meta ?? null);
            setSummaryStyle(options.style);

        } catch (err) {
            console.error('Error generating summary:', err);

            const axiosError = axios.isAxiosError(err) ? err : null;
            const status = axiosError?.response?.status ?? 0;
            const data = axiosError?.response?.data as { error?: string; errors?: Record<string, string[]> } | undefined;
            let errorMessage = 'Error al generar el resumen.';

            if (axiosError?.code === 'ECONNABORTED') {
                errorMessage = 'La generación del resumen está tardando demasiado. Intenta con un documento más corto.';
            } else if (data?.error) {
                errorMessage = data.error;
            } else if (status === 422 && data?.errors) {
                errorMessage = String(Object.values(data.errors).flat()[0]);
            } else if (status === 429) {
                errorMessage = 'Hiciste varias solicitudes seguidas. Espera un minuto e inténtalo de nuevo.';
            } else if (status === 419) {
                errorMessage = 'La sesión expiró. Recarga la página e inténtalo de nuevo.';
            } else if (status === 404) {
                errorMessage = 'El endpoint de resumen no está configurado. Contacta al administrador del sistema.';
            } else if (status >= 500) {
                errorMessage = 'Error en el servidor al procesar el archivo.';
            }

            setError(errorMessage);
        } finally {
            setIsProcessing(false);
        }
    };

    const copyToClipboard = async () => {
        if (!summary) return;

        try {
            await navigator.clipboard.writeText(toPlainText(summary));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Error copying to clipboard:', err);
        }
    };

    const resetTool = () => {
        setFile(null);
        setSummary('');
        setSummaryMeta(null);
        setError('');
    };

    const summaryStyleLabel = STYLE_OPTIONS.find(option => option.value === summaryStyle)?.label;

    return (
        <>
            <Head title="Resumir Documento - Evaristools" />

            <div className="min-h-screen bg-layer-base">
                <ToolPageHeader
                    title="Resumir Documento"
                    description="Genera resúmenes automáticos de documentos usando IA"
                    icon={Sparkles}
                />

                <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                    <div className="max-w-7xl mx-auto">
                        {/* Responsive: Stack vertically on mobile, 2 columns on desktop */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">

                            {/* Left Column: File Upload & Messages - Priority content on mobile */}
                            <div className="space-y-4 sm:space-y-6" data-tour="left-column">
                                {/* Privacy notice: el texto sale del hospital hacia un servicio externo */}
                                <div
                                    role="note"
                                    className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 sm:p-4 dark:border-amber-700/60 dark:bg-amber-900/20"
                                >
                                    <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700 dark:text-amber-400" />
                                    <div className="space-y-1 text-sm text-amber-900 dark:text-amber-100">
                                        <p className="font-semibold">No subas documentos con datos de pacientes</p>
                                        <p>
                                            Para generar el resumen, el texto del documento se envía a un servicio de IA externo (Groq).
                                            No uses esta herramienta con historias clínicas ni con documentos que contengan datos personales,
                                            de salud o información confidencial.
                                        </p>
                                    </div>
                                </div>

                                {/* Upload Section */}
                                {!file && (
                                    <ToolCard title="Seleccionar Documento" data-tour="upload-zone">
                                    <FileUploadZone
                                        onFileSelect={handleFileSelect}
                                        acceptedTypes=".pdf,.docx,.txt"
                                        title="Arrastra tu documento aquí"
                                        subtitle="PDF, Word (.docx) o TXT (máximo 10MB)"
                                    />
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".pdf,.docx,.txt"
                                        onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
                                        className="hidden"
                                    />
                                </ToolCard>
                                )}

                                {/* Error Message */}
                                {error && (
                                    <ToolCard title="Error">
                                        <div className="flex items-start gap-3 p-3 sm:p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                                            <p className="text-sm sm:text-base text-red-800 dark:text-red-200">{error}</p>
                                        </div>
                                    </ToolCard>
                                )}

                                {file && (
                                    <ToolCard title="Archivo Seleccionado">
                                        <div className="flex items-center justify-between p-3 sm:p-4 bg-layer-2 rounded-lg shadow-layer-1">
                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                <FileText className="h-7 w-7 sm:h-8 sm:w-8 text-institutional flex-shrink-0" />
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-medium text-sm sm:text-base text-slate-900 dark:text-white truncate">
                                                        {file.name}
                                                    </p>
                                                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                                                        {(file.size / 1024 / 1024).toFixed(2)} MB
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </ToolCard>
                                )}

                                {summary && (
                                    <ToolCard title="Resumen Generado" description={summaryStyleLabel}>
                                        <div className="space-y-3 sm:space-y-4">
                                            {summaryMeta && !summaryMeta.complete && (
                                                <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-100">
                                                    <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
                                                    <p>{describeCoverage(summaryMeta)}</p>
                                                </div>
                                            )}

                                            <div className="p-4 sm:p-6 bg-layer-2 rounded-lg shadow-layer-1">
                                                <SummaryContent markdown={summary} />
                                            </div>

                                            {summaryMeta && (
                                                <p className="text-xs text-slate-600 dark:text-slate-300">
                                                    Documento de {summaryMeta.words.toLocaleString('es-CO')} palabras · Generado con IA: revisa el resumen antes de usarlo.
                                                </p>
                                            )}

                                            <div className="flex flex-col sm:flex-row gap-3">
                                                <Button
                                                    onClick={copyToClipboard}
                                                    variant="outline"
                                                    className="flex-1"
                                                >
                                                    <Copy className="mr-2 h-4 w-4" />
                                                    {copied ? '¡Copiado!' : 'Copiar Resumen'}
                                                </Button>
                                                <Button
                                                    onClick={resetTool}
                                                    variant="outline"
                                                    className="flex-1"
                                                >
                                                    <Upload className="mr-2 h-4 w-4" />
                                                    Resumir Otro Documento
                                                </Button>
                                            </div>
                                        </div>
                                    </ToolCard>
                                )}
                            </div>

                            {/* Right Column: Options and Actions - Flows below on mobile */}
                            <div className="space-y-4 sm:space-y-6">
                                <ToolCard title="Opciones de Resumen" data-tour="options">
                                        <div className="space-y-5">
                                            {/* Style */}
                                            <div className="space-y-2">
                                                <Label id="summary-style-label">Tipo de Resumen</Label>
                                                <div role="radiogroup" aria-labelledby="summary-style-label" className="grid gap-2">
                                                    {STYLE_OPTIONS.map(({ value, label, description, icon: Icon }) => {
                                                        const selected = options.style === value;
                                                        return (
                                                            <button
                                                                key={value}
                                                                type="button"
                                                                role="radio"
                                                                aria-checked={selected}
                                                                onClick={() => setOptions({ ...options, style: value })}
                                                                className={`flex items-start gap-3 rounded-lg border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-institutional ${
                                                                    selected
                                                                        ? 'border-institutional bg-institutional/10 ring-1 ring-institutional dark:border-[#8b9bd6] dark:bg-[#8b9bd6]/15 dark:ring-[#8b9bd6]'
                                                                        : 'border-slate-200 hover:border-institutional/60 dark:border-slate-700 dark:hover:border-[#8b9bd6]/60'
                                                                }`}
                                                            >
                                                                <Icon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${selected ? 'text-institutional dark:text-[#8b9bd6]' : 'text-slate-500'}`} />
                                                                <span className="flex-1">
                                                                    <span className="block text-sm font-medium text-slate-900 dark:text-white">{label}</span>
                                                                    <span className="block text-xs text-slate-600 dark:text-slate-300">{description}</span>
                                                                </span>
                                                                {selected && <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-institutional dark:text-[#8b9bd6]" />}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Length */}
                                            <div className="space-y-2">
                                                <Label>Longitud del Resumen</Label>
                                                <Select
                                                    value={options.length}
                                                    onValueChange={(value) => setOptions({ ...options, length: value as SummaryLength })}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="short">{LENGTH_LABELS[options.style].short}</SelectItem>
                                                        <SelectItem value="medium">{LENGTH_LABELS[options.style].medium}</SelectItem>
                                                        <SelectItem value="long">{LENGTH_LABELS[options.style].long}</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {/* Language */}
                                            <div className="space-y-2">
                                                <Label>Idioma del Resumen</Label>
                                                <Select
                                                    value={options.language}
                                                    onValueChange={(value) => setOptions({ ...options, language: value })}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="es">Español</SelectItem>
                                                        <SelectItem value="en">Inglés</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {/* Custom instructions */}
                                            <div className="space-y-2">
                                                <Label htmlFor="summary-instructions">Indicaciones adicionales (opcional)</Label>
                                                <Textarea
                                                    id="summary-instructions"
                                                    value={options.instructions}
                                                    maxLength={MAX_INSTRUCTIONS}
                                                    rows={3}
                                                    placeholder="Ej.: enfócate en los costos y plazos, o resalta las responsabilidades de cada área"
                                                    onChange={(e) => setOptions({ ...options, instructions: e.target.value })}
                                                />
                                                <p className="text-right text-xs text-slate-500 dark:text-slate-400">
                                                    {options.instructions.length}/{MAX_INSTRUCTIONS}
                                                </p>
                                            </div>
                                        </div>
                                </ToolCard>

                                <ToolCard title="Acciones" data-tour="actions">
                                    <div className="space-y-3">
                                        {/* Stacked buttons on mobile, side by side on tablet+ */}
                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <Button
                                                onClick={generateSummary}
                                                disabled={isProcessing || !file}
                                                className="flex-1 bg-institutional hover:bg-institutional/90"
                                            >
                                                {isProcessing ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        Generando Resumen...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Sparkles className="mr-2 h-4 w-4" />
                                                        {summary ? 'Generar de Nuevo' : 'Generar Resumen'}
                                                    </>
                                                )}
                                            </Button>
                                            <Button
                                                onClick={resetTool}
                                                variant="outline"
                                                className="flex-1"
                                                disabled={isProcessing || !file}
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
