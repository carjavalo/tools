import {
    PDFArray,
    PDFDocument,
    PDFHexString,
    PDFName,
    PDFNumber,
    PDFSignature,
    PDFString,
    concatTransformationMatrix,
    degrees,
    drawObject,
    popGraphicsState,
    pushGraphicsState,
} from '@cantoo/pdf-lib';
import { centeredPlacement, displaySize, displayToPdf, pageFrame, type PageFrame } from '@/lib/pdf-pages';

// Espacio reservado para la firma CMS: alcanza para el certificado y una
// cadena de varios intermedios. El servidor rechaza firmas que no quepan.
const SIGNATURE_BYTES = 10240;
// El servidor busca exactamente este texto (PdfCertificateSigner::BYTE_RANGE_PLACEHOLDER).
const BYTE_RANGE_PLACEHOLDER = '**********';

/**
 * Posición del sello en la página tal como se ve: fracciones del ancho y del
 * alto (origen arriba a la izquierda). La altura sale de la proporción de la
 * imagen, así el sello no se deforma en páginas de otro tamaño.
 */
export interface StampPosition {
    left: number;
    top: number;
    width: number;
}

export interface StampImage {
    bytes: Uint8Array;
    width: number;
    height: number;
}

export interface PdfSignatureInfo {
    encrypted: boolean;
    pageSizes: { width: number; height: number }[];
    // Firmas digitales que ya trae el documento.
    signatureCount: number;
}

export interface CertificateSignatureDetails {
    name: string;
    reason: string;
    location: string;
}

export async function inspectPdf(bytes: ArrayBuffer): Promise<PdfSignatureInfo> {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
    if (doc.isEncrypted) return { encrypted: true, pageSizes: [], signatureCount: 0 };

    return {
        encrypted: false,
        pageSizes: doc.getPages().map((page) => displaySize(pageFrame(page))),
        signatureCount: doc.getForm().getFields().filter((field) => field instanceof PDFSignature).length,
    };
}

/** Rectángulo del sello en puntos de la vista y su caja en coordenadas del PDF. */
function stampGeometry(frame: PageFrame, position: StampPosition, image: StampImage) {
    const page = displaySize(frame);
    const width = position.width * page.width;
    const height = (width * image.height) / image.width;
    const left = position.left * page.width;
    const top = position.top * page.height;

    const corners = [
        displayToPdf(frame, left, top),
        displayToPdf(frame, left + width, top + height),
    ];
    const rect = [
        Math.min(corners[0].x, corners[1].x),
        Math.min(corners[0].y, corners[1].y),
        Math.max(corners[0].x, corners[1].x),
        Math.max(corners[0].y, corners[1].y),
    ];

    return { width, height, center: { u: left + width / 2, v: top + height / 2 }, rect };
}

/**
 * Firma manuscrita: dibuja el sello en las páginas indicadas. Si el PDF ya
 * tiene firmas digitales se guarda como actualización incremental para no
 * invalidarlas.
 */
export async function stampHandwrittenSignature(
    bytes: ArrayBuffer,
    image: StampImage,
    position: StampPosition,
    pageIndexes: number[],
    keepExistingSignatures: boolean,
): Promise<Uint8Array> {
    const doc = await PDFDocument.load(bytes, { forIncrementalUpdate: keepExistingSignatures, updateMetadata: false });
    const embedded = await doc.embedPng(image.bytes);
    const pages = doc.getPages();

    for (const index of pageIndexes) {
        const page = pages[index];
        const frame = pageFrame(page);
        const stamp = stampGeometry(frame, position, image);
        const origin = centeredPlacement(frame, stamp.center.u, stamp.center.v, stamp.width, stamp.height);
        page.drawImage(embedded, { x: origin.x, y: origin.y, width: stamp.width, height: stamp.height, rotate: degrees(origin.rotate) });
    }

    return doc.save({ updateFieldAppearances: false });
}

/**
 * Prepara la firma con certificado: agrega un campo de firma visible con el
 * sello y deja /ByteRange y /Contents de relleno para que el servidor calcule
 * la firma. Siempre es una actualización incremental: los bytes originales no
 * cambian y las firmas anteriores siguen siendo válidas.
 */
export async function prepareCertificateSignature(
    bytes: ArrayBuffer,
    image: StampImage,
    position: StampPosition,
    pageIndex: number,
    details: CertificateSignatureDetails,
): Promise<Uint8Array> {
    const doc = await PDFDocument.load(bytes, { forIncrementalUpdate: true, updateMetadata: false });
    const context = doc.context;
    const page = doc.getPage(pageIndex);
    const frame = pageFrame(page);
    const stamp = stampGeometry(frame, position, image);

    // Apariencia del campo: la imagen del sello, girada como la página.
    const embedded = await doc.embedPng(image.bytes);
    const radians = (frame.rotation * Math.PI) / 180;
    const cos = Math.round(Math.cos(radians));
    const sin = Math.round(Math.sin(radians));
    const appearance = context.formXObject(
        [pushGraphicsState(), concatTransformationMatrix(stamp.width, 0, 0, stamp.height, 0, 0), drawObject('Sello'), popGraphicsState()],
        {
            BBox: [0, 0, stamp.width, stamp.height],
            Matrix: [cos, sin, -sin, cos, 0, 0],
            Resources: { XObject: { Sello: embedded.ref } },
        },
    );
    const appearanceRef = context.register(appearance);

    const byteRange = PDFArray.withContext(context);
    byteRange.push(PDFNumber.of(0));
    for (let i = 0; i < 3; i++) byteRange.push(PDFName.of(BYTE_RANGE_PLACEHOLDER));

    const signature = context.obj({ Type: 'Sig', Filter: 'Adobe.PPKLite', SubFilter: 'adbe.pkcs7.detached' });
    signature.set(PDFName.of('ByteRange'), byteRange);
    signature.set(PDFName.of('Contents'), PDFHexString.of('0'.repeat(SIGNATURE_BYTES * 2)));
    signature.set(PDFName.of('M'), PDFString.fromDate(new Date()));
    signature.set(PDFName.of('Name'), PDFHexString.fromText(details.name));
    if (details.reason) signature.set(PDFName.of('Reason'), PDFHexString.fromText(details.reason));
    if (details.location) signature.set(PDFName.of('Location'), PDFHexString.fromText(details.location));
    const signatureRef = context.register(signature);

    const form = doc.getForm();
    const fieldNumber = form.getFields().filter((field) => field instanceof PDFSignature).length + 1;
    const widget = context.obj({
        Type: 'Annot',
        Subtype: 'Widget',
        FT: 'Sig',
        Rect: stamp.rect,
        // Imprimible y bloqueado para que no se mueva al abrirlo.
        F: 4 | 128,
        P: page.ref,
        T: PDFHexString.fromText(`Firma ${fieldNumber}`),
        AP: { N: appearanceRef },
    });
    widget.set(PDFName.of('V'), signatureRef);
    const widgetRef = context.register(widget);

    page.node.addAnnot(widgetRef);
    const acroForm = doc.catalog.getOrCreateAcroForm();
    acroForm.dict.set(PDFName.of('SigFlags'), PDFNumber.of(3));
    acroForm.addField(widgetRef);

    return doc.save({ updateFieldAppearances: false });
}
