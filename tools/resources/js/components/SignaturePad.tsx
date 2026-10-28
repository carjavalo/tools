import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Eraser } from 'lucide-react';

interface SignaturePadProps {
    color: string;
    // Se llama al terminar cada trazo con el canvas, o con null al borrarlo.
    onChange: (canvas: HTMLCanvasElement | null) => void;
}

const PAD_HEIGHT = 180;

/** Recuadro para firmar con el mouse, el dedo o un lápiz. */
export default function SignaturePad({ color, onChange }: SignaturePadProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);
    const [hasInk, setHasInk] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const pixelRatio = Math.max(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(canvas.clientWidth * pixelRatio);
        canvas.height = Math.round(PAD_HEIGHT * pixelRatio);
        const context = canvas.getContext('2d', { willReadFrequently: true })!;
        context.scale(pixelRatio, pixelRatio);
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.lineWidth = 2.6;
    }, []);

    const pointFrom = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const context = e.currentTarget.getContext('2d')!;
        const point = pointFrom(e);
        context.strokeStyle = color;
        context.fillStyle = color;
        // Un clic sin arrastrar deja un punto.
        context.beginPath();
        context.arc(point.x, point.y, context.lineWidth / 2, 0, Math.PI * 2);
        context.fill();
        context.beginPath();
        context.moveTo(point.x, point.y);
        lastPointRef.current = point;
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const last = lastPointRef.current;
        if (!last) return;
        const context = e.currentTarget.getContext('2d')!;
        const point = pointFrom(e);
        // Curva hasta el punto medio: el trazo sale suave aunque lleguen pocos eventos.
        const middle = { x: (last.x + point.x) / 2, y: (last.y + point.y) / 2 };
        context.quadraticCurveTo(last.x, last.y, middle.x, middle.y);
        context.stroke();
        context.beginPath();
        context.moveTo(middle.x, middle.y);
        lastPointRef.current = point;
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!lastPointRef.current) return;
        const context = e.currentTarget.getContext('2d')!;
        const point = pointFrom(e);
        context.lineTo(point.x, point.y);
        context.stroke();
        lastPointRef.current = null;
        setHasInk(true);
        onChange(e.currentTarget);
    };

    const clear = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
        setHasInk(false);
        onChange(null);
    };

    return (
        <div className="space-y-2">
            <div className="relative overflow-hidden rounded-lg border border-slate-300 bg-white dark:border-slate-600">
                <canvas
                    ref={canvasRef}
                    aria-label="Recuadro para dibujar la firma"
                    className="block w-full cursor-crosshair touch-none"
                    style={{ height: PAD_HEIGHT }}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                />
                {/* Línea guía, como en un formulario de papel */}
                <div className="pointer-events-none absolute right-6 bottom-10 left-6 border-b border-slate-300" />
                {!hasInk && (
                    <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-slate-400">
                        Firma aquí con el mouse o con el dedo
                    </p>
                )}
            </div>
            <div className="flex justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={!hasInk}>
                    <Eraser className="mr-1 h-4 w-4" />
                    Borrar
                </Button>
            </div>
        </div>
    );
}
