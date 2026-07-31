import { Laptop, Monitor, Smartphone, Wifi, Users, Send } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Device } from '@/types/evarisdrop/schema';
import { formatConnectionStatus } from '@/lib/formatters';
import { ConnectionStatus, DeviceLocation } from '@/types/evarisdrop/enums';

interface EnhancedDeviceCardProps {
  device: Device;
  onSendFiles?: (deviceId: string) => void;
  hasQueuedFiles?: boolean;
}

const getDeviceIcon = (type: Device['type']) => {
  switch (type) {
    case 'laptop':
      return <Laptop className="w-6 h-6" />;
    case 'mobile':
      return <Smartphone className="w-6 h-6" />;
    case 'desktop':
      return <Monitor className="w-6 h-6" />;
    default:
      return <Monitor className="w-6 h-6" />;
  }
};

const getStatusVariant = (status: ConnectionStatus) => {
  switch (status) {
    case ConnectionStatus.CONNECTED:
      return 'default';
    case ConnectionStatus.CONNECTING:
      return 'secondary';
    case ConnectionStatus.DISCONNECTED:
      return 'outline';
    case ConnectionStatus.ERROR:
      return 'destructive';
    default:
      return 'outline';
  }
};

const getLocationBadge = (location: DeviceLocation, roomCode?: string) => {
  if (location === DeviceLocation.SAME_ROOM) {
    return (
      <Badge variant="default" className="text-xs gap-1">
        <Users className="w-3 h-3" />
        Misma Sala
        {roomCode && <span className="opacity-75">({roomCode})</span>}
      </Badge>
    );
  }
  
  return (
    <Badge variant="outline" className="text-xs gap-1">
      <Wifi className="w-3 h-3" />
      Red Local
    </Badge>
  );
};

export function EnhancedDeviceCard({ device, onSendFiles, hasQueuedFiles }: EnhancedDeviceCardProps) {
  const canSendFiles = device.status === ConnectionStatus.CONNECTED && hasQueuedFiles;

  return (
    <Card className="glass-card border-white/30 bg-white/60 hover-lift hover:bg-white/80 dark:bg-slate-800/60 dark:hover:bg-slate-800/80">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            {getDeviceIcon(device.type)}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-sm truncate">{device.name}</h3>
              <Badge variant={getStatusVariant(device.status)} className="text-xs">
                {formatConnectionStatus(device.status)}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getLocationBadge(device.location, device.roomCode)}
                {device.userName && (
                  <span className="text-xs text-muted-foreground truncate">
                    {device.userName}
                  </span>
                )}
              </div>
              
              {canSendFiles && onSendFiles && (
                <Button
                  size="sm"
                  className="ml-2 bg-institutional hover:bg-institutional/90"
                  onClick={() => onSendFiles(device.id)}
                >
                  <Send className="w-3 h-3 mr-1" />
                  Enviar
                </Button>
              )}
            </div>
          </div>
        </div>

        {device.status === ConnectionStatus.CONNECTING && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
            Conectando...
          </div>
        )}

        {device.location === DeviceLocation.NETWORK && (
          <div className="mt-3 text-xs text-muted-foreground">
            💡 Invita a este dispositivo a tu sala para transferencias más rápidas
          </div>
        )}
      </CardContent>
    </Card>
  );
}