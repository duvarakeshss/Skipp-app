import React, { useState, useEffect } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import styled from 'styled-components/native';
import Svg, { Defs, LinearGradient, Stop, Circle, Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginUser } from '../utils/attendanceService';

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
  background-color: #2563eb;
  border-radius: 8px;
  padding: 14px;
  align-items: center;
  opacity: ${props => props.isLoading ? 0.7 : 1};
`;

const LoginButtonContent = styled.View`
  flex-direction: row;
  align-items: center;
`;

const LoadingSpinner = styled.View`
  width: 20px;
  height: 20px;
  border-width: 2px;
  border-color: white;
  border-top-color: transparent;
  border-radius: 10px;
  margin-right: 8px;
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

  // Load saved credentials on component mount
  useEffect(() => {
    const loadSavedCredentials = async () => {
      try {
        const savedRollNo = await AsyncStorage.getItem('saved_rollno');
        const savedPassword = await AsyncStorage.getItem('saved_password');

        if (savedRollNo) {
          setRollNo(savedRollNo);
        }
        if (savedPassword) {
          setPassword(savedPassword);
        }
      } catch (error) {
        console.error('Error loading saved credentials:', error);
      }
    };

    loadSavedCredentials();
  }, []);

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

      // Save credentials locally for future logins
      try {
        await AsyncStorage.setItem('saved_rollno', rollNo.trim());
        await AsyncStorage.setItem('saved_password', password);
      } catch (storageError) {
        console.error('Error saving credentials:', storageError);
        // Don't block login if storage fails
      }

      // Navigate directly to home page after successful login
      router.push('/(tabs)');

    } catch (err: any) {
      // Handle specific error messages from the service
      if (err.message) {
        setError(err.message);
      } else {
        setError('Login failed. Please check your credentials and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
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
                    <LoadingSpinner />
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
