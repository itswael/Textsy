import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  bio?: string;
  interests: string[];
  location?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (userData: Omit<User, 'id'>) => Promise<void>;
  signOut: () => Promise<void>;
  googleSignIn: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for stored user data on app start
    loadStoredUser();
  }, []);

  const loadStoredUser = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('@textsy_user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error('Error loading stored user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const storeUser = async (userData: User) => {
    try {
      await AsyncStorage.setItem('@textsy_user', JSON.stringify(userData));
    } catch (error) {
      console.error('Error storing user data:', error);
    }
  };

  const clearStoredUser = async () => {
    try {
      await AsyncStorage.removeItem('@textsy_user');
    } catch (error) {
      console.error('Error clearing stored user:', error);
    }
  };

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      // TODO: Implement actual Firebase authentication
      console.log('Signing in with:', { email, password });
      
      // Mock successful sign in
      const mockUser: User = {
        id: '1',
        name: 'Alex Chen',
        email,
        bio: 'Software engineer who loves indie music and hiking.',
        interests: ['tech', 'music', 'hiking', 'coffee'],
        location: 'San Francisco, CA',
      };
      
      setUser(mockUser);
      await storeUser(mockUser);
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (userData: Omit<User, 'id'>) => {
    setIsLoading(true);
    try {
      // TODO: Implement actual Firebase user creation
      console.log('Signing up with:', userData);
      
      // Mock successful sign up
      const newUser: User = {
        id: Date.now().toString(),
        ...userData,
      };
      
      setUser(newUser);
      await storeUser(newUser);
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const googleSignIn = async () => {
    setIsLoading(true);
    try {
      // TODO: Implement Google OAuth
      console.log('Google sign in');
      
      // Mock successful Google sign in
      const mockUser: User = {
        id: '1',
        name: 'Alex Chen',
        email: 'alex.chen@gmail.com',
        bio: 'Software engineer who loves indie music and hiking.',
        interests: ['tech', 'music', 'hiking', 'coffee'],
        location: 'San Francisco, CA',
      };
      
      setUser(mockUser);
      await storeUser(mockUser);
    } catch (error) {
      console.error('Google sign in error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      // TODO: Implement actual Firebase sign out
      console.log('Signing out');
      
      setUser(null);
      await clearStoredUser();
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    signIn,
    signUp,
    signOut,
    googleSignIn,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
