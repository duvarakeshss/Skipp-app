import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { sessionManager } from '../utils/sessionManager';

import { useColorScheme } from '@/hooks/useColorScheme';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const [sessionState, setSessionState] = useState(sessionManager.getSessionState());
  const [initialCheckDone, setInitialCheckDone] = useState(false);

  useEffect(() => {
    const unsubscribe = sessionManager.subscribe(setSessionState);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (loaded && !initialCheckDone) {
      sessionManager.initializeSession().then(() => {
        setInitialCheckDone(true);
      }).catch((error) => {
        console.error('Session initialization failed:', error);
        setInitialCheckDone(true);
      });
    }
  }, [loaded, initialCheckDone]);

  // Handle navigation based on authentication state
  useEffect(() => {
    if (initialCheckDone && !sessionState.isLoading) {
      if (sessionState.isAuthenticated) {
        router.replace('/(tabs)');
      } else {
        router.replace('/login');
      }
    }
  }, [sessionState.isAuthenticated, sessionState.isLoading, initialCheckDone, router]);

  // Show loading screen only while fonts are loading and user is not already authenticated
  if (!loaded && (!initialCheckDone || !sessionState.isAuthenticated)) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={['#0f172a', '#1e293b', '#334155']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.loadingGradient}
        >
          {/* Animated background elements */}
          <View style={styles.loadingBackgroundElements}>
            <View style={[styles.loadingOrb, styles.loadingOrb1]} />
            <View style={[styles.loadingOrb, styles.loadingOrb2]} />
          </View>

          <View style={styles.loadingContent}>
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.loadingCard}
            >
              <View style={styles.loadingIconContainer}>
                <LinearGradient
                  colors={['#3b82f6', '#1d4ed8', '#1e40af']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.loadingIcon}
                >
                  <Ionicons name="logo-react" size={32} color="#ffffff" />
                </LinearGradient>
              </View>

              <Text style={styles.loadingTitle}>
                Loading App
              </Text>

              <Text style={styles.loadingSubtitle}>
                Preparing your experience...
              </Text>

              <View style={styles.loadingAnimationContainer}>
                <ActivityIndicator size="large" color="#3b82f6" />
              </View>
            </LinearGradient>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen
          name="login"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="light" hidden={true} />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
  },
  loadingGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingBackgroundElements: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  loadingOrb: {
    position: 'absolute',
    borderRadius: 100,
    opacity: 0.1,
  },
  loadingOrb1: {
    width: 150,
    height: 150,
    backgroundColor: '#3b82f6',
    top: '20%',
    left: '10%',
  },
  loadingOrb2: {
    width: 100,
    height: 100,
    backgroundColor: '#1d4ed8',
    bottom: '30%',
    right: '15%',
  },
  loadingContent: {
    alignItems: 'center',
    padding: 32,
    width: '100%',
    maxWidth: 350,
  },
  loadingCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.3,
    shadowRadius: 25,
    elevation: 15,
  },
  loadingIconContainer: {
    marginBottom: 20,
  },
  loadingIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  loadingTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 6,
    textAlign: 'center',
  },
  loadingSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingAnimationContainer: {
    alignItems: 'center',
  },
});
