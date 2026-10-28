import { PDFDocument, PDFFont, StandardFonts, degrees, rgb } from 'pdf-lib';
import { centeredPlacement, displaySize, pageFrame } from '@/lib/pdf-pages';

export type WatermarkAnchor = 'tl' | 'tc' | 'tr' | 'ml' | 'mc' | 'mr' | 'bl' | 'bc' | 'br';
export type WatermarkLayout = 'single' | 'tile';

export interface WatermarkLayoutOptions {
    layout: WatermarkLayout;
    anchor: WatermarkAnchor;
    // Grados en sentido antihorario, tal como se ve la página.
    angle: number;
    // Ancho del texto o imagen como fracción del ancho de la página.
    size: number;
}

export type WatermarkMark =
    | { kind: 'text'; text: string; color: string }
    | { kind: 'image'; bytes: Uint8Array; format: 'png' | 'jpg'; width: number; height: number };

/** Centro de cada repetición de la marca, en puntos de la página tal como se ve. */
export interface WatermarkPlacement {
    u: number;
    v: number;
}

// Un mosaico muy denso con un texto corto podría generar miles de copias.
const MAX_TILES = 150;

let measureFont: Promise<PDFFont> | null = null;

/** Helvetica Bold, para medir el texto igual en la vista previa y en el PDF. */
export function watermarkFont(): Promise<PDFFont> {
    measureFont ??= PDFDocument.create().then((doc) => doc.embedFont(StandardFonts.HelveticaBold));
    return measureFont;
}

/**
 * Tamaño en puntos del texto o la imagen sobre una página de este ancho.
 * Para el texto, `height` es la altura de las mayúsculas y `fontSize` el
 * tamaño de letra que da ese ancho.
 */
export function markSize(mark: WatermarkMark, font: PDFFont, pageWidth: number, size: number) {
    const width = pageWidth * size;
    if (mark.kind === 'image') return { width, height: (width * mark.height) / mark.width, fontSize: 0 };

    const fontSize = width / font.widthOfTextAtSize(mark.text, 1);
    return { width, height: font.heightAtSize(fontSize, { descender: false }), fontSize };
}

/** Lanza un error con un mensaje claro si Helvetica no puede escribir el texto. */
export function assertEncodable(font: PDFFont, text: string) {
    try {
        font.widthOfTextAtSize(text, 1);
    } catch {
        throw new Error('El texto tiene caracteres que no se pueden usar en la marca de agua (emojis o símbolos especiales).');
    }
}

export function layoutWatermark(
    pageWidth: number,
    pageHeight: number,
    itemWidth: number,
    itemHeight: number,
    options: WatermarkLayoutOptions,
): WatermarkPlacement[] {
    const radians = (options.angle * Math.PI) / 180;
    // Caja que ocupa el elemento ya girado.
    const boxWidth = Math.abs(itemWidth * Math.cos(radians)) + Math.abs(itemHeight * Math.sin(radians));
    const boxHeight = Math.abs(itemWidth * Math.sin(radians)) + Math.abs(itemHeight * Math.cos(radians));

    if (options.layout === 'single') {
        const margin = Math.min(pageWidth, pageHeight) * 0.05;
        const column = options.anchor[1];
        const row = options.anchor[0];
        const u = column === 'l' ? margin + boxWidth / 2 : column === 'r' ? pageWidth - margin - boxWidth / 2 : pageWidth / 2;
        const v = row === 't' ? margin + boxHeight / 2 : row === 'b' ? pageHeight - margin - boxHeight / 2 : pageHeight / 2;
        return [{ u, v }];
    }

    // Mosaico al tresbolillo: cada fila se corre media posición.
    const gap = Math.max(24, Math.min(pageWidth, pageHeight) * 0.06);
    const stepX = boxWidth + gap;
    const stepY = boxHeight + gap;
    const placements: WatermarkPlacement[] = [];
    for (let row = 0, v = stepY / 2; v - boxHeight / 2 < pageHeight; row++, v += stepY) {
        const offset = row % 2 === 0 ? 0 : stepX / 2;
        for (let u = offset; u - boxWidth / 2 < pageWidth; u += stepX) {
            placements.push({ u, v });
            if (placements.length >= MAX_TILES) return placements;
        }
    }
    return placements;
}

const hexToRgb = (hex: string) => {
    const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return match
        ? rgb(parseInt(match[1], 16) / 255, parseInt(match[2], 16) / 255, parseInt(match[3], 16) / 255)
        : rgb(0.5, 0.5, 0.5);
};

/**
 * Dibuja la marca de agua encima del contenido de las páginas indicadas
 * (índices desde 0). Respeta el giro de cada página.
 */
export async function applyWatermark(
    pdfDoc: PDFDocument,
    mark: WatermarkMark,
    options: WatermarkLayoutOptions,
    opacity: number,
    pageIndexes: number[],
) {
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    if (mark.kind === 'text') assertEncodable(font, mark.text);

    const image =
        mark.kind === 'image' ? await (mark.format === 'png' ? pdfDoc.embedPng(mark.bytes) : pdfDoc.embedJpg(mark.bytes)) : null;
    const color = mark.kind === 'text' ? hexToRgb(mark.color) : undefined;

    const pages = pdfDoc.getPages();
    for (const index of pageIndexes) {
        const page = pages[index];
        const frame = pageFrame(page);
        const { width: pageWidth, height: pageHeight } = displaySize(frame);
        const item = markSize(mark, font, pageWidth, options.size);

        for (const { u, v } of layoutWatermark(pageWidth, pageHeight, item.width, item.height, options)) {
            const origin = centeredPlacement(frame, u, v, item.width, item.height, options.angle);
            if (image) {
                page.drawImage(image, {
                    x: origin.x,
                    y: origin.y,
                    width: item.width,
                    height: item.height,
                    rotate: degrees(origin.rotate),
                    opacity,
                });
            } else if (mark.kind === 'text') {
                page.drawText(mark.text, {
                    x: origin.x,
                    y: origin.y,
                    size: item.fontSize,
                    font,
                    color,
                    rotate: degrees(origin.rotate),
                    opacity,
                });
            }
        }
    }
}
