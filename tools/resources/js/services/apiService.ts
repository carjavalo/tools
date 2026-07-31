import axios from 'axios';
import type { Device, TransferRequest } from '../types/schema';

// Configure axios for Laravel
axios.defaults.baseURL = '/api';
axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

// Add CSRF token support
const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
if (token) {
    axios.defaults.headers.common['X-CSRF-TOKEN'] = token;
}

export interface ApiDevice {
    id: string;
    name: string;
    type: 'laptop' | 'desktop' | 'mobile' | 'tablet';
    userName: string;
    status: string;
    lastSeen: string;
    sessionId: string;
}

export interface ApiTransferRequest {
    id: string;
    fileName: string;
    fileSize: number;
    fromUserName: string;
    fromDeviceName: string;
    requestedAt: string;
    status: string;
}

export class ApiService {
    
    // Room Management
    static async createRoom(deviceName: string, deviceType: string, userName: string) {
        try {
            const response = await axios.post('/room/create', {
                deviceName,
                deviceType,
                userName
            });
            return response.data;
        } catch (error) {
            console.error('Error creating room:', error);
            throw error;
        }
    }

    static async joinRoom(roomCode: string, deviceName: string, deviceType: string, userName: string) {
        try {
            const response = await axios.post('/room/join', {
                roomCode,
                deviceName,
                deviceType,
                userName
            });
            return response.data;
        } catch (error) {
            console.error('Error joining room:', error);
            throw error;
        }
    }

    static async leaveRoom() {
        try {
            const response = await axios.post('/room/leave');
            return response.data;
        } catch (error) {
            console.error('Error leaving room:', error);
            throw error;
        }
    }

    static async getRoomDevices(roomCode: string): Promise<{ devices: ApiDevice[], currentDeviceId: string, roomCode: string }> {
        try {
            const response = await axios.get(`/room/${roomCode}/devices`);
            return response.data;
        } catch (error) {
            console.error('Error getting room devices:', error);
            throw error;
        }
    }

    // File Transfer
    static async requestTransfer(targetDeviceId: string, file: File) {
        try {
            const formData = new FormData();
            formData.append('targetDeviceId', targetDeviceId);
            formData.append('fileName', file.name);
            formData.append('fileSize', file.size.toString());
            formData.append('file', file);

            const response = await axios.post('/transfer/request', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            return response.data;
        } catch (error) {
            console.error('Error requesting transfer:', error);
            throw error;
        }
    }

    static async getPendingRequests(): Promise<{ requests: ApiTransferRequest[] }> {
        try {
            const response = await axios.get('/transfer/pending');
            return response.data;
        } catch (error) {
            console.error('Error getting pending requests:', error);
            throw error;
        }
    }

    static async respondToTransfer(transferId: string, action: 'accept' | 'reject') {
        try {
            const response = await axios.post(`/transfer/${transferId}/respond`, {
                action
            });
            return response.data;
        } catch (error) {
            console.error('Error responding to transfer:', error);
            throw error;
        }
    }

    static async getTransferStatus(transferId: string) {
        try {
            const response = await axios.get(`/transfer/${transferId}/status`);
            return response.data;
        } catch (error) {
            console.error('Error getting transfer status:', error);
            throw error;
        }
    }

    static async downloadFile(transferId: string): Promise<Blob> {
        try {
            const response = await axios.get(`/transfer/${transferId}/download`, {
                responseType: 'blob'
            });
            return response.data;
        } catch (error) {
            console.error('Error downloading file:', error);
            throw error;
        }
    }

    // Utility
    static async healthCheck() {
        try {
            const response = await axios.get('/health');
            return response.data;
        } catch (error) {
            console.error('Error checking API health:', error);
            throw error;
        }
    }

    // Helper to detect device type automatically
    static detectDeviceType(): 'laptop' | 'desktop' | 'mobile' | 'tablet' {
        const userAgent = navigator.userAgent.toLowerCase();
        
        if (/mobile|android|iphone|ipod|blackberry|windows phone/.test(userAgent)) {
            return 'mobile';
        }
        
        if (/ipad|tablet/.test(userAgent)) {
            return 'tablet';
        }
        
        // Check if it's likely a laptop vs desktop (rough heuristic)
        if (/macintosh|mac os x/.test(userAgent) && 'ontouchstart' in window) {
            return 'laptop'; // Likely MacBook with touch
        }
        
        // Default to laptop for portability
        return 'laptop';
    }

    // Helper to detect device name
    static detectDeviceName(): string {
        const userAgent = navigator.userAgent;
        
        if (/Macintosh/.test(userAgent)) {
            return 'MacBook';
        }
        
        if (/Windows/.test(userAgent)) {
            return 'PC Windows';
        }
        
        if (/iPhone/.test(userAgent)) {
            return 'iPhone';
        }
        
        if (/iPad/.test(userAgent)) {
            return 'iPad';
        }
        
        if (/Android/.test(userAgent)) {
            if (/Mobile/.test(userAgent)) {
                return 'Android Phone';
            } else {
                return 'Android Tablet';
            }
        }
        
        return 'Dispositivo';
    }
}
