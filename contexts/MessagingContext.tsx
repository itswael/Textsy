import messageStorageService from '@/services/MessageStorageService';
import webSocketService, { WebSocketMessage } from '@/services/WebSocketService';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

export interface Message {
  id: string;
  text: string;
  senderId: string;
  receiverId: string;
  timestamp: Date;
  isRead: boolean;
  chatId: string;
}

export interface Chat {
  id: string;
  participants: string[];
  lastMessage?: Message;
  unreadCount: number;
  updatedAt: Date;
}

interface MessagingContextType {
  chats: Chat[];
  messages: { [chatId: string]: Message[] };
  isConnected: boolean;
  sendMessage: (chatId: string, text: string, receiverId: string) => Promise<void>;
  markAsRead: (chatId: string, messageIds: string[]) => Promise<void>;
  createChat: (participantIds: string[]) => Promise<string>;
  loadChatHistory: (chatId: string) => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  searchMessages: (query: string) => Promise<Message[]>;
  getUnreadCount: () => Promise<number>;
}

const MessagingContext = createContext<MessagingContextType | undefined>(undefined);

export const useMessaging = () => {
  const context = useContext(MessagingContext);
  if (context === undefined) {
    throw new Error('useMessaging must be used within a MessagingProvider');
  }
  return context;
};

interface MessagingProviderProps {
  children: ReactNode;
}

export const MessagingProvider: React.FC<MessagingProviderProps> = ({ children }) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<{ [chatId: string]: Message[] }>({});
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Load stored chats and messages on app start
    loadStoredData();
    
    // Set up WebSocket event listeners
    const unsubscribeMessage = webSocketService.onMessage(handleWebSocketMessage);
    const unsubscribeConnection = webSocketService.onConnectionChange(handleConnectionChange);
    
    // Cleanup on unmount
    return () => {
      unsubscribeMessage();
      unsubscribeConnection();
      webSocketService.disconnect();
    };
  }, []);

  const handleWebSocketMessage = (wsMessage: WebSocketMessage) => {
    switch (wsMessage.type) {
      case 'message':
        handleIncomingMessage(wsMessage.data);
        break;
      case 'typing':
        // TODO: Handle typing indicators
        console.log('Typing indicator:', wsMessage.data);
        break;
      case 'read_receipt':
        // TODO: Handle read receipts
        console.log('Read receipt:', wsMessage.data);
        break;
      default:
        console.log('Unknown WebSocket message type:', wsMessage.type);
    }
  };

  const handleConnectionChange = (connected: boolean) => {
    setIsConnected(connected);
  };

  const handleIncomingMessage = async (message: Message) => {
    try {
      // Add message to local state
      setMessages(prev => ({
        ...prev,
        [message.chatId]: [...(prev[message.chatId] || []), message],
      }));

      // Update chat's last message and timestamp
      setChats(prev => prev.map(chat => 
        chat.id === message.chatId 
          ? { 
              ...chat, 
              lastMessage: message, 
              updatedAt: new Date(),
              unreadCount: chat.unreadCount + 1
            }
          : chat
      ));

      // Store message in local storage
      await messageStorageService.addMessage(message.chatId, message);
      
      // Update chat in storage
      const updatedChats = chats.map(chat => 
        chat.id === message.chatId 
          ? { 
              ...chat, 
              lastMessage: message, 
              updatedAt: new Date(),
              unreadCount: chat.unreadCount + 1
            }
          : chat
      );
      await messageStorageService.saveChats(updatedChats);

    } catch (error) {
      console.error('Error handling incoming message:', error);
    }
  };

  const loadStoredData = async () => {
    try {
      const storedChats = await messageStorageService.loadChats();
      const storedMessages = await messageStorageService.loadAllMessages();
      
      setChats(storedChats);
      setMessages(storedMessages);
    } catch (error) {
      console.error('Error loading stored messaging data:', error);
    }
  };

  const connect = async () => {
    try {
      await webSocketService.connect();
    } catch (error) {
      console.error('Failed to connect to messaging server:', error);
      setIsConnected(false);
    }
  };

  const disconnect = async () => {
    try {
      webSocketService.disconnect();
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
  };

  const sendMessage = async (chatId: string, text: string, receiverId: string): Promise<void> => {
    try {
      const message: Message = {
        id: Date.now().toString(),
        text,
        senderId: 'current-user-id', // TODO: Get from auth context
        receiverId,
        timestamp: new Date(),
        isRead: false,
        chatId,
      };

      // Add message to local state
      setMessages(prev => ({
        ...prev,
        [chatId]: [...(prev[chatId] || []), message],
      }));

      // Update chat's last message and timestamp
      setChats(prev => prev.map(chat => 
        chat.id === chatId 
          ? { ...chat, lastMessage: message, updatedAt: new Date() }
          : chat
      ));

      // Store message in local storage
      await messageStorageService.addMessage(chatId, message);
      
      // Update chat in storage
      const updatedChats = chats.map(chat => 
        chat.id === chatId 
          ? { ...chat, lastMessage: message, updatedAt: new Date() }
          : chat
      );
      await messageStorageService.saveChats(updatedChats);

      // Send message via WebSocket
      await webSocketService.sendMessage(message);

    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  };

  const markAsRead = async (chatId: string, messageIds: string[]): Promise<void> => {
    try {
      setMessages(prev => ({
        ...prev,
        [chatId]: (prev[chatId] || []).map(message =>
          messageIds.includes(message.id)
            ? { ...message, isRead: true }
            : message
        ),
      }));

      // Update unread count
      setChats(prev => prev.map(chat => 
        chat.id === chatId 
          ? { ...chat, unreadCount: Math.max(0, chat.unreadCount - messageIds.length) }
          : chat
      ));

      // Update messages in storage
      await messageStorageService.markMessagesAsRead(chatId, messageIds);
      
      // Update chat in storage
      const updatedChats = chats.map(chat => 
        chat.id === chatId 
          ? { ...chat, unreadCount: Math.max(0, chat.unreadCount - messageIds.length) }
          : chat
      );
      await messageStorageService.saveChats(updatedChats);

      // Send read receipt via WebSocket
      webSocketService.sendReadReceipt(chatId, messageIds);

    } catch (error) {
      console.error('Error marking messages as read:', error);
      throw error;
    }
  };

  const createChat = async (participantIds: string[]): Promise<string> => {
    try {
      const chatId = Date.now().toString();
      const newChat: Chat = {
        id: chatId,
        participants: participantIds,
        unreadCount: 0,
        updatedAt: new Date(),
      };

      setChats(prev => [newChat, ...prev]);
      setMessages(prev => ({ ...prev, [chatId]: [] }));

      // Store in local storage
      await messageStorageService.saveChats([newChat, ...chats]);
      await messageStorageService.saveMessages(chatId, []);

      console.log('Created new chat:', chatId);
      return chatId;

    } catch (error) {
      console.error('Error creating chat:', error);
      throw error;
    }
  };

  const loadChatHistory = async (chatId: string): Promise<void> => {
    try {
      // Load messages from storage
      const storedMessages = await messageStorageService.loadMessages(chatId);
      setMessages(prev => ({
        ...prev,
        [chatId]: storedMessages
      }));
      
      console.log('Loaded chat history for:', chatId);
      
    } catch (error) {
      console.error('Error loading chat history:', error);
      throw error;
    }
  };

  const searchMessages = async (query: string): Promise<Message[]> => {
    try {
      return await messageStorageService.searchMessages(query);
    } catch (error) {
      console.error('Error searching messages:', error);
      return [];
    }
  };

  const getUnreadCount = async (): Promise<number> => {
    try {
      return await messageStorageService.getUnreadMessageCount();
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  };

  const value: MessagingContextType = {
    chats,
    messages,
    isConnected,
    sendMessage,
    markAsRead,
    createChat,
    loadChatHistory,
    connect,
    disconnect,
    searchMessages,
    getUnreadCount,
  };

  return (
    <MessagingContext.Provider value={value}>
      {children}
    </MessagingContext.Provider>
  );
};
