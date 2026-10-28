import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFRef } from 'pdf-lib';

export interface ImageCompressionLevel {
    // Lado mayor máximo de cada imagen, en píxeles.
    maxDimension: number;
    // Calidad JPEG entre 0 y 1.
    quality: number;
}

export interface ImageCompressionResult {
    total: number;
    optimized: number;
}

// Solo se reemplaza una imagen si se ahorra al menos esto.
const MIN_SAVING_RATIO = 0.9;

const name = (value: string) => PDFName.of(value);

// Componentes de un espacio de color [/ICCBased perfil] (1 gris, 3 RGB, 4 CMYK),
// o null si no es un perfil ICC.
function iccComponents(pdfDoc: PDFDocument, colorSpace: unknown): number | null {
    if (!(colorSpace instanceof PDFArray) || colorSpace.get(0) !== name('ICCBased')) return null;
    const profile = pdfDoc.context.lookup(colorSpace.get(1));
    const components = profile instanceof PDFRawStream ? profile.dict.get(name('N')) : undefined;
    return components instanceof PDFNumber ? components.asNumber() : null;
}

/**
 * ¿La imagen es un JPEG (DCTDecode) en un espacio de color que el navegador
 * decodifica sin alterar los colores? Se descartan CMYK, colores indexados,
 * máscaras y las que traen /Decode, porque recomprimirlas cambiaría cómo se ven.
 */
function isRecompressibleJpeg(pdfDoc: PDFDocument, dict: PDFDict): boolean {
    if (dict.get(name('Subtype')) !== name('Image')) return false;

    const filter = dict.get(name('Filter'));
    const onlyDct = filter === name('DCTDecode')
        || (filter instanceof PDFArray && filter.size() === 1 && filter.get(0) === name('DCTDecode'));
    if (!onlyDct) return false;

    if (dict.get(name('ImageMask')) || dict.get(name('Decode'))) return false;

    const bits = dict.get(name('BitsPerComponent'));
    if (bits instanceof PDFNumber && bits.asNumber() !== 8) return false;

    const colorSpace = pdfDoc.context.lookup(dict.get(name('ColorSpace')));
    if (colorSpace === name('DeviceRGB') || colorSpace === name('DeviceGray')) return true;

    // Un perfil ICC vale si es de gris o RGB, no de CMYK.
    const components = iccComponents(pdfDoc, colorSpace);
    return components === 1 || components === 3;
}

async function decodeJpeg(bytes: Uint8Array): Promise<ImageBitmap> {
    const blob = new Blob([bytes as BlobPart], { type: 'image/jpeg' });
    try {
        // En un PDF la orientación EXIF no aplica: se decodifica tal cual.
        return await createImageBitmap(blob, { imageOrientation: 'none' });
    } catch {
        return createImageBitmap(blob);
    }
}

async function encodeJpeg(bitmap: ImageBitmap, width: number, height: number, quality: number): Promise<Uint8Array | null> {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return null;

    // Fondo blanco: el JPEG no tiene transparencia.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    canvas.width = 0;
    canvas.height = 0;

    return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
}

/**
 * Recomprime las fotos y escaneos (JPEG) del PDF: las reduce al tamaño máximo
 * del nivel elegido y las vuelve a codificar con su calidad. El texto y los
 * dibujos vectoriales no se tocan, así que el texto sigue siendo seleccionable.
 */
export async function recompressImages(
    pdfDoc: PDFDocument,
    level: ImageCompressionLevel,
    onProgress?: (done: number, total: number) => void,
): Promise<ImageCompressionResult> {
    const images: [PDFRef, PDFRawStream][] = [];
    for (const [ref, object] of pdfDoc.context.enumerateIndirectObjects()) {
        if (object instanceof PDFRawStream && isRecompressibleJpeg(pdfDoc, object.dict)) {
            images.push([ref, object]);
        }
    }

    let optimized = 0;
    for (let index = 0; index < images.length; index++) {
        onProgress?.(index, images.length);
        const [ref, stream] = images[index];

        try {
            const original = stream.contents;
            const bitmap = await decodeJpeg(original);
            const scale = Math.min(1, level.maxDimension / Math.max(bitmap.width, bitmap.height));
            const width = Math.max(1, Math.round(bitmap.width * scale));
            const height = Math.max(1, Math.round(bitmap.height * scale));

            const encoded = await encodeJpeg(bitmap, width, height, level.quality);
            bitmap.close();
            if (!encoded || encoded.length >= original.length * MIN_SAVING_RATIO) continue;

            const dict = stream.dict.clone(pdfDoc.context);
            dict.set(name('Width'), PDFNumber.of(width));
            dict.set(name('Height'), PDFNumber.of(height));
            dict.set(name('BitsPerComponent'), PDFNumber.of(8));
            dict.set(name('Filter'), name('DCTDecode'));
            dict.delete(name('DecodeParms'));
            // El canvas siempre produce JPEG en RGB; un perfil ICC RGB se conserva.
            if (iccComponents(pdfDoc, pdfDoc.context.lookup(dict.get(name('ColorSpace')))) !== 3) {
                dict.set(name('ColorSpace'), name('DeviceRGB'));
            }

            pdfDoc.context.assign(ref, PDFRawStream.of(dict, encoded));
            optimized++;
        } catch (error) {
            // Una imagen que el navegador no puede leer se deja como estaba.
            console.warn('No se pudo recomprimir una imagen del PDF:', error);
        }
    }
    onProgress?.(images.length, images.length);

    return { total: images.length, optimized };
}

/**
 * Quita los metadatos del documento, incluido el bloque XMP, que en algunos
 * PDF pesa varios kilobytes.
 */
export function removeMetadata(pdfDoc: PDFDocument) {
    pdfDoc.setTitle('');
    pdfDoc.setAuthor('');
    pdfDoc.setSubject('');
    pdfDoc.setKeywords([]);
    pdfDoc.setCreator('Evaristools - Hospital Universitario del Valle');
    pdfDoc.setProducer('Evaristools PDF Compressor');
    pdfDoc.catalog.delete(name('Metadata'));
}
