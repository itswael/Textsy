import { Message } from '@/contexts/MessagingContext';
import { Socket } from 'socket.io-client';

export interface WebSocketMessage {
  type: 'message' | 'typing' | 'read_receipt' | 'user_online' | 'user_offline';
  data: any;
}

export interface WebSocketServiceConfig {
  url: string;
  authToken?: string;
  userId: string;
}

class WebSocketService {
  private socket: Socket | null = null;
  private config: WebSocketServiceConfig | null = null;
  private messageHandlers: ((message: WebSocketMessage) => void)[] = [];
  private connectionHandlers: ((connected: boolean) => void)[] = [];

  constructor() {
    // Initialize with mock configuration for development
    this.config = {
      url: 'ws://localhost:3000',
      userId: 'mock-user-id',
    };
  }

  // Configure the service
  configure(config: WebSocketServiceConfig) {
    this.config = config;
  }

  // Connect to WebSocket server
  async connect(): Promise<void> {
    if (!this.config) {
      throw new Error('WebSocket service not configured');
    }
    try {
      // Dynamically import socket.io-client for environments where it's not bundled
      const { io } = await import('socket.io-client');
      this.socket = io(this.config.url, {
        auth: {
          token: this.config.authToken,
        },
        transports: ['websocket'],
      });

      this.socket.on('connect', () => {
        this.notifyConnectionChange(true);
        console.log('Connected to WebSocket server');
      });
      this.socket.on('disconnect', () => {
        this.notifyConnectionChange(false);
        console.log('Disconnected from WebSocket server');
      });
      this.socket.on('new-message', (data: any) => {
        this.notifyMessageHandlers({ type: 'message', data: data.message });
      });
      this.socket.on('user-typing', (data: any) => {
        this.notifyMessageHandlers({ type: 'typing', data });
      });
      this.socket.on('message-reaction', (data: any) => {
        this.notifyMessageHandlers({ type: 'reaction', data });
      });
      // Add more event listeners as needed
    } catch (error) {
      console.error('Failed to connect to WebSocket server:', error);
      throw error;
    }
  }

  // Disconnect from server
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.notifyConnectionChange(false);
      console.log('Disconnected from WebSocket server');
    }
  }

  // Send a message
  sendMessage(message: Message): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Not connected to WebSocket server'));
        return;
      }
      // You must join the chat before sending messages
      if (message.chatId) {
        this.socket.emit('join-chat', message.chatId);
      }
      this.socket.emit('send-message', {
        chatId: message.chatId,
        content: message.content,
        messageType: message.messageType || 'text',
        replyTo: message.replyTo,
        metadata: message.metadata || {},
      }, (response: any) => {
        if (response && response.error) {
          reject(new Error(response.error));
        } else {
          resolve();
        }
      });
    });
  }

  // Send typing indicator
  sendTypingIndicator(chatId: string, isTyping: boolean): void {
    if (!this.socket) return;
    this.socket.emit('typing', { chatId, isTyping });
  }

  // Send read receipt
  sendReadReceipt(chatId: string, messageIds: string[]): void {
    if (!this.socket) return;
    this.socket.emit('mark-read', { chatId, messageIds });
  }

  // Subscribe to incoming messages
  onMessage(handler: (message: WebSocketMessage) => void): () => void {
    this.messageHandlers.push(handler);
    
    // Return unsubscribe function
    return () => {
      const index = this.messageHandlers.indexOf(handler);
      if (index > -1) {
        this.messageHandlers.splice(index, 1);
      }
    };
  }

  // Subscribe to connection status changes
  onConnectionChange(handler: (connected: boolean) => void): () => void {
    this.connectionHandlers.push(handler);
    
    // Return unsubscribe function
    return () => {
      const index = this.connectionHandlers.indexOf(handler);
      if (index > -1) {
        this.connectionHandlers.splice(index, 1);
      }
    };
  }

  // Notify message handlers
  private notifyMessageHandlers(message: WebSocketMessage): void {
    this.messageHandlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error('Error in message handler:', error);
      }
    });
  }

  // Notify connection change handlers
  private notifyConnectionChange(connected: boolean): void {
    this.connectionHandlers.forEach(handler => {
      try {
        handler(connected);
      } catch (error) {
        console.error('Error in connection handler:', error);
      }
    });
  }

  // Check if connected
  isConnected(): boolean {
    return this.socket !== null;
  }

  // Get connection status
  getConnectionStatus(): 'connected' | 'connecting' | 'disconnected' {
    if (this.socket) return 'connected';
    if (this.config) return 'connecting';
    return 'disconnected';
  }

  // Simulate receiving a message (for development)
  simulateIncomingMessage(message: Message): void {
    const wsMessage: WebSocketMessage = {
      type: 'message',
      data: message,
    };
    
    this.notifyMessageHandlers(wsMessage);
  }

  // Simulate user typing (for development)
  simulateUserTyping(chatId: string, userId: string, isTyping: boolean): void {
    const wsMessage: WebSocketMessage = {
      type: 'typing',
      data: { chatId, userId, isTyping },
    };
    
    this.notifyMessageHandlers(wsMessage);
  }
}

// Export singleton instance
export const webSocketService = new WebSocketService();
export default webSocketService;
