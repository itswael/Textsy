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
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signIn, googleSignIn, isLoading } = useAuth();
  const colorScheme = useColorScheme();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      await signIn(email, password);
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Error', 'Login failed. Please try again.');
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await googleSignIn();
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Error', 'Google sign-in failed. Please try again.');
    }
  };

  const handleSignUp = () => {
    router.push('/auth/signup');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ThemedView style={styles.content}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Welcome to Textsy
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Connect with people who share your interests
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
            placeholder="Email"
            placeholderTextColor={Colors[colorScheme ?? 'light'].icon}
            value={email}
            onChangeText={setEmail}
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
            placeholder="Password"
            placeholderTextColor={Colors[colorScheme ?? 'light'].icon}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'Signing In...' : 'Sign In'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.googleButton]}
            onPress={handleGoogleSignIn}
            disabled={isLoading}
          >
            <Text style={styles.googleButtonText}>
              {isLoading ? 'Signing In...' : 'Continue with Google'}
            </Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: Colors[colorScheme ?? 'light'].icon }]}>
              Don't have an account?{' '}
            </Text>
            <TouchableOpacity onPress={handleSignUp}>
              <Text style={[styles.footerText, styles.linkText]}>
                Sign Up
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
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
  googleButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  googleButtonText: {
    color: '#333',
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
