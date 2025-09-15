import React, { useState, useEffect } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Keyboard, View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import styled from 'styled-components/native';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, LinearGradient, Stop, Circle, Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginUser , fetchAndCacheAllData } from '../utils/attendanceService';
import { sessionManager } from '../utils/sessionManager';
import { initializeBackgroundRefresh } from '../utils/backgroundRefresh';

// Logo Component
const LogoSVG = () => (
  <Svg width="64" height="64" viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor="#1173d4" stopOpacity="1" />
        <Stop offset="100%" stopColor="#0f6ac0" stopOpacity="1" />
      </LinearGradient>
    </Defs>
    <Circle cx="50" cy="50" r="45" fill="url(#logoGradient)" stroke="#ffffff" strokeWidth="2"/>
    <Path d="M25 25 L25 75 L35 75 L50 50 L65 75 L75 75 L75 25 L65 25 L50 50 L35 25 Z" fill="white"/>
  </Svg>
);

// Styled Components
const Container = styled(KeyboardAvoidingView)`
  flex: 1;
`;

const Background = styled(ScrollView)`
  flex-grow: 1;
  background-color: #0f172a;
`;

const BackgroundImage = styled.ImageBackground`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
`;

const Overlay = styled.View`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(15, 23, 42, 0.85);
`;

const MainContent = styled.View<{ isKeyboardVisible: boolean }>`
  flex: 1;
  justify-content: center;
  padding: 32px;
  padding-top: 80px;
  transform: translateY(${props => props.isKeyboardVisible ? '-80px' : '0px'});
  transition: transform 0.3s ease;
`;

const LoginCard = styled.View`
  background-color: rgba(30, 41, 59, 0.8);
  border-radius: 16px;
  padding: 32px;
  border-width: 1px;
  border-color: rgba(51, 65, 85, 0.5);
`;

const LogoContainer = styled.View`
  align-items: center;
  margin-bottom: 32px;
`;

const LogoWrapper = styled.View`
  margin-bottom: 16px;
`;

const Title = styled.Text`
  font-size: 32px;
  font-weight: bold;
  color: white;
  margin-bottom: 8px;
`;

const Subtitle = styled.Text`
  font-size: 18px;
  color: #cbd5e1;
`;

const FormContainer = styled.View`
  gap: 24px;
`;

const InputContainer = styled.View`
  gap: 8px;
`;

const InputLabel = styled.Text`
  color: #cbd5e1;
  margin-bottom: 8px;
  margin-left: 4px;
`;

const TextInputStyled = styled.TextInput`
  background-color: #374151;
  border-width: 2px;
  border-color: #4b5563;
  border-radius: 8px;
  padding: 14px 16px;
  color: white;
  font-size: 16px;
`;

const PasswordContainer = styled.View`
  position: relative;
`;

const PasswordInput = styled(TextInputStyled)`
  padding-right: 48px;
`;

const PasswordToggle = styled.TouchableOpacity`
  position: absolute;
  right: 16px;
  top: 50%;
  margin-top: -12px;
  padding: 4px;
`;

const SecurityNotice = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: center;
  background-color: rgba(30, 58, 138, 0.3);
  padding: 12px;
  border-radius: 8px;
  border-width: 1px;
  border-color: rgba(30, 64, 175, 0.5);
`;

const SecurityIcon = styled.Text`
  color: #60a5fa;
  margin-right: 8px;
`;

const SecurityText = styled.Text`
  color: #cbd5e1;
  font-size: 14px;
`;

const ErrorContainer = styled.View`
  background-color: rgba(127, 29, 29, 0.3);
  border-width: 1px;
  border-color: rgba(153, 27, 27, 0.5);
  border-radius: 8px;
  padding: 12px;
`;

const ErrorText = styled.Text`
  color: #f87171;
  text-align: center;
  font-size: 14px;
`;

const LoginButton = styled.TouchableOpacity<{ isLoading: boolean }>`
  background-color: ${props => props.isLoading ? '#1e40af' : '#2563eb'};
  border-radius: 8px;
  padding: 14px;
  align-items: center;
  opacity: ${props => props.isLoading ? 0.9 : 1};
  shadow-color: #000;
  shadow-offset: 0px 2px;
  shadow-opacity: 0.2;
  shadow-radius: 4px;
  elevation: 3;
`;

const LoginButtonContent = styled.View`
  flex-direction: row;
  align-items: center;
`;

const LoadingSpinner = styled.View<{ isLoading: boolean }>`
  width: 20px;
  height: 20px;
  border-width: 2px;
  border-color: ${props => props.isLoading ? 'rgba(255, 255, 255, 0.3)' : 'white'};
  border-top-color: white;
  border-radius: 10px;
  margin-right: 8px;
  opacity: ${props => props.isLoading ? 1 : 0};
`;

const LoginButtonText = styled.Text`
  color: white;
  font-weight: 600;
  font-size: 16px;
`;

const BottomBar = styled.View`
  background-color: rgba(0, 0, 0, 0.5);
  border-top-width: 1px;
  border-top-color: rgba(55, 65, 81, 0.5);
`;

const BottomBarContent = styled.View`
  padding: 16px 32px;
`;

const CopyrightText = styled.Text`
  text-align: center;
  color: #94a3b8;
  font-size: 14px;
`;

const LoadingOverlay = styled.View`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.8);
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const LoadingContainer = styled.View`
  width: 90%;
  max-width: 320px;
  align-items: center;
`;

const LoadingTitle = styled.Text`
  font-size: 20px;
  font-weight: 700;
  color: #ffffff;
  margin-bottom: 8px;
  text-align: center;
`;

const LoadingSubtitle = styled.Text`
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  text-align: center;
  line-height: 20px;
`;

export default function LoginScreen() {
  const [rollNo, setRollNo] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidHideListener?.remove();
      keyboardDidShowListener?.remove();
    };
  }, []);

  // Check for existing valid session on component mount
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const sessionState = sessionManager.getSessionState();

        if (sessionState.isAuthenticated && !sessionState.isLoading) {
          // Valid session exists, redirect to main app
          router.replace('/(tabs)');
          return;
        }

        // Load saved credentials into form (if any) - use the secure storage
        const savedRollNo = await AsyncStorage.getItem('nimora_rollno');
        const savedPassword = await AsyncStorage.getItem('nimora_auth');

        if (savedRollNo) {
          setRollNo(savedRollNo);
        }
        if (savedPassword) {
          setPassword(atob(savedPassword)); // Decode from base64
        }
      } catch (error) {
        console.error('Error checking existing session:', error);
      }
    };

    checkExistingSession();
  }, [router]);

  const handleLogin = async () => {
    setError('');
    setIsLoading(true);

    try {
      // Basic input validation
      if (!rollNo.trim() || !password.trim()) {
        setError('Please fill in all fields');
        setIsLoading(false);
        return;
      }

      // Call the login service (it handles its own validation and error throwing)
      await loginUser(rollNo.trim(), password);

      // Fetch and cache all data for offline use
      try {
        await fetchAndCacheAllData(rollNo.trim(), password);
      } catch (dataError) {
        console.warn('Failed to fetch initial data, but login successful:', dataError);
        // Don't block login if data fetch fails
      }

      // Initialize background refresh system
      try {
        await initializeBackgroundRefresh();
      } catch (refreshError) {
        console.warn('Failed to initialize background refresh:', refreshError);
        // Don't block login if background refresh fails
      }

      // Save credentials locally for future logins (both old and new format for compatibility)
      try {
        await AsyncStorage.setItem('saved_rollno', rollNo.trim());
        await AsyncStorage.setItem('saved_password', password);
        await AsyncStorage.setItem('session_timestamp', Date.now().toString());

        // Update session manager
        await sessionManager.login(rollNo.trim(), password);
      } catch (storageError) {
        console.error('Error saving credentials:', storageError);
        // Don't block login if storage fails
      }

      // Navigate directly to home page after successful login
      router.replace('/(tabs)');

    } catch (err: any) {
      console.error('Login error:', err);

      // Handle specific error messages from the service
      if (err.message) {
        // Check for specific error types and provide user-friendly messages
        if (err.message.includes('Invalid roll number') || err.message.includes('roll number format')) {
          setError('Please check your roll number and try again.');
        } else if (err.message.includes('Password must be') || err.message.includes('password')) {
          setError('Please check your password and try again.');
        } else if (err.message.includes('HTTP error') || err.message.includes('Failed to')) {
          setError('Login failed. Please check your roll number and password, then try again.');
        } else if (err.message.includes('Network') || err.message.includes('connection')) {
          setError('Network error. Please check your internet connection and try again.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Login failed. Please check your roll number and password, then try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar
        style="light"
        backgroundColor="#0f172a"
        translucent={true}
        hidden={true}
      />
      <Background
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Background Image */}
        <BackgroundImage
          source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBmthQzGCvaiD9b2_Evv3ffGwgO48Tmsz7ugSLIsvL9r3NBZUTV4qN615RiPaWay0VknPl_Q0gD3kQOxRU4vgLJFL-7i_tRS_QImCmCiWu-Q3uIikovSr1K2haRBTF1FinTNeHYmD8-di4Zi4-f3_anrM6wFTJZYkX_zxyBidpx9Q0isTNOsNpAr_o9x9yj-1O1kHKSPfLDvIkHAAVcSHfWcRvb2W0e6kEF5ucWpIVwGZXsDEzw991Q3XUjtEzNFB_9x72LYli-E4o' }}
          resizeMode="cover"
        >
          <Overlay />
        </BackgroundImage>

        {/* Full Screen Loading Overlay */}
        {isLoading && (
          <LoadingOverlay>
            <LoadingContainer>
              <ExpoLinearGradient
                colors={['rgba(15, 23, 42, 0.95)', 'rgba(30, 41, 59, 0.95)', 'rgba(51, 65, 85, 0.95)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ borderRadius: 20, padding: 32, alignItems: 'center' }}
              >
                <View style={{ marginBottom: 24 }}>
                  <ExpoLinearGradient
                    colors={['#3b82f6', '#1d4ed8', '#1e40af']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 32,
                      justifyContent: 'center',
                      alignItems: 'center',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 8 },
                      shadowOpacity: 0.3,
                      shadowRadius: 16,
                      elevation: 8,
                    }}
                  >
                    <Ionicons name="log-in" size={32} color="#ffffff" />
                  </ExpoLinearGradient>
                </View>

                <LoadingTitle>Logging you in...</LoadingTitle>
                <LoadingSubtitle>Please wait while we verify your credentials</LoadingSubtitle>

                <View style={{ marginTop: 32 }}>
                  <ActivityIndicator size="large" color="#3b82f6" />
                </View>
              </ExpoLinearGradient>
            </LoadingContainer>
          </LoadingOverlay>
        )}

        {/* Main Content */}
        <MainContent isKeyboardVisible={isKeyboardVisible}>
          <LoginCard>
            {/* Logo and Title */}
            <LogoContainer>
              <LogoWrapper>
                <LogoSVG />
              </LogoWrapper>
              <Title>Nimora</Title>
              <Subtitle>Track Your Attendance</Subtitle>
            </LogoContainer>

            {/* Login Form */}
            <FormContainer>
              {/* Roll Number Input */}
              <InputContainer>
                <InputLabel>Roll Number</InputLabel>
                <TextInputStyled
                  placeholder="Enter your roll number"
                  placeholderTextColor="#94a3b8"
                  value={rollNo}
                  onChangeText={setRollNo}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />
              </InputContainer>

              {/* Password Input */}
              <InputContainer>
                <InputLabel>Password</InputLabel>
                <PasswordContainer>
                  <PasswordInput
                    placeholder="Enter your password"
                    placeholderTextColor="#94a3b8"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                  />
                  <PasswordToggle
                    onPress={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off' : 'eye'}
                      size={20}
                      color="#94a3b8"
                    />
                  </PasswordToggle>
                </PasswordContainer>
              </InputContainer>

              {/* Security Notice */}
              <SecurityNotice>
                <SecurityIcon>🔒</SecurityIcon>
                <SecurityText>Password is encrypted</SecurityText>
              </SecurityNotice>

              {/* Error Message */}
              {error ? (
                <ErrorContainer>
                  <ErrorText>{error}</ErrorText>
                </ErrorContainer>
              ) : null}

              {/* Login Button */}
              <LoginButton
                onPress={handleLogin}
                disabled={isLoading}
                isLoading={isLoading}
              >
                {isLoading ? (
                  <LoginButtonContent>
                    <LoadingSpinner isLoading={isLoading} />
                    <LoginButtonText>Logging in...</LoginButtonText>
                  </LoginButtonContent>
                ) : (
                  <LoginButtonText>Login</LoginButtonText>
                )}
              </LoginButton>
            </FormContainer>
          </LoginCard>
        </MainContent>

        {/* Bottom Bar */}
        <BottomBar>
          <BottomBarContent>
            <CopyrightText>
              © 2025 Nimora. All rights reserved.
            </CopyrightText>
          </BottomBarContent>
        </BottomBar>
      </Background>
    </Container>
  );
}
