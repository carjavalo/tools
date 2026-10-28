import { hasExtension } from '@/lib/conversion';

export type PageRotation = 0 | 90 | 180 | 270;

/** Lleva cualquier ángulo (-90, 450...) al giro equivalente entre 0 y 270. */
export const normalizeRotation = (angle: number): PageRotation =>
    ((((Math.round(angle / 90) * 90) % 360) + 360) % 360) as PageRotation;

export const isPdfFile = (file: File): boolean =>
    file.type === 'application/pdf' || hasExtension(file, ['pdf']);

export const isEncryptedPdfError = (error: unknown): boolean =>
    error instanceof Error && error.message.toLowerCase().includes('encrypted');

// Lo que se necesita de una página de pdf-lib (sirve también para @cantoo/pdf-lib).
interface PageLike {
    getCropBox(): { x: number; y: number; width: number; height: number };
    getRotation(): { angle: number };
}

/** Zona visible de la página (CropBox) y el giro con que se muestra. */
export interface PageFrame {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: PageRotation;
}

export function pageFrame(page: PageLike): PageFrame {
    const box = page.getCropBox();
    return { ...box, rotation: normalizeRotation(page.getRotation().angle) };
}

/** Tamaño de la página tal como se ve en pantalla (ya girada), en puntos. */
export function displaySize(frame: PageFrame): { width: number; height: number } {
    return frame.rotation === 90 || frame.rotation === 270
        ? { width: frame.height, height: frame.width }
        : { width: frame.width, height: frame.height };
}

/**
 * Convierte un punto de la página tal como se ve (origen arriba a la
 * izquierda, y hacia abajo, en puntos) a coordenadas del PDF. Así lo que el
 * usuario coloca sobre la vista previa queda en el mismo sitio aunque la
 * página tenga /Rotate (escaneos apaisados, por ejemplo).
 */
export function displayToPdf(frame: PageFrame, u: number, v: number): { x: number; y: number } {
    const { x, y, width, height } = frame;
    switch (frame.rotation) {
        case 90:
            return { x: x + v, y: y + u };
        case 180:
            return { x: x + width - u, y: y + v };
        case 270:
            return { x: x + width - v, y: y + height - u };
        default:
            return { x: x + u, y: y + height - v };
    }
}

/**
 * Origen (esquina inferior izquierda) con que hay que dibujar en pdf-lib un
 * elemento de ancho × alto para que quede centrado en (u, v) de la vista y
 * girado `angle` grados en sentido antihorario tal como se ve. Devuelve
 * también el giro total que hay que pasarle a pdf-lib.
 */
export function centeredPlacement(
    frame: PageFrame,
    u: number,
    v: number,
    width: number,
    height: number,
    angle = 0,
): { x: number; y: number; rotate: number } {
    const center = displayToPdf(frame, u, v);
    // pdf-lib gira alrededor del origen; el giro de la página se compensa.
    const rotate = angle + frame.rotation;
    const radians = (rotate * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return {
        x: center.x - (width / 2) * cos + (height / 2) * sin,
        y: center.y - (width / 2) * sin - (height / 2) * cos,
        rotate,
    };
}

/**
 * Lee una lista de páginas como "1-3, 5, 8-10". Devuelve las páginas en orden
 * y sin repetir, o null si algo no es válido o se sale del documento.
 */
export function parsePageList(input: string, total: number): number[] | null {
    const parts = input.split(',').map((part) => part.trim()).filter(Boolean);
    if (parts.length === 0) return null;

    const pages = new Set<number>();
    for (const part of parts) {
        const match = /^(\d+)\s*(?:-\s*(\d+))?$/.exec(part);
        if (!match) return null;
        const start = Number(match[1]);
        const end = match[2] ? Number(match[2]) : start;
        if (start < 1 || end > total || start > end) return null;
        for (let page = start; page <= end; page++) pages.add(page);
    }
    return [...pages].sort((a, b) => a - b);
}

export const pdfBaseName = (file: File): string => file.name.replace(/\.pdf$/i, '');

export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/** Descarga un archivo generado en el navegador. */
export function downloadBlob(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Se libera después: algunos navegadores leen la URL tras el clic.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
