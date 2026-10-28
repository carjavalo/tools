import { PDFDocument } from '@cantoo/pdf-lib';

export interface ProtectPermissions {
    printing: boolean;
    copying: boolean;
    modifying: boolean;
    // Comentar y llenar formularios.
    annotating: boolean;
}

export interface ProtectOptions {
    userPassword: string;
    // Vacía: se genera una al azar y nadie podrá quitar las restricciones.
    ownerPassword: string;
    permissions: ProtectPermissions;
}

// Sin caracteres que se confunden al copiarlos a mano (0/O, 1/l/I).
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!#$%&*+-?@';

export function generatePassword(length = 14): string {
    const values = crypto.getRandomValues(new Uint32Array(length));
    return Array.from(values, (value) => PASSWORD_ALPHABET[value % PASSWORD_ALPHABET.length]).join('');
}

/** 0 (débil) a 3 (fuerte). */
export function passwordStrength(password: string): number {
    if (password.length < 8) return 0;
    const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(password)).length;
    if (password.length >= 12 && variety >= 3) return 3;
    if (variety >= 3 || (password.length >= 12 && variety >= 2)) return 2;
    return 1;
}

/** ¿El PDF ya está cifrado? (no se puede abrir sin su contraseña). */
export async function isEncryptedPdf(bytes: ArrayBuffer): Promise<boolean> {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
    return doc.isEncrypted;
}

/**
 * Cifra el PDF con AES-256 en el navegador. Se conservan enlaces, marcadores
 * y formularios porque no se reconstruye el documento, solo se cifra.
 */
export async function protectPdf(bytes: ArrayBuffer, options: ProtectOptions): Promise<Uint8Array> {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const { permissions } = options;

    doc.encrypt({
        userPassword: options.userPassword,
        ownerPassword: options.ownerPassword || generatePassword(32),
        algorithm: 'AES-256',
        permissions: {
            printing: permissions.printing ? 'highResolution' : false,
            copying: permissions.copying,
            modifying: permissions.modifying,
            annotating: permissions.annotating,
            fillingForms: permissions.annotating,
            // Los lectores de pantalla siempre pueden leer el texto.
            contentAccessibility: true,
            documentAssembly: permissions.modifying,
        },
    });

    const encrypted = await doc.save();

    // Comprobación: el resultado debe abrirse con la contraseña elegida.
    await PDFDocument.load(encrypted, { password: options.userPassword, updateMetadata: false });
    return encrypted;
}
