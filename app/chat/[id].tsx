import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { Message, useMessaging } from '@/contexts/MessagingContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

interface ChatUser {
  id: string;
  name: string;
  avatar: string;
  interests: string[];
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [chatUser, setChatUser] = useState<ChatUser | null>(null);
  const { user } = useAuth();
  const { messages, sendMessage, markAsRead, loadChatHistory } = useMessaging();
  const colorScheme = useColorScheme();
  const flatListRef = useRef<FlatList>(null);

  // Get messages for this chat
  const chatMessages = messages[id || ''] || [];

  // Mock chat user data
  useEffect(() => {
    if (id) {
      // TODO: Fetch real user data from API
      const mockUser: ChatUser = {
        id,
        name: 'Alex Chen',
        avatar: '👨‍💻',
        interests: ['tech', 'music', 'hiking'],
      };
      setChatUser(mockUser);

      // Load chat history
      loadChatHistory(id);
    }
  }, [id, loadChatHistory]);

  // Mark messages as read when viewing chat
  useEffect(() => {
    if (id && chatMessages.length > 0) {
      const unreadMessages = chatMessages
        .filter(msg => !msg.isRead && msg.senderId !== user?.id)
        .map(msg => msg.id);
      
      if (unreadMessages.length > 0) {
        markAsRead(id, unreadMessages);
      }
    }
  }, [id, chatMessages, user?.id, markAsRead]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user || !id) return;

    try {
      await sendMessage(id, newMessage.trim(), id);
      setNewMessage('');
      
      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
  };

  const handleBackPress = () => {
    router.back();
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwnMessage = item.senderId === user?.id;
    const messageTime = new Date(item.timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    return (
      <View style={[
        styles.messageContainer,
        isOwnMessage ? styles.ownMessage : styles.otherMessage
      ]}>
        <View style={[
          styles.messageBubble,
          isOwnMessage 
            ? [styles.ownBubble, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]
            : [styles.otherBubble, { backgroundColor: Colors[colorScheme ?? 'light'].icon + '20' }]
        ]}>
          <ThemedText style={[
            styles.messageText,
            isOwnMessage && { color: 'white' }
          ]}>
            {item.text}
          </ThemedText>
          <View style={styles.messageFooter}>
            <Text style={[
              styles.messageTime,
              isOwnMessage ? { color: 'white' } : { color: Colors[colorScheme ?? 'light'].icon }
            ]}>
              {messageTime}
            </Text>
            {isOwnMessage && (
              <Text style={[styles.readStatus, { color: 'white' }]}>
                {item.isRead ? '✓✓' : '✓'}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  if (!chatUser) {
    return (
      <ThemedView style={styles.container}>
        <Text>Loading chat...</Text>
      </ThemedView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={[
        styles.header,
        { borderBottomColor: Colors[colorScheme ?? 'light'].icon + '30' }
      ]}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: Colors[colorScheme ?? 'light'].tint }]}>
            ←
          </Text>
        </TouchableOpacity>
        
        <View style={styles.userInfo}>
          <Text style={styles.avatar}>{chatUser.avatar}</Text>
          <View style={styles.userDetails}>
            <ThemedText type="defaultSemiBold" style={styles.userName}>
              {chatUser.name}
            </ThemedText>
            <View style={styles.interestsContainer}>
              {chatUser.interests.slice(0, 3).map((interest, index) => (
                <View
                  key={index}
                  style={[
                    styles.interestTag,
                    { backgroundColor: Colors[colorScheme ?? 'light'].tint + '20' }
                  ]}
                >
                  <Text style={[styles.interestText, { color: Colors[colorScheme ?? 'light'].tint }]}>
                    {interest}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.moreButton}>
          <Text style={[styles.moreButtonText, { color: Colors[colorScheme ?? 'light'].icon }]}>
            ⋯
          </Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={chatMessages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContent}
        inverted
        showsVerticalScrollIndicator={false}
      />

      {/* Typing indicator */}
      {isTyping && (
        <View style={styles.typingIndicator}>
          <Text style={[styles.typingText, { color: Colors[colorScheme ?? 'light'].icon }]}>
            {chatUser.name} is typing...
          </Text>
        </View>
      )}

      {/* Message Input */}
      <View style={[
        styles.inputContainer,
        { borderTopColor: Colors[colorScheme ?? 'light'].icon + '30' }
      ]}>
        <TextInput
          style={[
            styles.messageInput,
            {
              borderColor: Colors[colorScheme ?? 'light'].icon,
              color: Colors[colorScheme ?? 'light'].text,
              backgroundColor: Colors[colorScheme ?? 'light'].background,
            }
          ]}
          placeholder="Type a message..."
          placeholderTextColor={Colors[colorScheme ?? 'light'].icon}
          value={newMessage}
          onChangeText={setNewMessage}
          multiline
          maxLength={500}
          onFocus={() => setIsTyping(true)}
          onBlur={() => setIsTyping(false)}
        />
        
        <TouchableOpacity
          style={[
            styles.sendButton,
            { backgroundColor: newMessage.trim() ? Colors[colorScheme ?? 'light'].tint : Colors[colorScheme ?? 'light'].icon + '30' }
          ]}
          onPress={handleSendMessage}
          disabled={!newMessage.trim()}
        >
          <Text style={styles.sendButtonText}>→</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    paddingTop: 60,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  backButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    fontSize: 32,
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  interestsContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  interestTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  interestText: {
    fontSize: 10,
    fontWeight: '500',
  },
  moreButton: {
    padding: 8,
  },
  moreButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  messageContainer: {
    marginBottom: 16,
  },
  ownMessage: {
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  ownBubble: {
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
    marginBottom: 4,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  messageTime: {
    fontSize: 11,
    opacity: 0.7,
  },
  readStatus: {
    fontSize: 11,
    marginLeft: 4,
  },
  typingIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  typingText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 12,
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 100,
    textAlignVertical: 'top',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
