// Connection status for devices and rooms
export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting', 
  CONNECTED = 'connected',
  ERROR = 'error'
}

// File transfer states
export enum TransferStatus {
  QUEUED = 'queued',           // File queued locally
  PENDING = 'pending',         // Waiting for recipient response
  ACCEPTED = 'accepted',       // Recipient accepted
  REJECTED = 'rejected',       // Recipient rejected
  UPLOADING = 'uploading',     // Currently transferring
  DOWNLOADING = 'downloading', 
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

// Device location types
export enum DeviceLocation {
  SAME_ROOM = 'same_room',     // Device in same room
  NETWORK = 'network'          // Device on network but different room
}

// Theme modes
export enum ThemeMode {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system'
}