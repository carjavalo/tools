import { FileText, X, RotateCcw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { FileTransfer } from '@/types/evarisdrop/schema';
import { formatFileSize, formatTransferSpeed, formatRemainingTime, formatTransferStatus } from '../../lib/formatters';
import { TransferStatus } from '@/types/evarisdrop/enums';

interface TransferProgressCardProps {
  transfer: FileTransfer;
  onCancel?: (transferId: string) => void;
  onRetry?: (transferId: string) => void;
}

const getStatusVariant = (status: TransferStatus) => {
  switch (status) {
    case TransferStatus.COMPLETED:
      return 'default';
    case TransferStatus.UPLOADING:
    case TransferStatus.DOWNLOADING:
      return 'secondary';
    case TransferStatus.FAILED:
      return 'destructive';
    default:
      return 'outline';
  }
};

export function TransferProgressCard({ transfer, onCancel, onRetry }: TransferProgressCardProps) {
  const isActive = transfer.status === TransferStatus.UPLOADING || transfer.status === TransferStatus.DOWNLOADING;
  const canRetry = transfer.status === TransferStatus.FAILED;
  const canCancel = isActive || transfer.status === TransferStatus.PENDING;

  return (
    <Card className="glass-card border-white/30 bg-white/60 hover:bg-white/80 dark:bg-slate-800/60 dark:hover:bg-slate-800/80 transition-all">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-muted-foreground" />
            <div>
              <h4 className="font-medium text-sm">{transfer.fileName}</h4>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(transfer.fileSize)}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant={getStatusVariant(transfer.status)} className="text-xs">
              {formatTransferStatus(transfer.status)}
            </Badge>
            
            {canRetry && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 w-6 p-0"
                onClick={() => onRetry?.(transfer.id)}
              >
                <RotateCcw className="w-3 h-3" />
              </Button>
            )}
            
            {canCancel && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 w-6 p-0"
                onClick={() => onCancel?.(transfer.id)}
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
        
        {isActive && (
          <>
            <Progress value={transfer.progress} className="mb-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{transfer.progress}%</span>
              <div className="flex gap-4">
                <span>{formatTransferSpeed(transfer.speed)}</span>
                <span>{formatRemainingTime(transfer.remainingTime)} restante</span>
              </div>
            </div>
          </>
        )}
        
        {transfer.status === TransferStatus.COMPLETED && (
          <Progress value={100} className="mb-2" />
        )}
      </CardContent>
    </Card>
  );
}