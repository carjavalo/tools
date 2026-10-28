import axios from 'axios';
import { conversionErrorMessage } from '@/lib/conversion';
import { loadImageFile, revokeImage } from '@/lib/image-tools';

export type OcrLanguage = 'spa' | 'eng';

export const OCR_LANGUAGES: { value: OcrLanguage; label: string }[] = [
    { value: 'spa', label: 'Español' },
    { value: 'eng', label: 'Inglés' },
];

// Límite por archivo del plan gratuito de OCR.space.
const MAX_UPLOAD_BYTES = 1024 * 1024;

// Se prueba de mayor a menor calidad hasta que la imagen quepa.
const ATTEMPTS = [
    { maxDimension: 2400, jpegQuality: 0.85 },
    { maxDimension: 1800, jpegQuality: 0.75 },
    { maxDimension: 1400, jpegQuality: 0.65 },
];

/**
 * Deja la imagen lista para OCR.space: derecha (giro EXIF), en JPG y por
 * debajo de 1 MB. Acepta también fotos HEIC.
 */
export async function prepareImageForOcr(source: Blob): Promise<Blob> {
    let last: Uint8Array | null = null;
    for (const attempt of ATTEMPTS) {
        const image = await loadImageFile(source, attempt);
        revokeImage(image);
        last = image.bytes;
        if (image.bytes.length <= MAX_UPLOAD_BYTES) break;
    }
    return new Blob([last as BlobPart], { type: 'image/jpeg' });
}

/** Envía una imagen ya preparada al servidor, que la pasa a OCR.space. */
export async function runOcr(image: Blob, language: OcrLanguage): Promise<string> {
    const formData = new FormData();
    formData.append('file', image, 'imagen.jpg');
    formData.append('language', language);

    try {
        const response = await axios.post<{ text?: string }>('/tools/ocr-extract/extract', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
            },
            timeout: 150000,
        });
        return response.data.text ?? '';
    } catch (error) {
        throw new Error(await conversionErrorMessage(error, 'No se pudo extraer el texto. Intenta de nuevo.'));
    }
}
