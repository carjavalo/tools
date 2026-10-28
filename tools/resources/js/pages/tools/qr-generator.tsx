import { useState } from 'react';
import { Head } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Download,
    Copy,
    RefreshCw,
    ScanQrCode,
    Building2,
    HelpCircle,
    Link2,
    Type,
    Wifi,
    Mail,
    Phone,
    MessageCircle,
    Contact,
    Eye,
    EyeOff,
    AlertCircle,
    type LucideIcon,
} from 'lucide-react';
import QRCodeLib from 'qrcode';
import ToolPageHeader from '@/components/ToolPageHeader';
import ToolCard from '@/components/ToolCard';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

type ContentType = 'url' | 'text' | 'wifi' | 'email' | 'phone' | 'whatsapp' | 'vcard';
type ErrorLevel = 'L' | 'M' | 'Q' | 'H';

interface QRData {
    size: number;
    errorCorrectionLevel: ErrorLevel;
    includeInstitutionalLogo: boolean;
    format: 'png' | 'svg' | 'jpeg';
    backgroundColor: string;
    foregroundColor: string;
}

interface ContentFields {
    url: string;
    text: string;
    wifiSsid: string;
    wifiPassword: string;
    wifiSecurity: 'WPA' | 'WEP' | 'nopass';
    wifiHidden: boolean;
    emailTo: string;
    emailSubject: string;
    emailBody: string;
    phone: string;
    whatsappNumber: string;
    whatsappMessage: string;
    contactFirstName: string;
    contactLastName: string;
    contactOrganization: string;
    contactTitle: string;
    contactPhone: string;
    contactEmail: string;
    contactWebsite: string;
    contactAddress: string;
}

interface GeneratedQR {
    url: string;
    payload: string;
    type: ContentType;
    size: number;
    errorCorrectionLevel: ErrorLevel;
    withLogo: boolean;
}

const CONTENT_TYPES: { id: ContentType; label: string; icon: LucideIcon }[] = [
    { id: 'url', label: 'Enlace', icon: Link2 },
    { id: 'text', label: 'Texto', icon: Type },
    { id: 'wifi', label: 'WiFi', icon: Wifi },
    { id: 'email', label: 'Correo', icon: Mail },
    { id: 'phone', label: 'Teléfono', icon: Phone },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
    { id: 'vcard', label: 'Contacto', icon: Contact },
];

const EMPTY_FIELDS: ContentFields = {
    url: '',
    text: '',
    wifiSsid: '',
    wifiPassword: '',
    wifiSecurity: 'WPA',
    wifiHidden: false,
    emailTo: '',
    emailSubject: '',
    emailBody: '',
    phone: '',
    whatsappNumber: '',
    whatsappMessage: '',
    contactFirstName: '',
    contactLastName: '',
    contactOrganization: '',
    contactTitle: '',
    contactPhone: '',
    contactEmail: '',
    contactWebsite: '',
    contactAddress: '',
};

// Ancho del logo respecto al QR. Con corrección H (30%) el código sigue leyéndose.
const LOGO_WIDTH_RATIO = 0.3;
const QR_MARGIN = 4;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Caracteres reservados de cada formato.
const escapeWifi = (value: string) => value.replace(/([\\;,:"])/g, '\\$1');
const escapeVCard = (value: string) => value.replace(/([\\;,])/g, '\\$1').replace(/\r?\n/g, '\\n');
const digitsOnly = (value: string) => value.replace(/\D/g, '');

/**
 * Convierte los campos del formulario en el texto que va dentro del QR, en el
 * formato que entienden las cámaras de los celulares. `payload` es null si
 * faltan datos; `problem` explica qué corregir.
 */
function buildPayload(type: ContentType, f: ContentFields): { payload: string | null; problem: string | null } {
    const none = { payload: null, problem: null };
    const invalid = (problem: string) => ({ payload: null, problem });

    switch (type) {
        case 'url': {
            const value = f.url.trim();
            if (!value) return none;
            const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
            try {
                new URL(withScheme);
            } catch {
                return invalid('El enlace no es válido. Ejemplo: https://www.huv.gov.co');
            }
            return { payload: withScheme, problem: null };
        }
        case 'text':
            return f.text.trim() ? { payload: f.text, problem: null } : none;
        case 'wifi': {
            if (!f.wifiSsid.trim()) return none;
            if (f.wifiSecurity !== 'nopass' && !f.wifiPassword) {
                return invalid('Escribe la contraseña de la red o elige «Sin contraseña».');
            }
            const password = f.wifiSecurity !== 'nopass' ? `P:${escapeWifi(f.wifiPassword)};` : '';
            return {
                payload: `WIFI:T:${f.wifiSecurity};S:${escapeWifi(f.wifiSsid)};${password}${f.wifiHidden ? 'H:true;' : ''};`,
                problem: null,
            };
        }
        case 'email': {
            const to = f.emailTo.trim();
            if (!to) return none;
            if (!EMAIL_PATTERN.test(to)) return invalid('El correo no es válido. Ejemplo: citas@huv.gov.co');
            const params = [
                f.emailSubject.trim() && `subject=${encodeURIComponent(f.emailSubject.trim())}`,
                f.emailBody.trim() && `body=${encodeURIComponent(f.emailBody.trim())}`,
            ].filter(Boolean);
            return { payload: `mailto:${to}${params.length ? `?${params.join('&')}` : ''}`, problem: null };
        }
        case 'phone': {
            const value = f.phone.trim();
            if (!value) return none;
            if (digitsOnly(value).length < 7) return invalid('El número debe tener al menos 7 dígitos.');
            return { payload: `tel:${value.replace(/[^\d+]/g, '')}`, problem: null };
        }
        case 'whatsapp': {
            let digits = digitsOnly(f.whatsappNumber);
            if (!digits) return none;
            // Celular colombiano sin indicativo: se agrega el 57.
            if (digits.length === 10 && digits.startsWith('3')) digits = `57${digits}`;
            if (digits.length < 11) return invalid('Escribe el número con indicativo de país, por ejemplo 57 300 123 4567.');
            const message = f.whatsappMessage.trim();
            return { payload: `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ''}`, problem: null };
        }
        case 'vcard': {
            const first = f.contactFirstName.trim();
            const last = f.contactLastName.trim();
            const organization = f.contactOrganization.trim();
            if (!first && !last && !organization) return none;
            const email = f.contactEmail.trim();
            if (email && !EMAIL_PATTERN.test(email)) return invalid('El correo del contacto no es válido.');

            const fullName = [first, last].filter(Boolean).join(' ') || organization;
            const lines = [
                'BEGIN:VCARD',
                'VERSION:3.0',
                `N:${escapeVCard(last)};${escapeVCard(first)};;;`,
                `FN:${escapeVCard(fullName)}`,
                organization && `ORG:${escapeVCard(organization)}`,
                f.contactTitle.trim() && `TITLE:${escapeVCard(f.contactTitle.trim())}`,
                f.contactPhone.trim() && `TEL;TYPE=CELL:${f.contactPhone.trim().replace(/[^\d+]/g, '')}`,
                email && `EMAIL:${escapeVCard(email)}`,
                f.contactWebsite.trim() && `URL:${escapeVCard(f.contactWebsite.trim())}`,
                f.contactAddress.trim() && `ADR;TYPE=WORK:;;${escapeVCard(f.contactAddress.trim())};;;;`,
                'END:VCARD',
            ].filter(Boolean);
            return { payload: lines.join('\n'), problem: null };
        }
    }
}

const loadImage = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = src;
    });

// Rectángulo con esquinas redondeadas (fondo blanco detrás del logo).
function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

// Caja del logo centrada, respetando la proporción de la imagen (el PNG es 5:4).
function logoBox(size: number, aspectRatio: number) {
    const logoWidth = size * LOGO_WIDTH_RATIO;
    const logoHeight = logoWidth * aspectRatio;
    const padding = size * 0.03;
    const boxWidth = logoWidth + padding * 2;
    const boxHeight = logoHeight + padding * 2;

    return {
        logo: { x: (size - logoWidth) / 2, y: (size - logoHeight) / 2, width: logoWidth, height: logoHeight },
        box: { x: (size - boxWidth) / 2, y: (size - boxHeight) / 2, width: boxWidth, height: boxHeight },
        radius: size * 0.03,
    };
}

async function logoAsDataUrl(): Promise<string> {
    const blob = await (await fetch('/images/logo.png')).blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

export default function QRGenerator() {
    const [qrData, setQRData] = useState<QRData>({
        size: 256,
        errorCorrectionLevel: 'H',
        includeInstitutionalLogo: true,
        format: 'png',
        backgroundColor: '#ffffff',
        foregroundColor: '#2d3e83'
    });
    const [contentType, setContentType] = useState<ContentType>('url');
    const [fields, setFields] = useState<ContentFields>(EMPTY_FIELDS);
    const [showWifiPassword, setShowWifiPassword] = useState(false);
    const [generated, setGenerated] = useState<GeneratedQR | null>(null);
    const [generationError, setGenerationError] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    const { payload, problem } = buildPayload(contentType, fields);
    // El logo tapa parte del código: solo con corrección máxima sigue leyéndose.
    const effectiveLevel: ErrorLevel = qrData.includeInstitutionalLogo ? 'H' : qrData.errorCorrectionLevel;
    const isStale = generated !== null && (generated.payload !== payload || generated.size !== qrData.size
        || generated.withLogo !== qrData.includeInstitutionalLogo || generated.errorCorrectionLevel !== effectiveLevel);

    const updateField = <K extends keyof ContentFields>(key: K, value: ContentFields[K]) => {
        setFields(prev => ({ ...prev, [key]: value }));
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
                    element: '[data-tour="config"]',
                    popover: {
                        title: 'Paso 1: Elegir el Contenido',
                        description: 'Elige qué abrirá el código al escanearlo: un enlace, un texto, una red WiFi, un correo, una llamada, un chat de WhatsApp o un contacto. Llena los campos y el código se arma con el formato correcto.',
                        side: 'right',
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="options"]',
                    popover: {
                        title: 'Paso 2: Ajustar Opciones',
                        description: 'Elige el tamaño, el formato de descarga (PNG, JPEG o SVG) y si quieres el logo institucional en el centro.',
                        side: 'right',
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="action"]',
                    popover: {
                        title: 'Paso 3: Generar Código QR',
                        description: 'Haz clic en "Generar Código QR". El botón solo estará activo cuando el contenido esté completo.',
                        side: 'right',
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="preview"]',
                    popover: {
                        title: 'Paso 4: Descargar o Copiar',
                        description: 'Tu código QR aparecerá en la vista previa. Escanéalo con tu celular para comprobarlo y luego descárgalo o cópialo al portapapeles.',
                        side: 'left',
                        align: 'start'
                    }
                }
            ]
        });
        driverObj.drive();
    };

    const generateQR = async () => {
        if (!payload) return;

        setIsLoading(true);
        setGenerationError('');
        try {
            // QR Code generation options
            const options = {
                errorCorrectionLevel: effectiveLevel,
                width: qrData.size,
                color: {
                    dark: qrData.foregroundColor,
                    light: qrData.backgroundColor
                },
                margin: QR_MARGIN
            };

            // Generate QR code as data URL
            const qrDataUrl = await QRCodeLib.toDataURL(payload, options);
            const url = qrData.includeInstitutionalLogo ? await addLogoToQR(qrDataUrl, qrData.size) : qrDataUrl;

            setGenerated({
                url,
                payload,
                type: contentType,
                size: qrData.size,
                errorCorrectionLevel: effectiveLevel,
                withLogo: qrData.includeInstitutionalLogo
            });

        } catch (error) {
            console.error('Error:', error);
            const tooBig = error instanceof Error && error.message.toLowerCase().includes('too big');
            setGenerationError(tooBig
                ? 'El contenido es demasiado largo para un código QR. Acórtalo o quita algunos campos.'
                : 'Error generando el código QR. Por favor intenta de nuevo.');
        } finally {
            setIsLoading(false);
        }
    };

    const addLogoToQR = async (qrDataUrl: string, size: number): Promise<string> => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return qrDataUrl;

        canvas.width = size;
        canvas.height = size;
        ctx.drawImage(await loadImage(qrDataUrl), 0, 0, size, size);

        try {
            const logoImg = await loadImage('/images/logo.png');
            const { logo, box, radius } = logoBox(size, logoImg.naturalHeight / logoImg.naturalWidth || 1);

            ctx.fillStyle = '#ffffff';
            roundedRectPath(ctx, box.x, box.y, box.width, box.height, radius);
            ctx.fill();
            ctx.strokeStyle = '#e5e7eb';
            ctx.lineWidth = Math.max(1, size / 128);
            ctx.stroke();

            ctx.drawImage(logoImg, logo.x, logo.y, logo.width, logo.height);
        } catch {
            // Fallback a texto si el logo no carga
            const { box, radius } = logoBox(size, 0.8);

            ctx.fillStyle = '#ffffff';
            roundedRectPath(ctx, box.x, box.y, box.width, box.height, radius);
            ctx.fill();
            ctx.strokeStyle = '#2d3e83';
            ctx.lineWidth = Math.max(2, size / 85);
            ctx.stroke();

            ctx.fillStyle = '#2d3e83';
            ctx.font = `bold ${Math.floor(box.height * 0.4)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('HUV', size / 2, size / 2);
        }

        return canvas.toDataURL();
    };

    // SVG vectorial con el mismo logo que la imagen PNG.
    const buildSvg = async (qr: GeneratedQR): Promise<string> => {
        let svg = await QRCodeLib.toString(qr.payload, {
            type: 'svg',
            errorCorrectionLevel: qr.errorCorrectionLevel,
            width: qr.size,
            margin: QR_MARGIN,
            color: {
                dark: qrData.foregroundColor,
                light: qrData.backgroundColor
            }
        });

        if (!qr.withLogo) return svg;

        // El SVG de qrcode trabaja en módulos (viewBox="0 0 N N"), no en píxeles.
        const units = parseFloat(svg.match(/viewBox="0 0 ([\d.]+)/)?.[1] ?? '0');
        if (!units) return svg;

        const logoDataUrl = await logoAsDataUrl();
        const logoImg = await loadImage(logoDataUrl);
        const { logo, box, radius } = logoBox(units, logoImg.naturalHeight / logoImg.naturalWidth || 1);

        // xlink:href lo entienden tanto los navegadores como Illustrator, Inkscape y Word.
        const overlay =
            `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="${radius}" fill="#ffffff" stroke="#e5e7eb" stroke-width="${units / 128}"/>` +
            `<image x="${logo.x}" y="${logo.y}" width="${logo.width}" height="${logo.height}" xlink:href="${logoDataUrl}" preserveAspectRatio="xMidYMid meet"/>`;

        svg = svg.replace('<svg ', '<svg xmlns:xlink="http://www.w3.org/1999/xlink" ');
        return svg.replace('</svg>', `${overlay}</svg>`);
    };

    const triggerDownload = (href: string, filename: string) => {
        const link = document.createElement('a');
        link.href = href;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const downloadQR = async () => {
        if (!generated) return;

        const filename = `qr-${generated.type}.${qrData.format}`;
        try {
            if (qrData.format === 'jpeg') {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) return;
                canvas.width = generated.size;
                canvas.height = generated.size;

                // Fill white background for JPEG
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(await loadImage(generated.url), 0, 0);
                triggerDownload(canvas.toDataURL('image/jpeg', 0.92), filename);
            } else if (qrData.format === 'svg') {
                const blob = new Blob([await buildSvg(generated)], { type: 'image/svg+xml' });
                const url = URL.createObjectURL(blob);
                triggerDownload(url, filename);
                URL.revokeObjectURL(url);
            } else {
                triggerDownload(generated.url, filename);
            }
        } catch (error) {
            console.error('Error downloading QR:', error);
            alert('Error descargando el código QR');
        }
    };

    const copyToClipboard = async () => {
        if (!generated) return;
        try {
            const response = await fetch(generated.url);
            const blob = await response.blob();
            await navigator.clipboard.write([
                new ClipboardItem({ [blob.type]: blob })
            ]);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Error copying to clipboard:', error);
            alert('Error copiando al portapapeles');
        }
    };

    const renderFields = () => {
        switch (contentType) {
            case 'url':
                return (
                    <div className="space-y-2">
                        <Label htmlFor="qr-url">Enlace</Label>
                        <Input
                            id="qr-url"
                            type="url"
                            inputMode="url"
                            placeholder="https://www.huv.gov.co"
                            value={fields.url}
                            onChange={(e) => updateField('url', e.target.value)}
                        />
                        <p className="text-xs text-slate-600 dark:text-slate-300">Si no escribes «https://», se agrega automáticamente.</p>
                    </div>
                );
            case 'text':
                return (
                    <div className="space-y-2">
                        <Label htmlFor="qr-text">Texto</Label>
                        <Textarea
                            id="qr-text"
                            rows={4}
                            placeholder="Escribe el texto que se mostrará al escanear el código"
                            value={fields.text}
                            onChange={(e) => updateField('text', e.target.value)}
                        />
                    </div>
                );
            case 'wifi':
                return (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="wifi-ssid">Nombre de la red (SSID)</Label>
                            <Input id="wifi-ssid" placeholder="HUV-Visitantes" value={fields.wifiSsid} onChange={(e) => updateField('wifiSsid', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Seguridad</Label>
                            <Select value={fields.wifiSecurity} onValueChange={(value: ContentFields['wifiSecurity']) => updateField('wifiSecurity', value)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="WPA">WPA / WPA2 / WPA3 (la más común)</SelectItem>
                                    <SelectItem value="WEP">WEP</SelectItem>
                                    <SelectItem value="nopass">Sin contraseña</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {fields.wifiSecurity !== 'nopass' && (
                            <div className="space-y-2">
                                <Label htmlFor="wifi-password">Contraseña</Label>
                                <div className="relative">
                                    <Input
                                        id="wifi-password"
                                        type={showWifiPassword ? 'text' : 'password'}
                                        autoComplete="off"
                                        className="pr-10"
                                        value={fields.wifiPassword}
                                        onChange={(e) => updateField('wifiPassword', e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowWifiPassword(!showWifiPassword)}
                                        aria-label={showWifiPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                        className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
                                    >
                                        {showWifiPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                        )}
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={fields.wifiHidden}
                                onChange={(e) => updateField('wifiHidden', e.target.checked)}
                                className="rounded border-gray-300"
                            />
                            Red oculta
                        </label>
                    </div>
                );
            case 'email':
                return (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email-to">Correo de destino</Label>
                            <Input id="email-to" type="email" placeholder="citas@huv.gov.co" value={fields.emailTo} onChange={(e) => updateField('emailTo', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email-subject">Asunto (opcional)</Label>
                            <Input id="email-subject" placeholder="Solicitud de cita" value={fields.emailSubject} onChange={(e) => updateField('emailSubject', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email-body">Mensaje (opcional)</Label>
                            <Textarea id="email-body" rows={3} value={fields.emailBody} onChange={(e) => updateField('emailBody', e.target.value)} />
                        </div>
                    </div>
                );
            case 'phone':
                return (
                    <div className="space-y-2">
                        <Label htmlFor="phone-number">Número de teléfono</Label>
                        <Input id="phone-number" type="tel" placeholder="+57 602 620 6000" value={fields.phone} onChange={(e) => updateField('phone', e.target.value)} />
                        <p className="text-xs text-slate-600 dark:text-slate-300">Al escanearlo, el celular ofrecerá llamar a este número.</p>
                    </div>
                );
            case 'whatsapp':
                return (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="whatsapp-number">Número de WhatsApp</Label>
                            <Input id="whatsapp-number" type="tel" placeholder="300 123 4567" value={fields.whatsappNumber} onChange={(e) => updateField('whatsappNumber', e.target.value)} />
                            <p className="text-xs text-slate-600 dark:text-slate-300">A los celulares colombianos de 10 dígitos se les agrega el indicativo 57.</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="whatsapp-message">Mensaje inicial (opcional)</Label>
                            <Textarea id="whatsapp-message" rows={3} placeholder="Hola, quiero información sobre..." value={fields.whatsappMessage} onChange={(e) => updateField('whatsappMessage', e.target.value)} />
                        </div>
                    </div>
                );
            case 'vcard':
                return (
                    <div className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="contact-first">Nombres</Label>
                                <Input id="contact-first" value={fields.contactFirstName} onChange={(e) => updateField('contactFirstName', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="contact-last">Apellidos</Label>
                                <Input id="contact-last" value={fields.contactLastName} onChange={(e) => updateField('contactLastName', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="contact-org">Organización</Label>
                                <Input id="contact-org" placeholder="Hospital Universitario del Valle" value={fields.contactOrganization} onChange={(e) => updateField('contactOrganization', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="contact-title">Cargo</Label>
                                <Input id="contact-title" value={fields.contactTitle} onChange={(e) => updateField('contactTitle', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="contact-phone">Teléfono</Label>
                                <Input id="contact-phone" type="tel" value={fields.contactPhone} onChange={(e) => updateField('contactPhone', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="contact-email">Correo</Label>
                                <Input id="contact-email" type="email" value={fields.contactEmail} onChange={(e) => updateField('contactEmail', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="contact-web">Sitio web</Label>
                                <Input id="contact-web" type="url" value={fields.contactWebsite} onChange={(e) => updateField('contactWebsite', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="contact-address">Dirección</Label>
                                <Input id="contact-address" value={fields.contactAddress} onChange={(e) => updateField('contactAddress', e.target.value)} />
                            </div>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300">Basta con el nombre o la organización; los demás campos son opcionales.</p>
                    </div>
                );
        }
    };

    return (
        <>
            <Head title="Generador de QR - Evaristools">
                <meta name="description" content="Genera códigos QR personalizados con logo institucional del Hospital Universitario del Valle" />
            </Head>

            <div className="min-h-screen bg-white dark:bg-[#1d1d1e]">
                <ToolPageHeader
                    title="Generador de QR"
                    description="Crea códigos QR personalizados con logo institucional"
                    icon={ScanQrCode}
                    showPopularBadge={true}
                />

                {/* Main Content */}
                <div className="container mx-auto px-4 py-8">
                    <div className="max-w-6xl mx-auto">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                            {/* Left Column - Configuration */}
                            <div className="space-y-6">
                                <ToolCard
                                    title="Contenido del QR"
                                    description="Elige qué abrirá el código al escanearlo"
                                    data-tour="config"
                                >
                                    <div role="radiogroup" aria-label="Tipo de contenido" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                        {CONTENT_TYPES.map(({ id, label, icon: Icon }) => {
                                            const selected = contentType === id;
                                            return (
                                                <button
                                                    key={id}
                                                    type="button"
                                                    role="radio"
                                                    aria-checked={selected}
                                                    onClick={() => setContentType(id)}
                                                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-institutional ${
                                                        selected
                                                            ? 'border-institutional bg-institutional/10 text-institutional ring-1 ring-institutional dark:border-[#8b9bd6] dark:bg-[#8b9bd6]/15 dark:text-white dark:ring-[#8b9bd6]'
                                                            : 'border-slate-200 text-slate-700 hover:border-institutional/60 dark:border-slate-700 dark:text-slate-200 dark:hover:border-[#8b9bd6]/60'
                                                    }`}
                                                >
                                                    <Icon className="h-4 w-4 flex-shrink-0" />
                                                    {label}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {renderFields()}

                                    {problem && (
                                        <p className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
                                            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                                            {problem}
                                        </p>
                                    )}
                                </ToolCard>

                                <ToolCard title="Opciones" data-tour="options">
                                    <div className="space-y-4">
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label htmlFor="size">Tamaño (px)</Label>
                                                <Select
                                                    value={qrData.size.toString()}
                                                    onValueChange={(value) => setQRData({ ...qrData, size: parseInt(value) })}
                                                >
                                                    <SelectTrigger id="size">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="128">128px</SelectItem>
                                                        <SelectItem value="256">256px</SelectItem>
                                                        <SelectItem value="512">512px</SelectItem>
                                                        <SelectItem value="1024">1024px (impresión)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="format">Formato de descarga</Label>
                                                <Select
                                                    value={qrData.format}
                                                    onValueChange={(value: 'png' | 'svg' | 'jpeg') => setQRData({ ...qrData, format: value })}
                                                >
                                                    <SelectTrigger id="format">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="png">PNG</SelectItem>
                                                        <SelectItem value="jpeg">JPEG</SelectItem>
                                                        <SelectItem value="svg">SVG (vectorial)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <div className="flex items-center space-x-2">
                                            <input
                                                type="checkbox"
                                                id="institutional-logo"
                                                checked={qrData.includeInstitutionalLogo}
                                                onChange={(e) => setQRData({ ...qrData, includeInstitutionalLogo: e.target.checked })}
                                                className="rounded border-gray-300"
                                            />
                                            <Label htmlFor="institutional-logo" className="flex items-center space-x-2">
                                                <Building2 className="h-4 w-4" />
                                                <span>Incluir logo institucional HUV</span>
                                            </Label>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="error-correction">Nivel de corrección de errores</Label>
                                            <Select
                                                value={effectiveLevel}
                                                disabled={qrData.includeInstitutionalLogo}
                                                onValueChange={(value: ErrorLevel) => setQRData({ ...qrData, errorCorrectionLevel: value })}
                                            >
                                                <SelectTrigger id="error-correction">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="L">Bajo (L) ~7%</SelectItem>
                                                    <SelectItem value="M">Medio (M) ~15%</SelectItem>
                                                    <SelectItem value="Q">Alto (Q) ~25%</SelectItem>
                                                    <SelectItem value="H">Máximo (H) ~30%</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            {qrData.includeInstitutionalLogo && (
                                                <p className="text-xs text-slate-600 dark:text-slate-300">
                                                    Con logo se usa siempre el nivel máximo, para que el código se lea aunque el logo tape una parte.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </ToolCard>

                                <ToolCard title="Acción" data-tour="action">
                                    <div className="space-y-3">
                                        <Button
                                            onClick={generateQR}
                                            disabled={isLoading || !payload}
                                            className="w-full bg-institutional hover:bg-institutional/90"
                                        >
                                            {isLoading ? (
                                                <>
                                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                                    Generando...
                                                </>
                                            ) : (
                                                <>
                                                    <ScanQrCode className="mr-2 h-4 w-4" />
                                                    Generar Código QR
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

                            {/* Right Column - Preview and Actions */}
                            <div className="space-y-6">
                                <ToolCard
                                    title="Vista Previa"
                                    description="Tu código QR generado aparecerá aquí"
                                    data-tour="preview"
                                >
                                    <div className="flex flex-col items-center space-y-6">
                                        {generationError && (
                                            <p className="flex w-full items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
                                                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                                                {generationError}
                                            </p>
                                        )}
                                        {generated ? (
                                            <>
                                                {isStale && (
                                                    <p className="w-full rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-100">
                                                        Cambiaste el contenido o las opciones: genera el código otra vez para actualizarlo.
                                                    </p>
                                                )}
                                                <div className="rounded-lg border-2 border-dashed border-gray-300 p-4 bg-white max-w-full">
                                                    <img
                                                        src={generated.url}
                                                        alt="Código QR generado"
                                                        className="h-auto max-w-full"
                                                        style={{ width: `${generated.size}px` }}
                                                    />
                                                </div>
                                                <p className="text-xs text-slate-600 dark:text-slate-300">
                                                    {generated.size} × {generated.size} px · Corrección {generated.errorCorrectionLevel} · Escanéalo con tu celular para comprobarlo
                                                </p>
                                                <div className="flex w-full space-x-3">
                                                    <Button
                                                        onClick={downloadQR}
                                                        variant="outline"
                                                        className="flex-1"
                                                    >
                                                        <Download className="mr-2 h-4 w-4" />
                                                        Descargar {qrData.format.toUpperCase()}
                                                    </Button>
                                                    <Button
                                                        onClick={copyToClipboard}
                                                        variant="outline"
                                                        className="flex-1"
                                                    >
                                                        <Copy className="mr-2 h-4 w-4" />
                                                        {copied ? 'Copiado!' : 'Copiar'}
                                                    </Button>
                                                </div>
                                                <details className="w-full text-sm">
                                                    <summary className="cursor-pointer text-slate-600 dark:text-slate-300">Contenido del código</summary>
                                                    <pre className="mt-2 whitespace-pre-wrap break-all rounded-md bg-slate-100 p-3 text-xs text-slate-800 dark:bg-[#1d1d1e] dark:text-slate-200">
                                                        {generated.payload}
                                                    </pre>
                                                </details>
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-64 text-center">
                                                <ScanQrCode className="h-16 w-16 text-gray-400 mb-4" />
                                                <p className="text-gray-500 dark:text-gray-400">
                                                    Ingresa el contenido y genera tu código QR
                                                </p>
                                            </div>
                                        )}
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
