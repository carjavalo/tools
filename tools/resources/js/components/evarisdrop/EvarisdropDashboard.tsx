import { useState, useEffect, useRef } from 'react';
import { conversionErrorMessage } from '@/lib/conversion';
import { WifiHigh, Plus, LogIn, Settings, RefreshCw, Upload } from 'lucide-react';
import ToolCard from '@/components/ToolCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { EnhancedDeviceCard } from './EnhancedDeviceCard';
import { TransferProgressCard } from './TransferProgressCard';
import { UserProfileSection } from './UserProfileSection';
import { FileDropZone } from './FileDropZone';
import { FileQueueCard } from './FileQueueCard';
import { TransferRequestDialog } from './TransferRequestDialog';
import { ApiService, type ApiDevice, type ApiTransferRequest } from '@/services/apiService';
import { ConnectionStatus, TransferStatus, ThemeMode, DeviceLocation } from '@/types/evarisdrop/enums';
import type { Device, FileTransfer, QueuedFile, TransferRequest } from '@/types/evarisdrop/schema';

interface EvarisdropDashboardProps {
  appName: string;
  maxFileSize: number;
  networkName: string;
}

export function EvarisdropDashboard({ appName, maxFileSize, networkName }: EvarisdropDashboardProps) {
  // Real API state
  const [currentUser, setCurrentUser] = useState({
    id: '',
    username: '',
    roomCode: '',
    isInRoom: false,
    deviceName: '',
    deviceType: 'laptop' as 'laptop' | 'desktop' | 'mobile' | 'tablet'
  });
  const [devices, setDevices] = useState<Device[]>([]);
  const [transfers, setTransfers] = useState<FileTransfer[]>([]);
  const [connectionStatus, setConnectionStatus] = useState(ConnectionStatus.DISCONNECTED);
  const [isJoinRoomOpen, setIsJoinRoomOpen] = useState(false);
  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([]);
  const [transferRequests, setTransferRequests] = useState<TransferRequest[]>([]);
  const [currentRequest, setCurrentRequest] = useState<TransferRequest | null>(null);
  
  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const handleUsernameChange = (username: string) => {
    setCurrentUser(prev => ({ ...prev, username }));
  };



  // Initialize with auto-detected device info
  useEffect(() => {
    const deviceType = ApiService.detectDeviceType();
    const deviceName = ApiService.detectDeviceName();
    const username = generateRandomUsername();
    
    setCurrentUser(prev => ({
      ...prev,
      username,
      deviceName,
      deviceType
    }));
  }, []);

  // Auto-create room when user info is ready (una sola vez: si falla, no se reintenta en bucle)
  const autoCreateRef = useRef(false);
  useEffect(() => {
    if (currentUser.username && !currentUser.isInRoom && !isLoading && !autoCreateRef.current) {
      autoCreateRef.current = true;
      console.log('🚀 Auto-creating room on page load for:', currentUser.username);
      handleCreateRoom();
    }
  }, [currentUser.username, currentUser.isInRoom, isLoading]);

  // Polling for device updates when in room
  useEffect(() => {
    if (!currentUser.isInRoom || !currentUser.roomCode) return;

    const pollDevices = async () => {
      // Sin consultar al servidor mientras la pestaña está oculta.
      if (document.hidden) return;
      try {
        const response = await ApiService.getRoomDevices(currentUser.roomCode);
        const apiDevices = response.devices || [];
        
        // Convert API devices to UI format
        const uiDevices: Device[] = apiDevices
          .filter(d => d.id !== response.currentDeviceId) // Exclude current device
          .map(apiDevice => ({
            id: apiDevice.id,
            name: apiDevice.name,
            type: apiDevice.type as Device['type'],
            status: ConnectionStatus.CONNECTED,
            lastSeen: apiDevice.lastSeen,
            location: DeviceLocation.SAME_ROOM,
            roomCode: currentUser.roomCode,
            userName: apiDevice.userName
          }));
        
        setDevices(uiDevices);
        setConnectionStatus(ConnectionStatus.CONNECTED);
      } catch (error) {
        console.error('Error polling devices:', error);
        setError('Error al obtener dispositivos');
      }
    };

    // Poll immediately, then every 3 seconds
    pollDevices();
    const interval = setInterval(pollDevices, 3000);
    
    return () => clearInterval(interval);
  }, [currentUser.isInRoom, currentUser.roomCode]);

  // Poll for pending transfer requests
  useEffect(() => {
    if (!currentUser.isInRoom) return;

    const pollRequests = async () => {
      if (document.hidden) return;
      try {
        const response = await ApiService.getPendingRequests();
        const apiRequests = response.requests || [];
        
        // Convert to UI format and show first pending request
        if (apiRequests.length > 0 && !currentRequest) {
          const firstRequest = apiRequests[0];
          const uiRequest: TransferRequest = {
            id: firstRequest.id,
            fileName: firstRequest.fileName,
            fileSize: firstRequest.fileSize,
            fromDevice: 'unknown',
            fromUserName: firstRequest.fromUserName,
            requestedAt: firstRequest.requestedAt,
            status: 'pending'
          };
          setCurrentRequest(uiRequest);
        }
      } catch (error) {
        console.error('Error polling requests:', error);
      }
    };

    const interval = setInterval(pollRequests, 2000);
    return () => clearInterval(interval);
  }, [currentUser.isInRoom, currentRequest]);

  const generateRandomUsername = () => {
    const adjectives = [
      'Azul', 'Rápido', 'Brillante', 'Veloz', 'Inteligente', 'Genial', 'Ágil',
      'Verde', 'Mágico', 'Estelar', 'Dorado', 'Plateado', 'Cristal', 'Solar',
      'Lunar', 'Cyber', 'Neo', 'Ultra', 'Mega', 'Super', 'Turbo', 'Quantum'
    ];
    const nouns = [
      'Caminante', 'Explorador', 'Navegante', 'Pionero', 'Guardián', 'Viajero',
      'Aventurero', 'Descobridor', 'Ingeniero', 'Arquitecto', 'Desarrollador',
      'Creador', 'Innovador', 'Maestro', 'Experto', 'Líder', 'Campeón', 'Héroe'
    ];
    const number = Math.floor(Math.random() * 9999) + 1;
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    return `${adjective}${noun}${number}`;
  };

  const handleGenerateNewUsername = () => {
    const newUsername = generateRandomUsername();
    handleUsernameChange(newUsername);
  };

  const handleCreateRoom = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('🚀 Creating room with:', {
        deviceName: currentUser.deviceName || ApiService.detectDeviceName(),
        deviceType: currentUser.deviceType || ApiService.detectDeviceType(),
        username: currentUser.username
      });
      
      const response = await ApiService.createRoom(
        currentUser.deviceName || ApiService.detectDeviceName(),
        currentUser.deviceType || ApiService.detectDeviceType(),
        currentUser.username
      );
      
      console.log('✅ Room created response:', response);
      
      setCurrentUser(prev => ({
        ...prev,
        id: response.device.id,
        roomCode: response.roomCode,
        isInRoom: true
      }));
      setConnectionStatus(ConnectionStatus.CONNECTED);
      
      console.log('🎯 Room code set:', response.roomCode);
      
    } catch (error) {
      console.error('❌ Error creating room:', error);
      
      // Antes se inventaba un código "local" que nadie podía usar para unirse.
      setConnectionStatus(ConnectionStatus.DISCONNECTED);
      setError(await conversionErrorMessage(error, 'No se pudo crear la sala. Revisa tu conexión y vuelve a intentarlo.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async (roomCode: string) => {
    if (isLoading) return;
    
    setIsLoading(true);
    setError(null);
    setConnectionStatus(ConnectionStatus.CONNECTING);
    
    try {
      console.log('🚀 Joining room with code:', roomCode);
      
      const response = await ApiService.joinRoom(
        roomCode,
        currentUser.deviceName || ApiService.detectDeviceName(),
        currentUser.deviceType || ApiService.detectDeviceType(),
        currentUser.username
      );
      
      console.log('✅ Room joined response:', response);
      
      setCurrentUser(prev => ({
        ...prev,
        id: response.device.id,
        roomCode: response.roomCode,
        isInRoom: true
      }));
      setConnectionStatus(ConnectionStatus.CONNECTED);
      
      console.log('🎯 Successfully joined room:', response.roomCode);
      
    } catch (error) {
      console.error('❌ Error joining room:', error);
      setError(await conversionErrorMessage(error, 'No se pudo unir a la sala. Verifica el código e intenta nuevamente.'));
      setConnectionStatus(ConnectionStatus.DISCONNECTED);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (files: File[]) => {
    // Add files to queue instead of transferring immediately
    files.forEach((file) => {
      const queuedFile: QueuedFile = {
        id: `queued-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        status: 'queued',
        addedAt: new Date().toISOString()
      };
      
      setQueuedFiles(prev => [...prev, queuedFile]);
    });
  };

  const handleSendFile = async (fileId: string, deviceId: string) => {
    const queuedFile = queuedFiles.find(f => f.id === fileId);
    if (!queuedFile) return;

    // Mark as sending
    setQueuedFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, status: 'sending' as const, targetDeviceId: deviceId } : f
    ));

    try {
      const response = await ApiService.requestTransfer(deviceId, queuedFile.file);
      
      // Mark as sent
      setQueuedFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, status: 'sent' as const, transferId: response.transferId } : f
      ));
      
    } catch (error) {
      console.error('Error sending file:', error);
      setError('Error al enviar archivo. Inténtalo de nuevo.');
      
      // Revert to queued state
      setQueuedFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, status: 'queued' as const, targetDeviceId: undefined } : f
      ));
    }
  };

  const handleRemoveQueuedFile = (fileId: string) => {
    setQueuedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const handleAcceptTransfer = async (requestId: string) => {
    if (!currentRequest) return;

    try {
      await ApiService.respondToTransfer(requestId, 'accept');
      
      // Create UI transfer for progress display
      const transfer: FileTransfer = {
        id: requestId,
        fileName: currentRequest.fileName,
        fileSize: currentRequest.fileSize,
        status: TransferStatus.UPLOADING,
        progress: 0,
        speed: 1024000,
        remainingTime: Math.ceil(currentRequest.fileSize / 1024000),
        fromDevice: currentRequest.fromDevice,
        toDevice: currentUser.id,
        acceptedAt: new Date().toISOString()
      };

      setTransfers(prev => [...prev, transfer]);
      setCurrentRequest(null);

      // Start download process
      setTimeout(async () => {
        try {
          const blob = await ApiService.downloadFile(requestId);
          
          // Create download link
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = currentRequest.fileName;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          
          // Mark as completed
          setTransfers(prev => prev.map(t => 
            t.id === requestId 
              ? { ...t, status: TransferStatus.COMPLETED, progress: 100, remainingTime: 0, completedAt: new Date().toISOString() }
              : t
          ));
          
        } catch (error) {
          console.error('Error downloading file:', error);
          setTransfers(prev => prev.map(t => 
            t.id === requestId 
              ? { ...t, status: TransferStatus.FAILED }
              : t
          ));
        }
      }, 1000);
      
    } catch (error) {
      console.error('Error accepting transfer:', error);
      setError('Error al aceptar transferencia');
    }
  };

  const handleRejectTransfer = async (requestId: string) => {
    try {
      await ApiService.respondToTransfer(requestId, 'reject');
      setCurrentRequest(null);
    } catch (error) {
      console.error('Error rejecting transfer:', error);
      setError('Error al rechazar transferencia');
    }
  };

  const handleCancelTransfer = (transferId: string) => {
    setTransfers(prev => prev.map(t => 
      t.id === transferId 
        ? { ...t, status: TransferStatus.CANCELLED }
        : t
    ));
  };

  const handleRetryTransfer = (transferId: string) => {
    setTransfers(prev => prev.map(t => 
      t.id === transferId 
        ? { ...t, status: TransferStatus.PENDING, progress: 0 }
        : t
    ));
  };

  const handleRefreshDevices = () => {
    setConnectionStatus(ConnectionStatus.CONNECTING);
    setTimeout(() => {
      setConnectionStatus(ConnectionStatus.CONNECTED);
    }, 2000);
  };

  return (
    <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Left Column - Devices & File Transfer */}
          <div className="space-y-6">
            {/* Devices & File Transfer */}
            <div data-tour="devices">
              <ToolCard
                title={`Dispositivos Disponibles (${devices.length})`}
                description="Dispositivos conectados en tu sala"
              >
              {devices.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <WifiHigh className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="font-medium text-slate-900 dark:text-white mb-2">No hay dispositivos en la sala</p>
                  <p className="text-sm">{currentUser.isInRoom ? 'Esperando conexiones...' : 'Únete o crea una sala para comenzar'}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {devices.map((device) => (
                    <EnhancedDeviceCard 
                      key={device.id} 
                      device={device}
                      hasQueuedFiles={queuedFiles.length > 0}
                      onSendFiles={() => {
                        // Auto-send first queued file for demo
                        const firstQueued = queuedFiles.find(f => f.status === 'queued');
                        if (firstQueued) {
                          handleSendFile(firstQueued.id, device.id);
                        }
                      }}
                    />
                  ))}
                </div>
              )}
              </ToolCard>
            </div>

            {/* File Transfer Zone */}
            <div data-tour="transfer-zone">
              <ToolCard
                title="Zona de Transferencia"
                description="Arrastra archivos aquí para compartir"
              >
                {currentUser.isInRoom && devices.length > 0 ? (
                  <FileDropZone 
                    onFileSelect={handleFileSelect}
                    maxFileSize={maxFileSize}
                  />
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Upload className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="font-medium text-slate-900 dark:text-white mb-2">Zona de Transferencia</p>
                    <p className="text-sm mb-3">Para transferir archivos necesitas:</p>
                    <div className="text-sm space-y-1">
                      <p>✓ Estar en una sala activa</p>
                      <p>✓ Tener dispositivos conectados</p>
                    </div>
                  </div>
                )}
              </ToolCard>
            </div>
          </div>

          {/* Right Column - User Profile & Transfers */}
          <div className="space-y-6">
            {/* User Profile */}
            <div data-tour="user-profile">
              <UserProfileSection
                username={currentUser.username}
                roomCode={currentUser.roomCode}
                onUsernameChange={handleUsernameChange}
                onGenerateNewUsername={handleGenerateNewUsername}
                onJoinRoom={handleJoinRoom}
              />
            </div>

            {/* File Queue */}
            {queuedFiles.length > 0 && (
              <div data-tour="file-queue">
                <FileQueueCard
                  queuedFiles={queuedFiles}
                  devices={devices.filter(d => d.status === ConnectionStatus.CONNECTED)}
                  onSendFile={handleSendFile}
                  onRemoveFile={handleRemoveQueuedFile}
                />
              </div>
            )}

            {/* Active Transfers */}
            {transfers.length > 0 && (
              <ToolCard
                title="Transferencias Activas"
                description="Archivos en proceso de transferencia"
              >
                <div className="space-y-3">
                  {transfers.map((transfer) => (
                    <TransferProgressCard
                      key={transfer.id}
                      transfer={transfer}
                      onCancel={() => handleCancelTransfer(transfer.id)}
                    />
                  ))}
                </div>
              </ToolCard>
            )}
          </div>
        </div>

        {/* Transfer Request Dialog */}
        <TransferRequestDialog
          request={currentRequest}
          isOpen={currentRequest !== null}
          onClose={() => setCurrentRequest(null)}
          onAccept={handleAcceptTransfer}
          onReject={handleRejectTransfer}
        />
      </div>
  );
}