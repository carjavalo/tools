import { useState } from 'react';
import { File, Send, X, Clock, ArrowRight } from 'lucide-react';
import ToolCard from '@/components/ToolCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { QueuedFile, Device } from '@/types/evarisdrop/schema';
import { formatFileSize } from '../../lib/formatters';

interface FileQueueCardProps {
  queuedFiles: QueuedFile[];
  devices: Device[];
  onSendFile: (fileId: string, deviceId: string) => void;
  onRemoveFile: (fileId: string) => void;
}

export function FileQueueCard({ queuedFiles, devices, onSendFile, onRemoveFile }: FileQueueCardProps) {
  const [selectedDevices, setSelectedDevices] = useState<Record<string, string>>({});

  const handleDeviceSelect = (fileId: string, deviceId: string) => {
    setSelectedDevices(prev => ({ ...prev, [fileId]: deviceId }));
  };

  const handleSendFile = (fileId: string) => {
    const deviceId = selectedDevices[fileId];
    if (deviceId) {
      onSendFile(fileId, deviceId);
    }
  };

  const getStatusColor = (status: QueuedFile['status']) => {
    switch (status) {
      case 'queued': return 'default';
      case 'sending': return 'secondary';
      case 'sent': return 'outline';
      default: return 'default';
    }
  };

  const getStatusText = (status: QueuedFile['status']) => {
    switch (status) {
      case 'queued': return 'En Cola';
      case 'sending': return 'Enviando';
      case 'sent': return 'Enviado';
      default: return 'Desconocido';
    }
  };

  if (queuedFiles.length === 0) {
    return (
      <ToolCard
        title="Cola de Archivos (0)"
        description="Archivos listos para enviar"
      >
        <div className="text-center py-6 text-muted-foreground">
          <File className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-slate-900 dark:text-white mb-1">No hay archivos en cola</p>
          <p className="text-sm">Selecciona archivos para agregarlos a la cola</p>
        </div>
      </ToolCard>
    );
  }

  return (
    <ToolCard
      title={`Cola de Archivos (${queuedFiles.length})`}
      description="Archivos listos para enviar"
    >
      <div className="space-y-4">
        {queuedFiles.map((queuedFile) => (
          <div key={queuedFile.id} className="flex items-center gap-3 p-3 border rounded-lg glass-card border-white/30 bg-white/60 dark:bg-slate-800/60">
              <File className="w-8 h-8 text-primary" />
              
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{queuedFile.file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(queuedFile.file.size)}
                </p>
              </div>

              <Badge variant={getStatusColor(queuedFile.status)} className="text-xs">
                {getStatusText(queuedFile.status)}
              </Badge>

              {queuedFile.status === 'queued' && (
                <div className="flex items-center gap-2">
                  <Select
                    value={selectedDevices[queuedFile.id] || ''}
                    onValueChange={(value) => handleDeviceSelect(queuedFile.id, value)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Destino" />
                    </SelectTrigger>
                    <SelectContent>
                      {devices.map((device) => (
                        <SelectItem key={device.id} value={device.id}>
                          <div className="flex items-center gap-2">
                            <span className="truncate">{device.name}</span>
                            {device.userName && (
                              <span className="text-xs text-muted-foreground">
                                ({device.userName})
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    size="sm"
                    className="bg-institutional hover:bg-institutional/90"
                    onClick={() => handleSendFile(queuedFile.id)}
                    disabled={!selectedDevices[queuedFile.id]}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {queuedFile.status === 'sending' && (
                <div className="flex items-center gap-2 text-primary">
                  <ArrowRight className="w-4 h-4 animate-pulse" />
                  <span className="text-xs">Enviando...</span>
                </div>
              )}

              {queuedFile.status === 'sent' && (
                <div className="flex items-center gap-2 text-green-600">
                  <Clock className="w-4 h-4" />
                  <span className="text-xs">Esperando respuesta</span>
                </div>
              )}

              <Button
                size="sm"
                variant="ghost"
                onClick={() => onRemoveFile(queuedFile.id)}
                disabled={queuedFile.status === 'sending'}
              >
                <X className="w-4 h-4" />
              </Button>
          </div>
        ))}
      </div>
    </ToolCard>
  );
}