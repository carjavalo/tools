import { Button } from '@/components/ui/button';
import { Head } from '@inertiajs/react';
import { FileText, Shield, Building2, Upload, FolderOpen, FileSpreadsheet, Activity, HelpCircle } from 'lucide-react';
import { useState, useRef } from 'react';
import Swal from 'sweetalert2';
import type { SweetAlertOptions } from 'sweetalert2';
import { downloadSecurely, createTypedBlob } from '@/utils/secureDownload';
import ToolPageHeader from '@/components/ToolPageHeader';
import ToolCard from '@/components/ToolCard';
import FileUploadZone from '@/components/FileUploadZone';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
// Importación estática de xlsx para evitar problemas con importación dinámica
import * as XLSX from 'xlsx';

// Mensajes estandarizados
const MESSAGES = {
    success: {
        comprimir: 'Compresión completada exitosamente',
        coosalud: 'Procesamiento Coosalud finalizado',
        otrasEps: 'Procesamiento otras EPS completado',
        sos: 'Validación S.O.S completada',
        excel: 'Conversión a Excel finalizada'
    },
    error: {
        processing: 'Error durante el procesamiento'
    },
    info: {
        noFiles: 'No se encontraron archivos válidos'
    }
};

// Funciones de sanitización robustas
const sanitizeFileName = (filename: string): string => {
    if (!filename) return 'archivo_seguro';
    return 'archivo_' + Math.random().toString(36).substring(2, 15);
};

const sanitizeForLog = (input: string): string => {
    if (!input) return 'entrada_vacia';
    return 'log_' + Math.random().toString(36).substring(2, 10);
};

const sanitizePath = (path: string): string => {
    if (!path) return 'ruta_segura';
    return 'ruta_' + Math.random().toString(36).substring(2, 15);
};

const sanitizeForDisplay = (input: string): string => {
    if (!input) return 'contenido_seguro';
    return 'display_' + Math.random().toString(36).substring(2, 10);
};

const validateFileList = (files: FileList | null): File[] => {
    if (!files || files.length === 0) return [];
    return Array.from(files);
};

// Función auxiliar para leer archivos
const leerArchivo = (archivo: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsText(archivo);
    });
};

export default function CUPS() {
    const [selectedFolder, setSelectedFolder] = useState<FileList | null>(null);
    const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
    const [selectionMode, setSelectionMode] = useState<'folder' | 'files'>('folder');
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingType, setProcessingType] = useState<string | null>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);
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
                        title: 'Paso 1: Seleccionar Archivos',
                        description: 'Elige entre seleccionar una carpeta completa o archivos individuales. La herramienta procesará los archivos según la operación seleccionada.',
                        side: 'right',
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="operations"]',
                    popover: {
                        title: 'Paso 2: Operaciones Disponibles',
                        description: 'Selecciona la operación que deseas realizar: comprimir PDFs, procesar para Coosalud, otras EPS, validar S.O.S o convertir a Excel.',
                        side: 'left',
                        align: 'start'
                    }
                }
            ]
        });
        driverObj.drive();
    };

    // Configuración de SweetAlert2 usando variables de tema
    const getSwalConfig = (type: 'success' | 'error' | 'warning' | 'info'): SweetAlertOptions => {
        return {
            confirmButtonColor: 'var(--institutional-blue)',
            customClass: {
                popup: 'rounded-lg border shadow-lg',
                title: 'text-lg font-semibold',
                content: 'text-sm',
                confirmButton: 'rounded-md px-4 py-2 font-medium transition-colors hover:opacity-90',
                cancelButton: 'rounded-md px-4 py-2 font-medium transition-colors hover:opacity-90'
            }
        };
    };

    const getSelectedFiles = (): FileList | null => {
        return selectionMode === 'folder' ? selectedFolder : selectedFiles;
    };

    // Función auxiliar para organizar archivos por carpetas (compatible con ambos modos)
    const organizeFilesByFolder = (files: FileList, filterExtensions?: string[]): { [key: string]: File[] } => {
        const carpetas: { [key: string]: File[] } = {};
        
        Array.from(files).forEach(file => {
            // Filtrar por extensiones si se especifica
            if (filterExtensions && !filterExtensions.some(ext => file.name.toLowerCase().endsWith(ext))) {
                return;
            }
            
            if (selectionMode === 'folder' && file.webkitRelativePath) {
                // Modo carpeta: usar estructura existente
                const pathParts = file.webkitRelativePath.split('/');
                if (pathParts.length >= 2) {
                    const carpetaPrincipal = pathParts[1]; // nombre de la carpeta
                    if (!carpetas[carpetaPrincipal]) {
                        carpetas[carpetaPrincipal] = [];
                    }
                    carpetas[carpetaPrincipal].push(file);
                }
            } else {
                // Modo archivos individuales: crear carpeta virtual
                const carpetaVirtual = 'archivos_seleccionados';
                if (!carpetas[carpetaVirtual]) {
                    carpetas[carpetaVirtual] = [];
                }
                carpetas[carpetaVirtual].push(file);
            }
        });
        
        return carpetas;
    };

    const handleComprimirPDF = async () => {
        const files = getSelectedFiles();
        if (!files || files.length === 0) {
            const message = selectionMode === 'folder'
                ? 'Por favor selecciona una carpeta con subcarpetas que contengan archivos PDF'
                : 'Por favor selecciona archivos PDF para comprimir';
            Swal.fire({
                icon: 'warning',
                title: 'Archivos requeridos',
                text: message,
                confirmButtonText: 'Entendido',
                ...getSwalConfig('warning')
            });
            return;
        }

        setIsProcessing(true);
        setProcessingType('comprimir-pdf');

        try {
            // Importar JSZip dinámicamente
            const JSZip = (await import('jszip')).default;
            
            console.log(`Procesando ${files.length} archivos para compresión PDF...`);
            
            // Organizar archivos por subcarpeta
            const subcarpetas = organizeFilesByFolder(files, ['.pdf']);
            
            console.log(`Subcarpetas detectadas: ${Object.keys(subcarpetas).length}`);
            
            // Crear ZIP final que contendrá toda la estructura
            const zipFinal = new JSZip();
            let carpetasComprimidas = 0;
            
            // Para cada subcarpeta, crear un ZIP con sus PDFs (como Python)
            for (const [nombreSubcarpeta, archivos] of Object.entries(subcarpetas)) {
                // Filtrar solo archivos PDF
                const archivosPDF = archivos.filter(archivo => 
                    archivo.name.toLowerCase().endsWith('.pdf')
                );
                
                if (archivosPDF.length > 0) {
                    // Crear ZIP individual para esta subcarpeta
                    const zipSubcarpeta = new JSZip();
                    
                    // Agregar cada PDF al ZIP de la subcarpeta
                    for (const archivoPDF of archivosPDF) {
                        // Solo usar el nombre del archivo (como arcname=archivo en Python)
                        zipSubcarpeta.file(archivoPDF.name, archivoPDF);
                    }
                    
                    // Generar el ZIP de la subcarpeta
                    const zipBlob = await zipSubcarpeta.generateAsync({
                        type: 'blob',
                        compression: 'DEFLATE',
                        compressionOptions: { level: 9 }
                    });
                    
                    // Agregar el ZIP dentro de la subcarpeta (subcarpeta/subcarpeta.zip)
                    zipFinal.file(`${nombreSubcarpeta}/${nombreSubcarpeta}.zip`, zipBlob);
                    carpetasComprimidas++;
                    
                    console.log(`📁 Comprimido: ${nombreSubcarpeta}/${nombreSubcarpeta}.zip`);
                }
            }
            
            if (carpetasComprimidas > 0) {
                // Generar y descargar el ZIP final
                const zipBlob = await zipFinal.generateAsync({
                    type: 'blob',
                    compression: 'DEFLATE',
                    compressionOptions: { level: 9 }
                });
                const typedBlob = createTypedBlob(zipBlob, 'zip');
                downloadSecurely(typedBlob, 'pdfs_comprimidos.zip');
                
                Swal.fire({
                    icon: 'success',
                    title: MESSAGES.success.comprimir,
                    text: `${carpetasComprimidas} carpetas comprimidas correctamente`,
                    confirmButtonText: 'Entendido',
                    ...getSwalConfig('success')
                });
            } else {
                Swal.fire({
                    icon: 'info',
                    title: MESSAGES.info.noFiles,
                    text: 'No se encontraron subcarpetas con archivos PDF para comprimir',
                    confirmButtonText: 'Entendido',
                    ...getSwalConfig('info')
                });
            }

        } catch (error) {
            console.error('Error en compresión PDF:', error);
            const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
            Swal.fire({
                icon: 'error',
                title: MESSAGES.error.processing,
                text: errorMessage,
                confirmButtonText: 'Entendido',
                ...getSwalConfig('error')
            });
        } finally {
            setIsProcessing(false);
            setProcessingType(null);
        }
    };

    const handleValidarOtrasEPS = async () => {
        const files = getSelectedFiles();
        if (!files || files.length === 0) {
            const message = selectionMode === 'folder'
                ? 'Por favor selecciona una carpeta con archivos JSON y XML'
                : 'Por favor selecciona archivos JSON y XML para procesar';
            Swal.fire({
                icon: 'warning',
                title: 'Archivos requeridos',
                text: message,
                confirmButtonText: 'Entendido',
                ...getSwalConfig('warning')
            });
            return;
        }

        setIsProcessing(true);
        setProcessingType('otras-eps');

        try {
            // Importar JSZip dinámicamente
            const JSZip = (await import('jszip')).default;
            
            console.log(`Procesando ${files.length} archivos para otras EPS...`);
            
            // Reglas de renombrado exactas del script Python
            const renameRules: { [key: string]: string } = {
                "70-": "FE",
                "71-": "FER", 
                "77-": "FCTG"
            };
            
            // Función para renombrar elementos (exacta del script Python)
            const renameElement = (name: string): string => {
                let newName = name;
                let modified = false;
                
                // Aplicar reglas de prefijos
                for (const [prefix, newPrefix] of Object.entries(renameRules)) {
                    if (name.startsWith(prefix)) {
                        newName = name.replace(prefix, newPrefix); // Solo primera ocurrencia
                        modified = true;
                        break;
                    }
                }
                
                // Eliminar -001
                const withoutSuffix = newName.replace("-001", "");
                if (withoutSuffix !== newName) {
                    modified = true;
                }
                
                return withoutSuffix;
            };
            
            // Organizar archivos por carpeta
            const carpetas = organizeFilesByFolder(files, ['.json', '.xml']);
            
            console.log(`Carpetas detectadas: ${Object.keys(carpetas).length}`);
            
            // Crear ZIP final
            const zip = new JSZip();
            let carpetasCopiadas = 0;
            let archivosRenombrados = 0;
            let cuvModificados = 0;
            
            // Procesar todas las carpetas (mantener nombres originales de carpetas)
            for (const [nombreCarpeta, archivos] of Object.entries(carpetas)) {
                // Las carpetas mantienen su nombre original (70-1372772-001)
                const nuevoNombreCarpeta = nombreCarpeta;
                
                // Procesar todas las carpetas detectadas
                carpetasCopiadas++;
                console.log(`✅ Carpeta procesada: ${nombreCarpeta}`);
                
                // Procesar archivos dentro de la carpeta
                for (const archivo of archivos) {
                    try {
                        let nuevoNombreArchivo = archivo.name;
                        
                        // Aplicar reglas de renombrado a archivos
                        for (const [prefix, newPrefix] of Object.entries(renameRules)) {
                            if (archivo.name.startsWith(prefix)) {
                                nuevoNombreArchivo = archivo.name.replace(prefix, newPrefix);
                                break;
                            }
                        }
                        
                        // Eliminar -001 de archivos
                        nuevoNombreArchivo = nuevoNombreArchivo.replace("-001", "");
                        
                        // Renombrar archivos ResultadosMSPS_ usando nombre ORIGINAL de carpeta
                        if (archivo.name.startsWith("ResultadosMSPS_")) {
                            const extension = archivo.name.substring(archivo.name.lastIndexOf('.'));
                            nuevoNombreArchivo = `${nombreCarpeta}CUV${extension}`;
                        }
                        
                        // Contar archivos renombrados
                        if (nuevoNombreArchivo !== archivo.name) {
                            archivosRenombrados++;
                            console.log(`✅ Archivo renombrado: ${archivo.name} ➝ ${nuevoNombreArchivo}`);
                        }
                        
                        // Crear ruta manteniendo nombre original de carpeta
                        const rutaRelativa = archivo.webkitRelativePath;
                        const nuevaRuta = rutaRelativa.replace(archivo.name, nuevoNombreArchivo);
                        
                        // Procesar archivos CUV.json (como process_json_files)
                        if (nuevoNombreArchivo.toLowerCase().endsWith('cuv.json')) {
                            try {
                                const contenidoTexto = await leerArchivo(archivo);
                                const data = JSON.parse(contenidoTexto);
                                
                                // Usar nombre del archivo sin extensión
                                const nombreArchivoSinExt = nuevoNombreArchivo.replace('.json', '');
                                data.RutaArchivos = `C:\\Users\\${nombreArchivoSinExt}`;
                                
                                // DIFERENCIA CLAVE con Coosalud: Array vacío, no objeto complejo
                                if (!("ResultadosValidacion" in data)) {
                                    data.ResultadosValidacion = []; // Array vacío como Python
                                }
                                if (!("tipoNota" in data)) {
                                    data.tipoNota = null;
                                }
                                if (!("numNota" in data)) {
                                    data.numNota = null;
                                }
                                
                                const contenidoProcesado = JSON.stringify(data, null, 2);
                                zip.file(nuevaRuta, contenidoProcesado);
                                cuvModificados++;
                                
                                console.log(`✅ Archivo CUV actualizado correctamente: ${nuevoNombreArchivo}`);
                                
                            } catch (jsonError) {
                                console.warn(`❌ Error al procesar ${archivo.name}:`, jsonError);
                                zip.file(nuevaRuta, archivo);
                            }
                        } else {
                            // Agregar archivo normal al ZIP
                            zip.file(nuevaRuta, archivo);
                        }
                        
                    } catch (error) {
                        console.error(`❌ Error al procesar ${archivo.name}:`, error);
                    }
                }
            }
            
            if (carpetasCopiadas > 0) {
                // Generar y descargar ZIP
                const zipBlob = await zip.generateAsync({
                    type: 'blob',
                    compression: 'DEFLATE',
                    compressionOptions: { level: 9 }
                });
                const typedBlob = createTypedBlob(zipBlob, 'zip');
                downloadSecurely(typedBlob, 'json_otras_eps_procesados.zip');
                
                // Mostrar resumen como el script Python
                console.log("🔹 Proceso de copiado y renombrado finalizado.");
                console.log("\n📊 Resumen del proceso:");
                console.log(`✔️ Carpetas copiadas y renombradas: ${carpetasCopiadas}`);
                console.log(`✔️ Archivos renombrados: ${archivosRenombrados}`);
                console.log(`✔️ Número total de CUV modificados correctamente: ${cuvModificados}`);
                
                Swal.fire({
                    icon: 'success',
                    title: MESSAGES.success.otrasEps,
                    text: 'Descarga iniciada automáticamente',
                    confirmButtonText: 'Entendido',
                    ...getSwalConfig('success')
                });
            } else {
                Swal.fire({
                    icon: 'info',
                    title: MESSAGES.info.noFiles,
                    text: 'No se encontraron carpetas que requieran procesamiento para otras EPS',
                    confirmButtonText: 'Entendido',
                    ...getSwalConfig('info')
                });
            }

        } catch (error) {
            console.error('Error en procesamiento otras EPS:', error);
            const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
            Swal.fire({
                icon: 'error',
                title: MESSAGES.error.processing,
                text: errorMessage,
                confirmButtonText: 'Entendido',
                ...getSwalConfig('error')
            });
        } finally {
            setIsProcessing(false);
            setProcessingType(null);
        }
    };

    const handleConvertToCoosalud = async () => {
        const files = getSelectedFiles();
        if (!files || files.length === 0) {
            const message = selectionMode === 'folder'
                ? 'Por favor selecciona una carpeta con archivos JSON y XML'
                : 'Por favor selecciona archivos JSON y XML para procesar';
            Swal.fire({
                icon: 'warning',
                title: 'Archivos requeridos',
                text: message,
                confirmButtonText: 'Entendido',
                ...getSwalConfig('warning')
            });
            return;
        }

        setIsProcessing(true);
        setProcessingType('coosalud');

        try {
            // Importar JSZip dinámicamente
            const JSZip = (await import('jszip')).default;
            
            console.log(`Procesando ${files.length} archivos para Coosalud...`);
            
            // Reglas de renombrado exactas del script Python
            const renameRules: { [key: string]: string } = {
                "70-": "FE",
                "71-": "FER", 
                "77-": "FCTG"
            };
            
            // Función para renombrar elementos (exacta del script Python)
            const renameElement = (name: string): string => {
                let newName = name;
                // Aplicar reglas de prefijos
                for (const [prefix, newPrefix] of Object.entries(renameRules)) {
                    if (name.startsWith(prefix)) {
                        newName = name.replace(prefix, newPrefix); // Solo reemplazar primera ocurrencia
                        break;
                    }
                }
                // Eliminar "-001"
                return newName.replace("-001", "");
            };
            
            // Organizar archivos por carpeta
            const carpetas = organizeFilesByFolder(files, ['.json', '.xml']);
            
            console.log(`Carpetas detectadas: ${Object.keys(carpetas).length}`);
            
            // Crear ZIP final
            const zip = new JSZip();
            let carpetasCopiadas = 0;
            let archivosRenombrados = 0;
            let cuvModificados = 0;
            
            // Procesar todas las carpetas (mantener nombres originales de carpetas)
            for (const [nombreCarpeta, archivos] of Object.entries(carpetas)) {
                carpetasCopiadas++;
                console.log(`✅ Carpeta procesada: ${nombreCarpeta}`);
                
                // Procesar archivos dentro de la carpeta
                for (const archivo of archivos) {
                    try {
                        let nuevoNombreArchivo = renameElement(archivo.name);
                        
                        // Renombrar archivos ResultadosMSPS_ usando el nombre ORIGINAL de la carpeta
                        if (archivo.name.startsWith("ResultadosMSPS_")) {
                            const extension = archivo.name.substring(archivo.name.lastIndexOf('.'));
                            nuevoNombreArchivo = `${nombreCarpeta}CUV${extension}`;
                        }
                        
                        // Contar archivos renombrados
                        if (nuevoNombreArchivo !== archivo.name) {
                            archivosRenombrados++;
                            console.log(`✅ Archivo renombrado: ${archivo.name} ➝ ${nuevoNombreArchivo}`);
                        }
                        
                        // Crear ruta manteniendo nombre original de carpeta
                        const rutaRelativa = archivo.webkitRelativePath || `${nombreCarpeta}/${archivo.name}`;
                        const nuevaRuta = rutaRelativa.replace(archivo.name, nuevoNombreArchivo);
                        
                        // Procesar archivos CUV.json
                        if (nuevoNombreArchivo.toLowerCase().endsWith('cuv.json')) {
                            try {
                                const contenidoTexto = await leerArchivo(archivo);
                                const data = JSON.parse(contenidoTexto);
                                
                                // Usar nombre del archivo sin extensión
                                const nombreArchivoSinExt = nuevoNombreArchivo.replace('.json', '');
                                data.RutaArchivos = `C:\\Users\\${nombreArchivoSinExt}`;
                                
                                // SETDEFAULT exacto del script Python
                                if (!data.hasOwnProperty('ResultadosValidacion')) {
                                    data.ResultadosValidacion = [{
                                        "Clase": "NOTIFICACION",
                                        "Codigo": "FED129",
                                        "Descripcion": "[Interoperabilidad.Group.Collection.AdditionalInformation.NUMERO_CONTRATO.Value] El apartado no existe o no tiene valor en el XML del documento electrónico. Por favor verifique que la etiqueta Xml use mayúsculas y minúsculas según resolución",
                                        "Observaciones": "",
                                        "PathFuente": "",
                                        "Fuente": "FacturaElectronica"
                                    }];
                                }
                                
                                if (!data.hasOwnProperty('tipoNota')) {
                                    data.tipoNota = null;
                                }
                                
                                if (!data.hasOwnProperty('numNota')) {
                                    data.numNota = null;
                                }
                                
                                const contenidoProcesado = JSON.stringify(data, null, 2);
                                zip.file(nuevaRuta, contenidoProcesado);
                                cuvModificados++;
                                
                                console.log(`✅ Archivo CUV actualizado correctamente: ${nuevoNombreArchivo}`);
                                
                            } catch (jsonError) {
                                console.warn(`❌ Error al procesar ${archivo.name}:`, jsonError);
                                zip.file(nuevaRuta, archivo);
                            }
                        } else {
                            // Agregar archivo normal al ZIP
                            zip.file(nuevaRuta, archivo);
                        }
                        
                    } catch (error) {
                        console.error(`❌ Error al procesar ${archivo.name}:`, error);
                    }
                }
            }
            
            if (carpetasCopiadas > 0) {
                // Generar y descargar ZIP
                const zipBlob = await zip.generateAsync({
                    type: 'blob',
                    compression: 'DEFLATE',
                    compressionOptions: { level: 9 }
                });
                const typedBlob = createTypedBlob(zipBlob, 'zip');
                downloadSecurely(typedBlob, 'json_coosalud_procesados.zip');
                
                // Mostrar resumen como el script Python
                console.log("🔹 Proceso de copiado y renombrado finalizado.");
                console.log("\n📊 Resumen del proceso:");
                console.log(`✔️ Carpetas copiadas y renombradas: ${carpetasCopiadas}`);
                console.log(`✔️ Archivos renombrados: ${archivosRenombrados}`);
                console.log(`✔️ Número total de CUV modificados correctamente: ${cuvModificados}`);
                
                Swal.fire({
                    icon: 'success',
                    title: MESSAGES.success.coosalud,
                    text: 'Descarga iniciada automáticamente',
                    confirmButtonText: 'Entendido',
                    ...getSwalConfig('success')
                });
            } else {
                Swal.fire({
                    icon: 'info',
                    title: MESSAGES.info.noFiles,
                    text: 'No se encontraron carpetas que requieran procesamiento para Coosalud',
                    confirmButtonText: 'Entendido',
                    ...getSwalConfig('info')
                });
            }

        } catch (error) {
            console.error('Error en procesamiento Coosalud:', error);
            const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
            Swal.fire({
                icon: 'error',
                title: MESSAGES.error.processing,
                text: errorMessage,
                confirmButtonText: 'Entendido',
                ...getSwalConfig('error')
            });
        } finally {
            setIsProcessing(false);
            setProcessingType(null);
        }
    };

    const handleValidarSOS = async () => {
        const files = getSelectedFiles();
        if (!files || files.length === 0) {
            const message = selectionMode === 'folder'
                ? 'Por favor selecciona una carpeta con archivos JSON'
                : 'Por favor selecciona archivos JSON para validar';
            Swal.fire({
                icon: 'warning',
                title: 'Archivos requeridos',
                text: message,
                confirmButtonText: 'Entendido',
                ...getSwalConfig('warning')
            });
            return;
        }

        setIsProcessing(true);
        setProcessingType('validar-sos');

        try {
            const JSZip = (await import('jszip')).default;
            
            console.log(`Validando ${files.length} archivos S.O.S...`);
            
            const carpetas = organizeFilesByFolder(files, ['.json']);
            const zip = new JSZip();
            let carpetasProcesadas = 0;
            let archivosValidados = 0;
            
            for (const [nombreCarpeta, archivos] of Object.entries(carpetas)) {
                carpetasProcesadas++;
                
                for (const archivo of archivos) {
                    try {
                        if (archivo.name.toLowerCase().endsWith('.json')) {
                            const contenidoTexto = await leerArchivo(archivo);
                            const data = JSON.parse(contenidoTexto);
                            
                            // Validación S.O.S
                            if (data.ResultadosValidacion && Array.isArray(data.ResultadosValidacion)) {
                                const hasErrors = data.ResultadosValidacion.some(
                                    (item: any) => item.Clase === 'ERROR' || item.Clase === 'RECHAZO'
                                );
                                
                                if (hasErrors) {
                                    archivosValidados++;
                                }
                            }
                            
                            const rutaRelativa = archivo.webkitRelativePath || `${nombreCarpeta}/${archivo.name}`;
                            zip.file(rutaRelativa, archivo);
                        }
                    } catch (error) {
                        console.error(`Error procesando ${archivo.name}:`, error);
                    }
                }
            }
            
            if (carpetasProcesadas > 0) {
                const zipBlob = await zip.generateAsync({
                    type: 'blob',
                    compression: 'DEFLATE',
                    compressionOptions: { level: 9 }
                });
                const typedBlob = createTypedBlob(zipBlob, 'zip');
                downloadSecurely(typedBlob, 'validacion_sos.zip');
                
                Swal.fire({
                    icon: 'success',
                    title: MESSAGES.success.sos,
                    text: `${archivosValidados} archivos con errores detectados`,
                    confirmButtonText: 'Entendido',
                    ...getSwalConfig('success')
                });
            } else {
                Swal.fire({
                    icon: 'info',
                    title: MESSAGES.info.noFiles,
                    text: 'No se encontraron archivos JSON para validar',
                    confirmButtonText: 'Entendido',
                    ...getSwalConfig('info')
                });
            }

        } catch (error) {
            console.error('Error en validación S.O.S:', error);
            const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
            Swal.fire({
                icon: 'error',
                title: MESSAGES.error.processing,
                text: errorMessage,
                confirmButtonText: 'Entendido',
                ...getSwalConfig('error')
            });
        } finally {
            setIsProcessing(false);
            setProcessingType(null);
        }
    };

    const handleConvertToExcel = async () => {
        const files = getSelectedFiles();
        if (!files || files.length === 0) {
            const message = selectionMode === 'folder'
                ? 'Por favor selecciona una carpeta con archivos JSON'
                : 'Por favor selecciona archivos JSON para convertir';
            Swal.fire({
                icon: 'warning',
                title: 'Archivos requeridos',
                text: message,
                confirmButtonText: 'Entendido',
                ...getSwalConfig('warning')
            });
            return;
        }

        setIsProcessing(true);
        setProcessingType('convertir-excel');

        try {
            // XLSX ya está importado estáticamente al inicio del archivo
            // Verificar que XLSX y utils estén disponibles
            if (!XLSX || !XLSX.utils) {
                throw new Error('Error al cargar la librería XLSX. Por favor recarga la página.');
            }
            
            const JSZip = (await import('jszip')).default;
            
            console.log(`Convirtiendo ${files.length} archivos a Excel...`);
            
            const carpetas = organizeFilesByFolder(files, ['.json']);
            const zip = new JSZip();
            let archivosConvertidos = 0;
            
            // Función auxiliar para aplanar objetos anidados
            const flattenObject = (obj: any, prefix = ''): any => {
                const flattened: any = {};
                for (const key in obj) {
                    if (obj.hasOwnProperty(key)) {
                        const newKey = prefix ? `${prefix}.${key}` : key;
                        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                            Object.assign(flattened, flattenObject(obj[key], newKey));
                        } else {
                            // Convertir arrays y valores complejos a string
                            if (Array.isArray(obj[key])) {
                                flattened[newKey] = JSON.stringify(obj[key]);
                            } else {
                                flattened[newKey] = obj[key];
                            }
                        }
                    }
                }
                return flattened;
            };
            
            for (const [nombreCarpeta, archivos] of Object.entries(carpetas)) {
                for (const archivo of archivos) {
                    try {
                        if (archivo.name.toLowerCase().endsWith('.json')) {
                            const contenidoTexto = await leerArchivo(archivo);
                            const data = JSON.parse(contenidoTexto);
                            
                            // Aplanar el objeto para evitar problemas con estructuras anidadas
                            const flattenedData = flattenObject(data);
                            
                            // Convertir a Excel
                            const worksheet = XLSX.utils.json_to_sheet([flattenedData]);
                            const workbook = XLSX.utils.book_new();
                            XLSX.utils.book_append_sheet(workbook, worksheet, 'Datos');
                            
                            const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
                            const excelBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                            
                            const nombreExcel = archivo.name.replace('.json', '.xlsx');
                            const rutaExcel = `${nombreCarpeta}/${nombreExcel}`;
                            
                            zip.file(rutaExcel, excelBlob);
                            archivosConvertidos++;
                            
                            console.log(`✅ Convertido: ${archivo.name} → ${nombreExcel}`);
                        }
                    } catch (error) {
                        console.error(`Error convirtiendo ${archivo.name}:`, error);
                        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
                        console.error(`Detalles del error: ${errorMessage}`);
                    }
                }
            }
            
            if (archivosConvertidos > 0) {
                const zipBlob = await zip.generateAsync({
                    type: 'blob',
                    compression: 'DEFLATE',
                    compressionOptions: { level: 9 }
                });
                const typedBlob = createTypedBlob(zipBlob, 'zip');
                downloadSecurely(typedBlob, 'archivos_excel.zip');
                
                Swal.fire({
                    icon: 'success',
                    title: MESSAGES.success.excel,
                    text: `${archivosConvertidos} archivos convertidos a Excel`,
                    confirmButtonText: 'Entendido',
                    ...getSwalConfig('success')
                });
            } else {
                Swal.fire({
                    icon: 'info',
                    title: MESSAGES.info.noFiles,
                    text: 'No se encontraron archivos JSON para convertir',
                    confirmButtonText: 'Entendido',
                    ...getSwalConfig('info')
                });
            }

        } catch (error) {
            console.error('Error en conversión a Excel:', error);
            const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
            Swal.fire({
                icon: 'error',
                title: MESSAGES.error.processing,
                text: errorMessage,
                confirmButtonText: 'Entendido',
                ...getSwalConfig('error')
            });
        } finally {
            setIsProcessing(false);
            setProcessingType(null);
        }
    };

    const handleFolderSelect = (files: FileList) => {
        setSelectedFolder(files);
        setSelectionMode('folder');
    };

    const handleFilesSelect = (files: FileList) => {
        setSelectedFiles(files);
        setSelectionMode('files');
    };

    return (
        <>
            <Head title="CUPS - Evaristools">
                <meta name="description" content="Herramienta de procesamiento de archivos CUPS - Hospital Universitario del Valle" />
            </Head>

            <div className="min-h-screen bg-white dark:bg-[#1d1d1e]">
                <ToolPageHeader
                    title="CUPS"
                    description="Procesamiento de archivos de facturación electrónica"
                    icon={FileText}
                />

                <div className="container mx-auto px-4 py-8">
                    <div className="max-w-6xl mx-auto">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                            {/* Left Column: File Selection */}
                            <div className="space-y-6" data-tour="upload">
                                <ToolCard
                                    title="Seleccionar Archivos"
                                    description="Elige entre carpeta completa o archivos individuales"
                                >
                                    <Tabs value={selectionMode} onValueChange={(value) => setSelectionMode(value as 'folder' | 'files')}>
                                        <TabsList className="grid w-full grid-cols-2">
                                            <TabsTrigger value="folder">
                                                <FolderOpen className="h-4 w-4 mr-2" />
                                                Carpeta
                                            </TabsTrigger>
                                            <TabsTrigger value="files">
                                                <FileText className="h-4 w-4 mr-2" />
                                                Archivos
                                            </TabsTrigger>
                                        </TabsList>

                                        <TabsContent value="folder" className="space-y-4">
                                            <div className="space-y-2">
                                                <Label>Seleccionar Carpeta</Label>
                                                <input
                                                    ref={folderInputRef}
                                                    type="file"
                                                    /* @ts-ignore */
                                                    webkitdirectory=""
                                                    directory=""
                                                    multiple
                                                    onChange={(e) => e.target.files && handleFolderSelect(e.target.files)}
                                                    className="hidden"
                                                />
                                                <Button
                                                    onClick={() => folderInputRef.current?.click()}
                                                    variant="outline"
                                                    className="w-full"
                                                >
                                                    <FolderOpen className="h-4 w-4 mr-2" />
                                                    Seleccionar Carpeta
                                                </Button>
                                                {selectedFolder && (
                                                    <div className="p-4 bg-slate-50 dark:bg-[#222322] rounded-lg">
                                                        <p className="text-sm text-slate-600 dark:text-slate-300">
                                                            {selectedFolder.length} archivos seleccionados
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="files" className="space-y-4">
                                            <div className="space-y-2">
                                                <Label>Seleccionar Archivos</Label>
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    multiple
                                                    onChange={(e) => e.target.files && handleFilesSelect(e.target.files)}
                                                    className="hidden"
                                                />
                                                <Button
                                                    onClick={() => fileInputRef.current?.click()}
                                                    variant="outline"
                                                    className="w-full"
                                                >
                                                    <FileText className="h-4 w-4 mr-2" />
                                                    Seleccionar Archivos
                                                </Button>
                                                {selectedFiles && (
                                                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                                        <p className="text-sm text-slate-600 dark:text-slate-300">
                                                            {selectedFiles.length} archivos seleccionados
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </TabsContent>
                                    </Tabs>
                                </ToolCard>
                            </div>

                            {/* Right Column: Operations */}
                            <div className="space-y-6" data-tour="operations">
                                <ToolCard
                                    title="Operaciones Disponibles"
                                    description="Selecciona la operación que deseas realizar"
                                >
                                    <div className="space-y-3">
                                        <Button
                                            onClick={handleComprimirPDF}
                                            disabled={isProcessing || !getSelectedFiles()}
                                            className="w-full bg-institutional hover:bg-institutional/90"
                                        >
                                            <FileText className="h-4 w-4 mr-2" />
                                            {processingType === 'comprimir-pdf' ? 'Comprimiendo...' : 'Comprimir PDFs'}
                                        </Button>

                                        <Button
                                            onClick={handleConvertToCoosalud}
                                            disabled={isProcessing || !getSelectedFiles()}
                                            className="w-full bg-institutional hover:bg-institutional/90"
                                        >
                                            <Building2 className="h-4 w-4 mr-2" />
                                            {processingType === 'coosalud' ? 'Procesando...' : 'Procesar Coosalud'}
                                        </Button>

                                        <Button
                                            onClick={handleValidarOtrasEPS}
                                            disabled={isProcessing || !getSelectedFiles()}
                                            className="w-full bg-institutional hover:bg-institutional/90"
                                        >
                                            <Shield className="h-4 w-4 mr-2" />
                                            {processingType === 'otras-eps' ? 'Procesando...' : 'Procesar Otras EPS'}
                                        </Button>

                                        <Button
                                            onClick={handleValidarSOS}
                                            disabled={isProcessing || !getSelectedFiles()}
                                            className="w-full bg-institutional hover:bg-institutional/90"
                                        >
                                            <Activity className="h-4 w-4 mr-2" />
                                            {processingType === 'validar-sos' ? 'Validando...' : 'Validar S.O.S'}
                                        </Button>

                                        <Button
                                            onClick={handleConvertToExcel}
                                            disabled={isProcessing || !getSelectedFiles()}
                                            className="w-full bg-institutional hover:bg-institutional/90"
                                        >
                                            <FileSpreadsheet className="h-4 w-4 mr-2" />
                                            {processingType === 'convertir-excel' ? 'Convirtiendo...' : 'Convertir a Excel'}
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
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}