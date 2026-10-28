import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&url';
import { useCallback, useEffect, useRef, useState } from 'react';

// El worker va empaquetado con la aplicación (no desde un CDN): la red del
// hospital puede bloquear sitios externos. Vite lo emite como .js, que
// cualquier servidor entrega con el tipo MIME correcto; en desarrollo viene
// del servidor de Vite (otro origen) y pdf.js lo envuelve por su cuenta.
function ensureWorker() {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

// Las miniaturas se pintan por tandas para no redibujar la cuadrícula en
// cada página de un PDF largo.
const BATCH_SIZE = 6;

async function renderPageToDataUrl(pdf: PDFDocumentProxy, pageNumber: number, targetWidth: number): Promise<string> {
    const page = await pdf.getPage(pageNumber);
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const baseViewport = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: (targetWidth / baseViewport.width) * pixelRatio });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const context = canvas.getContext('2d')!;

    await page.render({ canvasContext: context, viewport, canvas }).promise;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    page.cleanup();
    canvas.width = 0;
    canvas.height = 0;

    return dataUrl;
}

/**
 * Miniatura de la primera página, para listas de archivos. Devuelve null si
 * el PDF no se puede leer (dañado, protegido...).
 */
export async function renderFirstPageThumbnail(file: File, width = 120): Promise<string | null> {
    ensureWorker();
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
    try {
        const pdf = await loadingTask.promise;
        return await renderPageToDataUrl(pdf, 1, width);
    } catch (err) {
        console.error('Error generando la miniatura:', err);
        return null;
    } finally {
        loadingTask.destroy();
    }
}

/**
 * Genera miniaturas de cada página de un PDF en el navegador.
 * `thumbnails[i]` es null mientras la página i + 1 no se ha pintado.
 */
export function usePdfThumbnails(file: File | null, thumbnailWidth = 200) {
    const [thumbnails, setThumbnails] = useState<(string | null)[]>([]);
    const [isRendering, setIsRendering] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const pdfRef = useRef<PDFDocumentProxy | null>(null);

    useEffect(() => {
        setThumbnails([]);
        setError(null);

        if (!file) {
            setIsRendering(false);
            return;
        }

        let cancelled = false;
        let loadingTask: PDFDocumentLoadingTask | null = null;

        (async () => {
            setIsRendering(true);
            try {
                ensureWorker();
                const data = new Uint8Array(await file.arrayBuffer());
                loadingTask = pdfjsLib.getDocument({ data });
                const pdf = await loadingTask.promise;
                if (cancelled) return;

                pdfRef.current = pdf;
                const rendered: (string | null)[] = Array(pdf.numPages).fill(null);
                setThumbnails([...rendered]);

                for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
                    rendered[pageNumber - 1] = await renderPageToDataUrl(pdf, pageNumber, thumbnailWidth);
                    if (cancelled) return;
                    if (pageNumber % BATCH_SIZE === 0 || pageNumber === pdf.numPages) {
                        setThumbnails([...rendered]);
                    }
                }
            } catch (err) {
                if (!cancelled) {
                    console.error('Error generando miniaturas:', err);
                    setError('No se pudo generar la vista previa de este PDF.');
                }
            } finally {
                if (!cancelled) setIsRendering(false);
            }
        })();

        return () => {
            cancelled = true;
            pdfRef.current = null;
            loadingTask?.destroy();
        };
    }, [file, thumbnailWidth]);

    // Para la vista ampliada: pinta una página al ancho pedido.
    const renderPage = useCallback(async (pageNumber: number, width: number): Promise<string | null> => {
        const pdf = pdfRef.current;
        if (!pdf || pageNumber < 1 || pageNumber > pdf.numPages) return null;
        return renderPageToDataUrl(pdf, pageNumber, width);
    }, []);

    return { thumbnails, isRendering, error, renderPage };
}

/**
 * Abre un PDF con pdf.js para pintar páginas sueltas a demanda, sin generar
 * las miniaturas de todo el documento.
 */
export function usePdfRenderer(file: File | null) {
    const [pageCount, setPageCount] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const pdfRef = useRef<PDFDocumentProxy | null>(null);

    useEffect(() => {
        setPageCount(0);
        setError(null);
        if (!file) return;

        let cancelled = false;
        let loadingTask: PDFDocumentLoadingTask | null = null;

        (async () => {
            try {
                ensureWorker();
                loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
                const pdf = await loadingTask.promise;
                if (cancelled) return;
                pdfRef.current = pdf;
                setPageCount(pdf.numPages);
            } catch (err) {
                if (!cancelled) {
                    console.error('Error abriendo el PDF:', err);
                    setError('No se pudo generar la vista previa de este PDF.');
                }
            }
        })();

        return () => {
            cancelled = true;
            pdfRef.current = null;
            loadingTask?.destroy();
        };
    }, [file]);

    const renderPage = useCallback(async (pageNumber: number, width: number): Promise<string | null> => {
        const pdf = pdfRef.current;
        if (!pdf || pageNumber < 1 || pageNumber > pdf.numPages) return null;
        return renderPageToDataUrl(pdf, pageNumber, width);
    }, []);

    return { pageCount, error, renderPage };
}
