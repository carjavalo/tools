import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { usePermisosVista } from '@/hooks/use-permisos-vista';
import AppLayout from '@/layouts/app-layout';
import { camposParaRol } from '@/lib/roles';
import { dashboard } from '@/routes';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, useForm, usePage } from '@inertiajs/react';
import {
    BarChart3,
    CheckCircle2,
    ChevronDown,
    Eye,
    FilePlus2,
    FileSpreadsheet,
    FileText,
    LoaderCircle,
    Pencil,
    Plus,
    Save,
    Search,
    Trash2,
    UserPlus,
    X,
} from 'lucide-react';
import {
    FormEvent,
    ReactNode,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

interface Option {
    id: number;
    Nombre: string;
}

interface EspecialidadOpt {
    id: number;
    espcodser: string | null;
    Nombre: string;
}

interface SubEspecialidadOpt {
    id: number;
    cod_SubEspecialidad: string | null;
    Nombre: string;
    codespcodser: string;
}

interface MedicoOpt {
    id: number;
    name: string;
    Apellido1: string | null;
    apellido2: string | null;
}

interface CupsOpt {
    id: number;
    CodCupsHuv: string | null;
    Nombre: string;
    descrip_Normativa: string | null;
    tipofactor: string | null;
}

interface CasoListaRow {
    codrad: number;
    fecha: string | null;
    paciente: string;
    documento: string | null;
    eps: string;
    convenio: string;
    estado: string;
}

interface CotizacionServidor {
    id: number;
    tercero: string;
    estado: string;
    fecha_cotizacion: string;
    valor: string;
    observacion: string;
    adjunto_url: string | null;
}

interface CotizacionItem {
    id: number | null;
    tercero: string;
    estado: string;
    fecha_cotizacion: string;
    valor: string;
    observacion: string;
    adjunto_url: string | null;
    file: File | null;
}

interface PageProps {
    especialidades: EspecialidadOpt[];
    subespecialidades: SubEspecialidadOpt[];
    medicos: MedicoOpt[];
    estados: Option[];
    estadosSecundarios: Option[];
    tiposDocumento: Option[];
    epsList: Option[];
    rolesList: Option[];
    especialidadesFiltro: { espcodser: string | null; Nombre: string }[];
    subespecialidadesFiltro: {
        cod_SubEspecialidad: string | null;
        Nombre: string;
        codespcodser: string;
    }[];
    defaultEstadoId: number | null;
    today: string;
    puedeGestionarCotizaciones: boolean;
    muestraGrillaCasos: boolean;
    casosLista: CasoListaRow[];
}

interface PacienteInfo {
    tipo_Docu: string;
    nombre: string;
    telefonos: string;
    eps: string;
}

interface ConvenioOpt {
    id: number;
    nit_Convenio: string;
    nombre: string;
    regimen: string;
    tarifa: string;
}

interface ProcDetalle {
    cusv_id: number;
    codigo: string;
    descripcion: string;
    encontrada: boolean;
    N_Autorizacion: string | null;
}

interface CasoDetalle {
    codrad: number;
    paciente: string;
    tipo_Docu: string;
    Ndocumento: string;
    telefonos: string;
    eps: string;
    convenio: string;
    especialidad: string;
    subespecialidad: string;
    medico: string;
    fechaRecibido: string | null;
    estadoActual: string;
    copago: boolean;
    valorCopago: string | number | null;
    paquete: string | null;
    paqueteUrl: string | null;
    codMed: string | null;
    estRad: string | null;
    fecreci: string | null;
    entregaProg: string | null;
    fechaAutorizacion: string | null;
    vencimientoAut: string | null;
    ObservacionTFX: string | null;
    procedimientos: ProcDetalle[];
    autorizaciones: string[];
    cotizaciones: CotizacionServidor[];
}

interface InformeRow {
    // Cadena porque una fila puede venir de la bitácora (T), de un
    // seguimiento (S) o de la radicación sin movimientos (C).
    id: string;
    codrad: number;
    tipo: string;
    campo: string;
    anterior: string;
    nuevo: string;
    documento: string;
    paciente: string;
    fechaRecibido: string | null;
    estado: string;
    copago: boolean;
    valorCopago: string | number | null;
    paqueteUrl: string | null;
    medico: string;
    especialidad: string;
    motivo: string;
    estadoSecundario: string;
    subespecialidad: string;
    fechaRecibidoDev: string | null;
    vencAnestesia: string | null;
    observacion: string | null;
    estadoQx: string;
    usuario: string;
    modificadoEn: string | null;
}

type ProcRow = { cusv_id: string; N_Autorizacion: string };

type RadicarForm = {
    Codesp: string;
    codsubesp: string;
    codMed: string;
    Ndocumento: string;
    convenio: string;
    estRad: string;
    copago: boolean;
    valor_copago: string;
    paquete: File | null;
    fentregapro: string;
    estcod: string;
    fecAutorizacion: string;
    fechavenautorizacion: string;
    ObservacionTFX: string;
    ObservacionCCX: string;
    procedimientos: ProcRow[];
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Inicio', href: dashboard().url },
    { title: 'Radicar Solicitud', href: '/tools/radicar-solicitud' },
];

const BRAND = '#2d3e83';

const EMPTY_USUARIO = {
    name: '',
    rol: 'paciente',
    Apellido1: '',
    apellido2: '',
    tipo_Docu: '',
    Numero_D: '',
    email: '',
    Telefono1: '',
    telefono2: '',
    Direccion: '',
    Eps: '',
    codesp: '',
    password: '',
    password_confirmation: '',
};

const EMPTY_ESPECIALIDAD = {
    espcodser: '',
    codminsal: '',
    Nombre: '',
    Observacion: '',
};

const EMPTY_SEG = {
    // Estado actual del caso: el mismo campo de Nueva Radicación.
    estRad: '',
    codsubesp: '',
    fecreci: '',
    venc_anestesia: '',
    estado_qx: '',
    ObservacionCCX: '',
};

const EMPTY_INF = {
    fechaInicial: '',
    fechaFinal: '',
    consecutivo: '',
    documento: '',
    medico: '',
    especialidad: '',
    subespecialidad: '',
    estado: '',
};

/** Muestra un monto en pesos; '—' cuando no hay valor. */
function formatoMoneda(valor: string | number | null | undefined): string {
    if (valor === null || valor === undefined || valor === '') return '—';
    const n = Number(valor);
    if (Number.isNaN(n)) return String(valor);

    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
    }).format(n);
}

/**
 * Convierte una respuesta fallida en un mensaje que diga qué pasó.
 *
 * Un texto genérico obliga a ir al log del servidor para saber si fue la
 * sesión, el tamaño del archivo o un error de la aplicación; aquí se
 * distinguen los casos que el usuario puede resolver por su cuenta.
 */
async function mensajeDeError(r: Response): Promise<string> {
    if (r.status === 419) {
        return 'Tu sesión expiró. Recarga la página (F5) e intenta de nuevo.';
    }
    if (r.status === 413) {
        return 'El archivo es demasiado grande para el servidor. Sube un PDF más liviano o pide que aumenten el límite de subida.';
    }
    if (r.status === 403) {
        return 'No tienes permiso para realizar esta acción.';
    }
    if (r.status === 401) {
        return 'Tu sesión se cerró. Vuelve a iniciar sesión.';
    }

    // El servidor puede responder JSON con un mensaje útil.
    try {
        const d = await r.clone().json();
        if (typeof d?.message === 'string' && d.message !== '') {
            return `${d.message} (error ${r.status})`;
        }
    } catch {
        // La respuesta no era JSON: se usa el mensaje por código.
    }

    if (r.status >= 500) {
        return `El servidor respondió con un error ${r.status}. Revisa storage/logs/laravel.log para el detalle.`;
    }

    return `No fue posible completar la operación (error ${r.status}).`;
}

/** Lee el token XSRF de la cookie para enviarlo en peticiones POST por fetch. */
function getXsrfToken(): string {
    const m = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : '';
}

/**
 * Combobox digitable de Código CUPS: busca en la tabla cups (por código o
 * nombre) contra el servidor mientras el usuario escribe.
 */
function CupsCombobox({
    selectedLabel,
    onSelect,
}: {
    selectedLabel: string;
    onSelect: (c: CupsOpt) => void;
}) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<CupsOpt[]>([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (ev: MouseEvent) => {
            if (ref.current && !ref.current.contains(ev.target as Node)) {
                setOpen(false);
                setQuery('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        const q = query.trim();
        if (q.length < 2) {
            setResults([]);
            return;
        }
        const timer = setTimeout(() => {
            setLoading(true);
            fetch(
                `/tools/radicar-solicitud/buscar-cups?q=${encodeURIComponent(q)}`,
                { headers: { Accept: 'application/json' } },
            )
                .then((r) => r.json())
                .then((d) => setResults(d.cups ?? []))
                .catch(() => setResults([]))
                .finally(() => setLoading(false));
        }, 300);
        return () => clearTimeout(timer);
    }, [query]);

    return (
        <div ref={ref} className="relative lg:w-44">
            <Input
                value={open ? query : selectedLabel}
                onFocus={() => setOpen(true)}
                onChange={(e) => {
                    setQuery(e.target.value);
                    setOpen(true);
                }}
                placeholder={open ? 'Digite código o nombre…' : 'Código CUPS *'}
            />
            {open && (
                <div className="absolute z-50 mt-1 max-h-64 w-[30rem] max-w-[85vw] overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
                    {query.trim().length < 2 ? (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">
                            Digite al menos 2 caracteres del código o nombre del
                            CUPS.
                        </div>
                    ) : loading ? (
                        <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
                            <LoaderCircle className="size-3.5 animate-spin" />
                            Buscando…
                        </div>
                    ) : results.length === 0 ? (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">
                            No se encontraron CUPS con «{query.trim()}».
                        </div>
                    ) : (
                        results.map((c) => (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                    onSelect(c);
                                    setOpen(false);
                                    setQuery('');
                                }}
                                className="flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
                            >
                                <span className="mt-0.5 inline-flex shrink-0 rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-medium text-foreground">
                                    {c.CodCupsHuv ?? '—'}
                                </span>
                                <span className="min-w-0">
                                    <span className="block truncate text-foreground">
                                        {c.Nombre}
                                    </span>
                                    {c.descrip_Normativa && (
                                        <span className="block truncate text-xs text-muted-foreground">
                                            {c.descrip_Normativa}
                                        </span>
                                    )}
                                </span>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

/** Campo con etiqueta en mayúsculas (estilo del mockup). */
function Field({
    label,
    children,
    className = '',
    action,
}: {
    label: string;
    children: ReactNode;
    className?: string;
    action?: ReactNode;
}) {
    return (
        <div className={`grid gap-1.5 ${className}`}>
            <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                {label}
                {action}
            </span>
            {children}
        </div>
    );
}

/** Dato de solo lectura (etiqueta + valor) para el historial. */
function Dato({
    label,
    value,
    className = '',
}: {
    label: string;
    value: ReactNode;
    className?: string;
}) {
    return (
        <div className={className}>
            <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                {label}
            </div>
            <div className="text-sm font-medium text-foreground">
                {value || '—'}
            </div>
        </div>
    );
}

export default function RadicarSolicitud({
    especialidades,
    subespecialidades,
    medicos,
    estados,
    estadosSecundarios,
    tiposDocumento,
    epsList,
    rolesList,
    especialidadesFiltro,
    subespecialidadesFiltro,
    defaultEstadoId,
    today,
    puedeGestionarCotizaciones,
    muestraGrillaCasos,
    casosLista,
}: PageProps) {
    const { flash, auth } = usePage<SharedData>().props;
    const esSuperAdmin = auth?.user?.rol === 'Super Admin';
    const accionesRadicar = usePermisosVista('radicar-solicitud');
    const [tab, setTab] = useState<'nueva' | 'historial' | 'informes'>('nueva');
    const [paciente, setPaciente] = useState<PacienteInfo | null>(null);
    const [acuerdos, setAcuerdos] = useState<CupsOpt[]>([]);
    const [convenios, setConvenios] = useState<ConvenioOpt[]>([]);
    const [casoCreado, setCasoCreado] = useState<number | null>(null);
    const [crearOpen, setCrearOpen] = useState(false);
    // Origen del modal: 'paciente' (botón + de Identificación) o 'medico'
    // (botón + de Médico). Define qué se hace con el usuario ya creado.
    const [modoUsuario, setModoUsuario] = useState<'paciente' | 'medico'>(
        'paciente',
    );
    // Lista de médicos del selector: parte de la prop del servidor y crece
    // cuando se crea uno desde el modal, sin recargar la página.
    const [medicosList, setMedicosList] = useState<MedicoOpt[]>(medicos);
    // Igual para las especialidades: alimenta el combobox de Especialidad y el
    // selector de especialidad del modal de médicos.
    const [especialidadesList, setEspecialidadesList] =
        useState<EspecialidadOpt[]>(especialidades);
    const [espCrearOpen, setEspCrearOpen] = useState(false);
    const [espCreando, setEspCreando] = useState(false);
    const [espErrors, setEspErrors] = useState<Record<string, string>>({});
    const [nuevaEsp, setNuevaEsp] = useState({ ...EMPTY_ESPECIALIDAD });
    const [nuevoUsuario, setNuevoUsuario] = useState({ ...EMPTY_USUARIO });
    // Campos que se piden según el rol elegido en el modal de usuario.
    const camposUsuario = camposParaRol(nuevoUsuario.rol);
    const [userErrors, setUserErrors] = useState<Record<string, string>>({});
    const [creando, setCreando] = useState(false);
    // Id del usuario en edición (null = modo creación de un nuevo usuario).
    const [editandoId, setEditandoId] = useState<number | null>(null);
    // Historial / Búsqueda
    const [histQuery, setHistQuery] = useState('');
    const [caso, setCaso] = useState<CasoDetalle | null>(null);
    const [histLoading, setHistLoading] = useState(false);
    const [histError, setHistError] = useState<string | null>(null);
    const [seg, setSeg] = useState({ ...EMPTY_SEG });
    const [aplicando, setAplicando] = useState(false);
    const [segOk, setSegOk] = useState(false);
    const [borrarOpen, setBorrarOpen] = useState(false);
    // Modificar radicado (botón del Historial)
    const [modifOpen, setModifOpen] = useState(false);
    const [modifSaving, setModifSaving] = useState(false);
    const [modifError, setModifError] = useState<string | null>(null);
    const [modif, setModif] = useState({
        codMed: '',
        estRad: '',
        copago: false,
        valor_copago: '',
        paquete: null as File | null,
        fentregapro: '',
        fecreci: '',
        fecAutorizacion: '',
        fechavenautorizacion: '',
        ObservacionTFX: '',
        procedimientos: [] as ProcRow[],
    });
    const [borrando, setBorrando] = useState(false);
    const [histOk, setHistOk] = useState<string | null>(null);
    // Cotizaciones de conceptos no convenidos
    const [cotRows, setCotRows] = useState<CotizacionItem[]>([]);
    const [cotSaving, setCotSaving] = useState(false);
    const [cotOk, setCotOk] = useState(false);
    const [cotError, setCotError] = useState<string | null>(null);
    const [gridFilter, setGridFilter] = useState('');
    // Informes
    const [inf, setInf] = useState({ ...EMPTY_INF });
    const [infRows, setInfRows] = useState<InformeRow[] | null>(null);
    // El servidor avisa cuando recortó el informe por volumen.
    const [infTruncado, setInfTruncado] = useState(false);
    const [infLoading, setInfLoading] = useState(false);
    const [expandedObs, setExpandedObs] = useState<Set<string>>(new Set());

    const form = useForm<RadicarForm>({
        Codesp: '',
        codsubesp: '',
        codMed: '',
        Ndocumento: '',
        convenio: '',
        estRad: defaultEstadoId ? String(defaultEstadoId) : '',
        copago: false,
        valor_copago: '',
        paquete: null as File | null,
        // Se precarga con la fecha actual, igual que "Fecha Recibido (Manual)".
        fentregapro: today,
        estcod: '',
        fecAutorizacion: '',
        fechavenautorizacion: '',
        ObservacionTFX: '',
        ObservacionCCX: '',
        procedimientos: [{ cusv_id: '', N_Autorizacion: '' }],
    });

    // Búsqueda automática del paciente por documento (debounced).
    useEffect(() => {
        const doc = form.data.Ndocumento.trim();
        if (!doc) {
            setPaciente(null);
            setAcuerdos([]);
            setConvenios([]);
            return;
        }
        const timer = setTimeout(() => {
            fetch(
                `/tools/radicar-solicitud/buscar-paciente?documento=${encodeURIComponent(doc)}`,
                { headers: { Accept: 'application/json' } },
            )
                .then((r) => r.json())
                .then((d) => {
                    if (d.found) {
                        setPaciente({
                            tipo_Docu: d.tipo_Docu ?? '',
                            nombre: d.nombre ?? '',
                            telefonos: d.telefonos ?? '',
                            eps: d.eps ?? '',
                        });
                        setAcuerdos(d.acuerdos ?? []);
                        const convs: ConvenioOpt[] = d.convenios ?? [];
                        setConvenios(convs);
                        // Si la EPS tiene un solo convenio, se selecciona solo.
                        form.setData(
                            'convenio',
                            convs.length === 1 ? convs[0].nit_Convenio : '',
                        );
                    } else {
                        setPaciente(null);
                        setAcuerdos([]);
                        setConvenios([]);
                        form.setData('convenio', '');
                    }
                })
                .catch(() => {
                    setPaciente(null);
                    setAcuerdos([]);
                    setConvenios([]);
                });
        }, 400);
        return () => clearTimeout(timer);
    }, [form.data.Ndocumento]);

    // Combobox de Especialidad: el usuario digita el código (o nombre) y se
    // filtran las especialidades de la tabla en tiempo real.
    const [espQuery, setEspQuery] = useState('');
    const [espOpen, setEspOpen] = useState(false);
    const espRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (ev: MouseEvent) => {
            if (espRef.current && !espRef.current.contains(ev.target as Node)) {
                setEspOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const espFiltered = useMemo(() => {
        const q = espQuery.trim().toLowerCase();
        const list = especialidadesList.filter((e) => e.espcodser);
        if (!q) return list.slice(0, 50);
        return list
            .filter(
                (e) =>
                    String(e.espcodser).toLowerCase().includes(q) ||
                    e.Nombre.toLowerCase().includes(q),
            )
            .slice(0, 50);
    }, [especialidadesList, espQuery]);

    const selectEspecialidad = (e: EspecialidadOpt) => {
        form.setData('Codesp', String(e.espcodser));
        form.setData('codsubesp', '');
        setEspQuery(`${e.espcodser} — ${e.Nombre}`);
        setEspOpen(false);
    };

    // Combobox de Subespecialidad para el segmento de modificaciones (Historial).
    const [subQuery, setSubQuery] = useState('');
    const [subOpen, setSubOpen] = useState(false);
    const subRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (ev: MouseEvent) => {
            if (subRef.current && !subRef.current.contains(ev.target as Node)) {
                setSubOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const subFiltered = useMemo(() => {
        const q = subQuery.trim().toLowerCase();
        const list = subespecialidades.filter((s) => s.cod_SubEspecialidad);
        if (!q) return list.slice(0, 50);
        return list
            .filter(
                (s) =>
                    s.Nombre.toLowerCase().includes(q) ||
                    String(s.cod_SubEspecialidad).toLowerCase().includes(q),
            )
            .slice(0, 50);
    }, [subespecialidades, subQuery]);

    const selectSubSeg = (s: SubEspecialidadOpt) => {
        setSeg((prev) => ({
            ...prev,
            codsubesp: String(s.cod_SubEspecialidad),
        }));
        setSubQuery(s.Nombre);
        setSubOpen(false);
    };

    // Catálogo local de CUPS seleccionados en el bloque de procedimientos
    // (los resultados del combobox se registran aquí para resolver nombre,
    // descripción normativa y factor por id).
    const [cupsCatalogo, setCupsCatalogo] = useState<Record<string, CupsOpt>>(
        {},
    );

    const cupsDe = (id: string): CupsOpt | undefined =>
        cupsCatalogo[id] ?? acuerdos.find((c) => String(c.id) === id);

    const cupsNombre = (id: string) => cupsDe(id)?.Nombre ?? '';

    const cupsInfo = (id: string) => {
        const c = cupsDe(id);
        if (!c) return '';
        const partes: string[] = [];
        if (c.tipofactor) partes.push(`Factor: ${c.tipofactor}`);
        return partes.join(' · ');
    };

    const setProc = (i: number, key: keyof ProcRow, value: string) =>
        form.setData(
            'procedimientos',
            form.data.procedimientos.map((p, idx) =>
                idx === i ? { ...p, [key]: value } : p,
            ),
        );

    const addProc = () =>
        form.setData('procedimientos', [
            ...form.data.procedimientos,
            { cusv_id: '', N_Autorizacion: '' },
        ]);

    const removeProc = (i: number) =>
        form.setData(
            'procedimientos',
            form.data.procedimientos.filter((_, idx) => idx !== i),
        );

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.transform((data) => ({
            ...data,
            // Se envían los renglones con algún dato; el Código CUPS es obligatorio,
            // por eso un renglón con autorización pero sin CUPS se marca como error.
            procedimientos: data.procedimientos
                .filter((p) => p.cusv_id || p.N_Autorizacion)
                .map((p) => ({
                    cusv_id: p.cusv_id ? Number(p.cusv_id) : null,
                    N_Autorizacion: p.N_Autorizacion,
                })),
        }));
        form.post('/tools/radicar-solicitud', {
            preserveScroll: true,
            onSuccess: (page) => {
                const num = (page.props.flash as SharedData['flash'])
                    ?.casoRadicado;
                setCasoCreado(num ?? null);
                setPaciente(null);
                setEspQuery('');
                form.reset();
            },
        });
    };

    const setU = (campo: string, valor: string) =>
        setNuevoUsuario((prev) => ({ ...prev, [campo]: valor }));

    // Si el servidor manda listas nuevas, se adoptan.
    useEffect(() => {
        setMedicosList(medicos);
    }, [medicos]);

    useEffect(() => {
        setEspecialidadesList(especialidades);
    }, [especialidades]);

    // Botón + del campo Especialidad: abre el modal con lo ya digitado en el
    // combobox precargado como nombre, para no volver a escribirlo.
    const openCrearEspecialidad = () => {
        setEspErrors({});
        setNuevaEsp({ ...EMPTY_ESPECIALIDAD, Nombre: espQuery.trim() });
        setEspCrearOpen(true);
        setEspOpen(false);
    };

    const submitNuevaEspecialidad = (e: FormEvent) => {
        e.preventDefault();
        setEspCreando(true);
        setEspErrors({});
        fetch('/tools/radicar-solicitud/crear-especialidad', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'X-XSRF-TOKEN': getXsrfToken(),
            },
            body: JSON.stringify(nuevaEsp),
        })
            .then(async (r) => {
                if (r.status === 422) {
                    const data = await r.json();
                    const errs: Record<string, string> = {};
                    Object.entries(data.errors ?? {}).forEach(([k, v]) => {
                        errs[k] = Array.isArray(v) ? String(v[0]) : String(v);
                    });
                    setEspErrors(errs);
                    return null;
                }
                return r.ok ? r.json() : null;
            })
            .then((d) => {
                if (!d || !d.found) return;
                const esp: EspecialidadOpt = d.especialidad;
                // Entra a la lista y queda seleccionada en la radicación.
                setEspecialidadesList((prev) => [
                    ...prev.filter((x) => x.id !== esp.id),
                    esp,
                ]);
                selectEspecialidad(esp);
                setEspCrearOpen(false);
                setNuevaEsp({ ...EMPTY_ESPECIALIDAD });
            })
            .finally(() => setEspCreando(false));
    };

    // Botón + del campo Médico: abre el mismo modal de crear usuario, ya
    // posicionado en el rol Medico. Siempre es creación (no hay cédula que
    // buscar como en Identificación).
    const openCrearMedico = () => {
        setUserErrors({});
        setEditandoId(null);
        setModoUsuario('medico');
        setNuevoUsuario({ ...EMPTY_USUARIO, rol: 'Medico' });
        setCrearOpen(true);
    };

    const openCrearUsuario = () => {
        setUserErrors({});
        setModoUsuario('paciente');
        const doc = form.data.Ndocumento.trim();

        // Campo de identificación vacío → crear un nuevo usuario.
        if (!doc) {
            setEditandoId(null);
            setNuevoUsuario({ ...EMPTY_USUARIO });
            setCrearOpen(true);
            return;
        }

        // Hay una cédula: si el usuario existe se abre en modo edición con sus
        // datos precargados; si no existe se abre en modo creación.
        fetch(
            `/tools/radicar-solicitud/editar-paciente?documento=${encodeURIComponent(doc)}`,
            { headers: { Accept: 'application/json' } },
        )
            .then((r) => r.json())
            .then((d) => {
                if (d.found && d.usuario) {
                    setEditandoId(d.usuario.id);
                    setNuevoUsuario({
                        name: d.usuario.name ?? '',
                        rol: d.usuario.rol ?? 'paciente',
                        Apellido1: d.usuario.Apellido1 ?? '',
                        apellido2: d.usuario.apellido2 ?? '',
                        tipo_Docu: d.usuario.tipo_Docu ?? '',
                        Numero_D: d.usuario.Numero_D ?? doc,
                        email: d.usuario.email ?? '',
                        Telefono1: d.usuario.Telefono1 ?? '',
                        telefono2: d.usuario.telefono2 ?? '',
                        Direccion: d.usuario.Direccion ?? '',
                        Eps: d.usuario.Eps ?? '',
                        codesp: d.usuario.codesp ?? '',
                        password: '',
                        password_confirmation: '',
                    });
                } else {
                    setEditandoId(null);
                    setNuevoUsuario({ ...EMPTY_USUARIO, Numero_D: doc });
                }
                setCrearOpen(true);
            })
            .catch(() => {
                setEditandoId(null);
                setNuevoUsuario({ ...EMPTY_USUARIO, Numero_D: doc });
                setCrearOpen(true);
            });
    };

    const submitNuevoUsuario = (e: FormEvent) => {
        e.preventDefault();
        setCreando(true);
        setUserErrors({});
        const esEdicion = editandoId !== null;
        const url = esEdicion
            ? `/tools/radicar-solicitud/paciente/${editandoId}`
            : '/tools/radicar-solicitud/crear-paciente';
        fetch(url, {
            method: esEdicion ? 'PUT' : 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'X-XSRF-TOKEN': getXsrfToken(),
            },
            body: JSON.stringify(nuevoUsuario),
        })
            .then(async (r) => {
                if (r.status === 422) {
                    const data = await r.json();
                    const errs: Record<string, string> = {};
                    Object.entries(data.errors ?? {}).forEach(([k, v]) => {
                        errs[k] = Array.isArray(v) ? String(v[0]) : String(v);
                    });
                    setUserErrors(errs);
                    return null;
                }
                return r.ok ? r.json() : null;
            })
            .then((d) => {
                if (!d || !d.found) return;

                // Modal abierto desde el campo Médico y el usuario guardado es
                // un médico: entra al selector y queda seleccionado, sin tocar
                // los datos del paciente de la radicación.
                if (modoUsuario === 'medico' && d.rol === 'Medico') {
                    const medico: MedicoOpt = {
                        id: d.id,
                        name: d.nombres ?? '',
                        Apellido1: d.apellido1 ?? '',
                        apellido2: d.apellido2 ?? '',
                    };
                    setMedicosList((prev) => [
                        ...prev.filter((m) => m.id !== medico.id),
                        medico,
                    ]);
                    form.setData('codMed', String(medico.id));
                    setCrearOpen(false);
                    setEditandoId(null);
                    setNuevoUsuario({ ...EMPTY_USUARIO });
                    return;
                }

                // Flujo de paciente: se carga en la radicación.
                setPaciente({
                    tipo_Docu: d.tipo_Docu ?? '',
                    nombre: d.nombre ?? '',
                    telefonos: d.telefonos ?? '',
                    eps: d.eps ?? '',
                });
                setAcuerdos(d.acuerdos ?? []);
                const convs: ConvenioOpt[] = d.convenios ?? [];
                setConvenios(convs);
                form.setData(
                    'convenio',
                    convs.length === 1 ? convs[0].nit_Convenio : '',
                );
                if (d.documento) form.setData('Ndocumento', d.documento);
                setCrearOpen(false);
                setEditandoId(null);
                setNuevoUsuario({ ...EMPTY_USUARIO });
            })
            .finally(() => setCreando(false));
    };

    const consultarCaso = (qOverride?: string) => {
        const q = (qOverride ?? histQuery).trim();
        if (!q) return;
        setHistLoading(true);
        setHistError(null);
        setHistOk(null);
        setSegOk(false);
        fetch(
            `/tools/radicar-solicitud/buscar-caso?q=${encodeURIComponent(q)}`,
            { headers: { Accept: 'application/json' } },
        )
            .then((r) => r.json())
            .then((d) => {
                if (d.found) {
                    setCaso(d.caso);
                    setSeg({ ...EMPTY_SEG });
                    setSubQuery('');
                } else {
                    setCaso(null);
                    setHistError(
                        'No se encontró ningún caso con ese consecutivo o cédula.',
                    );
                }
            })
            .catch(() => setHistError('Ocurrió un error al consultar.'))
            .finally(() => setHistLoading(false));
    };

    const setSegField = (campo: string, valor: string) =>
        setSeg((prev) => ({ ...prev, [campo]: valor }));

    // ----- Modificar radicado (botón del Historial) -----

    const abrirModificarRadicado = () => {
        if (!caso) return;
        setModif({
            codMed: caso.codMed ?? '',
            estRad: caso.estRad ?? '',
            copago: caso.copago ?? false,
            valor_copago:
                caso.valorCopago != null ? String(caso.valorCopago) : '',
            // Solo se manda si el usuario sube uno nuevo; de lo contrario el
            // caso conserva el PDF que ya tenía.
            paquete: null,
            fentregapro: caso.entregaProg ?? '',
            fecreci: caso.fecreci ?? '',
            fecAutorizacion: caso.fechaAutorizacion ?? '',
            fechavenautorizacion: caso.vencimientoAut ?? '',
            ObservacionTFX: caso.ObservacionTFX ?? '',
            procedimientos: caso.procedimientos.map((p) => ({
                cusv_id: String(p.cusv_id),
                N_Autorizacion: p.N_Autorizacion ?? '',
            })),
        });
        // Los CUPS actuales del caso se registran en el catálogo local para
        // que el modal muestre sus códigos y descripciones.
        setCupsCatalogo((prev) => {
            const copia = { ...prev };
            for (const p of caso.procedimientos) {
                if (!copia[String(p.cusv_id)]) {
                    copia[String(p.cusv_id)] = {
                        id: p.cusv_id,
                        CodCupsHuv: p.codigo,
                        Nombre: p.descripcion,
                        descrip_Normativa: null,
                        tipofactor: null,
                    };
                }
            }
            return copia;
        });
        setModifError(null);
        setModifOpen(true);
    };

    const setModifField = (campo: string, valor: string) =>
        setModif((prev) => ({ ...prev, [campo]: valor }));

    const setModifProc = (i: number, campo: keyof ProcRow, valor: string) =>
        setModif((prev) => ({
            ...prev,
            procedimientos: prev.procedimientos.map((p, idx) =>
                idx === i ? { ...p, [campo]: valor } : p,
            ),
        }));

    const addModifProc = () =>
        setModif((prev) => ({
            ...prev,
            procedimientos: [
                ...prev.procedimientos,
                { cusv_id: '', N_Autorizacion: '' },
            ],
        }));

    const removeModifProc = (i: number) =>
        setModif((prev) => ({
            ...prev,
            procedimientos: prev.procedimientos.filter((_, idx) => idx !== i),
        }));

    const guardarRadicado = () => {
        if (!caso) return;
        setModifSaving(true);
        setModifError(null);

        // Va como multipart porque puede llevar el PDF del paquete. PHP no
        // interpreta el cuerpo de un PUT multipart, así que se envía por POST
        // con _method=PUT y Laravel lo enruta al método de actualización.
        const fd = new FormData();
        fd.append('_method', 'PUT');
        fd.append('codMed', modif.codMed);
        fd.append('estRad', modif.estRad);
        fd.append('copago', modif.copago ? '1' : '0');
        if (modif.copago) {
            fd.append('valor_copago', modif.valor_copago);
        }
        fd.append('fentregapro', modif.fentregapro);
        fd.append('fecreci', modif.fecreci);
        fd.append('fecAutorizacion', modif.fecAutorizacion);
        fd.append('fechavenautorizacion', modif.fechavenautorizacion);
        fd.append('ObservacionTFX', modif.ObservacionTFX);
        if (modif.paquete) {
            fd.append('paquete', modif.paquete);
        }
        // Se descartan renglones de CUPS sin código seleccionado.
        modif.procedimientos
            .filter((p) => p.cusv_id !== '')
            .forEach((p, i) => {
                fd.append(`procedimientos[${i}][cusv_id]`, p.cusv_id);
                fd.append(
                    `procedimientos[${i}][N_Autorizacion]`,
                    p.N_Autorizacion,
                );
            });

        fetch(`/tools/radicar-solicitud/${caso.codrad}`, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'X-XSRF-TOKEN': getXsrfToken(),
            },
            body: fd,
        })
            .then(async (r) => {
                if (r.status === 422) {
                    const d = await r.json();
                    const primero = Object.values(
                        (d.errors ?? {}) as Record<string, string[]>,
                    )[0]?.[0];
                    setModifError(primero ?? 'Revisa los datos del radicado.');
                    return null;
                }
                if (!r.ok) {
                    setModifError(await mensajeDeError(r));
                    return null;
                }
                return r.json();
            })
            .then((d) => {
                if (d && d.ok) {
                    setCaso(d.caso);
                    setModifOpen(false);
                    setHistOk(
                        `Radicado #${d.caso.codrad} modificado correctamente.`,
                    );
                }
            })
            .catch(() => setModifError('No fue posible modificar el radicado.'))
            .finally(() => setModifSaving(false));
    };

    // ----- Cotizaciones de conceptos no convenidos -----

    const nuevaCotizacion = (): CotizacionItem => ({
        id: null,
        tercero: '',
        estado: '',
        fecha_cotizacion: today,
        valor: '',
        observacion: '',
        adjunto_url: null,
        file: null,
    });

    // Al cargar un caso, se cargan sus cotizaciones guardadas (o una fila
    // vacía para empezar a cotizar).
    useEffect(() => {
        setCotOk(false);
        setCotError(null);
        if (!caso) {
            setCotRows([]);
            return;
        }
        const guardadas = (caso.cotizaciones ?? []).map((c) => ({
            ...c,
            id: c.id as number | null,
            file: null,
        }));
        setCotRows(guardadas.length ? guardadas : [nuevaCotizacion()]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [caso?.codrad]);

    const setCotField = (
        i: number,
        campo: keyof CotizacionItem,
        valor: string | File | null,
    ) =>
        setCotRows((prev) =>
            prev.map((r, idx) => (idx === i ? { ...r, [campo]: valor } : r)),
        );

    const addCotRow = () => setCotRows((prev) => [...prev, nuevaCotizacion()]);

    const removeCotRow = (i: number) =>
        setCotRows((prev) => prev.filter((_, idx) => idx !== i));

    const totalCotizado = cotRows.reduce(
        (sum, r) => sum + (Number(r.valor) || 0),
        0,
    );

    const fmtCOP = (n: number) =>
        n.toLocaleString('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        });

    const guardarCotizaciones = () => {
        if (!caso) return;
        // Se descartan filas totalmente vacías.
        const filas = cotRows.filter(
            (r) =>
                r.id !== null ||
                r.tercero.trim() !== '' ||
                r.valor.trim() !== '' ||
                r.observacion.trim() !== '' ||
                r.file !== null,
        );
        if (filas.length === 0) {
            setCotError('Agregue al menos un concepto para cotizar.');
            return;
        }
        const incompleta = filas.find(
            (r) => r.tercero.trim() === '' || r.valor.trim() === '',
        );
        if (incompleta) {
            setCotError(
                'Cada concepto debe tener tercero/proveedor y valor de cotización.',
            );
            return;
        }

        const fd = new FormData();
        filas.forEach((r, i) => {
            if (r.id !== null) {
                fd.append(`cotizaciones[${i}][id]`, String(r.id));
            }
            fd.append(`cotizaciones[${i}][tercero]`, r.tercero.trim());
            fd.append(`cotizaciones[${i}][estado]`, r.estado);
            fd.append(
                `cotizaciones[${i}][fecha_cotizacion]`,
                r.fecha_cotizacion || today,
            );
            fd.append(`cotizaciones[${i}][valor]`, r.valor);
            fd.append(`cotizaciones[${i}][observacion]`, r.observacion);
            if (r.file) {
                fd.append(`cotizaciones[${i}][adjunto]`, r.file);
            }
        });

        setCotSaving(true);
        setCotOk(false);
        setCotError(null);
        fetch(`/tools/radicar-solicitud/${caso.codrad}/cotizaciones`, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'X-XSRF-TOKEN': getXsrfToken(),
            },
            body: fd,
        })
            .then(async (r) => {
                if (r.status === 422) {
                    const d = await r.json();
                    const primero = Object.values(
                        (d.errors ?? {}) as Record<string, string[]>,
                    )[0]?.[0];
                    setCotError(
                        primero ?? 'Revisa los datos de la cotización.',
                    );
                    return null;
                }
                if (!r.ok) {
                    setCotError(await mensajeDeError(r));
                    return null;
                }
                return r.json();
            })
            .then((d) => {
                if (d && d.ok) {
                    setCotRows(
                        (d.cotizaciones as CotizacionServidor[]).map((c) => ({
                            ...c,
                            id: c.id as number | null,
                            file: null,
                        })),
                    );
                    setCaso((prev) =>
                        prev ? { ...prev, cotizaciones: d.cotizaciones } : prev,
                    );
                    setCotOk(true);
                } else if (d !== null) {
                    setCotError('No fue posible guardar las cotizaciones.');
                }
            })
            .catch(() =>
                setCotError('No fue posible guardar las cotizaciones.'),
            )
            .finally(() => setCotSaving(false));
    };

    const aplicarModificacion = (e: FormEvent) => {
        e.preventDefault();
        if (!caso) return;
        setAplicando(true);
        setSegOk(false);
        fetch(`/tools/radicar-solicitud/${caso.codrad}/seguimiento`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'X-XSRF-TOKEN': getXsrfToken(),
            },
            body: JSON.stringify(seg),
        })
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
                if (d && d.ok) {
                    setCaso(d.caso);
                    setSeg({ ...EMPTY_SEG });
                    setSubQuery('');
                    setSegOk(true);
                }
            })
            .finally(() => setAplicando(false));
    };

    const borrarCaso = () => {
        if (!caso) return;
        setBorrando(true);
        fetch(`/tools/radicar-solicitud/${caso.codrad}`, {
            method: 'DELETE',
            headers: {
                Accept: 'application/json',
                'X-XSRF-TOKEN': getXsrfToken(),
            },
        })
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
                if (d && d.ok) {
                    const num = caso.codrad;
                    setCaso(null);
                    setHistQuery('');
                    setBorrarOpen(false);
                    setHistOk(`El caso #${num} fue eliminado correctamente.`);
                }
            })
            .finally(() => setBorrando(false));
    };

    const setInfField = (campo: string, valor: string) =>
        setInf((prev) => ({ ...prev, [campo]: valor }));

    // Subespecialidades del filtro, dependientes de la especialidad elegida.
    const subOptionsInforme = useMemo(
        () =>
            inf.especialidad
                ? subespecialidadesFiltro.filter(
                      (s) => String(s.codespcodser) === inf.especialidad,
                  )
                : subespecialidadesFiltro,
        [subespecialidadesFiltro, inf.especialidad],
    );

    const generarInforme = (e: FormEvent) => {
        e.preventDefault();
        setInfLoading(true);
        setExpandedObs(new Set());
        const params = new URLSearchParams();
        Object.entries(inf).forEach(([k, v]) => {
            if (v) params.set(k, v);
        });
        fetch(`/tools/radicar-solicitud/informe?${params.toString()}`, {
            headers: { Accept: 'application/json' },
        })
            .then((r) => r.json())
            .then((d) => {
                setInfRows(d.rows ?? []);
                setInfTruncado(Boolean(d.truncado));
            })
            .catch(() => setInfRows([]))
            .finally(() => setInfLoading(false));
    };

    /**
     * Descarga en Excel exactamente lo que muestra la grilla: mismas columnas,
     * mismo orden y mismas filas ya filtradas. La librería se carga solo al
     * pulsar el botón para no engordar la vista.
     */
    const exportarInformeExcel = async () => {
        if (!infRows || infRows.length === 0) return;

        const XLSX = await import('xlsx');

        const filas = infRows.map((r) => ({
            'N° Caso': r.codrad,
            'Fecha Recibido': r.fechaRecibido ?? '',
            Documento: r.documento,
            Paciente: r.paciente,
            Tipo: r.tipo,
            Campo: r.campo,
            Anterior: r.anterior,
            Nuevo: r.nuevo,
            Estado: r.estado,
            Copago: r.copago ? 'Sí' : 'No',
            // Se exporta el número para poder sumarlo o filtrarlo en Excel.
            'Valor Copago':
                r.copago && r.valorCopago ? Number(r.valorCopago) : '',
            Paquete: r.paqueteUrl ? 'Sí' : 'No',
            Médico: r.medico,
            Especialidad: r.especialidad,
            Motivo: r.motivo,
            'Estado Secundario': r.estadoSecundario,
            Subespecialidad: r.subespecialidad,
            'Fec. Recibido': r.fechaRecibidoDev ?? '',
            'Venc. Anestesia': r.vencAnestesia ?? '',
            Observación: r.observacion ?? '',
            'Estado QX': r.estadoQx,
            Usuario: r.usuario,
            Modificado: r.modificadoEn ?? '',
        }));

        const hoja = XLSX.utils.json_to_sheet(filas);
        // Ancho de columna aproximado al contenido más largo de cada una.
        hoja['!cols'] = Object.keys(filas[0]).map((clave) => ({
            wch: Math.min(
                45,
                Math.max(
                    clave.length + 2,
                    ...filas.map(
                        (f) => String(f[clave as keyof typeof f] ?? '').length,
                    ),
                ),
            ),
        }));

        const libro = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(libro, hoja, 'Informe');

        const hoy = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(libro, `informe-radicaciones-${hoy}.xlsx`);
    };

    const toggleObs = (id: string) =>
        setExpandedObs((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });

    // Pestañas visibles según el Gestor de Permisos: cada pestaña se rige por
    // el permiso "ver" de su sub-vista (radicar-solicitud-*). Sin
    // configuración guardada, se permite (igual que el backend). El Super
    // Admin ve todas las pestañas, grillas y botones sin excepción.
    const permisosUsuario = auth?.permisos ?? {};
    const tabPermitida = (key: 'nueva' | 'historial' | 'informes') =>
        esSuperAdmin ||
        permisosUsuario[`radicar-solicitud-${key}`]?.ver !== false;

    // Botón "Modificar radicado": si su sub-vista está configurada en el
    // Gestor de Permisos, esa configuración manda por sí sola; sin
    // configurar, se exige el permiso de editar de Radicar Solicitud.
    const modificarCfg = permisosUsuario['radicar-solicitud-modificar'];
    const puedeModificarRadicado =
        esSuperAdmin ||
        (modificarCfg ? modificarCfg.ver : accionesRadicar.editar);

    // Formulario "Aplicar Modificaciones al Caso" (Historial): se rige por su
    // propia sub-vista del Gestor de Permisos (visible salvo que se apague).
    const puedeAplicarModificaciones =
        esSuperAdmin ||
        permisosUsuario['radicar-solicitud-seguimiento']?.ver !== false;

    const tabs = [
        { key: 'nueva' as const, label: 'NUEVA RADICACIÓN', icon: FilePlus2 },
        {
            key: 'historial' as const,
            label: 'HISTORIAL / BÚSQUEDA',
            icon: Search,
        },
        { key: 'informes' as const, label: 'INFORMES', icon: BarChart3 },
    ].filter((t) => tabPermitida(t.key));

    // Si la pestaña activa no está permitida, se pasa a la primera visible.
    useEffect(() => {
        if (!tabPermitida(tab) && tabs.length > 0) {
            setTab(tabs[0].key);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Radicar Solicitud" />

            <div className="flex h-full flex-1 flex-col gap-4 p-4 md:p-6">
                <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                    {/* Pestañas */}
                    <div className="flex flex-wrap gap-1 border-b px-3 pt-2">
                        {tabs.map((t) => {
                            const active = tab === t.key;
                            return (
                                <button
                                    key={t.key}
                                    type="button"
                                    onClick={() => setTab(t.key)}
                                    className={`flex items-center gap-2 rounded-t-lg px-4 py-3 text-sm font-semibold transition-colors ${
                                        active
                                            ? 'border-b-2 border-[#2d3e83] text-[#2d3e83] dark:border-white dark:text-white'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    <t.icon className="size-4" />
                                    {t.label}
                                </button>
                            );
                        })}
                    </div>

                    {tabs.length === 0 && (
                        <p className="p-8 text-center text-sm text-muted-foreground">
                            Tu rol no tiene pestañas habilitadas en esta opción.
                            Contacta al administrador.
                        </p>
                    )}
                    {tab === 'nueva' && tabPermitida('nueva') && (
                        <div className="p-4 md:p-6">
                            {/* Encabezado de la sección */}
                            <div className="mb-4 flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-3">
                                    <div
                                        className="flex size-10 items-center justify-center rounded-xl text-white"
                                        style={{ backgroundColor: BRAND }}
                                    >
                                        <FilePlus2 className="size-5" />
                                    </div>
                                    <h1 className="text-lg font-bold tracking-tight text-foreground">
                                        Radicación de Casos{' '}
                                        <span className="text-muted-foreground">
                                            (Multi-CUPS / Multi-Autorización)
                                        </span>
                                    </h1>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-[#2d3e83] dark:text-white">
                                        Caso N°
                                    </span>
                                    <Input
                                        readOnly
                                        value={casoCreado ?? ''}
                                        className="w-28 border-[#2d3e83]/40 text-center font-mono font-semibold"
                                        placeholder="—"
                                    />
                                </div>
                            </div>

                            {/* Banner de éxito */}
                            {casoCreado && (
                                <div className="mb-4 flex flex-col items-center justify-center gap-1 rounded-xl border border-green-200 bg-green-50 py-4 text-center dark:border-green-900 dark:bg-green-950">
                                    <div className="flex items-center gap-2 font-semibold text-green-700 dark:text-green-300">
                                        <CheckCircle2 className="size-5" />
                                        Caso Radicado Correctamente
                                    </div>
                                    <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                                        #{casoCreado}
                                    </div>
                                </div>
                            )}

                            {flash?.error && (
                                <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                                    <X className="size-5 shrink-0" />
                                    {flash.error}
                                </div>
                            )}

                            <form onSubmit={submit} className="grid gap-5">
                                {/* Fila 1 */}
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                    <Field label="Tipo Documento">
                                        <Input
                                            value={paciente?.tipo_Docu ?? ''}
                                            readOnly
                                            placeholder="—"
                                            className="bg-muted/40"
                                        />
                                    </Field>

                                    <Field
                                        label="Identificación (Cédula) *"
                                        action={
                                            <button
                                                type="button"
                                                onClick={openCrearUsuario}
                                                title="Crear un paciente nuevo, o editar el existente si la cédula ya está registrada"
                                                className="inline-flex size-5 items-center justify-center rounded-md bg-[#2d3e83]/10 text-[#2d3e83] transition-colors hover:bg-[#2d3e83]/20 dark:bg-white/10 dark:text-white"
                                            >
                                                <UserPlus className="size-3.5" />
                                            </button>
                                        }
                                    >
                                        <div className="relative">
                                            <Input
                                                value={form.data.Ndocumento}
                                                onChange={(e) =>
                                                    form.setData(
                                                        'Ndocumento',
                                                        e.target.value,
                                                    )
                                                }
                                                maxLength={20}
                                                placeholder="N° de documento"
                                                className="pr-9"
                                            />
                                            <Search className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
                                        </div>
                                        {form.errors.Ndocumento && (
                                            <span className="text-xs text-red-600">
                                                {form.errors.Ndocumento}
                                            </span>
                                        )}
                                    </Field>

                                    <Field label="Nombre del Paciente">
                                        <Input
                                            value={paciente?.nombre ?? ''}
                                            readOnly
                                            placeholder="Se completa al buscar…"
                                            className="bg-muted/40"
                                        />
                                    </Field>

                                    <Field label="Fecha Recibido (Manual)">
                                        <Input
                                            type="date"
                                            value={today}
                                            readOnly
                                            className="bg-muted/40"
                                        />
                                    </Field>
                                </div>

                                {/* Fila 2 — Paciente */}
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                    <Field
                                        label="Especialidad *"
                                        action={
                                            <button
                                                type="button"
                                                onClick={openCrearEspecialidad}
                                                title="Crear una especialidad nueva si no aparece en la lista"
                                                className="inline-flex size-5 items-center justify-center rounded-md bg-[#2d3e83]/10 text-[#2d3e83] transition-colors hover:bg-[#2d3e83]/20 dark:bg-white/10 dark:text-white"
                                            >
                                                <Plus className="size-3.5" />
                                            </button>
                                        }
                                    >
                                        <div className="relative" ref={espRef}>
                                            <Input
                                                value={espQuery}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setEspQuery(val);
                                                    setEspOpen(true);
                                                    if (form.data.Codesp) {
                                                        form.setData(
                                                            'Codesp',
                                                            '',
                                                        );
                                                        form.setData(
                                                            'codsubesp',
                                                            '',
                                                        );
                                                    }
                                                    // Si el texto coincide exactamente con un
                                                    // código, seleccionarla automáticamente.
                                                    const exact =
                                                        especialidadesList.find(
                                                            (sp) =>
                                                                sp.espcodser &&
                                                                String(
                                                                    sp.espcodser,
                                                                ).toLowerCase() ===
                                                                    val
                                                                        .trim()
                                                                        .toLowerCase(),
                                                        );
                                                    if (exact)
                                                        selectEspecialidad(
                                                            exact,
                                                        );
                                                }}
                                                onFocus={() => setEspOpen(true)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Escape') {
                                                        setEspOpen(false);
                                                    } else if (
                                                        e.key === 'Enter'
                                                    ) {
                                                        e.preventDefault();
                                                        if (
                                                            espFiltered.length >
                                                            0
                                                        )
                                                            selectEspecialidad(
                                                                espFiltered[0],
                                                            );
                                                    }
                                                }}
                                                placeholder="Digite el código o nombre…"
                                                className="pr-9"
                                                autoComplete="off"
                                            />
                                            <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
                                            {espOpen && (
                                                <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover py-1 text-popover-foreground shadow-md">
                                                    {espFiltered.length ===
                                                        0 && (
                                                        <li className="px-3 py-2 text-sm text-muted-foreground">
                                                            Sin coincidencias
                                                        </li>
                                                    )}
                                                    {espFiltered.map((e) => (
                                                        <li key={e.id}>
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    selectEspecialidad(
                                                                        e,
                                                                    )
                                                                }
                                                                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                                                            >
                                                                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold text-foreground">
                                                                    {
                                                                        e.espcodser
                                                                    }
                                                                </span>
                                                                <span>
                                                                    {e.Nombre}
                                                                </span>
                                                            </button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                        {form.errors.Codesp && (
                                            <span className="text-xs text-red-600">
                                                {form.errors.Codesp}
                                            </span>
                                        )}
                                    </Field>
                                    <Field
                                        label="Médico *"
                                        action={
                                            <button
                                                type="button"
                                                onClick={openCrearMedico}
                                                title="Crear un médico nuevo si no aparece en la lista"
                                                className="inline-flex size-5 items-center justify-center rounded-md bg-[#2d3e83]/10 text-[#2d3e83] transition-colors hover:bg-[#2d3e83]/20 dark:bg-white/10 dark:text-white"
                                            >
                                                <UserPlus className="size-3.5" />
                                            </button>
                                        }
                                    >
                                        <Select
                                            value={form.data.codMed}
                                            onValueChange={(v) =>
                                                form.setData('codMed', v)
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccione…" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {medicosList.length === 0 && (
                                                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                                        No hay médicos
                                                        registrados.
                                                    </div>
                                                )}
                                                {medicosList.map((m) => (
                                                    <SelectItem
                                                        key={m.id}
                                                        value={String(m.id)}
                                                    >
                                                        {[
                                                            m.name,
                                                            m.Apellido1,
                                                            m.apellido2,
                                                        ]
                                                            .filter(Boolean)
                                                            .join(' ')}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {form.errors.codMed && (
                                            <span className="text-xs text-red-600">
                                                {form.errors.codMed}
                                            </span>
                                        )}
                                    </Field>
                                    <Field label="Teléfonos">
                                        <Input
                                            value={paciente?.telefonos ?? ''}
                                            readOnly
                                            placeholder="—"
                                            className="bg-muted/40"
                                        />
                                    </Field>
                                </div>

                                {/* Fila 3 */}
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                    <Field label="ERP / EPS Aseguradora">
                                        <Input
                                            value={paciente?.eps ?? ''}
                                            readOnly
                                            placeholder="—"
                                            className="bg-muted/40"
                                        />
                                    </Field>
                                    <Field label="Convenio *">
                                        <Select
                                            value={form.data.convenio}
                                            onValueChange={(v) =>
                                                form.setData('convenio', v)
                                            }
                                            disabled={convenios.length === 0}
                                        >
                                            <SelectTrigger>
                                                <SelectValue
                                                    placeholder={
                                                        paciente
                                                            ? convenios.length ===
                                                              0
                                                                ? 'La EPS no tiene convenios'
                                                                : 'Seleccione…'
                                                            : '—'
                                                    }
                                                />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {convenios.map((c) => (
                                                    <SelectItem
                                                        key={c.id}
                                                        value={c.nit_Convenio}
                                                    >
                                                        {[
                                                            c.nombre,
                                                            c.regimen,
                                                            c.tarifa
                                                                ? `Tarifa ${c.tarifa}`
                                                                : '',
                                                        ]
                                                            .filter(Boolean)
                                                            .join(' · ')}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {form.errors.convenio && (
                                            <span className="text-xs text-red-600">
                                                {form.errors.convenio}
                                            </span>
                                        )}
                                    </Field>
                                    <Field label="Estado Actual *">
                                        <Select
                                            value={form.data.estRad}
                                            onValueChange={(v) =>
                                                form.setData('estRad', v)
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccione…" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {estados.map((s) => (
                                                    <SelectItem
                                                        key={s.id}
                                                        value={String(s.id)}
                                                    >
                                                        {s.Nombre}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {form.errors.estRad && (
                                            <span className="text-xs text-red-600">
                                                {form.errors.estRad}
                                            </span>
                                        )}
                                    </Field>
                                    <Field label="Entrega a Programación *">
                                        <Input
                                            type="date"
                                            value={form.data.fentregapro}
                                            readOnly
                                            className="bg-muted/40"
                                        />
                                        {form.errors.fentregapro && (
                                            <span className="text-xs text-red-600">
                                                {form.errors.fentregapro}
                                            </span>
                                        )}
                                    </Field>
                                    {/*
                                        Estado Secundario no se diligencia en
                                        esta vista: lo registra otro rol desde
                                        el seguimiento del caso.
                                    */}
                                </div>

                                {/* Fila 4 */}
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                    {/*
                                        Fecha Recibido no se
                                        diligencia en esta vista: la registra
                                        otro rol desde el seguimiento del caso.
                                    */}
                                    <Field label="Fecha Autorización *">
                                        <Input
                                            type="date"
                                            value={form.data.fecAutorizacion}
                                            onChange={(e) =>
                                                form.setData(
                                                    'fecAutorizacion',
                                                    e.target.value,
                                                )
                                            }
                                        />
                                        {form.errors.fecAutorizacion && (
                                            <span className="text-xs text-red-600">
                                                {form.errors.fecAutorizacion}
                                            </span>
                                        )}
                                    </Field>
                                    <Field label="Fecha Vencimiento Autorización *">
                                        <Input
                                            type="date"
                                            value={
                                                form.data.fechavenautorizacion
                                            }
                                            onChange={(e) =>
                                                form.setData(
                                                    'fechavenautorizacion',
                                                    e.target.value,
                                                )
                                            }
                                        />
                                        {form.errors.fechavenautorizacion && (
                                            <span className="text-xs text-red-600">
                                                {
                                                    form.errors
                                                        .fechavenautorizacion
                                                }
                                            </span>
                                        )}
                                    </Field>

                                    <Field label="Copago">
                                        <div className="flex items-center gap-3">
                                            <label className="flex h-9 cursor-pointer items-center gap-2 text-sm">
                                                <Checkbox
                                                    checked={form.data.copago}
                                                    onCheckedChange={(v) => {
                                                        const marcado =
                                                            v === true;
                                                        form.setData(
                                                            'copago',
                                                            marcado,
                                                        );
                                                        // Al desmarcar no queda
                                                        // un valor colgado.
                                                        if (!marcado) {
                                                            form.setData(
                                                                'valor_copago',
                                                                '',
                                                            );
                                                        }
                                                    }}
                                                />
                                                <span className="text-foreground">
                                                    Aplica
                                                </span>
                                            </label>
                                            {form.data.copago && (
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={
                                                        form.data.valor_copago
                                                    }
                                                    onChange={(e) =>
                                                        form.setData(
                                                            'valor_copago',
                                                            e.target.value,
                                                        )
                                                    }
                                                    placeholder="Valor"
                                                    className="flex-1"
                                                />
                                            )}
                                        </div>
                                        {form.errors.valor_copago && (
                                            <span className="text-xs text-red-600">
                                                {form.errors.valor_copago}
                                            </span>
                                        )}
                                    </Field>

                                    <Field label="Paquete (PDF, máx. 30 MB)">
                                        <Input
                                            type="file"
                                            accept="application/pdf"
                                            onChange={(e) =>
                                                form.setData(
                                                    'paquete',
                                                    e.target.files?.[0] ?? null,
                                                )
                                            }
                                            className="cursor-pointer file:mr-2 file:cursor-pointer file:rounded file:border-0 file:bg-muted file:px-2 file:py-0.5 file:text-xs"
                                        />
                                        {form.data.paquete && (
                                            <span className="truncate text-xs text-muted-foreground">
                                                {form.data.paquete.name}
                                            </span>
                                        )}
                                        {form.errors.paquete && (
                                            <span className="text-xs text-red-600">
                                                {form.errors.paquete}
                                            </span>
                                        )}
                                    </Field>
                                </div>

                                {/* Bloque de procedimientos / autorizaciones */}
                                <div className="rounded-xl border bg-muted/30 p-4">
                                    <div className="mb-1 text-xs font-bold tracking-wide text-[#2d3e83] uppercase dark:text-white">
                                        Bloque de procedimientos y
                                        autorizaciones EPS
                                    </div>
                                    <div className="mb-3 text-xs text-muted-foreground">
                                        Digite el código o el nombre del
                                        procedimiento para buscarlo en la tabla
                                        de CUPS.
                                        {paciente?.eps
                                            ? ` EPS del paciente: ${paciente.eps}.`
                                            : ''}
                                    </div>
                                    <div className="grid gap-3">
                                        {form.data.procedimientos.map(
                                            (proc, i) => {
                                                const errores =
                                                    form.errors as Record<
                                                        string,
                                                        string
                                                    >;
                                                const cupsError =
                                                    errores[
                                                        `procedimientos.${i}.cusv_id`
                                                    ];
                                                const autorizacionError =
                                                    errores[
                                                        `procedimientos.${i}.N_Autorizacion`
                                                    ];
                                                return (
                                                    <div key={i}>
                                                        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                                                            <CupsCombobox
                                                                selectedLabel={
                                                                    cupsDe(
                                                                        proc.cusv_id,
                                                                    )
                                                                        ?.CodCupsHuv ??
                                                                    (proc.cusv_id
                                                                        ? cupsNombre(
                                                                              proc.cusv_id,
                                                                          )
                                                                        : '')
                                                                }
                                                                onSelect={(
                                                                    c,
                                                                ) => {
                                                                    setCupsCatalogo(
                                                                        (
                                                                            prev,
                                                                        ) => ({
                                                                            ...prev,
                                                                            [String(
                                                                                c.id,
                                                                            )]:
                                                                                c,
                                                                        }),
                                                                    );
                                                                    setProc(
                                                                        i,
                                                                        'cusv_id',
                                                                        String(
                                                                            c.id,
                                                                        ),
                                                                    );
                                                                }}
                                                            />
                                                            <Input
                                                                value={cupsNombre(
                                                                    proc.cusv_id,
                                                                )}
                                                                readOnly
                                                                placeholder="Descripción del procedimiento"
                                                                className="flex-1 bg-muted/40"
                                                            />
                                                            <Input
                                                                value={
                                                                    cupsDe(
                                                                        proc.cusv_id,
                                                                    )
                                                                        ?.descrip_Normativa ??
                                                                    ''
                                                                }
                                                                readOnly
                                                                placeholder="Descripción normativa"
                                                                className="flex-1 bg-muted/40"
                                                            />
                                                            <Input
                                                                value={
                                                                    proc.N_Autorizacion
                                                                }
                                                                onChange={(e) =>
                                                                    setProc(
                                                                        i,
                                                                        'N_Autorizacion',
                                                                        e.target
                                                                            .value,
                                                                    )
                                                                }
                                                                maxLength={20}
                                                                placeholder="N° Autorización EPS *"
                                                                className="lg:w-48"
                                                            />
                                                            <Button
                                                                type="button"
                                                                variant="destructive"
                                                                size="icon"
                                                                className="shrink-0"
                                                                title="Quitar"
                                                                disabled={
                                                                    form.data
                                                                        .procedimientos
                                                                        .length ===
                                                                    1
                                                                }
                                                                onClick={() =>
                                                                    removeProc(
                                                                        i,
                                                                    )
                                                                }
                                                            >
                                                                <X className="size-4" />
                                                            </Button>
                                                        </div>
                                                        {cupsInfo(
                                                            proc.cusv_id,
                                                        ) && (
                                                            <span className="mt-1 block text-xs text-muted-foreground">
                                                                {cupsInfo(
                                                                    proc.cusv_id,
                                                                )}
                                                            </span>
                                                        )}
                                                        {cupsError && (
                                                            <span className="mt-1 block text-xs text-red-600">
                                                                {cupsError}
                                                            </span>
                                                        )}
                                                        {autorizacionError && (
                                                            <span className="mt-1 block text-xs text-red-600">
                                                                {
                                                                    autorizacionError
                                                                }
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            },
                                        )}
                                    </div>
                                    <Button
                                        type="button"
                                        onClick={addProc}
                                        className="mt-3 gap-2"
                                        style={{ backgroundColor: BRAND }}
                                    >
                                        <Plus className="size-4" />
                                        Agregar otro CUPS / Autorización
                                    </Button>
                                    {form.errors.procedimientos && (
                                        <p className="mt-2 text-xs text-red-600">
                                            {form.errors.procedimientos}
                                        </p>
                                    )}
                                </div>

                                {/* Observaciones */}
                                <div className="grid gap-4">
                                    <Field label="OB TFX *">
                                        <Input
                                            value={form.data.ObservacionTFX}
                                            onChange={(e) =>
                                                form.setData(
                                                    'ObservacionTFX',
                                                    e.target.value,
                                                )
                                            }
                                            className="sm:max-w-sm"
                                        />
                                        {form.errors.ObservacionTFX && (
                                            <span className="text-xs text-red-600">
                                                {form.errors.ObservacionTFX}
                                            </span>
                                        )}
                                    </Field>
                                    <Field label="Observación CCX *">
                                        <Textarea
                                            value={form.data.ObservacionCCX}
                                            onChange={(e) =>
                                                form.setData(
                                                    'ObservacionCCX',
                                                    e.target.value,
                                                )
                                            }
                                            rows={3}
                                            placeholder="Información adicional"
                                        />
                                        {form.errors.ObservacionCCX && (
                                            <span className="text-xs text-red-600">
                                                {form.errors.ObservacionCCX}
                                            </span>
                                        )}
                                    </Field>
                                </div>

                                {/* Botón guardar (requiere permiso de crear) */}
                                {accionesRadicar.crear ? (
                                    <Button
                                        type="submit"
                                        disabled={form.processing}
                                        className="h-12 w-full gap-2 text-base font-semibold text-white hover:opacity-95"
                                        style={{ backgroundColor: '#0f766e' }}
                                    >
                                        {form.processing ? (
                                            <LoaderCircle className="size-5 animate-spin" />
                                        ) : (
                                            <Save className="size-5" />
                                        )}
                                        Guardar y Registrar Caso
                                    </Button>
                                ) : (
                                    <p className="rounded-lg border bg-muted/40 px-4 py-3 text-center text-sm text-muted-foreground">
                                        Tu rol no tiene permiso para registrar
                                        casos.
                                    </p>
                                )}
                            </form>
                        </div>
                    )}

                    {tab === 'historial' && tabPermitida('historial') && (
                        <div className="p-4 md:p-6">
                            <div className="mb-4 flex items-center gap-3 border-b pb-4">
                                <div
                                    className="flex size-10 items-center justify-center rounded-xl text-white"
                                    style={{ backgroundColor: BRAND }}
                                >
                                    <Search className="size-5" />
                                </div>
                                <h1 className="text-lg font-bold tracking-tight text-foreground">
                                    Consulta e Historial de Casos
                                </h1>
                            </div>

                            {/* Grilla de radicaciones (administrable por rol
                                en el Gestor de Permisos) */}
                            {muestraGrillaCasos && (
                                <div className="mb-5 rounded-xl border bg-card shadow-sm">
                                    <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center sm:justify-between">
                                        <span className="text-xs font-bold tracking-wide text-[#2d3e83] uppercase dark:text-white">
                                            Radicaciones realizadas — clic en
                                            una fila para cargarla
                                        </span>
                                        <div className="relative w-full sm:max-w-xs">
                                            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                                            <Input
                                                value={gridFilter}
                                                onChange={(e) =>
                                                    setGridFilter(
                                                        e.target.value,
                                                    )
                                                }
                                                placeholder="Filtrar por caso, paciente, cédula, convenio…"
                                                className="h-8 pl-9 text-sm"
                                            />
                                        </div>
                                    </div>
                                    <div className="max-h-64 overflow-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead className="sticky top-0 bg-muted/80 text-xs text-muted-foreground uppercase backdrop-blur">
                                                <tr>
                                                    <th className="px-3 py-2 font-medium">
                                                        Caso N°
                                                    </th>
                                                    <th className="px-3 py-2 font-medium">
                                                        Fecha
                                                    </th>
                                                    <th className="px-3 py-2 font-medium">
                                                        Paciente
                                                    </th>
                                                    <th className="px-3 py-2 font-medium">
                                                        Identificación
                                                    </th>
                                                    <th className="px-3 py-2 font-medium">
                                                        EPS
                                                    </th>
                                                    <th className="px-3 py-2 font-medium">
                                                        Convenio
                                                    </th>
                                                    <th className="px-3 py-2 font-medium">
                                                        Estado
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {casosLista
                                                    .filter((c) => {
                                                        const f = gridFilter
                                                            .trim()
                                                            .toLowerCase();
                                                        if (!f) return true;
                                                        return [
                                                            String(c.codrad),
                                                            c.paciente,
                                                            c.documento ?? '',
                                                            c.eps,
                                                            c.convenio,
                                                            c.estado,
                                                        ]
                                                            .join(' ')
                                                            .toLowerCase()
                                                            .includes(f);
                                                    })
                                                    .map((c) => (
                                                        <tr
                                                            key={c.codrad}
                                                            onClick={() => {
                                                                setHistQuery(
                                                                    String(
                                                                        c.codrad,
                                                                    ),
                                                                );
                                                                consultarCaso(
                                                                    String(
                                                                        c.codrad,
                                                                    ),
                                                                );
                                                            }}
                                                            className={`cursor-pointer transition-colors hover:bg-[#2d3e83]/5 dark:hover:bg-white/5 ${
                                                                caso?.codrad ===
                                                                c.codrad
                                                                    ? 'bg-[#2d3e83]/10 dark:bg-white/10'
                                                                    : ''
                                                            }`}
                                                        >
                                                            <td className="px-3 py-2 font-bold text-[#2d3e83] dark:text-white">
                                                                #{c.codrad}
                                                            </td>
                                                            <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                                                                {c.fecha ?? '—'}
                                                            </td>
                                                            <td className="px-3 py-2 font-medium text-foreground">
                                                                {c.paciente}
                                                            </td>
                                                            <td className="px-3 py-2 text-muted-foreground">
                                                                {c.documento ??
                                                                    '—'}
                                                            </td>
                                                            <td className="px-3 py-2 text-muted-foreground">
                                                                {c.eps}
                                                            </td>
                                                            <td className="px-3 py-2 text-muted-foreground">
                                                                {c.convenio}
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-300">
                                                                    {c.estado}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                {casosLista.length === 0 && (
                                                    <tr>
                                                        <td
                                                            colSpan={7}
                                                            className="px-3 py-8 text-center text-muted-foreground"
                                                        >
                                                            No hay radicaciones
                                                            registradas.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Segmento 1: búsqueda */}
                            <div className="mb-5 rounded-xl border bg-muted/30 p-4">
                                <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                                    Buscar por N° consecutivo o cédula del
                                    paciente
                                </span>
                                <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                                    <Input
                                        value={histQuery}
                                        onChange={(e) =>
                                            setHistQuery(e.target.value)
                                        }
                                        onKeyDown={(e) =>
                                            e.key === 'Enter' && consultarCaso()
                                        }
                                        placeholder="Ej: 1 o 1116234…"
                                        className="sm:max-w-sm"
                                    />
                                    <Button
                                        type="button"
                                        onClick={() => consultarCaso()}
                                        disabled={histLoading}
                                        className="gap-2"
                                        style={{ backgroundColor: BRAND }}
                                    >
                                        {histLoading ? (
                                            <LoaderCircle className="size-4 animate-spin" />
                                        ) : (
                                            <Search className="size-4" />
                                        )}
                                        Consultar
                                    </Button>
                                    {puedeModificarRadicado && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={abrirModificarRadicado}
                                            disabled={!caso}
                                            title={
                                                caso
                                                    ? 'Modificar los datos del radicado'
                                                    : 'Consulta un caso para poder modificarlo'
                                            }
                                            className="gap-2 text-[#2d3e83] disabled:opacity-40 dark:text-white"
                                        >
                                            <Pencil className="size-4" />
                                            Modificar radicado
                                        </Button>
                                    )}
                                    {esSuperAdmin && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={() => setBorrarOpen(true)}
                                            disabled={!caso}
                                            title={
                                                caso
                                                    ? 'Eliminar el caso consultado'
                                                    : 'Consulta un caso para poder eliminarlo'
                                            }
                                            className="gap-2 text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-40 dark:hover:bg-red-950"
                                        >
                                            <Trash2 className="size-4" />
                                            Borrar caso
                                        </Button>
                                    )}
                                </div>

                                {histError && (
                                    <p className="mt-2 text-sm text-red-600">
                                        {histError}
                                    </p>
                                )}
                                {histOk && (
                                    <p className="mt-2 text-sm font-medium text-green-700 dark:text-green-400">
                                        {histOk}
                                    </p>
                                )}
                            </div>

                            {caso && (
                                <div className="grid gap-5">
                                    {/* Segmento 2: datos del caso (solo lectura) */}
                                    <div className="rounded-xl border bg-card p-4 shadow-sm">
                                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                            <Dato
                                                label="N° Consecutivo"
                                                value={
                                                    <span className="font-bold text-[#2d3e83] dark:text-white">
                                                        #{caso.codrad}
                                                    </span>
                                                }
                                            />
                                            <Dato
                                                label="Paciente"
                                                value={caso.paciente}
                                            />
                                            <Dato
                                                label="Identificación"
                                                value={`${caso.tipo_Docu} - ${caso.Ndocumento}`}
                                            />
                                            <Dato
                                                label="Teléfonos"
                                                value={caso.telefonos}
                                            />
                                            <Dato
                                                label="Especialidad"
                                                value={caso.especialidad}
                                            />
                                            <Dato
                                                label="Subespecialidad"
                                                value={caso.subespecialidad}
                                            />
                                            <Dato
                                                label="Médico"
                                                value={caso.medico}
                                            />
                                            <Dato
                                                label="Fecha Recibido"
                                                value={caso.fechaRecibido}
                                            />
                                            <Dato
                                                label="Aseguradora (ERP)"
                                                value={
                                                    <span className="font-semibold text-[#2d3e83] dark:text-white">
                                                        {caso.eps || '—'}
                                                    </span>
                                                }
                                            />
                                            <Dato
                                                label="Convenio"
                                                value={caso.convenio || '—'}
                                            />
                                            <Dato
                                                label="Estado Actual"
                                                value={
                                                    <span className="font-semibold text-green-600 dark:text-green-400">
                                                        {caso.estadoActual}
                                                    </span>
                                                }
                                            />
                                            <Dato
                                                label="Entrega Prog."
                                                value={caso.entregaProg}
                                            />
                                            <Dato
                                                label="Fecha Autorización"
                                                value={caso.fechaAutorizacion}
                                            />
                                            <Dato
                                                label="Vencimiento Aut."
                                                value={caso.vencimientoAut}
                                            />
                                            <Dato
                                                label="Copago"
                                                value={
                                                    caso.copago ? (
                                                        <span className="font-semibold text-foreground">
                                                            Sí —{' '}
                                                            {formatoMoneda(
                                                                caso.valorCopago,
                                                            )}
                                                        </span>
                                                    ) : (
                                                        'No'
                                                    )
                                                }
                                            />
                                            <Dato
                                                label="Paquete"
                                                value={
                                                    caso.paqueteUrl ? (
                                                        // Se abre en una
                                                        // pestaña aparte: el
                                                        // visor del navegador
                                                        // da toda la pantalla
                                                        // y permite
                                                        // seleccionar y
                                                        // copiar el texto.
                                                        <a
                                                            href={
                                                                caso.paqueteUrl
                                                            }
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            title={`Abrir ${caso.paquete} en una pestaña nueva`}
                                                            className="inline-flex items-center gap-1.5 rounded-md bg-[#2d3e83]/10 px-2.5 py-1 text-xs font-medium text-[#2d3e83] transition-colors hover:bg-[#2d3e83]/20 dark:bg-white/10 dark:text-white"
                                                        >
                                                            <Eye className="size-3.5" />
                                                            Ver PDF
                                                        </a>
                                                    ) : (
                                                        '—'
                                                    )
                                                }
                                            />
                                        </div>
                                    </div>

                                    {/* Segmento 3: CUPS y autorizaciones */}
                                    <div className="rounded-xl border bg-muted/30 p-4">
                                        <div className="mb-2 text-xs font-bold tracking-wide text-[#2d3e83] uppercase dark:text-white">
                                            Códigos CUPS & procedimientos
                                            registrados en este caso
                                        </div>
                                        {caso.procedimientos.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">
                                                Sin procedimientos registrados.
                                            </p>
                                        ) : (
                                            <ul className="space-y-1 font-mono text-xs text-foreground">
                                                {caso.procedimientos.map(
                                                    (p, i) => (
                                                        <li key={i}>
                                                            {p.cusv_id} &rarr;{' '}
                                                            {p.codigo} |{' '}
                                                            {p.descripcion ||
                                                                '—'}{' '}
                                                            {!p.encontrada && (
                                                                <span className="text-red-600">
                                                                    (No
                                                                    encontrada)
                                                                </span>
                                                            )}
                                                        </li>
                                                    ),
                                                )}
                                            </ul>
                                        )}
                                        <div className="mt-3">
                                            <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                                                Números de autorización EPS
                                            </div>
                                            <div className="font-semibold text-red-700 dark:text-red-400">
                                                {caso.autorizaciones.length
                                                    ? caso.autorizaciones.join(
                                                          ' / ',
                                                      )
                                                    : 'N/A'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Segmento 4: OB TFX */}
                                    <Dato
                                        label="OB TFX"
                                        value={caso.ObservacionTFX || 'N/A'}
                                    />

                                    {/* Segmento 4.5: cotizaciones de conceptos
                                        no convenidos (sub-vista administrable
                                        en el Gestor de Permisos) */}
                                    {puedeGestionarCotizaciones && (
                                        <div className="rounded-xl border bg-card p-4 shadow-sm">
                                            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="text-xs font-bold tracking-wide text-[#2d3e83] uppercase dark:text-white">
                                                    Cotizaciones de conceptos no
                                                    convenidos
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="gap-1"
                                                    onClick={addCotRow}
                                                >
                                                    <Plus className="size-4" />
                                                    Agregar concepto
                                                </Button>
                                            </div>

                                            {cotOk && (
                                                <div className="mb-3 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
                                                    <CheckCircle2 className="size-4" />
                                                    Cotizaciones guardadas
                                                    correctamente.
                                                </div>
                                            )}
                                            {cotError && (
                                                <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                                                    <X className="size-4" />
                                                    {cotError}
                                                </div>
                                            )}

                                            {cotRows.length === 0 && (
                                                <p className="py-4 text-center text-sm text-muted-foreground">
                                                    Sin conceptos. Usa «Agregar
                                                    concepto» para iniciar la
                                                    cotización.
                                                </p>
                                            )}

                                            <div className="grid gap-3">
                                                {/* Encabezados (pantallas amplias) */}
                                                {cotRows.length > 0 && (
                                                    <div className="hidden gap-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase lg:grid lg:grid-cols-[1.4fr_1fr_0.9fr_1fr_1.1fr_1.4fr_2rem]">
                                                        <span>
                                                            Terceros o Proveedor
                                                            *
                                                        </span>
                                                        <span>Estado</span>
                                                        <span>
                                                            Fecha Cotización
                                                        </span>
                                                        <span>
                                                            Valor Cotización *
                                                        </span>
                                                        <span>
                                                            Adjuntar Cotización
                                                            (PDF)
                                                        </span>
                                                        <span>Observación</span>
                                                        <span />
                                                    </div>
                                                )}
                                                {cotRows.map((r, i) => (
                                                    <div
                                                        key={r.id ?? `n-${i}`}
                                                        className="grid gap-2 rounded-lg border bg-muted/20 p-2 lg:grid-cols-[1.4fr_1fr_0.9fr_1fr_1.1fr_1.4fr_2rem] lg:items-center lg:border-0 lg:bg-transparent lg:p-0"
                                                    >
                                                        <Input
                                                            value={r.tercero}
                                                            onChange={(e) =>
                                                                setCotField(
                                                                    i,
                                                                    'tercero',
                                                                    e.target
                                                                        .value,
                                                                )
                                                            }
                                                            maxLength={200}
                                                            placeholder="Tercero o proveedor *"
                                                        />
                                                        <Select
                                                            value={r.estado}
                                                            onValueChange={(
                                                                v,
                                                            ) =>
                                                                setCotField(
                                                                    i,
                                                                    'estado',
                                                                    v,
                                                                )
                                                            }
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Estado" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {estados.map(
                                                                    (s) => (
                                                                        <SelectItem
                                                                            key={
                                                                                s.id
                                                                            }
                                                                            value={String(
                                                                                s.id,
                                                                            )}
                                                                        >
                                                                            {
                                                                                s.Nombre
                                                                            }
                                                                        </SelectItem>
                                                                    ),
                                                                )}
                                                            </SelectContent>
                                                        </Select>
                                                        <Input
                                                            type="date"
                                                            value={
                                                                r.fecha_cotizacion
                                                            }
                                                            onChange={(e) =>
                                                                setCotField(
                                                                    i,
                                                                    'fecha_cotizacion',
                                                                    e.target
                                                                        .value,
                                                                )
                                                            }
                                                        />
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={r.valor}
                                                            onChange={(e) =>
                                                                setCotField(
                                                                    i,
                                                                    'valor',
                                                                    e.target
                                                                        .value,
                                                                )
                                                            }
                                                            placeholder="Valor *"
                                                        />
                                                        <div className="flex min-w-0 items-center gap-1">
                                                            <input
                                                                type="file"
                                                                accept="application/pdf"
                                                                onChange={(e) =>
                                                                    setCotField(
                                                                        i,
                                                                        'file',
                                                                        e.target
                                                                            .files?.[0] ??
                                                                            null,
                                                                    )
                                                                }
                                                                className="w-full min-w-0 cursor-pointer text-xs text-muted-foreground file:mr-1 file:cursor-pointer file:rounded-md file:border-0 file:bg-[#2d3e83]/10 file:px-2 file:py-1.5 file:text-xs file:font-medium file:text-[#2d3e83] dark:file:bg-white/10 dark:file:text-white"
                                                            />
                                                            {r.adjunto_url &&
                                                                !r.file && (
                                                                    <a
                                                                        href={
                                                                            r.adjunto_url
                                                                        }
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                        title="Ver PDF adjunto"
                                                                        className="shrink-0 text-[#2d3e83] hover:opacity-70 dark:text-white"
                                                                    >
                                                                        <FileText className="size-4" />
                                                                    </a>
                                                                )}
                                                        </div>
                                                        <Input
                                                            value={
                                                                r.observacion
                                                            }
                                                            onChange={(e) =>
                                                                setCotField(
                                                                    i,
                                                                    'observacion',
                                                                    e.target
                                                                        .value,
                                                                )
                                                            }
                                                            maxLength={1200}
                                                            placeholder="Observación del concepto"
                                                        />
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="size-8 justify-self-end text-muted-foreground hover:text-red-600"
                                                            title="Quitar concepto"
                                                            onClick={() =>
                                                                removeCotRow(i)
                                                            }
                                                        >
                                                            <Trash2 className="size-4" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Total y guardado */}
                                            <div className="mt-4 flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="text-sm">
                                                    <span className="text-muted-foreground">
                                                        Total cotizado:{' '}
                                                    </span>
                                                    <span className="text-lg font-bold text-[#2d3e83] dark:text-white">
                                                        {fmtCOP(totalCotizado)}
                                                    </span>
                                                    <span className="ml-2 text-xs text-muted-foreground">
                                                        (
                                                        {
                                                            cotRows.filter(
                                                                (r) =>
                                                                    r.tercero.trim() !==
                                                                    '',
                                                            ).length
                                                        }{' '}
                                                        concepto(s))
                                                    </span>
                                                </div>
                                                <Button
                                                    type="button"
                                                    onClick={
                                                        guardarCotizaciones
                                                    }
                                                    disabled={cotSaving}
                                                    className="gap-2"
                                                    style={{
                                                        backgroundColor: BRAND,
                                                    }}
                                                >
                                                    {cotSaving ? (
                                                        <LoaderCircle className="size-4 animate-spin" />
                                                    ) : (
                                                        <Save className="size-4" />
                                                    )}
                                                    Guardar Cotizaciones
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Segmento 5: modificaciones (trazabilidad);
                                        administrable por sub-vista en el
                                        Gestor de Permisos */}
                                    {puedeAplicarModificaciones && (
                                        <form
                                            onSubmit={aplicarModificacion}
                                            className="rounded-xl border bg-card p-4 shadow-sm"
                                        >
                                            {segOk && (
                                                <div className="mb-3 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
                                                    <CheckCircle2 className="size-4" />
                                                    Modificación registrada en
                                                    la trazabilidad del caso.
                                                </div>
                                            )}
                                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                                <Field label="Subespecialidad">
                                                    <div
                                                        className="relative"
                                                        ref={subRef}
                                                    >
                                                        <Input
                                                            value={subQuery}
                                                            onChange={(e) => {
                                                                setSubQuery(
                                                                    e.target
                                                                        .value,
                                                                );
                                                                setSubOpen(
                                                                    true,
                                                                );
                                                                if (
                                                                    seg.codsubesp
                                                                )
                                                                    setSegField(
                                                                        'codsubesp',
                                                                        '',
                                                                    );
                                                            }}
                                                            onFocus={() =>
                                                                setSubOpen(true)
                                                            }
                                                            onKeyDown={(e) => {
                                                                if (
                                                                    e.key ===
                                                                    'Escape'
                                                                ) {
                                                                    setSubOpen(
                                                                        false,
                                                                    );
                                                                } else if (
                                                                    e.key ===
                                                                    'Enter'
                                                                ) {
                                                                    e.preventDefault();
                                                                    if (
                                                                        subFiltered.length >
                                                                        0
                                                                    )
                                                                        selectSubSeg(
                                                                            subFiltered[0],
                                                                        );
                                                                }
                                                            }}
                                                            placeholder="Digite el nombre…"
                                                            className="pr-9"
                                                            autoComplete="off"
                                                        />
                                                        <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
                                                        {subOpen && (
                                                            <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover py-1 text-popover-foreground shadow-md">
                                                                {subFiltered.length ===
                                                                    0 && (
                                                                    <li className="px-3 py-2 text-sm text-muted-foreground">
                                                                        Sin
                                                                        coincidencias
                                                                    </li>
                                                                )}
                                                                {subFiltered.map(
                                                                    (s) => (
                                                                        <li
                                                                            key={
                                                                                s.id
                                                                            }
                                                                        >
                                                                            <button
                                                                                type="button"
                                                                                onClick={() =>
                                                                                    selectSubSeg(
                                                                                        s,
                                                                                    )
                                                                                }
                                                                                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                                                                            >
                                                                                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold text-foreground">
                                                                                    {
                                                                                        s.cod_SubEspecialidad
                                                                                    }
                                                                                </span>
                                                                                <span>
                                                                                    {
                                                                                        s.Nombre
                                                                                    }
                                                                                </span>
                                                                            </button>
                                                                        </li>
                                                                    ),
                                                                )}
                                                            </ul>
                                                        )}
                                                    </div>
                                                </Field>
                                                {/* Estado Actual: los mismos
                                                    estados de Nueva
                                                    Radicación, ya filtrados
                                                    por los que tiene
                                                    asignados el rol. */}
                                                <Field label="Estado Actual">
                                                    <Select
                                                        value={seg.estRad}
                                                        onValueChange={(v) =>
                                                            setSegField(
                                                                'estRad',
                                                                v,
                                                            )
                                                        }
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Seleccione…" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {estados.length ===
                                                                0 && (
                                                                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                                                    Tu rol no
                                                                    tiene
                                                                    estados
                                                                    asignados.
                                                                </div>
                                                            )}
                                                            {estados.map(
                                                                (s) => (
                                                                    <SelectItem
                                                                        key={
                                                                            s.id
                                                                        }
                                                                        value={String(
                                                                            s.id,
                                                                        )}
                                                                    >
                                                                        {
                                                                            s.Nombre
                                                                        }
                                                                    </SelectItem>
                                                                ),
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                </Field>
                                                <Field label="Fecha Recibido">
                                                    <Input
                                                        type="date"
                                                        value={seg.fecreci}
                                                        onChange={(e) =>
                                                            setSegField(
                                                                'fecreci',
                                                                e.target.value,
                                                            )
                                                        }
                                                    />
                                                </Field>
                                                {/* Motivo no se diligencia en
                                                    este formulario. */}
                                                <Field label="Vencimiento Anestesia">
                                                    <Input
                                                        type="date"
                                                        value={
                                                            seg.venc_anestesia
                                                        }
                                                        onChange={(e) =>
                                                            setSegField(
                                                                'venc_anestesia',
                                                                e.target.value,
                                                            )
                                                        }
                                                    />
                                                </Field>
                                                <Field label="Estado QX">
                                                    <Input
                                                        value={seg.estado_qx}
                                                        onChange={(e) =>
                                                            setSegField(
                                                                'estado_qx',
                                                                e.target.value,
                                                            )
                                                        }
                                                        maxLength={120}
                                                    />
                                                </Field>
                                                <Field
                                                    label="Observaciones CCX"
                                                    className="lg:col-span-3"
                                                >
                                                    <Textarea
                                                        value={
                                                            seg.ObservacionCCX
                                                        }
                                                        onChange={(e) =>
                                                            setSegField(
                                                                'ObservacionCCX',
                                                                e.target.value,
                                                            )
                                                        }
                                                        rows={2}
                                                    />
                                                </Field>
                                            </div>
                                            <Button
                                                type="submit"
                                                disabled={aplicando}
                                                className="mt-4 h-11 w-full gap-2 font-semibold text-gray-900 hover:opacity-90"
                                                style={{
                                                    backgroundColor: '#eab308',
                                                }}
                                            >
                                                {aplicando ? (
                                                    <LoaderCircle className="size-5 animate-spin" />
                                                ) : (
                                                    <Save className="size-5" />
                                                )}
                                                Aplicar Modificaciones al Caso
                                            </Button>
                                        </form>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {tab === 'informes' && tabPermitida('informes') && (
                        <div className="p-4 md:p-6">
                            <div className="mb-4 flex items-center gap-3 border-b pb-4">
                                <div
                                    className="flex size-10 items-center justify-center rounded-xl text-white"
                                    style={{ backgroundColor: BRAND }}
                                >
                                    <BarChart3 className="size-5" />
                                </div>
                                <h1 className="text-lg font-bold tracking-tight text-foreground">
                                    Generación de Informes
                                </h1>
                            </div>

                            {/* Filtros */}
                            <form
                                onSubmit={generarInforme}
                                className="rounded-xl border bg-muted/30 p-4"
                            >
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                    <Field label="Fecha Inicial">
                                        <Input
                                            type="date"
                                            value={inf.fechaInicial}
                                            onChange={(e) =>
                                                setInfField(
                                                    'fechaInicial',
                                                    e.target.value,
                                                )
                                            }
                                        />
                                    </Field>
                                    <Field label="Fecha Final">
                                        <Input
                                            type="date"
                                            value={inf.fechaFinal}
                                            onChange={(e) =>
                                                setInfField(
                                                    'fechaFinal',
                                                    e.target.value,
                                                )
                                            }
                                        />
                                    </Field>
                                    <Field label="Consecutivo">
                                        <Input
                                            value={inf.consecutivo}
                                            onChange={(e) =>
                                                setInfField(
                                                    'consecutivo',
                                                    e.target.value,
                                                )
                                            }
                                            placeholder="N° de caso"
                                        />
                                    </Field>
                                    <Field label="N° de Documento">
                                        <Input
                                            value={inf.documento}
                                            onChange={(e) =>
                                                setInfField(
                                                    'documento',
                                                    e.target.value,
                                                )
                                            }
                                            placeholder="Cédula del paciente"
                                            autoComplete="off"
                                        />
                                    </Field>
                                    <Field label="Médico">
                                        <Input
                                            value={inf.medico}
                                            onChange={(e) =>
                                                setInfField(
                                                    'medico',
                                                    e.target.value,
                                                )
                                            }
                                            placeholder="Nombre del médico"
                                        />
                                    </Field>
                                    <Field label="Especialidad">
                                        <Select
                                            value={inf.especialidad || 'todas'}
                                            onValueChange={(v) =>
                                                setInf((p) => ({
                                                    ...p,
                                                    especialidad:
                                                        v === 'todas' ? '' : v,
                                                    subespecialidad: '',
                                                }))
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Todas" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="todas">
                                                    Todas
                                                </SelectItem>
                                                {especialidadesFiltro.map(
                                                    (e) => (
                                                        <SelectItem
                                                            key={e.espcodser}
                                                            value={String(
                                                                e.espcodser,
                                                            )}
                                                        >
                                                            {e.Nombre}
                                                        </SelectItem>
                                                    ),
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </Field>
                                    <Field label="Subespecialidad">
                                        <Select
                                            value={
                                                inf.subespecialidad || 'todas'
                                            }
                                            onValueChange={(v) =>
                                                setInfField(
                                                    'subespecialidad',
                                                    v === 'todas' ? '' : v,
                                                )
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Todas" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="todas">
                                                    Todas
                                                </SelectItem>
                                                {subOptionsInforme.map((s) => (
                                                    <SelectItem
                                                        key={
                                                            s.cod_SubEspecialidad
                                                        }
                                                        value={String(
                                                            s.cod_SubEspecialidad,
                                                        )}
                                                    >
                                                        {s.Nombre}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </Field>
                                    <Field label="Estado">
                                        <Select
                                            value={inf.estado || 'todos'}
                                            onValueChange={(v) =>
                                                setInfField(
                                                    'estado',
                                                    v === 'todos' ? '' : v,
                                                )
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Todos" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="todos">
                                                    Todos
                                                </SelectItem>
                                                {estados.map((s) => (
                                                    <SelectItem
                                                        key={s.id}
                                                        value={String(s.id)}
                                                    >
                                                        {s.Nombre}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </Field>
                                </div>
                                <Button
                                    type="submit"
                                    disabled={infLoading}
                                    className="mt-4 gap-2"
                                    style={{ backgroundColor: BRAND }}
                                >
                                    {infLoading ? (
                                        <LoaderCircle className="size-4 animate-spin" />
                                    ) : (
                                        <BarChart3 className="size-4" />
                                    )}
                                    Generar Informe
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={exportarInformeExcel}
                                    disabled={!infRows || infRows.length === 0}
                                    title={
                                        infRows && infRows.length > 0
                                            ? 'Descargar en Excel lo que muestra la grilla'
                                            : 'Genera primero el informe'
                                    }
                                    className="mt-4 ml-2 gap-2 text-[#2d3e83] disabled:opacity-40 dark:text-white"
                                >
                                    <FileSpreadsheet className="size-4" />
                                    Exportar a Excel
                                </Button>
                            </form>

                            {infTruncado && (
                                <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                                    El informe se recortó por volumen: se
                                    muestran los movimientos más recientes.
                                    Acota el rango de fechas o usa los filtros
                                    para ver el resto.
                                </p>
                            )}

                            {/* Resultados */}
                            <div className="mt-5 overflow-x-auto rounded-xl border bg-card shadow-sm">
                                {infRows === null ? (
                                    <p className="p-8 text-center text-sm text-muted-foreground">
                                        Aplica los filtros y genera el informe
                                        para ver la trazabilidad de
                                        modificaciones por caso.
                                    </p>
                                ) : infRows.length === 0 ? (
                                    <p className="p-8 text-center text-sm text-muted-foreground">
                                        No se encontraron modificaciones con los
                                        filtros indicados.
                                    </p>
                                ) : (
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
                                            <tr>
                                                <th className="px-3 py-2 font-medium">
                                                    N° Caso
                                                </th>
                                                <th className="px-3 py-2 font-medium">
                                                    Fecha Recibido
                                                </th>
                                                <th className="px-3 py-2 font-medium">
                                                    Documento
                                                </th>
                                                <th className="px-3 py-2 font-medium">
                                                    Paciente
                                                </th>
                                                <th className="px-3 py-2 font-medium">
                                                    Tipo
                                                </th>
                                                <th className="px-3 py-2 font-medium">
                                                    Campo
                                                </th>
                                                <th className="px-3 py-2 font-medium">
                                                    Cambio
                                                </th>
                                                <th className="px-3 py-2 font-medium">
                                                    Estado
                                                </th>
                                                <th className="px-3 py-2 font-medium">
                                                    Copago
                                                </th>
                                                <th className="px-3 py-2 font-medium">
                                                    Paquete
                                                </th>
                                                <th className="px-3 py-2 font-medium">
                                                    Médico
                                                </th>
                                                <th className="px-3 py-2 font-medium">
                                                    Especialidad
                                                </th>
                                                <th className="px-3 py-2 font-medium">
                                                    Motivo
                                                </th>
                                                <th className="px-3 py-2 font-medium">
                                                    Estado Sec.
                                                </th>
                                                <th className="px-3 py-2 font-medium">
                                                    Subespecialidad
                                                </th>
                                                <th className="px-3 py-2 font-medium">
                                                    Fec. Recibido
                                                </th>
                                                <th className="px-3 py-2 font-medium">
                                                    Venc. Anest.
                                                </th>
                                                <th className="px-3 py-2 font-medium">
                                                    Observación
                                                </th>
                                                <th className="px-3 py-2 font-medium">
                                                    Estado QX
                                                </th>
                                                <th className="px-3 py-2 font-medium">
                                                    Usuario
                                                </th>
                                                <th className="px-3 py-2 font-medium">
                                                    Modificado
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {infRows.map((r) => (
                                                <tr
                                                    key={r.id}
                                                    className="hover:bg-muted/40"
                                                >
                                                    <td className="px-3 py-2 font-semibold text-[#2d3e83] dark:text-white">
                                                        #{r.codrad}
                                                    </td>
                                                    <td className="px-3 py-2 text-muted-foreground">
                                                        {r.fechaRecibido || '—'}
                                                    </td>
                                                    <td className="px-3 py-2 text-muted-foreground">
                                                        {r.documento}
                                                    </td>
                                                    <td className="px-3 py-2 font-medium text-foreground">
                                                        {r.paciente}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <span
                                                            className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                                                                r.tipo ===
                                                                'Cambio'
                                                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                                                                    : r.tipo ===
                                                                        'Seguimiento'
                                                                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200'
                                                                      : 'bg-muted text-muted-foreground'
                                                            }`}
                                                        >
                                                            {r.tipo}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 font-medium">
                                                        {r.campo}
                                                    </td>
                                                    <td className="max-w-xs px-3 py-2">
                                                        {r.anterior === '—' &&
                                                        r.nuevo === '—' ? (
                                                            <span className="text-muted-foreground">
                                                                —
                                                            </span>
                                                        ) : (
                                                            <span className="flex flex-wrap items-center gap-1">
                                                                <span className="text-muted-foreground line-through">
                                                                    {r.anterior}
                                                                </span>
                                                                <span className="text-muted-foreground">
                                                                    →
                                                                </span>
                                                                <span className="font-medium text-foreground">
                                                                    {r.nuevo}
                                                                </span>
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        {r.estado}
                                                    </td>
                                                    <td className="px-3 py-2 whitespace-nowrap">
                                                        {r.copago ? (
                                                            <span className="font-medium text-foreground">
                                                                Sí ·{' '}
                                                                {formatoMoneda(
                                                                    r.valorCopago,
                                                                )}
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted-foreground">
                                                                No
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        {r.paqueteUrl ? (
                                                            <a
                                                                href={
                                                                    r.paqueteUrl
                                                                }
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="font-medium text-[#2d3e83] underline dark:text-white"
                                                            >
                                                                Ver PDF
                                                            </a>
                                                        ) : (
                                                            <span className="text-muted-foreground">
                                                                —
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        {r.medico}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        {r.especialidad}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        {r.motivo}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        {r.estadoSecundario}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        {r.subespecialidad}
                                                    </td>
                                                    <td className="px-3 py-2 text-muted-foreground">
                                                        {r.fechaRecibidoDev ||
                                                            '—'}
                                                    </td>
                                                    <td className="px-3 py-2 text-muted-foreground">
                                                        {r.vencAnestesia || '—'}
                                                    </td>
                                                    <td className="max-w-xs px-3 py-2 text-muted-foreground">
                                                        {r.observacion ? (
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    toggleObs(
                                                                        r.id,
                                                                    )
                                                                }
                                                                title="Clic para ver la observación completa"
                                                                className="flex items-start gap-1 text-left hover:text-foreground"
                                                            >
                                                                <span
                                                                    className={
                                                                        expandedObs.has(
                                                                            r.id,
                                                                        )
                                                                            ? 'whitespace-pre-wrap'
                                                                            : 'line-clamp-1'
                                                                    }
                                                                >
                                                                    {
                                                                        r.observacion
                                                                    }
                                                                </span>
                                                                <ChevronDown
                                                                    className={`mt-0.5 size-3.5 shrink-0 transition-transform ${expandedObs.has(r.id) ? 'rotate-180' : ''}`}
                                                                />
                                                            </button>
                                                        ) : (
                                                            '—'
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        {r.estadoQx}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        {r.usuario}
                                                    </td>
                                                    <td className="px-3 py-2 text-muted-foreground">
                                                        {r.modificadoEn || '—'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal: Crear usuario (paciente) sin salir de la radicación */}
            {/* Crear especialidad desde el botón + del campo Especialidad */}
            <Dialog open={espCrearOpen} onOpenChange={setEspCrearOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Crear especialidad</DialogTitle>
                        <DialogDescription>
                            Registra una especialidad que no exista todavía. Al
                            crearla quedará seleccionada en la radicación.
                        </DialogDescription>
                    </DialogHeader>

                    <form
                        onSubmit={submitNuevaEspecialidad}
                        className="grid gap-4"
                    >
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <Label>Código Servinte *</Label>
                                <Input
                                    value={nuevaEsp.espcodser}
                                    onChange={(e) =>
                                        setNuevaEsp((p) => ({
                                            ...p,
                                            espcodser: e.target.value,
                                        }))
                                    }
                                    maxLength={10}
                                    placeholder="Ej. 137"
                                    autoFocus
                                />
                                {espErrors.espcodser && (
                                    <span className="text-xs text-red-600">
                                        {espErrors.espcodser}
                                    </span>
                                )}
                            </div>
                            <div className="grid gap-2">
                                <Label>Código MinSalud</Label>
                                <Input
                                    value={nuevaEsp.codminsal}
                                    onChange={(e) =>
                                        setNuevaEsp((p) => ({
                                            ...p,
                                            codminsal: e.target.value,
                                        }))
                                    }
                                    maxLength={10}
                                    placeholder="Ej. Q01"
                                />
                                {espErrors.codminsal && (
                                    <span className="text-xs text-red-600">
                                        {espErrors.codminsal}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label>Nombre *</Label>
                            <Input
                                value={nuevaEsp.Nombre}
                                onChange={(e) =>
                                    setNuevaEsp((p) => ({
                                        ...p,
                                        Nombre: e.target.value,
                                    }))
                                }
                                maxLength={120}
                            />
                            {espErrors.Nombre && (
                                <span className="text-xs text-red-600">
                                    {espErrors.Nombre}
                                </span>
                            )}
                        </div>

                        <div className="grid gap-2">
                            <Label>Observación</Label>
                            <Textarea
                                value={nuevaEsp.Observacion}
                                onChange={(e) =>
                                    setNuevaEsp((p) => ({
                                        ...p,
                                        Observacion: e.target.value,
                                    }))
                                }
                                rows={2}
                                maxLength={300}
                            />
                            {espErrors.Observacion && (
                                <span className="text-xs text-red-600">
                                    {espErrors.Observacion}
                                </span>
                            )}
                        </div>

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setEspCrearOpen(false)}
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={espCreando}
                                className="gap-2"
                                style={{ backgroundColor: BRAND }}
                            >
                                {espCreando && (
                                    <LoaderCircle className="size-4 animate-spin" />
                                )}
                                Crear especialidad
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={crearOpen} onOpenChange={setCrearOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {editandoId
                                ? 'Editar usuario'
                                : modoUsuario === 'medico'
                                  ? 'Crear médico'
                                  : 'Crear usuario'}
                        </DialogTitle>
                        <DialogDescription>
                            {editandoId
                                ? 'Actualiza la información del usuario existente. Al guardar se recargará como paciente en la radicación.'
                                : modoUsuario === 'medico'
                                  ? 'Completa la información para registrar un médico nuevo. Al crearlo quedará seleccionado en el campo Médico de la radicación.'
                                  : 'Completa la información para registrar un nuevo usuario. Al crearlo se cargará como paciente en la radicación.'}
                        </DialogDescription>
                    </DialogHeader>

                    <form
                        onSubmit={submitNuevoUsuario}
                        className="grid max-h-[70vh] gap-4 overflow-y-auto px-1"
                    >
                        <div className="grid gap-2">
                            <Label>Rol *</Label>
                            <Select
                                value={nuevoUsuario.rol}
                                onValueChange={(v) => {
                                    setU('rol', v);
                                    // La especialidad no se pide en ningún rol.
                                    setU('codesp', '');
                                    // Lo escrito en un campo que el rol nuevo
                                    // no pide se descarta: no debe guardarse
                                    // un dato que el usuario dejó de ver.
                                    const c = camposParaRol(v);
                                    if (!c.correo) setU('email', '');
                                    if (!c.telefono1) setU('Telefono1', '');
                                    if (!c.telefono2) setU('telefono2', '');
                                    if (!c.direccion) setU('Direccion', '');
                                    if (!c.eps) setU('Eps', '');
                                    if (!c.contrasena) {
                                        setU('password', '');
                                        setU('password_confirmation', '');
                                    }
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccione" />
                                </SelectTrigger>
                                <SelectContent>
                                    {rolesList.map((r) => (
                                        <SelectItem key={r.id} value={r.Nombre}>
                                            {r.Nombre}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {userErrors.rol && (
                                <span className="text-xs text-red-600">
                                    {userErrors.rol}
                                </span>
                            )}
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <Label>Nombres *</Label>
                                <Input
                                    value={nuevoUsuario.name}
                                    onChange={(e) =>
                                        setU('name', e.target.value)
                                    }
                                    autoFocus
                                />
                                {userErrors.name && (
                                    <span className="text-xs text-red-600">
                                        {userErrors.name}
                                    </span>
                                )}
                            </div>
                            <div className="grid gap-2">
                                <Label>Primer apellido</Label>
                                <Input
                                    value={nuevoUsuario.Apellido1}
                                    onChange={(e) =>
                                        setU('Apellido1', e.target.value)
                                    }
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Segundo apellido</Label>
                                <Input
                                    value={nuevoUsuario.apellido2}
                                    onChange={(e) =>
                                        setU('apellido2', e.target.value)
                                    }
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Tipo de documento</Label>
                                <Select
                                    value={nuevoUsuario.tipo_Docu}
                                    onValueChange={(v) => setU('tipo_Docu', v)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {tiposDocumento.map((t) => (
                                            <SelectItem
                                                key={t.id}
                                                value={t.Nombre}
                                            >
                                                {t.Nombre}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label>Número de documento</Label>
                                <Input
                                    value={nuevoUsuario.Numero_D}
                                    onChange={(e) =>
                                        setU('Numero_D', e.target.value)
                                    }
                                    maxLength={20}
                                />
                                {userErrors.Numero_D && (
                                    <span className="text-xs text-red-600">
                                        {userErrors.Numero_D}
                                    </span>
                                )}
                            </div>
                            {camposUsuario.correo && (
                                <div className="grid gap-2">
                                    <Label>Correo electrónico *</Label>
                                    <Input
                                        type="email"
                                        value={nuevoUsuario.email}
                                        onChange={(e) =>
                                            setU('email', e.target.value)
                                        }
                                    />
                                    {userErrors.email && (
                                        <span className="text-xs text-red-600">
                                            {userErrors.email}
                                        </span>
                                    )}
                                </div>
                            )}
                            {camposUsuario.telefono1 && (
                                <div className="grid gap-2">
                                    <Label>Teléfono 1</Label>
                                    <Input
                                        value={nuevoUsuario.Telefono1}
                                        onChange={(e) =>
                                            setU('Telefono1', e.target.value)
                                        }
                                    />
                                </div>
                            )}
                            {camposUsuario.telefono2 && (
                                <div className="grid gap-2">
                                    <Label>Teléfono 2</Label>
                                    <Input
                                        value={nuevoUsuario.telefono2}
                                        onChange={(e) =>
                                            setU('telefono2', e.target.value)
                                        }
                                    />
                                </div>
                            )}
                        </div>

                        {camposUsuario.direccion && (
                            <div className="grid gap-2">
                                <Label>Dirección</Label>
                                <Input
                                    value={nuevoUsuario.Direccion}
                                    onChange={(e) =>
                                        setU('Direccion', e.target.value)
                                    }
                                />
                            </div>
                        )}
                        {camposUsuario.eps && (
                            <>
                                <div className="grid gap-2">
                                    <Label>EPS</Label>
                                    <Select
                                        value={nuevoUsuario.Eps}
                                        onValueChange={(v) => setU('Eps', v)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccione la EPS" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {epsList.map((e) => (
                                                <SelectItem
                                                    key={e.id}
                                                    value={e.Nombre}
                                                >
                                                    {e.Nombre}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {userErrors.Eps && (
                                        <span className="text-xs text-red-600">
                                            {userErrors.Eps}
                                        </span>
                                    )}
                                </div>
                            </>
                        )}

                        {camposUsuario.contrasena && (
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label>
                                        {editandoId
                                            ? 'Contraseña (dejar en blanco para no cambiarla)'
                                            : 'Contraseña *'}
                                    </Label>
                                    <Input
                                        type="password"
                                        value={nuevoUsuario.password}
                                        onChange={(e) =>
                                            setU('password', e.target.value)
                                        }
                                    />
                                    {userErrors.password && (
                                        <span className="text-xs text-red-600">
                                            {userErrors.password}
                                        </span>
                                    )}
                                </div>
                                <div className="grid gap-2">
                                    <Label>Confirmar contraseña</Label>
                                    <Input
                                        type="password"
                                        value={
                                            nuevoUsuario.password_confirmation
                                        }
                                        onChange={(e) =>
                                            setU(
                                                'password_confirmation',
                                                e.target.value,
                                            )
                                        }
                                    />
                                </div>
                            </div>
                        )}

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setCrearOpen(false)}
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={creando}
                                className="gap-2 text-white"
                                style={{ backgroundColor: BRAND }}
                            >
                                {creando && (
                                    <LoaderCircle className="size-4 animate-spin" />
                                )}
                                {editandoId
                                    ? 'Actualizar usuario'
                                    : 'Crear usuario'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Confirmación de borrado de caso (solo Super Admin) */}
            <Dialog open={borrarOpen} onOpenChange={setBorrarOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Eliminar caso</DialogTitle>
                        <DialogDescription>
                            Esta acción no se puede deshacer. Se eliminará el
                            caso{' '}
                            <span className="font-semibold text-foreground">
                                #{caso?.codrad}
                            </span>{' '}
                            junto con sus procedimientos y su trazabilidad.
                            ¿Deseas continuar?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setBorrarOpen(false)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={borrarCaso}
                            disabled={borrando}
                            className="gap-2"
                        >
                            {borrando && (
                                <LoaderCircle className="size-4 animate-spin" />
                            )}
                            Eliminar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Diálogo Modificar Radicado */}
            <Dialog open={modifOpen} onOpenChange={setModifOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            Modificar Radicado — Caso #{caso?.codrad}
                        </DialogTitle>
                        <DialogDescription>
                            Corrige los datos principales del radicado. Los
                            cambios se guardan directamente sobre el caso.
                        </DialogDescription>
                    </DialogHeader>

                    {modifError && (
                        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                            <X className="size-4" />
                            {modifError}
                        </div>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label>Médico *</Label>
                            <Select
                                value={modif.codMed}
                                onValueChange={(v) =>
                                    setModifField('codMed', v)
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccione…" />
                                </SelectTrigger>
                                <SelectContent>
                                    {medicosList.map((m) => (
                                        <SelectItem
                                            key={m.id}
                                            value={String(m.id)}
                                        >
                                            {[m.name, m.Apellido1, m.apellido2]
                                                .filter(Boolean)
                                                .join(' ')}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Estado Actual *</Label>
                            <Select
                                value={modif.estRad}
                                onValueChange={(v) =>
                                    setModifField('estRad', v)
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccione…" />
                                </SelectTrigger>
                                <SelectContent>
                                    {estados.map((s) => (
                                        <SelectItem
                                            key={s.id}
                                            value={String(s.id)}
                                        >
                                            {s.Nombre}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Entrega a Programación *</Label>
                            <Input
                                type="date"
                                value={modif.fentregapro}
                                onChange={(e) =>
                                    setModifField('fentregapro', e.target.value)
                                }
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Fecha Recibido *</Label>
                            <Input
                                type="date"
                                value={modif.fecreci}
                                onChange={(e) =>
                                    setModifField('fecreci', e.target.value)
                                }
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Fecha Autorización *</Label>
                            <Input
                                type="date"
                                value={modif.fecAutorizacion}
                                onChange={(e) =>
                                    setModifField(
                                        'fecAutorizacion',
                                        e.target.value,
                                    )
                                }
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Fecha Vencimiento Autorización *</Label>
                            <Input
                                type="date"
                                value={modif.fechavenautorizacion}
                                onChange={(e) =>
                                    setModifField(
                                        'fechavenautorizacion',
                                        e.target.value,
                                    )
                                }
                            />
                        </div>
                        <div className="grid gap-2 sm:col-span-2">
                            <Label>Copago</Label>
                            <div className="flex items-center gap-3">
                                <label className="flex h-9 cursor-pointer items-center gap-2 text-sm">
                                    <Checkbox
                                        checked={modif.copago}
                                        onCheckedChange={(v) => {
                                            const marcado = v === true;
                                            setModif((prev) => ({
                                                ...prev,
                                                copago: marcado,
                                                valor_copago: marcado
                                                    ? prev.valor_copago
                                                    : '',
                                            }));
                                        }}
                                    />
                                    <span className="text-foreground">
                                        Aplica
                                    </span>
                                </label>
                                {modif.copago && (
                                    <Input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={modif.valor_copago}
                                        onChange={(e) =>
                                            setModifField(
                                                'valor_copago',
                                                e.target.value,
                                            )
                                        }
                                        placeholder="Valor"
                                        className="flex-1"
                                    />
                                )}
                            </div>
                        </div>
                        <div className="grid gap-2 sm:col-span-2">
                            <Label>Paquete (PDF, máx. 30 MB)</Label>
                            <Input
                                type="file"
                                accept="application/pdf"
                                onChange={(e) =>
                                    setModif((prev) => ({
                                        ...prev,
                                        paquete: e.target.files?.[0] ?? null,
                                    }))
                                }
                                className="cursor-pointer file:mr-2 file:cursor-pointer file:rounded file:border-0 file:bg-muted file:px-2 file:py-0.5 file:text-xs"
                            />
                            <span className="text-xs text-muted-foreground">
                                {modif.paquete ? (
                                    <>
                                        Se reemplazará por: {modif.paquete.name}
                                    </>
                                ) : caso?.paqueteUrl ? (
                                    <>
                                        Actual:{' '}
                                        <a
                                            href={caso.paqueteUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="underline"
                                        >
                                            {caso.paquete}
                                        </a>
                                        . Sube uno nuevo solo si quieres
                                        reemplazarlo.
                                    </>
                                ) : (
                                    'Sin archivo adjunto.'
                                )}
                            </span>
                        </div>
                        <div className="grid gap-2 sm:col-span-2">
                            <Label>OB TFX</Label>
                            <Textarea
                                value={modif.ObservacionTFX}
                                onChange={(e) =>
                                    setModifField(
                                        'ObservacionTFX',
                                        e.target.value,
                                    )
                                }
                                rows={2}
                                placeholder="Observación (opcional)"
                            />
                        </div>
                    </div>

                    {/* Códigos CUPS del radicado */}
                    <div className="grid gap-2 rounded-lg border bg-muted/20 p-3">
                        <Label>Códigos CUPS y autorizaciones *</Label>
                        {modif.procedimientos.map((p, i) => (
                            <div
                                key={i}
                                className="flex flex-col gap-2 sm:flex-row sm:items-center"
                            >
                                <CupsCombobox
                                    selectedLabel={
                                        cupsDe(p.cusv_id)?.CodCupsHuv ??
                                        (p.cusv_id ? cupsNombre(p.cusv_id) : '')
                                    }
                                    onSelect={(c) => {
                                        setCupsCatalogo((prev) => ({
                                            ...prev,
                                            [String(c.id)]: c,
                                        }));
                                        setModifProc(
                                            i,
                                            'cusv_id',
                                            String(c.id),
                                        );
                                    }}
                                />
                                <Input
                                    value={cupsNombre(p.cusv_id)}
                                    readOnly
                                    placeholder="Descripción del procedimiento"
                                    className="flex-1 bg-muted/40"
                                />
                                <Input
                                    value={p.N_Autorizacion}
                                    onChange={(e) =>
                                        setModifProc(
                                            i,
                                            'N_Autorizacion',
                                            e.target.value,
                                        )
                                    }
                                    maxLength={20}
                                    placeholder="N° Autorización EPS"
                                    className="sm:w-44"
                                />
                                <Button
                                    type="button"
                                    variant="destructive"
                                    size="icon"
                                    className="shrink-0"
                                    title="Quitar"
                                    disabled={modif.procedimientos.length === 1}
                                    onClick={() => removeModifProc(i)}
                                >
                                    <X className="size-4" />
                                </Button>
                            </div>
                        ))}
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-fit gap-1"
                            onClick={addModifProc}
                        >
                            <Plus className="size-4" />
                            Agregar otro CUPS
                        </Button>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setModifOpen(false)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            onClick={guardarRadicado}
                            disabled={modifSaving}
                            className="gap-2"
                            style={{ backgroundColor: BRAND }}
                        >
                            {modifSaving ? (
                                <LoaderCircle className="size-4 animate-spin" />
                            ) : (
                                <Save className="size-4" />
                            )}
                            Guardar cambios
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
