import React, { useState, useEffect } from 'react'
import { useRouter } from 'expo-router'
import { getStoredCredentials, clearCredentials, autoFeedback } from '../../utils/attendanceService'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  Platform,
  StatusBar
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { LinearGradient } from 'expo-linear-gradient'

const { width } = Dimensions.get('window')

export default function Feedback() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const checkCredentials = async () => {
      const credentials = await getStoredCredentials()
      if (!credentials) {
        Alert.alert(
          'Login Required',
          'Please log in to access feedback automation.',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/login')
            }
          ]
        )
      }
    }

    checkCredentials()
  }, [])

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await clearCredentials()
            // Clear saved login credentials
            try {
              await AsyncStorage.removeItem('saved_rollno')
              await AsyncStorage.removeItem('saved_password')
            } catch (storageError) {
              console.error('Error clearing saved credentials:', storageError)
            }
            router.replace('/login')
          }
        }
      ]
    )
  }

  const handleAutoFeedback = async (feedbackIndex: number) => {
    const credentials = await getStoredCredentials()
    if (!credentials) {
      setError('Login credentials not found. Please log in again.')
      return
    }

    setLoading(true)
    setMessage('')
    setError('')

    try {
      const response = await autoFeedback(credentials.rollNo, credentials.password, feedbackIndex)

      const feedbackType = feedbackIndex === 0 ? 'End Semester Feedback' : 'Intermediate Feedback'
      setMessage(response.message || `${feedbackType} automation completed successfully!`)
    } catch (err: any) {
      setError(err.message || 'An error occurred while starting the feedback automation')
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#000000"
        translucent={true}
        hidden={true}
      />

      {/* Top Bar */}
      <View style={styles.topBar}>
        <View style={styles.topBarContent}>
          <Text style={styles.topBarTitle}>Feedback Automation</Text>
          <TouchableOpacity
            style={styles.topBarLogoutButton}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollContainer}>
        {loading && (
          <View style={styles.loadingCard}>
            <View style={styles.loadingBar}>
              <LinearGradient
                colors={['#3b82f6', '#2563eb']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.loadingProgress}
              />
            </View>
            <Text style={styles.loadingText}>Processing your request...</Text>
          </View>
        )}

        {message && (
          <View style={styles.messageCard}>
            <View style={styles.messageIcon}>
              <Ionicons name="checkmark-circle" size={24} color="#16a34a" />
            </View>
            <Text style={styles.messageText}>{message}</Text>
          </View>
        )}

        {error && (
          <View style={styles.errorCard}>
            <View style={styles.errorIcon}>
              <Ionicons name="alert-circle" size={24} color="#dc2626" />
            </View>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.feedbackGrid}>
          <TouchableOpacity
            style={styles.feedbackCard}
            onPress={() => handleAutoFeedback(0)}
            disabled={loading}
          >
            <LinearGradient
              colors={['#dbeafe', '#bfdbfe']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.feedbackCardGradient}
            >
              <View style={styles.feedbackIcon}>
                <Ionicons name="document-text" size={28} color="#1e40af" />
              </View>
              <Text style={styles.feedbackTitle}>End Semester Feedback</Text>
              <Text style={styles.feedbackDescription}>
                Automate the end semester feedback forms for all courses.
              </Text>
              <TouchableOpacity
                style={[styles.feedbackButton, loading && styles.feedbackButtonDisabled]}
                onPress={() => handleAutoFeedback(0)}
                disabled={loading}
              >
                <Text style={[styles.feedbackButtonText, loading && styles.feedbackButtonTextDisabled]}>
                  {loading ? 'Processing...' : 'Start Automation'}
                </Text>
              </TouchableOpacity>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.feedbackCard}
            onPress={() => handleAutoFeedback(1)}
            disabled={loading}
          >
            <LinearGradient
              colors={['#dcfce7', '#bbf7d0']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.feedbackCardGradient}
            >
              <View style={styles.feedbackIcon}>
                <Ionicons name="calendar" size={28} color="#166534" />
              </View>
              <Text style={styles.feedbackTitle}>Intermediate Feedback</Text>
              <Text style={styles.feedbackDescription}>
                Automate the intermediate feedback forms for all courses.
              </Text>
              <TouchableOpacity
                style={[styles.feedbackButton, loading && styles.feedbackButtonDisabled]}
                onPress={() => handleAutoFeedback(1)}
                disabled={loading}
              >
                <Text style={[styles.feedbackButtonText, loading && styles.feedbackButtonTextDisabled]}>
                  {loading ? 'Processing...' : 'Start Automation'}
                </Text>
              </TouchableOpacity>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.notesCard}>
          <View style={styles.notesHeader}>
            <View style={styles.notesIcon}>
              <Ionicons name="information-circle" size={20} color="#d97706" />
            </View>
            <Text style={styles.notesTitle}>Important Notes:</Text>
          </View>
          <View style={styles.notesList}>
            <Text style={styles.noteItem}>• The automation process runs in the background on the server</Text>
            <Text style={styles.noteItem}>• Do not close this page until you receive a success message</Text>
            <Text style={styles.noteItem}>• This will select the highest ratings for all questions</Text>
            <Text style={styles.noteItem}>• You can verify the completed feedback in your student portal</Text>
            <Text style={styles.noteItem}>• If an error occurs, please try again or complete the feedback manually</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  topBar: {
    backgroundColor: '#000000',
    paddingTop: Platform.OS === 'ios' ? 20 : 16,
    paddingBottom: 16,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  topBarContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topBarTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    flex: 1,
  },
  topBarLogoutButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#555555',
  },
  scrollContainer: {
    flex: 1,
  },
  loadingCard: {
    backgroundColor: '#ffffff',
    margin: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loadingBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    marginBottom: 12,
    overflow: 'hidden',
  },
  loadingProgress: {
    height: '100%',
    borderRadius: 4,
  },
  loadingText: {
    fontSize: 16,
    color: '#2563eb',
    textAlign: 'center',
    fontWeight: '600',
  },
  messageCard: {
    backgroundColor: '#ffffff',
    margin: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  messageIcon: {
    marginRight: 12,
  },
  messageText: {
    fontSize: 16,
    color: '#16a34a',
    fontWeight: '600',
    flex: 1,
  },
  errorCard: {
    backgroundColor: '#ffffff',
    margin: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  errorIcon: {
    marginRight: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#dc2626',
    fontWeight: '600',
    flex: 1,
  },
  feedbackGrid: {
    padding: 16,
    paddingTop: 0,
  },
  feedbackCard: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  feedbackCardGradient: {
    padding: 20,
    alignItems: 'center',
  },
  feedbackIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  feedbackTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  feedbackDescription: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  feedbackButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  feedbackButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  feedbackButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  feedbackButtonTextDisabled: {
    color: '#d1d5db',
  },
  notesCard: {
    backgroundColor: '#ffffff',
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  notesIcon: {
    marginRight: 8,
  },
  notesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#d97706',
  },
  notesList: {
    paddingLeft: 4,
  },
  noteItem: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
    lineHeight: 20,
  },
})
