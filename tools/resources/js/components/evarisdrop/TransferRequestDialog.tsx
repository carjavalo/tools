import { useState } from 'react';
import { Download, AlertCircle, User, File, Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { TransferRequest } from '@/types/evarisdrop/schema';
import { formatFileSize } from '../../lib/formatters';

interface TransferRequestDialogProps {
  request: TransferRequest | null;
  isOpen: boolean;
  onClose: () => void;
  onAccept: (requestId: string) => void;
  onReject: (requestId: string) => void;
}

export function TransferRequestDialog({ 
  request, 
  isOpen, 
  onClose, 
  onAccept, 
  onReject 
}: TransferRequestDialogProps) {
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  if (!request) return null;

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      await onAccept(request.id);
    } finally {
      setIsAccepting(false);
      onClose();
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    try {
      await onReject(request.id);
    } finally {
      setIsRejecting(false);
      onClose();
    }
  };

  const timeAgo = () => {
    const now = new Date();
    const requested = new Date(request.requestedAt);
    const diffMs = now.getTime() - requested.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Hace un momento';
    if (diffMins === 1) return 'Hace 1 minuto';
    if (diffMins < 60) return `Hace ${diffMins} minutos`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return 'Hace 1 hora';
    return `Hace ${diffHours} horas`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5 text-primary" />
            Solicitud de Transferencia
          </DialogTitle>
          <DialogDescription>
            Alguien quiere enviarte un archivo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Info */}
          <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
            <File className="w-8 h-8 text-primary" />
            <div className="flex-1">
              <p className="font-medium">{request.fileName}</p>
              <p className="text-sm text-muted-foreground">
                {formatFileSize(request.fileSize)}
              </p>
            </div>
          </div>

          {/* Sender Info */}
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">De: {request.fromUserName}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {timeAgo()}
              </div>
            </div>
          </div>

          {/* Warning for large files */}
          {request.fileSize > 100 * 1024 * 1024 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Este archivo es grande ({formatFileSize(request.fileSize)}). 
                La transferencia puede tomar varios minutos.
              </AlertDescription>
            </Alert>
          )}

          {/* Status Badge */}
          <div className="flex justify-center">
            <Badge variant="secondary" className="gap-1">
              <Clock className="w-3 h-3" />
              Esperando tu respuesta
            </Badge>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleReject}
            disabled={isAccepting || isRejecting}
            className="flex-1"
          >
            {isRejecting ? 'Rechazando...' : 'Rechazar'}
          </Button>
          <Button
            onClick={handleAccept}
            disabled={isAccepting || isRejecting}
            className="flex-1 bg-institutional hover:bg-institutional/90"
          >
            {isAccepting ? (
              <>
                <Download className="w-4 h-4 mr-2 animate-pulse" />
                Aceptando...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Aceptar y Descargar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
