import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import React, { useState } from 'react';
import {
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

// Mock data for development
const mockChats = [
  {
    id: '1',
    name: 'Alex Chen',
    lastMessage: 'Hey! How was your weekend?',
    timestamp: '2m ago',
    unreadCount: 2,
    avatar: '👨‍💻',
    interests: ['tech', 'music'],
  },
  {
    id: '2',
    name: 'Sarah Kim',
    lastMessage: 'That movie was amazing!',
    timestamp: '1h ago',
    unreadCount: 0,
    avatar: '👩‍🎨',
    interests: ['art', 'movies'],
  },
  {
    id: '3',
    name: 'Mike Johnson',
    lastMessage: 'Great game last night!',
    timestamp: '3h ago',
    unreadCount: 1,
    avatar: '🏈',
    interests: ['sports', 'fitness'],
  },
];

export default function ChatScreen() {
  const [chats, setChats] = useState(mockChats);
  const [searchQuery, setSearchQuery] = useState('');
  const colorScheme = useColorScheme();

  const filteredChats = chats.filter(chat =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.interests.some(interest => 
      interest.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const handleChatPress = (chatId: string) => {
    // TODO: Navigate to individual chat screen
    console.log('Opening chat:', chatId);
    // router.push(`/chat/${chatId}`);
  };

  const handleNewChat = () => {
    // TODO: Navigate to explore/discovery screen
    console.log('Starting new chat');
    // router.push('/explore');
  };

  const renderChatItem = ({ item }: { item: typeof mockChats[0] }) => (
    <TouchableOpacity
      style={[
        styles.chatItem,
        { borderBottomColor: Colors[colorScheme ?? 'light'].icon }
      ]}
      onPress={() => handleChatPress(item.id)}
    >
      <View style={styles.avatarContainer}>
        <Text style={styles.avatar}>{item.avatar}</Text>
      </View>
      
      <View style={styles.chatInfo}>
        <View style={styles.chatHeader}>
          <ThemedText type="defaultSemiBold" style={styles.chatName}>
            {item.name}
          </ThemedText>
          <Text style={[styles.timestamp, { color: Colors[colorScheme ?? 'light'].icon }]}>
            {item.timestamp}
          </Text>
        </View>
        
        <View style={styles.chatFooter}>
          <ThemedText style={styles.lastMessage} numberOfLines={1}>
            {item.lastMessage}
          </ThemedText>
          {item.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadCount}>{item.unreadCount}</Text>
            </View>
          )}
        </View>
        
        <View style={styles.interestsContainer}>
          {item.interests.map((interest, index) => (
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
    </TouchableOpacity>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title" style={styles.title}>
          Chats
        </ThemedText>
        <TouchableOpacity style={styles.newChatButton} onPress={handleNewChat}>
          <Text style={styles.newChatButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={[
            styles.searchInput,
            {
              borderColor: Colors[colorScheme ?? 'light'].icon,
              color: Colors[colorScheme ?? 'light'].text,
              backgroundColor: Colors[colorScheme ?? 'light'].background,
            }
          ]}
          placeholder="Search chats or interests..."
          placeholderTextColor={Colors[colorScheme ?? 'light'].icon}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {filteredChats.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyStateIcon, { color: Colors[colorScheme ?? 'light'].icon }]}>
            💬
          </Text>
          <ThemedText type="subtitle" style={styles.emptyStateTitle}>
            No chats yet
          </ThemedText>
          <ThemedText style={styles.emptyStateText}>
            Start exploring to find people who share your interests!
          </ThemedText>
          <TouchableOpacity style={styles.exploreButton} onPress={handleNewChat}>
            <Text style={styles.exploreButtonText}>Start Exploring</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredChats}
          renderItem={renderChatItem}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.chatList}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  newChatButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0a7ea4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  newChatButtonText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  searchInput: {
    height: 45,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  chatList: {
    paddingHorizontal: 20,
  },
  chatItem: {
    flexDirection: 'row',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatar: {
    fontSize: 24,
  },
  chatInfo: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 12,
  },
  chatFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    opacity: 0.7,
    marginRight: 8,
  },
  unreadBadge: {
    backgroundColor: '#0a7ea4',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadCount: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  interestsContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  interestTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  interestText: {
    fontSize: 11,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: 24,
  },
  exploreButton: {
    backgroundColor: '#0a7ea4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  exploreButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
