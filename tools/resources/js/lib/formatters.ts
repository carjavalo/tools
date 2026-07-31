import { ConnectionStatus, TransferStatus } from '@/types/evarisdrop/enums';

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatTransferSpeed = (bytesPerSecond: number): string => {
  return formatFileSize(bytesPerSecond) + '/s';
};

export const formatRemainingTime = (seconds: number): string => {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
};

export const formatConnectionStatus = (status: ConnectionStatus): string => {
  switch (status) {
    case ConnectionStatus.CONNECTED:
      return 'Conectado';
    case ConnectionStatus.CONNECTING:
      return 'Conectando...';
    case ConnectionStatus.DISCONNECTED:
      return 'Desconectado';
    case ConnectionStatus.ERROR:
      return 'Error de Conexión';
    default:
      return 'Desconocido';
  }
};

export const formatTransferStatus = (status: TransferStatus): string => {
  switch (status) {
    case TransferStatus.PENDING:
      return 'Pendiente';
    case TransferStatus.UPLOADING:
      return 'Enviando';
    case TransferStatus.DOWNLOADING:
      return 'Recibiendo';
    case TransferStatus.COMPLETED:
      return 'Completado';
    case TransferStatus.FAILED:
      return 'Fallido';
    case TransferStatus.CANCELLED:
      return 'Cancelado';
    default:
      return 'Desconocido';
  }
};