import axios from 'axios';

/**
 * ¿El archivo tiene una de estas extensiones? Se valida por extensión porque
 * en Windows el tipo MIME de los archivos de Office a veces llega vacío.
 */
export const hasExtension = (file: File, extensions: string[]): boolean =>
    extensions.includes(file.name.split('.').pop()?.toLowerCase() ?? '');

/**
 * Mensaje para el usuario cuando falla una conversión que pidió el PDF como
 * blob: el JSON de error del servidor también llega como Blob y hay que leerlo.
 */
export async function conversionErrorMessage(err: unknown, fallback: string): Promise<string> {
    if (!axios.isAxiosError(err)) return fallback;
    if (err.code === 'ECONNABORTED') return 'El servidor está tardando demasiado. Intenta con un archivo más pequeño.';
    if (!err.response) return 'No se pudo conectar con el servidor. Verifica tu conexión.';

    let data: unknown = err.response.data;
    if (data instanceof Blob) {
        try {
            data = JSON.parse(await data.text());
        } catch {
            data = null;
        }
    }

    if (data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string') {
        return (data as { error: string }).error;
    }
    if (err.response.status === 413) return 'El archivo es demasiado grande para el servidor.';
    if (err.response.status === 419) return 'La sesión expiró. Recarga la página e inténtalo de nuevo.';
    if (err.response.status === 429) return 'Demasiados intentos seguidos. Espera un minuto e inténtalo de nuevo.';

    return fallback;
}
