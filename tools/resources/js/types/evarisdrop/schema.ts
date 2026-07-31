import type { ConnectionStatus, TransferStatus, ThemeMode, DeviceLocation } from './enums';

// Props types (data passed to components)
export interface PropTypes {
  appName: string;
  maxFileSize: number;
  supportedFormats: string;
  networkName: string;
}

// Store types (global state data)
export interface StoreTypes {
  currentUser: {
    id: string;
    username: string;
    roomCode: string;
    isInRoom: boolean;
    theme: ThemeMode;
  };
  connectionStatus: ConnectionStatus;
  discoveredDevices: Device[];
  activeTransfers: FileTransfer[];
}

// Query types (API response data)
export interface QueryTypes {
  devices: Device[];
  transfers: FileTransfer[];
  roomInfo: RoomInfo;
}

export interface Device {
  id: string;
  name: string;
  type: 'laptop' | 'mobile' | 'desktop' | 'tablet';
  status: ConnectionStatus;
  lastSeen: string;
  location: DeviceLocation;
  roomCode?: string;
  userName?: string;
}

export interface FileTransfer {
  id: string;
  fileName: string;
  fileSize: number;
  status: TransferStatus;
  progress: number;
  speed: number;
  remainingTime: number;
  fromDevice: string;
  toDevice: string;
  requestedAt?: string;
  acceptedAt?: string;
  completedAt?: string;
}

// File queue for local files before sending
export interface QueuedFile {
  id: string;
  file: File;
  targetDeviceId?: string;
  status: 'queued' | 'sending' | 'sent';
  addedAt: string;
}

// Transfer request for incoming file requests
export interface TransferRequest {
  id: string;
  fileName: string;
  fileSize: number;
  fromDevice: string;
  fromUserName: string;
  requestedAt: string;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface RoomInfo {
  code: string;
  participants: number;
  createdAt: string;
}