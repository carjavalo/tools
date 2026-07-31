import { useState, useRef } from 'react';
import { Head } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Share2, Copy, RefreshCw, ScanQrCode, Building2, HelpCircle } from 'lucide-react';
import QRCodeLib from 'qrcode';
import ToolPageHeader from '@/components/ToolPageHeader';
import ToolCard from '@/components/ToolCard';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

interface QRData {
    text: string;
    size: number;
    errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H';
    includeInstitutionalLogo: boolean;
    format: 'png' | 'svg' | 'jpeg';
    backgroundColor: string;
    foregroundColor: string;
}

export default function QRGenerator() {
    const [qrData, setQRData] = useState<QRData>({
        text: '',
        size: 256,
        errorCorrectionLevel: 'H',
        includeInstitutionalLogo: true,
        format: 'png',
        backgroundColor: '#ffffff',
        foregroundColor: '#2d3e83'
    });
    const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [copied, setCopied] = useState(false);

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
                        title: 'Paso 1: Configurar Contenido',
                        description: 'Ingresa el texto, URL o contenido que quieres convertir en código QR. Usa las pestañas para cambiar entre texto simple, URLs o configuraciones avanzadas (tamaño, colores, logo institucional).',
                        side: 'right',
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="action"]',
                    popover: {
                        title: 'Paso 2: Generar Código QR',
                        description: 'Una vez configurado tu contenido, haz clic en "Generar Código QR" para crear tu código. El botón solo estará activo cuando hayas ingresado algún contenido.',
                        side: 'right',
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="preview"]',
                    popover: {
                        title: 'Paso 3: Descargar o Copiar',
                        description: 'Tu código QR aparecerá en la vista previa. Podrás descargarlo en el formato que elegiste (PNG, JPEG, SVG) o copiarlo directamente al portapapeles.',
                        side: 'left',
                        align: 'start'
                    }
                }
            ]
        });
        driverObj.drive();
    };

    const generateQR = async () => {
        if (!qrData.text.trim()) {
            alert('Por favor ingresa el texto o URL para generar el código QR');
            return;
        }

        setIsLoading(true);
        try {
            // QR Code generation options
            const options = {
                errorCorrectionLevel: qrData.errorCorrectionLevel,
                width: qrData.size,
                color: {
                    dark: qrData.foregroundColor,
                    light: qrData.backgroundColor
                },
                margin: 4
            };

            // Generate QR code as data URL
            const qrDataUrl = await QRCodeLib.toDataURL(qrData.text, options);
            
            if (qrData.includeInstitutionalLogo) {
                // Add institutional logo to QR code
                const qrWithLogo = await addLogoToQR(qrDataUrl, qrData.size);
                setQrCodeUrl(qrWithLogo);
            } else {
                setQrCodeUrl(qrDataUrl);
            }
            
        } catch (error) {
            console.error('Error:', error);
            alert('Error generando el código QR. Por favor intenta de nuevo.');
        } finally {
            setIsLoading(false);
        }
    };

    const addLogoToQR = async (qrDataUrl: string, size: number): Promise<string> => {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve(qrDataUrl);

            canvas.width = size;
            canvas.height = size;

            const qrImage = new Image();
            qrImage.onload = () => {
                // Draw QR code
                ctx.drawImage(qrImage, 0, 0, size, size);

                // Load institutional logo
                const logoImg = new Image();
                logoImg.onload = () => {
                    // Logo más grande y visible (30% del QR)
                    const logoSize = Math.floor(size * 0.3);
                    const logoX = (size - logoSize) / 2;
                    const logoY = (size - logoSize) / 2;

                    // Crear cuadrado hueco/transparente en el centro del QR
                    const squareSize = logoSize + 16; // Padding de 8px a cada lado
                    const squareX = (size - squareSize) / 2;
                    const squareY = (size - squareSize) / 2;

                    // Dibujar cuadrado blanco con borde redondeado
                    ctx.fillStyle = '#ffffff';
                    const borderRadius = 8;
                    ctx.beginPath();
                    ctx.moveTo(squareX + borderRadius, squareY);
                    ctx.lineTo(squareX + squareSize - borderRadius, squareY);
                    ctx.quadraticCurveTo(squareX + squareSize, squareY, squareX + squareSize, squareY + borderRadius);
                    ctx.lineTo(squareX + squareSize, squareY + squareSize - borderRadius);
                    ctx.quadraticCurveTo(squareX + squareSize, squareY + squareSize, squareX + squareSize - borderRadius, squareY + squareSize);
                    ctx.lineTo(squareX + borderRadius, squareY + squareSize);
                    ctx.quadraticCurveTo(squareX, squareY + squareSize, squareX, squareY + squareSize - borderRadius);
                    ctx.lineTo(squareX, squareY + borderRadius);
                    ctx.quadraticCurveTo(squareX, squareY, squareX + borderRadius, squareY);
                    ctx.closePath();
                    ctx.fill();

                    // Dibujar borde sutil del cuadrado
                    ctx.strokeStyle = '#e5e7eb';
                    ctx.lineWidth = 2;
                    ctx.stroke();

                    // Dibujar logo institucional PNG centrado
                    ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);

                    resolve(canvas.toDataURL());
                };
                
                logoImg.onerror = () => {
                    // Fallback a texto si el logo no carga
                    const logoSize = Math.floor(size * 0.3);
                    const squareSize = logoSize + 16;
                    const squareX = (size - squareSize) / 2;
                    const squareY = (size - squareSize) / 2;
                    
                    // Cuadrado blanco de fondo
                    ctx.fillStyle = '#ffffff';
                    const borderRadius = 8;
                    ctx.beginPath();
                    ctx.moveTo(squareX + borderRadius, squareY);
                    ctx.lineTo(squareX + squareSize - borderRadius, squareY);
                    ctx.quadraticCurveTo(squareX + squareSize, squareY, squareX + squareSize, squareY + borderRadius);
                    ctx.lineTo(squareX + squareSize, squareY + squareSize - borderRadius);
                    ctx.quadraticCurveTo(squareX + squareSize, squareY + squareSize, squareX + squareSize - borderRadius, squareY + squareSize);
                    ctx.lineTo(squareX + borderRadius, squareY + squareSize);
                    ctx.quadraticCurveTo(squareX, squareY + squareSize, squareX, squareY + squareSize - borderRadius);
                    ctx.lineTo(squareX, squareY + borderRadius);
                    ctx.quadraticCurveTo(squareX, squareY, squareX + borderRadius, squareY);
                    ctx.closePath();
                    ctx.fill();

                    // Borde institucional
                    ctx.strokeStyle = '#2d3e83';
                    ctx.lineWidth = 3;
                    ctx.stroke();

                    // Texto fallback
                    ctx.fillStyle = '#2d3e83';
                    ctx.font = `bold ${Math.floor(logoSize * 0.35)}px Arial`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('HUV', size / 2, size / 2);

                    resolve(canvas.toDataURL());
                };
                
                logoImg.src = '/images/logo.png';
            };
            qrImage.src = qrDataUrl;
        });
    };

    const downloadQR = async () => {
        if (qrCodeUrl) {
            try {
                let downloadUrl = qrCodeUrl;
                let filename = `qr-code-evaristools.${qrData.format}`;

                // Convert to different formats if needed
                if (qrData.format === 'jpeg') {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        canvas.width = qrData.size;
                        canvas.height = qrData.size;
                        
                        // Fill white background for JPEG
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        
                        const img = new Image();
                        img.onload = () => {
                            ctx.drawImage(img, 0, 0);
                            const jpegUrl = canvas.toDataURL('image/jpeg', 0.9);
                            
                            const link = document.createElement('a');
                            link.href = jpegUrl;
                            link.download = filename;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                        };
                        img.src = qrCodeUrl;
                        return;
                    }
                } else if (qrData.format === 'svg') {
                    // Generate SVG version
                    const svgString = await QRCodeLib.toString(qrData.text, {
                        type: 'svg',
                        errorCorrectionLevel: qrData.errorCorrectionLevel,
                        width: qrData.size,
                        color: {
                            dark: qrData.foregroundColor,
                            light: qrData.backgroundColor
                        }
                    });
                    
                    const blob = new Blob([svgString], { type: 'image/svg+xml' });
                    downloadUrl = URL.createObjectURL(blob);
                }

                const link = document.createElement('a');
                link.href = downloadUrl;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                // Clean up object URL if created
                if (downloadUrl !== qrCodeUrl) {
                    URL.revokeObjectURL(downloadUrl);
                }
            } catch (error) {
                console.error('Error downloading QR:', error);
                alert('Error descargando el código QR');
            }
        }
    };

    const copyToClipboard = async () => {
        if (qrCodeUrl) {
            try {
                const response = await fetch(qrCodeUrl);
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
        }
    };

    const qrTypes = [
        { id: 'text', name: 'Texto', placeholder: 'Ingresa tu texto aquí' },
        { id: 'url', name: 'URL', placeholder: 'https://ejemplo.com' },
        { id: 'email', name: 'Email', placeholder: 'usuario@ejemplo.com' },
        { id: 'phone', name: 'Teléfono', placeholder: '+57 300 123 4567' },
        { id: 'wifi', name: 'WiFi', placeholder: 'WIFI:T:WPA;S:NombreRed;P:Contraseña;;' },
        { id: 'vcard', name: 'Contacto', placeholder: 'BEGIN:VCARD\nVERSION:3.0\nFN:Nombre Completo\nEND:VCARD' }
    ];

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
                                    title="Configuración del QR"
                                    description="Personaliza tu código QR con las opciones disponibles"
                                    data-tour="config"
                                >
                                <Tabs defaultValue="text" className="w-full">
                                    <TabsList className="grid w-full grid-cols-3">
                                        <TabsTrigger value="text">Texto</TabsTrigger>
                                        <TabsTrigger value="url">URL</TabsTrigger>
                                        <TabsTrigger value="advanced">Avanzado</TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="text" className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="qr-text">Texto o contenido</Label>
                                            <Input
                                                id="qr-text"
                                                placeholder="Ingresa el texto para el código QR"
                                                value={qrData.text}
                                                onChange={(e) => setQRData({ ...qrData, text: e.target.value })}
                                            />
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="url" className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="qr-url">URL</Label>
                                            <Input
                                                id="qr-url"
                                                placeholder="https://ejemplo.com"
                                                value={qrData.text}
                                                onChange={(e) => setQRData({ ...qrData, text: e.target.value })}
                                            />
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="advanced" className="space-y-4">
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label htmlFor="size">Tamaño (px)</Label>
                                                <Select
                                                    value={qrData.size.toString()}
                                                    onValueChange={(value) => setQRData({ ...qrData, size: parseInt(value) })}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="128">128px</SelectItem>
                                                        <SelectItem value="256">256px</SelectItem>
                                                        <SelectItem value="512">512px</SelectItem>
                                                        <SelectItem value="1024">1024px</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="format">Formato</Label>
                                                <Select
                                                    value={qrData.format}
                                                    onValueChange={(value: 'png' | 'svg' | 'jpeg') => setQRData({ ...qrData, format: value })}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="png">PNG</SelectItem>
                                                        <SelectItem value="jpeg">JPEG</SelectItem>
                                                        <SelectItem value="svg">SVG</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="error-correction">Nivel de corrección de errores</Label>
                                            <Select
                                                value={qrData.errorCorrectionLevel}
                                                onValueChange={(value: 'L' | 'M' | 'Q' | 'H') => setQRData({ ...qrData, errorCorrectionLevel: value })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="L">Bajo (L) ~7%</SelectItem>
                                                    <SelectItem value="M">Medio (M) ~15%</SelectItem>
                                                    <SelectItem value="Q">Alto (Q) ~25%</SelectItem>
                                                    <SelectItem value="H">Máximo (H) ~30%</SelectItem>
                                                </SelectContent>
                                            </Select>
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
                                    </TabsContent>
                                </Tabs>
                                </ToolCard>

                                <ToolCard title="Acción" data-tour="action">
                                    <div className="space-y-3">
                                        <Button
                                            onClick={generateQR}
                                            disabled={isLoading || !qrData.text.trim()}
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
                                        {qrCodeUrl ? (
                                            <>
                                                <div className="rounded-lg border-2 border-dashed border-gray-300 p-4 bg-white overflow-auto max-w-full">
                                                    <img
                                                        src={qrCodeUrl}
                                                        alt="Código QR generado"
                                                        className="h-auto"
                                                        style={{ width: `${qrData.size}px` }}
                                                    />
                                                </div>
                                                <div className="flex space-x-3">
                                                    <Button
                                                        onClick={downloadQR}
                                                        variant="outline"
                                                        className="flex-1"
                                                    >
                                                        <Download className="mr-2 h-4 w-4" />
                                                        Descargar
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