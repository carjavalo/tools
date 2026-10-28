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
    // Si se indica (0–1), la imagen se vuelve a codificar como JPEG con esa calidad.
    jpegQuality?: number;
}

const isPng = (bytes: Uint8Array) => bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
const isJpg = (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

// Fotos de iPhone: contenedor ISO-BMFF con una de estas marcas.
const HEIC_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'];

export function isHeicBytes(bytes: Uint8Array): boolean {
    const text = (start: number) => String.fromCharCode(...bytes.slice(start, start + 4));
    return bytes.length > 12 && text(4) === 'ftyp' && HEIC_BRANDS.includes(text(8));
}

/** ¿Es una foto HEIC? Por la extensión o por el contenido. */
export async function isHeicFile(file: File): Promise<boolean> {
    if (/\.(heic|heif)$/i.test(file.name) || /image\/hei[cf]/.test(file.type)) return true;
    return isHeicBytes(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
}

/**
 * Convierte una foto HEIC a JPEG. La librería pesa unos 3 MB, así que solo
 * se descarga cuando alguien sube una foto de este tipo.
 */
async function heicToJpeg(file: Blob): Promise<Blob> {
    try {
        const { heicTo } = await import('heic-to');
        return await heicTo({ blob: file, type: 'image/jpeg', quality: 0.92 });
    } catch (error) {
        console.error('Error convirtiendo HEIC:', error);
        throw new Error('No se pudo leer la foto HEIC del iPhone. Intenta exportarla como JPG.');
    }
}

/**
 * Orientación EXIF de un JPEG (1 = normal). Las fotos de celular suelen
 * venir giradas con esta marca: el navegador la aplica al mostrarlas, pero
 * un PDF no, así que hay que redibujarlas.
 */
export function jpegOrientation(bytes: Uint8Array): number {
    if (!isJpg(bytes)) return 1;
    let offset = 2;
    while (offset + 4 < bytes.length && bytes[offset] === 0xff) {
        const marker = bytes[offset + 1];
        const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
        if (marker === 0xda) break;
        if (marker === 0xe1 && String.fromCharCode(...bytes.slice(offset + 4, offset + 8)) === 'Exif') {
            const tiff = offset + 10;
            const little = bytes[tiff] === 0x49;
            const read16 = (at: number) => (little ? bytes[at] | (bytes[at + 1] << 8) : (bytes[at] << 8) | bytes[at + 1]);
            const read32 = (at: number) => (little ? read16(at) | (read16(at + 2) << 16) : (read16(at) << 16) | read16(at + 2));
            const directory = tiff + read32(tiff + 4);
            const entries = read16(directory);
            for (let i = 0; i < entries; i++) {
                const entry = directory + 2 + i * 12;
                if (entry + 10 > bytes.length) break;
                if (read16(entry) === 0x0112) return read16(entry + 8);
            }
            return 1;
        }
        offset += 2 + length;
    }
    return 1;
}

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

export async function canvasToImage(canvas: HTMLCanvasElement, jpegQuality?: number): Promise<LoadedImage> {
    const type = jpegQuality !== undefined ? 'image/jpeg' : 'image/png';
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, jpegQuality));
    if (!blob) throw new Error('No se pudo generar la imagen.');
    return fromBytes(new Uint8Array(await blob.arrayBuffer()), jpegQuality !== undefined ? 'jpg' : 'png');
}

/**
 * Lee una imagen subida por el usuario y la deja en PNG o JPG. Convierte las
 * fotos HEIC del iPhone y endereza las que traen giro EXIF. Si hay que
 * quitar el fondo, recortarla, reducirla, comprimirla o no es PNG/JPG, se
 * redibuja en un canvas.
 */
export async function loadImageFile(file: Blob, options: LoadImageOptions = {}): Promise<LoadedImage> {
    let source = file;
    let bytes = new Uint8Array(await source.arrayBuffer());
    if (isHeicBytes(bytes)) {
        source = await heicToJpeg(file);
        bytes = new Uint8Array(await source.arrayBuffer());
    }
    const format = isPng(bytes) ? 'png' : isJpg(bytes) ? 'jpg' : null;

    const url = URL.createObjectURL(source);
    let element: HTMLImageElement;
    try {
        element = await loadImageElement(url);
    } catch {
        throw new Error('El navegador no puede leer esta imagen. Usa JPG, PNG, WebP o HEIC.');
    } finally {
        URL.revokeObjectURL(url);
    }

    // naturalWidth/Height ya vienen con el giro EXIF aplicado.
    const { naturalWidth: width, naturalHeight: height } = element;
    const maxDimension = options.maxDimension ?? Infinity;
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const needsRedraw =
        !format || scale < 1 || options.removeWhite || options.trim || options.jpegQuality !== undefined || jpegOrientation(bytes) > 1;

    if (!needsRedraw) return fromBytes(bytes, format!);

    let canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('El navegador no pudo procesar la imagen.');
    if (options.jpegQuality !== undefined) {
        // JPEG no tiene transparencia: fondo blanco, como el papel.
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.imageSmoothingQuality = 'high';
    context.drawImage(element, 0, 0, canvas.width, canvas.height);

    if (options.removeWhite) removeWhiteBackground(context, canvas.width, canvas.height);
    if (options.trim) {
        const trimmed = trimCanvas(canvas);
        if (!trimmed) throw new Error('La imagen está vacía o es completamente blanca.');
        canvas = trimmed;
    }

    const image = await canvasToImage(canvas, options.removeWhite ? undefined : options.jpegQuality);
    canvas.width = 0;
    canvas.height = 0;
    return image;
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
