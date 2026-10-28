/** Imagen lista para incrustar en un PDF con pdf-lib (solo admite PNG y JPG). */
export interface LoadedImage {
    bytes: Uint8Array;
    format: 'png' | 'jpg';
    width: number;
    height: number;
    // Para mostrarla en la página y pintarla en un canvas.
    url: string;
    element: HTMLImageElement;
}

interface LoadImageOptions {
    // Vuelve transparente el fondo blanco o casi blanco (firmas escaneadas, logos en JPG).
    removeWhite?: boolean;
    // Recorta los bordes vacíos.
    trim?: boolean;
    // Lado mayor máximo en píxeles.
    maxDimension?: number;
}

const isPng = (bytes: Uint8Array) => bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
const isJpg = (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

export function loadImageElement(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('No se pudo leer la imagen.'));
        image.src = url;
    });
}

async function fromBytes(bytes: Uint8Array, format: 'png' | 'jpg'): Promise<LoadedImage> {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: format === 'png' ? 'image/png' : 'image/jpeg' }));
    const element = await loadImageElement(url);
    return { bytes, format, width: element.naturalWidth, height: element.naturalHeight, url, element };
}

/** Pasa a transparente lo blanco: más claro, más transparente, con bordes suaves. */
function removeWhiteBackground(context: CanvasRenderingContext2D, width: number, height: number) {
    const imageData = context.getImageData(0, 0, width, height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        if (luminance >= 235) data[i + 3] = 0;
        else if (luminance > 190) data[i + 3] = Math.min(data[i + 3], Math.round(((235 - luminance) / 45) * 255));
    }
    context.putImageData(imageData, 0, 0);
}

/** Recorta el canvas a la zona con contenido visible. Devuelve null si está vacío. */
export function trimCanvas(source: HTMLCanvasElement, padding = 4): HTMLCanvasElement | null {
    const context = source.getContext('2d');
    if (!context) return null;
    const { width, height } = source;
    const data = context.getImageData(0, 0, width, height).data;

    let top = height;
    let left = width;
    let right = -1;
    let bottom = -1;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (data[(y * width + x) * 4 + 3] > 8) {
                if (x < left) left = x;
                if (x > right) right = x;
                if (y < top) top = y;
                if (y > bottom) bottom = y;
            }
        }
    }
    if (right < 0) return null;

    left = Math.max(0, left - padding);
    top = Math.max(0, top - padding);
    right = Math.min(width - 1, right + padding);
    bottom = Math.min(height - 1, bottom + padding);

    const trimmed = document.createElement('canvas');
    trimmed.width = right - left + 1;
    trimmed.height = bottom - top + 1;
    trimmed.getContext('2d')!.drawImage(source, left, top, trimmed.width, trimmed.height, 0, 0, trimmed.width, trimmed.height);
    return trimmed;
}

export async function canvasToImage(canvas: HTMLCanvasElement): Promise<LoadedImage> {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('No se pudo generar la imagen.');
    return fromBytes(new Uint8Array(await blob.arrayBuffer()), 'png');
}

/**
 * Lee una imagen subida por el usuario y la deja en PNG o JPG. Si hay que
 * quitar el fondo, recortarla, reducirla o no es PNG/JPG, se redibuja en un
 * canvas y se exporta como PNG.
 */
export async function loadImageFile(file: Blob, options: LoadImageOptions = {}): Promise<LoadedImage> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const format = isPng(bytes) ? 'png' : isJpg(bytes) ? 'jpg' : null;

    const url = URL.createObjectURL(file);
    let element: HTMLImageElement;
    try {
        element = await loadImageElement(url);
    } finally {
        URL.revokeObjectURL(url);
    }

    const { naturalWidth: width, naturalHeight: height } = element;
    const maxDimension = options.maxDimension ?? Infinity;
    const scale = Math.min(1, maxDimension / Math.max(width, height));

    if (format && scale === 1 && !options.removeWhite && !options.trim) return fromBytes(bytes, format);

    let canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('El navegador no pudo procesar la imagen.');
    context.drawImage(element, 0, 0, canvas.width, canvas.height);

    if (options.removeWhite) removeWhiteBackground(context, canvas.width, canvas.height);
    if (options.trim) {
        const trimmed = trimCanvas(canvas);
        if (!trimmed) throw new Error('La imagen está vacía o es completamente blanca.');
        canvas = trimmed;
    }

    return canvasToImage(canvas);
}

/** Carga una imagen publicada en el sitio (por ejemplo, el logo del hospital). */
export async function loadImageUrl(url: string): Promise<LoadedImage> {
    const response = await fetch(url);
    if (!response.ok) throw new Error('No se pudo cargar la imagen.');
    return loadImageFile(await response.blob());
}

export const revokeImage = (image: LoadedImage | null) => {
    if (image) URL.revokeObjectURL(image.url);
};
