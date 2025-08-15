import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

export default function ProfileScreen() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [onlineStatus, setOnlineStatus] = useState(true);
  const { user, signOut } = useAuth();
  const colorScheme = useColorScheme();

  if (!user) {
    // This shouldn't happen if auth is working correctly
    return null;
  }

  const handleEditProfile = () => {
    // TODO: Navigate to edit profile screen
    console.log('Edit profile');
  };

  const handlePrivacySettings = () => {
    // TODO: Navigate to privacy settings screen
    console.log('Privacy settings');
  };

  const handleBlockedUsers = () => {
    // TODO: Navigate to blocked users screen
    console.log('Blocked users');
  };

  const handleReportIssue = () => {
    // TODO: Navigate to report issue screen
    console.log('Report issue');
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              router.replace('/auth/login');
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          }
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            // TODO: Implement account deletion
            console.log('Deleting account');
            router.replace('/auth/login');
          }
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <ThemedView style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatar}>👨‍💻</Text>
          </View>
          <View style={styles.userInfo}>
            <ThemedText type="title" style={styles.userName}>
              {user.name}
            </ThemedText>
            <Text style={[styles.userEmail, { color: Colors[colorScheme ?? 'light'].icon }]}>
              {user.email}
            </Text>
            {user.location && (
              <Text style={[styles.userLocation, { color: Colors[colorScheme ?? 'light'].icon }]}>
                📍 {user.location}
              </Text>
            )}
          </View>
        </View>

        {/* Bio */}
        {user.bio && (
          <View style={styles.section}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              About
            </ThemedText>
            <ThemedText style={styles.bio}>{user.bio}</ThemedText>
          </View>
        )}

        {/* Interests */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Interests
          </ThemedText>
          <View style={styles.interestsContainer}>
            {user.interests.map((interest, index) => (
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

        {/* Settings */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Settings
          </ThemedText>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                Push Notifications
              </Text>
              <Text style={[styles.settingDescription, { color: Colors[colorScheme ?? 'light'].icon }]}>
                Receive notifications for new messages
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#767577', true: Colors[colorScheme ?? 'light'].tint }}
              thumbColor={notificationsEnabled ? '#f4f3f4' : '#f4f3f4'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                Location Services
              </Text>
              <Text style={[styles.settingDescription, { color: Colors[colorScheme ?? 'light'].icon }]}>
                Show your location to nearby users
              </Text>
            </View>
            <Switch
              value={locationEnabled}
              onValueChange={setLocationEnabled}
              trackColor={{ false: '#767577', true: Colors[colorScheme ?? 'light'].tint }}
              thumbColor={locationEnabled ? '#f4f3f4' : '#f4f3f4'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                Online Status
              </Text>
              <Text style={[styles.settingDescription, { color: Colors[colorScheme ?? 'light'].icon }]}>
                Show when you're online
              </Text>
            </View>
            <Switch
              value={onlineStatus}
              onValueChange={setOnlineStatus}
              trackColor={{ false: '#767577', true: Colors[colorScheme ?? 'light'].tint }}
              thumbColor={onlineStatus ? '#f4f3f4' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Account
          </ThemedText>
          
          <TouchableOpacity style={styles.actionButton} onPress={handleEditProfile}>
            <Text style={[styles.actionButtonText, { color: Colors[colorScheme ?? 'light'].tint }]}>
              Edit Profile
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handlePrivacySettings}>
            <Text style={[styles.actionButtonText, { color: Colors[colorScheme ?? 'light'].tint }]}>
              Privacy Settings
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleBlockedUsers}>
            <Text style={[styles.actionButtonText, { color: Colors[colorScheme ?? 'light'].tint }]}>
              Blocked Users
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleReportIssue}>
            <Text style={[styles.actionButtonText, { color: Colors[colorScheme ?? 'light'].tint }]}>
              Report an Issue
            </Text>
          </TouchableOpacity>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Danger Zone
          </ThemedText>
          
          <TouchableOpacity style={[styles.actionButton, styles.logoutButton]} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, styles.deleteButton]} onPress={handleDeleteAccount}>
            <Text style={styles.deleteButtonText}>Delete Account</Text>
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <View style={styles.section}>
          <Text style={[styles.appInfo, { color: Colors[colorScheme ?? 'light'].icon }]}>
            Textsy v1.0.0
          </Text>
        </View>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
  },
  avatar: {
    fontSize: 40,
  },
  userInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    marginBottom: 4,
  },
  userLocation: {
    fontSize: 14,
  },
  section: {
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
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
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
  },
  actionButton: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  logoutButton: {
    borderBottomColor: '#ff6b6b',
  },
  logoutButtonText: {
    color: '#ff6b6b',
    fontSize: 16,
    fontWeight: '500',
  },
  deleteButton: {
    borderBottomColor: '#ff4757',
  },
  deleteButtonText: {
    color: '#ff4757',
    fontSize: 16,
    fontWeight: '500',
  },
  appInfo: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 4,
  },
});
