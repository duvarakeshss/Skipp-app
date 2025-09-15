import React, { useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { getStoredCredentials, autoFeedback, getCachedOrFreshData } from '../../utils/attendanceService'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import LogoutModal from '../../components/LogoutModal'
import { sessionManager } from '../../utils/sessionManager'
import SettingsModal from '../../components/SettingsModal'
import ProfileMenu from '../../components/ProfileMenu'
import { notificationService } from '../../utils/notificationService'
import { StatusBar } from 'expo-status-bar'

export default function Feedback() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [userName, setUserName] = useState('')
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [logoutLoading, setLogoutLoading] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [examNotificationsEnabled, setExamNotificationsEnabled] = useState(true)
  const [refreshLoading, setRefreshLoading] = useState(false)

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
        return
      }

      // Get user name for display
      try {
        const greeting = await getCachedOrFreshData('greeting', credentials.rollNo, credentials.password);
        const name = (greeting.split(',')[1]?.trim() || greeting.split(' ')[1] || 'User').replace('!', '');
        setUserName(name);
      } catch (nameError) {
        console.error('Error fetching user name:', nameError);
        setUserName('User');
      }

      // Load notification preferences
      try {
        const notificationsPref = await notificationService.getNotificationsEnabled()
        const examNotificationsPref = await notificationService.getExamNotificationsEnabled()
        setNotificationsEnabled(notificationsPref)
        setExamNotificationsEnabled(examNotificationsPref)
      } catch (error) {
        console.error('Error loading notification preferences:', error)
      }
    }

    checkCredentials()
  }, [router])

  const handleLogout = () => {
    setShowLogoutModal(true)
  }

  const handleLogoutConfirm = async () => {
    setLogoutLoading(true)
    try {
      await sessionManager.logout()
      router.replace('/login')
    } catch (error) {
      console.error('Error during logout:', error)
      setLogoutLoading(false)
      setShowLogoutModal(false)
    }
  }

  const handleLogoutCancel = () => {
    setShowLogoutModal(false)
  }

  const handleProfileMenuClose = () => {
    setShowProfileMenu(false)
  }

  const handleSettingsPress = () => {
    setShowSettingsModal(true)
  }

  const handleSettingsClose = () => {
    setShowSettingsModal(false)
  }

  const handleLogoutFromMenu = () => {
    handleLogout()
  }

  const toggleNotifications = async () => {
    const newState = !notificationsEnabled
    setNotificationsEnabled(newState)
    await notificationService.setNotificationsEnabled(newState)
  }

  const toggleExamNotifications = async () => {
    const newState = !examNotificationsEnabled
    setExamNotificationsEnabled(newState)
    await notificationService.setExamNotificationsEnabled(newState)
  }

  const handleRefresh = async () => {
    try {
      setRefreshLoading(true)

      // Get credentials from storage
      const credentials = await getStoredCredentials()
      if (!credentials) {
        Alert.alert('Error', 'No credentials found. Please log in again.')
        return
      }

      // Clear cache for greeting data to force fresh data
      setLoading(true)
      setError('')

      // Get fresh greeting data for user name
      try {
        const greeting = await getCachedOrFreshData('greeting', credentials.rollNo, credentials.password);
        const name = (greeting.split(',')[1]?.trim() || greeting.split(' ')[1] || 'User').replace('!', '');
        setUserName(name);
      } catch (nameError) {
        console.error('Error fetching user name:', nameError);
        setUserName('User');
      }

      // Since feedback.tsx mainly deals with feedback automation and doesn't load much cached data,
      // we'll just refresh the greeting/user info
      Alert.alert('Success', 'User information refreshed successfully')
    } catch (err: any) {
      console.error('Error refreshing data:', err)
      setError(err.message || 'Failed to refresh data')
      Alert.alert('Error', err.message || 'Failed to refresh data')
    } finally {
      setRefreshLoading(false)
      setLoading(false)
    }
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
      <StatusBar style="light" hidden={true} />
      {/* Top Bar */}
      <View style={styles.topBar}>
        <View style={styles.topBarContent}>
          <View style={styles.spacer} />
          <View style={styles.profileSection}>
            <Text style={styles.topBarTitle}>{userName || 'User'}</Text>
            <TouchableOpacity
              style={styles.profileIconButton}
              onPress={() => setShowProfileMenu(true)}
            >
              <View style={styles.profileIcon}>
                <Ionicons name="person-circle" size={40} color="#ffffff" />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollContainer}>
        {/* Welcome Section */}
        <LinearGradient
          colors={['#1e3a8a', '#3b82f6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.welcomeSection}
        >
          <View style={styles.welcomeContent}>
            <View style={styles.welcomeIcon}>
              <Ionicons name="chatbubble-ellipses" size={32} color="#ffffff" />
            </View>
            <Text style={styles.welcomeTitle}>Feedback Automation</Text>
            <Text style={styles.welcomeSubtitle}>
              Automate your course feedback with just one tap
            </Text>
          </View>
        </LinearGradient>

        {loading && (
          <View style={styles.loadingCard}>
            <View style={styles.loadingAnimation}>
              <ActivityIndicator size="large" color="#2563eb" />
              <View style={styles.loadingBar}>
                <LinearGradient
                  colors={['#3b82f6', '#2563eb', '#1d4ed8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.loadingProgress}
                />
              </View>
            </View>
            <Text style={styles.loadingText}>Processing your feedback automation...</Text>
            <Text style={styles.loadingSubtext}>This may take a few moments</Text>
          </View>
        )}

        {message && (
          <View style={styles.messageCard}>
            <LinearGradient
              colors={['#dcfce7', '#bbf7d0']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.messageGradient}
            >
              <View style={styles.messageIcon}>
                <Ionicons name="checkmark-circle" size={28} color="#16a34a" />
              </View>
              <View style={styles.messageContent}>
                <Text style={styles.messageTitle}>Success!</Text>
                <Text style={styles.messageText}>{message}</Text>
              </View>
            </LinearGradient>
          </View>
        )}

        {error && (
          <View style={styles.errorCard}>
            <LinearGradient
              colors={['#fef2f2', '#fee2e2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.errorGradient}
            >
              <View style={styles.errorIcon}>
                <Ionicons name="alert-circle" size={28} color="#dc2626" />
              </View>
              <View style={styles.errorContent}>
                <Text style={styles.errorTitle}>Error Occurred</Text>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            </LinearGradient>
          </View>
        )}

        <View style={styles.feedbackGrid}>
          <TouchableOpacity
            style={styles.feedbackCard}
            onPress={() => handleAutoFeedback(0)}
            disabled={loading}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#dbeafe', '#bfdbfe', '#93c5fd']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.feedbackCardGradient}
            >
              <View style={styles.feedbackIconContainer}>
                <View style={styles.feedbackIcon}>
                  <Ionicons name="document-text" size={32} color="#1e40af" />
                </View>
                <View style={styles.feedbackBadge}>
                  <Text style={styles.feedbackBadgeText}>Final</Text>
                </View>
              </View>
              <Text style={styles.feedbackTitle}>End Semester Feedback</Text>
              <Text style={styles.feedbackDescription}>
                Complete all end-of-semester feedback forms automatically with optimal ratings
              </Text>
              <View style={styles.feedbackStats}>
                <View style={styles.statItem}>
                  <Ionicons name="time-outline" size={16} color="#6b7280" />
                  <Text style={styles.statText}>~2-3 minutes</Text>
                </View>
                <View style={styles.statItem}>
                  <Ionicons name="checkmark-circle-outline" size={16} color="#6b7280" />
                  <Text style={styles.statText}>All courses</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.feedbackButton, loading && styles.feedbackButtonDisabled]}
                onPress={() => handleAutoFeedback(0)}
                disabled={loading}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={loading ? ['#9ca3af', '#6b7280'] : ['#2563eb', '#1d4ed8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.buttonGradient}
                >
                  <Text style={[styles.feedbackButtonText, loading && styles.feedbackButtonTextDisabled]}>
                    {loading ? 'Processing...' : 'Start Automation'}
                  </Text>
                  {!loading && <Ionicons name="arrow-forward" size={18} color="#ffffff" />}
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.feedbackCard}
            onPress={() => handleAutoFeedback(1)}
            disabled={loading}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#dcfce7', '#bbf7d0', '#86efac']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.feedbackCardGradient}
            >
              <View style={styles.feedbackIconContainer}>
                <View style={styles.feedbackIcon}>
                  <Ionicons name="calendar" size={32} color="#166534" />
                </View>
                <View style={styles.feedbackBadge}>
                  <Text style={styles.feedbackBadgeText}>Mid-term</Text>
                </View>
              </View>
              <Text style={styles.feedbackTitle}>Intermediate Feedback</Text>
              <Text style={styles.feedbackDescription}>
                Complete all mid-semester feedback forms automatically with optimal ratings
              </Text>
              <View style={styles.feedbackStats}>
                <View style={styles.statItem}>
                  <Ionicons name="time-outline" size={16} color="#6b7280" />
                  <Text style={styles.statText}>~1-2 minutes</Text>
                </View>
                <View style={styles.statItem}>
                  <Ionicons name="checkmark-circle-outline" size={16} color="#6b7280" />
                  <Text style={styles.statText}>All courses</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.feedbackButton, loading && styles.feedbackButtonDisabled]}
                onPress={() => handleAutoFeedback(1)}
                disabled={loading}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={loading ? ['#9ca3af', '#6b7280'] : ['#16a34a', '#15803d']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.buttonGradient}
                >
                  <Text style={[styles.feedbackButtonText, loading && styles.feedbackButtonTextDisabled]}>
                    {loading ? 'Processing...' : 'Start Automation'}
                  </Text>
                  {!loading && <Ionicons name="arrow-forward" size={18} color="#ffffff" />}
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.infoSection}>
          <LinearGradient
            colors={['#fef3c7', '#fde68a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.infoCard}
          >
            <View style={styles.infoHeader}>
              <View style={styles.infoIcon}>
                <Ionicons name="information-circle" size={24} color="#d97706" />
              </View>
              <Text style={styles.infoTitle}>How It Works</Text>
            </View>
            <View style={styles.infoSteps}>
              <View style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <Text style={styles.stepText}>Click on the feedback type you want to automate</Text>
              </View>
              <View style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <Text style={styles.stepText}>The system processes all your enrolled courses</Text>
              </View>
              <View style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <Text style={styles.stepText}>Optimal ratings are automatically selected for all questions</Text>
              </View>
            </View>
          </LinearGradient>

          <View style={styles.notesCard}>
            <View style={styles.notesHeader}>
              <View style={styles.notesIcon}>
                <Ionicons name="shield-checkmark" size={20} color="#059669" />
              </View>
              <Text style={styles.notesTitle}>Important Notes</Text>
            </View>
            <View style={styles.notesList}>
              <View style={styles.noteItem}>
                <Ionicons name="checkmark-circle" size={16} color="#059669" />
                <Text style={styles.noteText}>Automation runs securely on the server</Text>
              </View>
              <View style={styles.noteItem}>
                <Ionicons name="checkmark-circle" size={16} color="#059669" />
                <Text style={styles.noteText}>All feedback forms are completed with highest ratings</Text>
              </View>
              <View style={styles.noteItem}>
                <Ionicons name="checkmark-circle" size={16} color="#059669" />
                <Text style={styles.noteText}>Process is completely automated - no manual intervention needed</Text>
              </View>
              <View style={styles.noteItem}>
                <Ionicons name="checkmark-circle" size={16} color="#059669" />
                <Text style={styles.noteText}>You can verify completion in your student portal</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      <LogoutModal
        visible={showLogoutModal}
        onCancel={handleLogoutCancel}
        onConfirm={handleLogoutConfirm}
        loading={logoutLoading}
      />

      {/* Profile Menu */}
      <ProfileMenu
        visible={showProfileMenu}
        onClose={handleProfileMenuClose}
        onSettings={handleSettingsPress}
        onLogout={handleLogoutFromMenu}
      />

      {/* Settings Modal */}
      <SettingsModal
        visible={showSettingsModal}
        onClose={handleSettingsClose}
        notificationsEnabled={notificationsEnabled}
        examNotificationsEnabled={examNotificationsEnabled}
        onToggleNotifications={toggleNotifications}
        onToggleExamNotifications={toggleExamNotifications}
        onRefreshData={handleRefresh}
        isRefreshingData={refreshLoading}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  topBar: {
    backgroundColor: '#0f172a',
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#1e40af',
  },
  topBarContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  spacer: {
    flex: 1,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  profileIcon: {
    marginLeft: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  profileIconButton: {
    padding: 4,
    borderRadius: 16,
  },
  topBarTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    flex: 1,
    marginTop: 2,
  },
  scrollContainer: {
    flex: 1,
  },
  welcomeSection: {
    margin: 16,
    marginBottom: 8,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  welcomeContent: {
    padding: 24,
    alignItems: 'center',
  },
  welcomeIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 22,
  },
  loadingCard: {
    backgroundColor: '#ffffff',
    margin: 16,
    marginBottom: 8,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    alignItems: 'center',
  },
  loadingAnimation: {
    alignItems: 'center',
    marginBottom: 16,
  },
  loadingBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    marginTop: 16,
    overflow: 'hidden',
  },
  loadingProgress: {
    height: '100%',
    borderRadius: 3,
  },
  loadingText: {
    fontSize: 18,
    color: '#2563eb',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 4,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  messageCard: {
    backgroundColor: '#ffffff',
    margin: 16,
    marginBottom: 8,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  messageGradient: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  messageIcon: {
    marginRight: 16,
  },
  messageContent: {
    flex: 1,
  },
  messageTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#16a34a',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    color: '#166534',
    lineHeight: 22,
  },
  errorCard: {
    backgroundColor: '#ffffff',
    margin: 16,
    marginBottom: 8,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  errorGradient: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorIcon: {
    marginRight: 16,
  },
  errorContent: {
    flex: 1,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#dc2626',
    marginBottom: 4,
  },
  errorText: {
    fontSize: 16,
    color: '#991b1b',
    lineHeight: 22,
  },
  feedbackGrid: {
    padding: 16,
    paddingTop: 0,
  },
  feedbackCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  feedbackCardGradient: {
    padding: 24,
    alignItems: 'center',
  },
  feedbackIconContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  feedbackIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  feedbackBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#dc2626',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  feedbackBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  feedbackTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  feedbackDescription: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  feedbackStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  statText: {
    fontSize: 12,
    color: '#374151',
    marginLeft: 6,
    fontWeight: '500',
  },
  feedbackButton: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  feedbackButtonDisabled: {
    opacity: 0.6,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  feedbackButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  feedbackButtonTextDisabled: {
    color: '#d1d5db',
  },
  infoSection: {
    padding: 16,
    paddingTop: 0,
  },
  infoCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoIcon: {
    marginRight: 12,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#92400e',
  },
  infoSteps: {
    paddingLeft: 8,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#d97706',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  stepText: {
    fontSize: 15,
    color: '#78350f',
    lineHeight: 22,
    flex: 1,
  },
  notesCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  notesIcon: {
    marginRight: 12,
  },
  notesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#059669',
  },
  notesList: {
    paddingLeft: 4,
  },
  noteItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  noteText: {
    fontSize: 15,
    color: '#065f46',
    lineHeight: 22,
    marginLeft: 12,
    flex: 1,
  },
})
