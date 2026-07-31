/**
 * Utilidades para descargas seguras sin avisos del navegador
 */

// Tipos MIME específicos para cada tipo de archivo
const MIME_TYPES = {
    zip: 'application/zip',
    excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    json: 'application/json',
    pdf: 'application/pdf'
} as const;

type FileType = keyof typeof MIME_TYPES;

/**
 * Crea un blob con el tipo MIME correcto
 */
export const createTypedBlob = (data: any, type: FileType): Blob => {
    return new Blob([data], { 
        type: MIME_TYPES[type] 
    });
};

/**
 * Descarga un archivo de forma segura usando métodos nativos del navegador
 * Esta función minimiza los avisos de "descarga no segura"
 */
export const downloadSecurely = (blob: Blob, filename: string): boolean => {
    try {
        // Método nativo más confiable que file-saver
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        // Configurar el enlace de descarga
        link.href = url;
        link.download = filename;
        
        // En desarrollo HTTP, usar configuración más permisiva
        const isDevelopment = window.location.protocol === 'http:';
        
        if (isDevelopment) {
            // En HTTP no usar noreferrer para evitar bloqueos
            link.setAttribute('rel', 'noopener');
        } else {
            // En HTTPS usar configuración completa
            link.setAttribute('rel', 'noopener noreferrer');
        }
        
        link.setAttribute('target', '_self');
        
        // Estilos para hacer invisible el enlace
        link.style.display = 'none';
        link.style.position = 'absolute';
        link.style.left = '-9999px';
        
        // Agregar al DOM, hacer clic y limpiar
        document.body.appendChild(link);
        
        // Click directo es más compatible en HTTP
        link.click();
        
        // Limpiar después de un pequeño delay
        setTimeout(() => {
            if (document.body.contains(link)) {
                document.body.removeChild(link);
            }
            URL.revokeObjectURL(url);
        }, 100);
        
        return true;
    } catch (error) {
        console.error('Error en descarga segura:', error);
        return false;
    }
};

/**
 * Descarga con indicador de progreso visual
 */
export const downloadWithProgress = async (
    generateFunction: () => Promise<Blob>, 
    filename: string,
    type: FileType,
    onProgress?: (progress: number) => void
): Promise<boolean> => {
    let progressContainer: HTMLElement | null = null;
    
    try {
        // Crear indicador de progreso
        progressContainer = createProgressIndicator(filename);
        document.body.appendChild(progressContainer);
        
        // Simular progreso inicial
        updateProgress(progressContainer, 10);
        onProgress?.(10);
        
        // Generar archivo
        const blob = await generateFunction();
        updateProgress(progressContainer, 80);
        onProgress?.(80);
        
        // Crear blob tipado
        const typedBlob = createTypedBlob(blob, type);
        updateProgress(progressContainer, 95);
        onProgress?.(95);
        
        // Pequeña pausa para mostrar completado
        await new Promise(resolve => setTimeout(resolve, 300));
        updateProgress(progressContainer, 100);
        onProgress?.(100);
        
        // Realizar descarga
        const success = downloadSecurely(typedBlob, filename);
        
        // Remover indicador después de un delay
        setTimeout(() => {
            if (progressContainer && document.body.contains(progressContainer)) {
                document.body.removeChild(progressContainer);
            }
        }, 1000);
        
        return success;
    } catch (error) {
        console.error('Error en descarga con progreso:', error);
        
        // Limpiar indicador en caso de error
        if (progressContainer && document.body.contains(progressContainer)) {
            document.body.removeChild(progressContainer);
        }
        
        return false;
    }
};

/**
 * Crea un indicador de progreso visual
 */
const createProgressIndicator = (filename: string): HTMLElement => {
    const container = document.createElement('div');
    container.innerHTML = `
        <div style="
            position: fixed; 
            top: 50%; 
            left: 50%; 
            transform: translate(-50%, -50%); 
            background: white; 
            padding: 24px; 
            border-radius: 12px; 
            box-shadow: 0 8px 32px rgba(0,0,0,0.12); 
            z-index: 10000;
            min-width: 300px;
            text-align: center;
            font-family: system-ui, -apple-system, sans-serif;
        ">
            <div style="margin-bottom: 16px;">
                <div style="
                    width: 40px; 
                    height: 40px; 
                    border: 3px solid #f3f3f3; 
                    border-top: 3px solid #007bff; 
                    border-radius: 50%; 
                    animation: spin 1s linear infinite; 
                    margin: 0 auto 12px;
                "></div>
                <p style="margin: 0; font-size: 14px; color: #333; font-weight: 500;">
                    Preparando descarga...
                </p>
                <p style="margin: 4px 0 0; font-size: 12px; color: #666;">
                    ${filename}
                </p>
            </div>
            <div style="
                width: 100%; 
                height: 6px; 
                background: #f0f0f0; 
                border-radius: 3px; 
                overflow: hidden;
            ">
                <div class="progress-bar" style="
                    width: 0%; 
                    height: 100%; 
                    background: linear-gradient(90deg, #007bff, #0056b3); 
                    border-radius: 3px; 
                    transition: width 0.3s ease;
                "></div>
            </div>
        </div>
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;
    
    return container;
};

/**
 * Actualiza el progreso visual
 */
const updateProgress = (container: HTMLElement, progress: number): void => {
    const progressBar = container.querySelector('.progress-bar') as HTMLElement;
    if (progressBar) {
        progressBar.style.width = `${Math.min(progress, 100)}%`;
    }
};

/**
 * Función de fallback usando file-saver si el método nativo falla
 */
export const downloadFallback = async (blob: Blob, filename: string): Promise<boolean> => {
    try {
        const { saveAs } = await import('file-saver');
        saveAs(blob, filename);
        return true;
    } catch (error) {
        console.error('Error en fallback de descarga:', error);
        return false;
    }
};