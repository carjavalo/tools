import { useState, useEffect } from 'react';
import type { SharedData } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import axios from 'axios';
import { Search, FileText, QrCode, FileLock, FileUp, FileDown, FolderOutput, ArrowDown01, StickyNote, BookA, Building2, Lock, Image, Activity, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ThemeToggle } from '@/components/theme-toggle';

interface ToolCategory {
    id: string;
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string; size?: number }>;
    tools: Tool[];
}

interface Tool {
    id: string;
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string; size?: number }>;
    category: string;
    // Note: popularity is now handled dynamically via backend
}

const toolCategories: ToolCategory[] = [
    {
        id: 'pdf-tools',
        title: 'Herramientas PDF',
        description: 'Edición, conversión y manipulación de documentos PDF',
        icon: FileText,
        tools: [
            {
                id: 'resume-document',
                title: 'Resumir Documento',
                description: 'Genera resúmenes automáticos con IA',
                icon: FileText,
                category: 'pdf-tools'
            },
            {
                id: 'qr-generator',
                title: 'Generador de QR',
                description: 'Crea códigos QR personalizados con logo',
                icon: QrCode,
                category: 'pdf-tools'
            },
            {
                id: 'merge-pdfs',
                title: 'Unir PDFs',
                description: 'Combina múltiples archivos PDF en uno solo',
                icon: FileUp,
                category: 'pdf-tools'
            },
            {
                id: 'split-pdf',
                title: 'Dividir PDF',
                description: 'Separa un PDF en múltiples archivos más pequeños',
                icon: FolderOutput,
                category: 'pdf-tools'
            },
            {
                id: 'compress-pdf',
                title: 'Comprimir PDF',
                description: 'Reduce el tamaño de tus archivos PDF',
                icon: ArrowDown01,
                category: 'pdf-tools'
            }
        ]
    },
    {
        id: 'document-tools',
        title: 'Herramientas de Documentos',
        description: 'Procesamiento y conversión de documentos',
        icon: BookA,
        tools: [
            {
                id: 'word-to-pdf',
                title: 'Word a PDF',
                description: 'Convierte documentos Word a formato PDF',
                icon: FileDown,
                category: 'document-tools'
            },
            {
                id: 'powerpoint-to-pdf',
                title: 'PowerPoint a PDF',
                description: 'Convierte presentaciones PowerPoint a PDF',
                icon: Building2,
                category: 'document-tools'
            },
            {
                id: 'excel-to-pdf',
                title: 'Excel a PDF',
                description: 'Convierte hojas de cálculo Excel a PDF',
                icon: FileText,
                category: 'document-tools'
            }
        ]
    },
    {
        id: 'security-tools',
        title: 'Herramientas de Seguridad',
        description: 'Protección y gestión de documentos',
        icon: FileLock,
        tools: [
            {
                id: 'protect-pdf',
                title: 'Proteger PDF',
                description: 'Añade protección por contraseña a tus PDFs',
                icon: Lock,
                category: 'security-tools'
            },
            {
                id: 'sign-pdf',
                title: 'Firmar PDF',
                description: 'Añade firmas digitales a tus documentos PDF',
                icon: FileLock,
                category: 'security-tools'
            },
            {
                id: 'watermark-pdf',
                title: 'Marca de agua en PDF',
                description: 'Añade marcas de agua a tus documentos PDF',
                icon: FileText,
                category: 'security-tools'
            },
            {
                id: 'rotate-pdf',
                title: 'Rotar PDF',
                description: 'Rota las páginas de tus documentos PDF',
                icon: Building2,
                category: 'security-tools'
            }
        ]
    },
    {
        id: 'organization-tools',
        title: 'Herramientas de Organización',
        description: 'Gestión y organización de documentos',
        icon: Building2,
        tools: [
            {
                id: 'sort-pdf',
                title: 'Ordenar PDF',
                description: 'Reorganiza las páginas de tus documentos PDF',
                icon: FileUp,
                category: 'organization-tools'
            },
            {
                id: 'crop-pdf',
                title: 'Recortar PDF',
                description: 'Elimina los márgenes de tus documentos PDF',
                icon: Building2,
                category: 'organization-tools'
            },
            {
                id: 'page-numbers',
                title: 'Números de página',
                description: 'Añade números de página a un PDF',
                icon: FileText,
                category: 'organization-tools'
            }
        ]
    },
    {
        id: 'image-tools',
        title: 'Herramientas de Imágenes',
        description: 'Conversión y procesamiento de imágenes',
        icon: Image,
        tools: [
            {
                id: 'images-to-pdf',
                title: 'Imágenes a PDF',
                description: 'Convierte imágenes a formato PDF',
                icon: FileUp,
                category: 'image-tools'
            },
            {
                id: 'pdf-to-images',
                title: 'PDF a Imágenes',
                description: 'Convierte páginas de PDF a imágenes',
                icon: FileDown,
                category: 'image-tools'
            },
            {
                id: 'images-to-word',
                title: 'Imágenes a Word',
                description: 'Convierte imágenes a documentos Word editables',
                icon: BookA,
                category: 'image-tools'
            },
            {
                id: 'ocr-extract',
                title: 'OCR y Extracción de Texto',
                description: 'Extrae texto de imágenes mediante OCR',
                icon: StickyNote,
                category: 'image-tools'
            }
        ]
    },
    {
        id: 'hospital-tools',
        title: 'Herramientas Hospitalarias',
        description: 'Procesamiento de archivos RIPS y CUV para EPS',
        icon: Activity,
        tools: [
            {
                id: 'cups',
                title: 'CUPS - Rips JSON HUV',
                description: 'Sistema de conversión y procesamiento de archivos RIPS JSON para diferentes EPS',
                icon: Activity,
                category: 'hospital-tools'
            },
            {
                id: 'evarisdrop',
                title: 'Evarisdrop',
                description: 'Sistema de transferencia de archivos entre dispositivos en tiempo real',
                icon: Share2,
                category: 'hospital-tools'
            },
            {
                id: 'programacion-cirugia',
                title: 'Programación de Cirugía Sede Cali',
                description: 'Programa y gestiona las cirugías del hospital',
                icon: Activity, // Puedes cambiar el icono si lo deseas
                category: 'hospital-tools'
            },
            {
                id: 'programacion-cirugia-cartago',
                title: 'Programación de Cirugía Sede Cartago',
                description: 'Programa y gestiona las cirugías del hospital',
                icon: Activity,
                category: 'hospital-tools'
            }
        ]
    }
];

const allTools = toolCategories.flatMap(category => category.tools);

export default function Evaristools({ shared }: { shared: SharedData }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [popularToolIds, setPopularToolIds] = useState<string[]>([]);
    const [isLoadingPopular, setIsLoadingPopular] = useState(true);

    // Cargar herramientas populares al montar el componente
    useEffect(() => {
        fetchPopularTools();
    }, []);

    // Obtener herramientas populares desde el backend
    const fetchPopularTools = async () => {
        try {
            const response = await axios.get('/api/tools/popular?threshold=5', { baseURL: '' });
            if (response.data.success) {
                setPopularToolIds(response.data.popular_tools);
            }
        } catch (error) {
            console.error('Error fetching popular tools:', error);
        } finally {
            setIsLoadingPopular(false);
        }
    };

    // Registrar clic cuando el usuario hace clic en una herramienta
    const handleToolClick = async (toolId: string) => {
        try {
            // Registrar el clic en el backend (fire and forget)
            axios.post('/api/tools/click', { tool_id: toolId }, { baseURL: '' }).catch(() => {
                // Ignorar errores silenciosamente para no interrumpir la navegación
            });
        } catch (error) {
            // Ignorar errores
        }
    };

    // Verificar si una herramienta es popular dinámicamente
    const isToolPopular = (toolId: string): boolean => {
        return popularToolIds.includes(toolId);
    };

    // Filter tools based on search term
    const filteredTools = allTools.filter(tool =>
        tool.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tool.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Filter categories to only show those with matching tools
    const filteredCategories = toolCategories.map(category => ({
        ...category,
        tools: category.tools.filter(tool =>
            tool.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            tool.description.toLowerCase().includes(searchTerm.toLowerCase())
        )
    })).filter(category => category.tools.length > 0);

    // Function to get route for each tool
    const getToolRoute = (toolId: string): string | null => {
        const toolRoutes: Record<string, string> = {
            'qr-generator': '/tools/qr-generator',
            'compress-pdf': '/tools/pdf-compress',
            'ocr-extract': '/tools/ocr-extract',
            'merge-pdfs': '/tools/merge-pdfs',
            'split-pdf': '/tools/split-pdf',
            'images-to-pdf': '/tools/images-to-pdf',
            'images-to-word': '/tools/images-to-word',
            'pdf-to-images': '/tools/pdf-to-images',
            'word-to-pdf': '/tools/word-to-pdf',
            'rotate-pdf': '/tools/rotate-pdf',
            'page-numbers': '/tools/page-numbers',
            'watermark-pdf': '/tools/watermark-pdf',
            'sort-pdf': '/tools/sort-pdf',
            'crop-pdf': '/tools/crop-pdf',
            'powerpoint-to-pdf': '/tools/powerpoint-to-pdf',
            'excel-to-pdf': '/tools/excel-to-pdf',
            'resume-document': '/tools/resume-document',
            'sign-pdf': '/tools/sign-pdf',
            'protect-pdf': '/tools/protect-pdf',
            'cups': '/tools/cups',
            'evarisdrop': '/tools/evarisdrop',
            'programacion-cirugia': '/tools/programacion-cirugia',
            'programacion-cirugia-cartago': '/tools/programacion-cirugia-cartago',
        // Add more routes as tools are implemented
    };
        return toolRoutes[toolId] || null;
    };

    return (
        <>
            <Head title="Evaristools - Herramientas de Oficina">
                <meta name="description" content="Hospital Universitario del Valle 'Evaristo Garcia' E.S.E - Herramientas completas de digitalización, OCR y procesamiento de documentos." />
            </Head>
            
            <div className="min-h-screen bg-layer-base">
                {/* Header - Responsive box system */}
                <header className="bg-layer-1 backdrop-blur-md border-b border-border/50">
                    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                        {/* Top bar: Logo + Title + Theme Toggle */}
                        <div className="flex items-center justify-between py-4 gap-4">
                            {/* Logo & Title - shrink on mobile, expand on desktop */}
                            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                <div className="flex-shrink-0 h-10 w-10 sm:h-12 sm:w-12">
                                    <img 
                                        src="/images/logo.png" 
                                        alt="Hospital Universitario del Valle Logo" 
                                        className="h-full w-full object-contain"
                                    />
                                </div>
                                <div className="min-w-0">
                                    <h1 className="text-lg sm:text-xl font-bold text-institutional dark:text-[#6b7bb8] truncate">
                                        Evaristools
                                    </h1>
                                    <p className="text-[10px] sm:text-xs text-muted-foreground dark:text-slate-400 truncate">
                                        Hospital Universitario del Valle "Evaristo Garcia" E.S.E
                                    </p>
                                </div>
                            </div>
                            
                            {/* Theme Toggle - always visible */}
                            <div className="flex-shrink-0">
                                <ThemeToggle />
                            </div>
                        </div>
                        
                        {/* Search Bar - Full width on mobile, centered on desktop */}
                        <div className="pb-4 sm:pb-6">
                            <div className="w-full sm:max-w-md sm:mx-auto">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        placeholder="Buscar herramientas..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-10 bg-layer-2 border-0 shadow-layer-1 h-11 sm:h-10"
                                    />
                                </div>
                                {searchTerm && (
                                    <p className="text-xs sm:text-sm text-muted-foreground mt-2 text-center">
                                        {filteredTools.length} {filteredTools.length === 1 ? 'herramienta encontrada' : 'herramientas encontradas'}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Tools Section - Responsive rearrangement */}
                <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                    <Tabs defaultValue="all" className="w-full">
                        {/* Tabs - Horizontal scroll on mobile, grid on desktop */}
                        <div className="mb-6 sm:mb-8 -mx-4 sm:mx-0">
                            <div className="overflow-x-auto scrollbar-hide">
                                <TabsList className="inline-flex sm:grid sm:w-full sm:grid-cols-3 lg:grid-cols-6 min-w-full sm:min-w-0 px-4 sm:px-0">
                                    <TabsTrigger value="all" className="whitespace-nowrap">Todas</TabsTrigger>
                                    <TabsTrigger value="pdf-tools" className="whitespace-nowrap">PDF</TabsTrigger>
                                    <TabsTrigger value="document-tools" className="whitespace-nowrap">Documentos</TabsTrigger>
                                    <TabsTrigger value="security-tools" className="whitespace-nowrap">Seguridad</TabsTrigger>
                                    <TabsTrigger value="organization-tools" className="whitespace-nowrap">Organización</TabsTrigger>
                                    <TabsTrigger value="image-tools" className="whitespace-nowrap">Imágenes</TabsTrigger>
                                </TabsList>
                            </div>
                        </div>

                        <TabsContent value="all" className="space-y-8">
                            {filteredTools.length === 0 ? (
                                <div className="text-center py-12">
                                    <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                                        No se encontraron herramientas
                                    </h3>
                                    <p className="text-muted-foreground">
                                        Intenta con otros términos de búsqueda
                                    </p>
                                </div>
                            ) : (
                                <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                    {filteredTools.map((tool) => {
                                        const isPopular = isToolPopular(tool.id);
                                        return (
                                            <Card
                                                key={tool.id}
                                                className="group bg-layer-2 border-0 shadow-layer-2 hover-lift hover:bg-layer-3 transition-colors"
                                            >
                                                <CardHeader className="pb-3">
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex items-center space-x-3">
                                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-layer-1 text-institutional group-hover:bg-institutional group-hover:text-white transition-colors">
                                                                <tool.icon className="h-5 w-5" />
                                                            </div>
                                                            <div>
                                                                <CardTitle className="text-base text-slate-900 dark:text-white">
                                                                    {tool.title}
                                                                </CardTitle>
                                                                {isPopular && (
                                                                    <Badge variant="secondary" className="mt-1 text-xs">
                                                                        Popular
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </CardHeader>
                                                <CardContent>
                                                    <CardDescription className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                                                        {tool.description}
                                                    </CardDescription>
                                                    {getToolRoute(tool.id) ? (
                                                        <Link 
                                                            href={getToolRoute(tool.id)!}
                                                            onClick={() => handleToolClick(tool.id)}
                                                        >
                                                            <Button
                                                                className="w-full bg-institutional hover:bg-institutional/90"
                                                                size="sm"
                                                            >
                                                                Usar Herramienta
                                                            </Button>
                                                        </Link>
                                                    ) : (
                                                        <Button
                                                            className="w-full bg-institutional hover:bg-institutional/90"
                                                            size="sm"
                                                            disabled
                                                        >
                                                            Próximamente
                                                        </Button>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            )}
                        </TabsContent>

                        {filteredCategories.map((category) => (
                            <TabsContent key={category.id} value={category.id} className="space-y-4 sm:space-y-6">
                                <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                                    <div className="flex-shrink-0 h-10 w-10 sm:h-12 sm:w-12 flex items-center justify-center rounded-lg bg-primary-layer-1 text-institutional">
                                        <category.icon className="h-5 w-5 sm:h-6 sm:w-6" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                                            {category.title}
                                        </h2>
                                        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300">
                                            {category.description}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                    {category.tools.map((tool) => {
                                        const isPopular = isToolPopular(tool.id);
                                        return (
                                            <Card
                                                key={tool.id}
                                                className="group bg-layer-2 border-0 shadow-layer-2 hover-lift hover:bg-layer-3 transition-colors"
                                            >
                                                <CardHeader className="pb-3">
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex items-center space-x-3">
                                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-layer-1 text-institutional group-hover:bg-institutional group-hover:text-white transition-colors">
                                                                <tool.icon className="h-5 w-5" />
                                                            </div>
                                                            <div>
                                                                <CardTitle className="text-base text-slate-900 dark:text-white">
                                                                    {tool.title}
                                                                </CardTitle>
                                                                {isPopular && (
                                                                    <Badge variant="secondary" className="mt-1 text-xs">
                                                                        Popular
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </CardHeader>
                                                <CardContent>
                                                    <CardDescription className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                                                        {tool.description}
                                                    </CardDescription>
                                                    {getToolRoute(tool.id) ? (
                                                        <Link 
                                                            href={getToolRoute(tool.id)!}
                                                            onClick={() => handleToolClick(tool.id)}
                                                        >
                                                            <Button
                                                                className="w-full bg-institutional hover:bg-institutional/90"
                                                                size="sm"
                                                            >
                                                                Usar Herramienta
                                                            </Button>
                                                        </Link>
                                                    ) : (
                                                        <Button
                                                            className="w-full bg-institutional hover:bg-institutional/90"
                                                            size="sm"
                                                            disabled
                                                        >
                                                            Próximamente
                                                        </Button>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            </TabsContent>
                        ))}
                    </Tabs>
                </main>
            </div>
        </>
    );
}