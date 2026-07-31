import { Head } from '@inertiajs/react';
import ToolPageHeader from '@/components/ToolPageHeader';
import { Share2, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EvarisdropDashboard } from '@/components/evarisdrop/EvarisdropDashboard';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

export default function Evarisdrop() {
    const startTour = () => {
        const driverObj = driver({
            showProgress: true,
            popoverClass: 'driverjs-theme',
            prevBtnText: 'Anterior',
            nextBtnText: 'Siguiente',
            doneBtnText: 'Finalizar',
            steps: [
                {
                    element: '[data-tour="user-profile"]',
                    popover: {
                        title: 'Paso 1: Tu Perfil',
                        description: 'Aquí puedes ver y editar tu nombre de usuario. También se muestra el código de tu sala actual. ¡Puedes generar un nuevo usuario aleatorio si lo deseas!',
                        side: 'left',
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="devices"]',
                    popover: {
                        title: 'Paso 2: Dispositivos Disponibles',
                        description: 'Una vez que crees o te unas a una sala, verás aquí todos los dispositivos conectados. Podrás enviarles archivos con solo un clic.',
                        side: 'right',
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="transfer-zone"]',
                    popover: {
                        title: 'Paso 3: Zona de Transferencia',
                        description: 'Arrastra archivos aquí o haz clic para seleccionarlos. Los archivos se añadirán a la cola y podrás enviarlos a cualquier dispositivo conectado.',
                        side: 'right',
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="file-queue"]',
                    popover: {
                        title: 'Paso 4: Cola de Archivos',
                        description: 'Aquí verás los archivos que has seleccionado y están listos para enviar. Podrás elegir a qué dispositivo enviar cada archivo.',
                        side: 'left',
                        align: 'start'
                    }
                }
            ]
        });
        driverObj.drive();
    };

    return (
        <>
            <Head title="Evarisdrop - Evaristools">
                <meta name="description" content="Sistema de transferencia de archivos entre dispositivos en tiempo real" />
            </Head>

            <div className="min-h-screen bg-white dark:bg-[#1d1d1e]">
                <ToolPageHeader
                    title="Evarisdrop"
                    description="Transferencia de archivos entre dispositivos en tiempo real"
                    icon={Share2}
                    showPopularBadge={true}
                />

                <div className="container mx-auto px-4 py-8">
                    {/* Help Button */}
                    <div className="max-w-6xl mx-auto mb-4">
                        <Button
                            onClick={startTour}
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-2 border-institutional text-institutional hover:bg-institutional/10"
                        >
                            <HelpCircle className="w-4 h-4" />
                            ¿Cómo usar Evarisdrop?
                        </Button>
                    </div>
                    
                    <EvarisdropDashboard
                        appName="Evarisdrop"
                        maxFileSize={52428800}
                        networkName="Evaristools Network"
                    />
                </div>
            </div>
        </>
    );
}