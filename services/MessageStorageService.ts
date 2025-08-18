import { Chat, Message } from '@/contexts/MessagingContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

class MessageStorageService {
  private readonly CHATS_KEY = '@textsy_chats';
  private readonly MESSAGES_KEY = '@textsy_messages';
  private readonly USER_PREFERENCES_KEY = '@textsy_user_preferences';

  // Chat Management
  async saveChats(chats: Chat[]): Promise<void> {
    try {
      await AsyncStorage.setItem(this.CHATS_KEY, JSON.stringify(chats));
    } catch (error) {
      console.error('Error saving chats:', error);
      throw error;
    }
  }

  async loadChats(): Promise<Chat[]> {
    try {
      const stored = await AsyncStorage.getItem(this.CHATS_KEY);
      if (stored) {
        const chats = JSON.parse(stored);
        // Convert timestamp strings back to Date objects
        return chats.map((chat: any) => ({
          ...chat,
          updatedAt: new Date(chat.updatedAt),
          lastMessage: chat.lastMessage ? {
            ...chat.lastMessage,
            timestamp: new Date(chat.lastMessage.timestamp)
          } : undefined
        }));
      }
      return [];
    } catch (error) {
      console.error('Error loading chats:', error);
      return [];
    }
  }

  async deleteChat(chatId: string): Promise<void> {
    try {
      const chats = await this.loadChats();
      const filteredChats = chats.filter(chat => chat.id !== chatId);
      await this.saveChats(filteredChats);
      
      // Also delete associated messages
      await this.deleteMessages(chatId);
    } catch (error) {
      console.error('Error deleting chat:', error);
      throw error;
    }
  }

  // Message Management
  async saveMessages(chatId: string, messages: Message[]): Promise<void> {
    try {
      const allMessages = await this.loadAllMessages();
      allMessages[chatId] = messages;
      await AsyncStorage.setItem(this.MESSAGES_KEY, JSON.stringify(allMessages));
    } catch (error) {
      console.error('Error saving messages:', error);
      throw error;
    }
  }

  async loadMessages(chatId: string): Promise<Message[]> {
    try {
      const allMessages = await this.loadAllMessages();
      const messages = allMessages[chatId] || [];
      
      // Convert timestamp strings back to Date objects
      return messages.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));
    } catch (error) {
      console.error('Error loading messages:', error);
      return [];
    }
  }

  async loadAllMessages(): Promise<{ [chatId: string]: Message[] }> {
    try {
      const stored = await AsyncStorage.getItem(this.MESSAGES_KEY);
      if (stored) {
        const messages = JSON.parse(stored);
        // Convert timestamp strings back to Date objects
        const convertedMessages: { [chatId: string]: Message[] } = {};
        Object.keys(messages).forEach(chatId => {
          convertedMessages[chatId] = messages[chatId].map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }));
        });
        return convertedMessages;
      }
      return {};
    } catch (error) {
      console.error('Error loading all messages:', error);
      return {};
    }
  }

  async addMessage(chatId: string, message: Message): Promise<void> {
    try {
      const messages = await this.loadMessages(chatId);
      messages.push(message);
      await this.saveMessages(chatId, messages);
    } catch (error) {
      console.error('Error adding message:', error);
      throw error;
    }
  }

  async updateMessage(chatId: string, messageId: string, updates: Partial<Message>): Promise<void> {
    try {
      const messages = await this.loadMessages(chatId);
      const messageIndex = messages.findIndex(msg => msg.id === messageId);
      
      if (messageIndex !== -1) {
        messages[messageIndex] = { ...messages[messageIndex], ...updates };
        await this.saveMessages(chatId, messages);
      }
    } catch (error) {
      console.error('Error updating message:', error);
      throw error;
    }
  }

  async deleteMessages(chatId: string): Promise<void> {
    try {
      const allMessages = await this.loadAllMessages();
      delete allMessages[chatId];
      await AsyncStorage.setItem(this.MESSAGES_KEY, JSON.stringify(allMessages));
    } catch (error) {
      console.error('Error deleting messages:', error);
      throw error;
    }
  }

  async markMessagesAsRead(chatId: string, messageIds: string[]): Promise<void> {
    try {
      const messages = await this.loadMessages(chatId);
      const updatedMessages = messages.map(msg =>
        messageIds.includes(msg.id) ? { ...msg, isRead: true } : msg
      );
      await this.saveMessages(chatId, updatedMessages);
    } catch (error) {
      console.error('Error marking messages as read:', error);
      throw error;
    }
  }

  // User Preferences
  async saveUserPreferences(preferences: any): Promise<void> {
    try {
      await AsyncStorage.setItem(this.USER_PREFERENCES_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.error('Error saving user preferences:', error);
      throw error;
    }
  }

  async loadUserPreferences(): Promise<any> {
    try {
      const stored = await AsyncStorage.getItem(this.USER_PREFERENCES_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Error loading user preferences:', error);
      return {};
    }
  }

  // Storage Management
  async getStorageSize(): Promise<number> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      let totalSize = 0;
      
      for (const key of keys) {
        if (key.startsWith('@textsy_')) {
          const value = await AsyncStorage.getItem(key);
          if (value) {
            totalSize += new Blob([value]).size;
          }
        }
      }
      
      return totalSize;
    } catch (error) {
      console.error('Error calculating storage size:', error);
      return 0;
    }
  }

  async clearAllData(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const textsyKeys = keys.filter(key => key.startsWith('@textsy_'));
      await AsyncStorage.multiRemove(textsyKeys);
    } catch (error) {
      console.error('Error clearing all data:', error);
      throw error;
    }
  }

  // Search and Filter
  async searchMessages(query: string): Promise<Message[]> {
    try {
      const allMessages = await this.loadAllMessages();
      const results: Message[] = [];
      
      Object.values(allMessages).forEach(messages => {
        const matchingMessages = messages.filter(msg =>
          msg.text.toLowerCase().includes(query.toLowerCase())
        );
        results.push(...matchingMessages);
      });
      
      // Sort by timestamp (newest first)
      return results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      console.error('Error searching messages:', error);
      return [];
    }
  }

  async getUnreadMessageCount(): Promise<number> {
    try {
      const allMessages = await this.loadAllMessages();
      let totalUnread = 0;
      
      Object.values(allMessages).forEach(messages => {
        totalUnread += messages.filter(msg => !msg.isRead).length;
      });
      
      return totalUnread;
    } catch (error) {
      console.error('Error getting unread message count:', error);
      return 0;
    }
  }

  // Backup and Restore
  async exportData(): Promise<string> {
    try {
      const chats = await this.loadChats();
      const messages = await this.loadAllMessages();
      const preferences = await this.loadUserPreferences();
      
      const exportData = {
        chats,
        messages,
        preferences,
        exportDate: new Date().toISOString(),
        version: '1.0.0'
      };
      
      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('Error exporting data:', error);
      throw error;
    }
  }

  async importData(data: string): Promise<void> {
    try {
      const importData = JSON.parse(data);
      
      if (importData.chats) {
        await this.saveChats(importData.chats);
      }
      
      if (importData.messages) {
        await AsyncStorage.setItem(this.MESSAGES_KEY, JSON.stringify(importData.messages));
      }
      
      if (importData.preferences) {
        await this.saveUserPreferences(importData.preferences);
      }
    } catch (error) {
      console.error('Error importing data:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const messageStorageService = new MessageStorageService();
export default messageStorageService;
