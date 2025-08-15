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
const mockUsers = [
  {
    id: '1',
    name: 'Alex Chen',
    age: 25,
    bio: 'Software engineer who loves indie music and hiking. Always up for a good conversation about tech trends!',
    avatar: '👨‍💻',
    interests: ['tech', 'music', 'hiking', 'coffee'],
    location: 'San Francisco, CA',
    matchScore: 95,
  },
  {
    id: '2',
    name: 'Sarah Kim',
    age: 28,
    bio: 'Artist and coffee enthusiast. I paint landscapes and love discovering new cafes around the city.',
    avatar: '👩‍🎨',
    interests: ['art', 'coffee', 'travel', 'photography'],
    location: 'New York, NY',
    matchScore: 87,
  },
  {
    id: '3',
    name: 'Mike Johnson',
    age: 30,
    bio: 'Sports fanatic and fitness coach. Love talking about basketball, working out, and healthy living.',
    avatar: '🏈',
    interests: ['sports', 'fitness', 'nutrition', 'basketball'],
    location: 'Los Angeles, CA',
    matchScore: 78,
  },
  {
    id: '4',
    name: 'Emma Wilson',
    age: 26,
    bio: 'Bookworm and yoga instructor. I love discussing literature, practicing mindfulness, and trying new restaurants.',
    avatar: '📚',
    interests: ['books', 'yoga', 'food', 'mindfulness'],
    location: 'Portland, OR',
    matchScore: 92,
  },
];

export default function ExploreScreen() {
  const [users, setUsers] = useState(mockUsers);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [currentUserIndex, setCurrentUserIndex] = useState(0);
  const colorScheme = useColorScheme();

  const availableInterests = ['tech', 'music', 'art', 'sports', 'fitness', 'coffee', 'travel', 'books', 'yoga', 'food'];

  const filteredUsers = users.filter(user =>
    (searchQuery === '' || 
     user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
     user.bio.toLowerCase().includes(searchQuery.toLowerCase()) ||
     user.interests.some(interest => interest.toLowerCase().includes(searchQuery.toLowerCase()))) &&
    (selectedInterests.length === 0 || 
     selectedInterests.some(interest => user.interests.includes(interest)))
  );

  const handleInterestToggle = (interest: string) => {
    setSelectedInterests(prev => 
      prev.includes(interest) 
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const handleLike = (userId: string) => {
    // TODO: Implement like functionality
    console.log('Liked user:', userId);
    setCurrentUserIndex(prev => Math.min(prev + 1, filteredUsers.length - 1));
  };

  const handlePass = (userId: string) => {
    // TODO: Implement pass functionality
    console.log('Passed user:', userId);
    setCurrentUserIndex(prev => Math.min(prev + 1, filteredUsers.length - 1));
  };

  const handleStartChat = (userId: string) => {
    // TODO: Navigate to chat screen
    console.log('Starting chat with:', userId);
  };

  const renderUserCard = ({ item, index }: { item: typeof mockUsers[0], index: number }) => {
    if (index < currentUserIndex) return null;

    return (
      <View style={styles.userCard}>
        <View style={styles.cardHeader}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatar}>{item.avatar}</Text>
          </View>
          <View style={styles.userInfo}>
            <ThemedText type="title" style={styles.userName}>
              {item.name}, {item.age}
            </ThemedText>
            <Text style={[styles.location, { color: Colors[colorScheme ?? 'light'].icon }]}>
              📍 {item.location}
            </Text>
            <View style={styles.matchScore}>
              <Text style={styles.matchScoreText}>
                {item.matchScore}% match
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.bioContainer}>
          <ThemedText style={styles.bio}>{item.bio}</ThemedText>
        </View>

        <View style={styles.interestsContainer}>
          {item.interests.map((interest, idx) => (
            <View
              key={idx}
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

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.passButton]}
            onPress={() => handlePass(item.id)}
          >
            <Text style={styles.passButtonText}>✕</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.chatButton]}
            onPress={() => handleStartChat(item.id)}
          >
            <Text style={styles.chatButtonText}>💬</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.likeButton]}
            onPress={() => handleLike(item.id)}
          >
            <Text style={styles.likeButtonText}>♥</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title" style={styles.title}>
          Discover
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          Find people who share your interests
        </ThemedText>
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
          placeholder="Search by name, bio, or interests..."
          placeholderTextColor={Colors[colorScheme ?? 'light'].icon}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.interestsFilter}>
        <Text style={[styles.filterLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
          Filter by interests:
        </Text>
        <FlatList
          data={availableInterests}
          horizontal
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                selectedInterests.includes(item) && {
                  backgroundColor: Colors[colorScheme ?? 'light'].tint,
                }
              ]}
              onPress={() => handleInterestToggle(item)}
            >
              <Text style={[
                styles.filterChipText,
                selectedInterests.includes(item) && { color: 'white' }
              ]}>
                {item}
              </Text>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.filterList}
        />
      </View>

      {filteredUsers.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyStateIcon, { color: Colors[colorScheme ?? 'light'].icon }]}>
            🔍
          </Text>
          <ThemedText type="subtitle" style={styles.emptyStateTitle}>
            No matches found
          </ThemedText>
          <ThemedText style={styles.emptyStateText}>
            Try adjusting your search or interest filters
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          renderItem={renderUserCard}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.userList}
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
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.8,
    textAlign: 'center',
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
  interestsFilter: {
    marginBottom: 20,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  filterList: {
    paddingHorizontal: 20,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 8,
    backgroundColor: '#f8f8f8',
  },
  filterChipText: {
    fontSize: 14,
    color: '#666',
  },
  userList: {
    paddingHorizontal: 20,
  },
  userCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatar: {
    fontSize: 32,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  location: {
    fontSize: 14,
    marginBottom: 8,
  },
  matchScore: {
    backgroundColor: '#0a7ea4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  matchScoreText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  bioContainer: {
    marginBottom: 16,
  },
  bio: {
    fontSize: 16,
    lineHeight: 22,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  interestTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  interestText: {
    fontSize: 12,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 16,
  },
  actionButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  passButton: {
    backgroundColor: '#ff6b6b',
  },
  chatButton: {
    backgroundColor: '#0a7ea4',
  },
  likeButton: {
    backgroundColor: '#51cf66',
  },
  passButtonText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  chatButtonText: {
    color: 'white',
    fontSize: 24,
  },
  likeButtonText: {
    color: 'white',
    fontSize: 24,
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
  },
});
