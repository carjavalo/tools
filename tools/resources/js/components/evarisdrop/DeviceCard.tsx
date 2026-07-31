import { Laptop, Monitor, Smartphone, MoreVertical } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { Device } from '@/types/evarisdrop/schema';
import { formatConnectionStatus } from '../../lib/formatters';
import { ConnectionStatus } from '@/types/evarisdrop/enums';

interface DeviceCardProps {
  device: Device;
  onConnect?: (deviceId: string) => void;
  onDisconnect?: (deviceId: string) => void;
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
    case ConnectionStatus.ERROR:
      return 'destructive';
    default:
      return 'outline';
  }
};

export function DeviceCard({ device, onConnect, onDisconnect }: DeviceCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-primary">
              {getDeviceIcon(device.type)}
            </div>
            <div>
              <h3 className="font-medium text-sm">{device.name}</h3>
              <Badge variant={getStatusVariant(device.status)} className="text-xs mt-1">
                {formatConnectionStatus(device.status)}
              </Badge>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {device.status === ConnectionStatus.CONNECTED ? (
                <DropdownMenuItem onClick={() => onDisconnect?.(device.id)}>
                  Desconectar
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => onConnect?.(device.id)}>
                  Conectar
                </DropdownMenuItem>
              )}
              <DropdownMenuItem>Ver Detalles</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}