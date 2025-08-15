import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function SignupScreen() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    bio: '',
    interests: '',
  });
  const { signUp, isLoading } = useAuth();
  const colorScheme = useColorScheme();

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSignup = async () => {
    // Validation
    if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }

    try {
      const interests = formData.interests
        .split(',')
        .map(interest => interest.trim())
        .filter(interest => interest.length > 0);

      await signUp({
        name: formData.name,
        email: formData.email,
        bio: formData.bio || undefined,
        interests: interests.length > 0 ? interests : ['general'],
        location: undefined,
      });
      
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Error', 'Signup failed. Please try again.');
    }
  };

  const handleBackToLogin = () => {
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedView style={styles.content}>
          <View style={styles.header}>
            <ThemedText type="title" style={styles.title}>
              Create Account
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Join Textsy and start connecting
            </ThemedText>
          </View>

          <View style={styles.form}>
            <TextInput
              style={[
                styles.input,
                { 
                  borderColor: Colors[colorScheme ?? 'light'].icon,
                  color: Colors[colorScheme ?? 'light'].text,
                  backgroundColor: Colors[colorScheme ?? 'light'].background,
                }
              ]}
              placeholder="Full Name *"
              placeholderTextColor={Colors[colorScheme ?? 'light'].icon}
              value={formData.name}
              onChangeText={(value) => handleInputChange('name', value)}
              autoCapitalize="words"
            />

            <TextInput
              style={[
                styles.input,
                { 
                  borderColor: Colors[colorScheme ?? 'light'].icon,
                  color: Colors[colorScheme ?? 'light'].text,
                  backgroundColor: Colors[colorScheme ?? 'light'].background,
                }
              ]}
              placeholder="Email *"
              placeholderTextColor={Colors[colorScheme ?? 'light'].icon}
              value={formData.email}
              onChangeText={(value) => handleInputChange('email', value)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TextInput
              style={[
                styles.input,
                { 
                  borderColor: Colors[colorScheme ?? 'light'].icon,
                  color: Colors[colorScheme ?? 'light'].text,
                  backgroundColor: Colors[colorScheme ?? 'light'].background,
                }
              ]}
              placeholder="Password *"
              placeholderTextColor={Colors[colorScheme ?? 'light'].icon}
              value={formData.password}
              onChangeText={(value) => handleInputChange('password', value)}
              secureTextEntry
              autoCapitalize="none"
            />

            <TextInput
              style={[
                styles.input,
                { 
                  borderColor: Colors[colorScheme ?? 'light'].icon,
                  color: Colors[colorScheme ?? 'light'].text,
                  backgroundColor: Colors[colorScheme ?? 'light'].background,
                }
              ]}
              placeholder="Confirm Password *"
              placeholderTextColor={Colors[colorScheme ?? 'light'].icon}
              value={formData.confirmPassword}
              onChangeText={(value) => handleInputChange('confirmPassword', value)}
              secureTextEntry
              autoCapitalize="none"
            />

            <TextInput
              style={[
                styles.input,
                styles.textArea,
                { 
                  borderColor: Colors[colorScheme ?? 'light'].icon,
                  color: Colors[colorScheme ?? 'light'].text,
                  backgroundColor: Colors[colorScheme ?? 'light'].background,
                }
              ]}
              placeholder="Bio (optional)"
              placeholderTextColor={Colors[colorScheme ?? 'light'].icon}
              value={formData.bio}
              onChangeText={(value) => handleInputChange('bio', value)}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <TextInput
              style={[
                styles.input,
                { 
                  borderColor: Colors[colorScheme ?? 'light'].icon,
                  color: Colors[colorScheme ?? 'light'].text,
                  backgroundColor: Colors[colorScheme ?? 'light'].background,
                }
              ]}
              placeholder="Interests (e.g., music, tech, sports)"
              placeholderTextColor={Colors[colorScheme ?? 'light'].icon}
              value={formData.interests}
              onChangeText={(value) => handleInputChange('interests', value)}
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={handleSignup}
              disabled={isLoading}
            >
              <Text style={styles.buttonText}>
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </Text>
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: Colors[colorScheme ?? 'light'].icon }]}>
                Already have an account?{' '}
              </Text>
              <TouchableOpacity onPress={handleBackToLogin}>
                <Text style={[styles.footerText, styles.linkText]}>
                  Sign In
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.8,
  },
  form: {
    gap: 16,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    paddingTop: 16,
    paddingBottom: 16,
  },
  button: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: '#0a7ea4',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  footerText: {
    fontSize: 14,
  },
  linkText: {
    color: '#0a7ea4',
    fontWeight: '600',
  },
});
