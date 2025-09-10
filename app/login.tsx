import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const [rollNo, setRollNo] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    setError('');
    setIsLoading(true);

    try {
      // Validate inputs
      if (!rollNo || !password) {
        setError('Please fill in all fields');
        return;
      }

      // Basic validation
      if (rollNo.trim().length === 0) {
        setError('Please enter a valid roll number');
        return;
      }

      if (password.length < 6) {
        setError('Password must be at least 6 characters long');
        return;
      }

      // Simulate login process
      await new Promise(resolve => setTimeout(resolve, 1000));

      // For demo purposes, accept any valid input
      Alert.alert(
        'Login Successful',
        `Welcome, ${rollNo}!`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate to home/dashboard
              router.push('/(tabs)');
            }
          }
        ]
      );

    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        className="bg-slate-900"
        keyboardShouldPersistTaps="handled"
      >
        {/* Background Image */}
        <View className="absolute inset-0">
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=800' }}
            className="w-full h-full"
            resizeMode="cover"
          />
          <View className="absolute inset-0 bg-slate-900/85" />
        </View>

        {/* Main Content */}
        <View className="flex-1 justify-center px-8 pt-20">
          <View className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-slate-700/50">
            {/* Logo and Title */}
            <View className="items-center mb-8">
              <View className="w-16 h-16 bg-blue-600 rounded-full items-center justify-center mb-4">
                <Text className="text-white text-2xl font-bold">N</Text>
              </View>
              <Text className="text-4xl font-bold text-white mb-2">Nimora</Text>
              <Text className="text-lg text-slate-300">Track Your Attendance</Text>
            </View>

            {/* Login Form */}
            <View className="space-y-6">
              {/* Roll Number Input */}
              <View>
                <Text className="text-slate-300 mb-2 ml-1">Roll Number</Text>
                <View className="relative">
                  <TextInput
                    className="bg-slate-700 border-2 border-slate-600 rounded-lg px-4 py-3.5 text-white placeholder-slate-400"
                    placeholder="Enter your roll number"
                    placeholderTextColor="#94a3b8"
                    value={rollNo}
                    onChangeText={setRollNo}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                  />
                </View>
              </View>

              {/* Password Input */}
              <View>
                <Text className="text-slate-300 mb-2 ml-1">Password</Text>
                <View className="relative">
                  <TextInput
                    className="bg-slate-700 border-2 border-slate-600 rounded-lg px-4 py-3.5 text-white placeholder-slate-400 pr-12"
                    placeholder="Enter your password"
                    placeholderTextColor="#94a3b8"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                  />
                  <TouchableOpacity
                    className="absolute right-4 top-1/2 -translate-y-2"
                    onPress={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    <Text className="text-slate-400 text-lg">
                      {showPassword ? '🙈' : '👁️'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Security Notice */}
              <View className="flex-row items-center justify-center bg-blue-900/30 p-3 rounded-lg border border-blue-800/50">
                <Text className="text-blue-400 mr-2">🔒</Text>
                <Text className="text-slate-300 text-sm">Password is encrypted</Text>
              </View>

              {/* Error Message */}
              {error ? (
                <View className="bg-red-900/30 border border-red-800/50 rounded-lg p-3">
                  <Text className="text-red-400 text-center text-sm">{error}</Text>
                </View>
              ) : null}

              {/* Login Button */}
              <TouchableOpacity
                className={`bg-blue-600 rounded-lg py-3.5 items-center ${isLoading ? 'opacity-70' : 'active:bg-blue-700'}`}
                onPress={handleLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <View className="flex-row items-center">
                    <View className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    <Text className="text-white font-semibold text-base">Logging in...</Text>
                  </View>
                ) : (
                  <Text className="text-white font-semibold text-base">Login</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Bottom Bar */}
        <View className="bg-black/50 backdrop-blur-sm border-t border-slate-700/50">
          <View className="px-8 py-4">
            <Text className="text-center text-slate-400 text-sm">
              © 2025 Nimora. All rights reserved.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
