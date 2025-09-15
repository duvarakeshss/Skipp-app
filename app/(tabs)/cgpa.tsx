import React, { useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { getStoredCredentials, clearCredentials, getCachedOrFreshData } from '../../utils/attendanceService'
import { sessionManager } from '../../utils/sessionManager'
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
import AsyncStorage from '@react-native-async-storage/async-storage'
import { notificationService } from '../../utils/notificationService'
import ProfileMenu from '../../components/ProfileMenu'
import SettingsModal from '../../components/SettingsModal'
import { StatusBar } from 'expo-status-bar'

interface SemesterData {
  SEMESTER: string
  GPA: string
  CGPA: string
  CREDITS?: string
}

const SemesterCard = ({ semester, gpa, cgpa, credits }: { semester: string; gpa: string; cgpa: string; credits?: string }) => {
  const getGpaColor = (gpa: string) => {
    if (gpa === "-" || gpa === "N/A") return '#6b7280'
    const numGpa = parseFloat(gpa)
    if (numGpa >= 9) return '#16a34a'
    if (numGpa >= 8) return '#15803d'
    if (numGpa >= 7) return '#2563eb'
    if (numGpa >= 6) return '#d97706'
    return '#dc2626'
  }

  const getCgpaColor = (cgpa: string) => {
    if (cgpa === "-" || cgpa === "N/A") return '#6b7280'
    const numCgpa = parseFloat(cgpa)
    if (numCgpa >= 9) return '#16a34a'
    if (numCgpa >= 8) return '#15803d'
    if (numCgpa >= 7) return '#2563eb'
    if (numCgpa >= 6) return '#d97706'
    return '#dc2626'
  }

  return (
    <View style={styles.semesterCard}>
      <View style={styles.semesterCardHeader}>
        <Text style={styles.semesterTitle}>Semester {semester}</Text>
      </View>

      <View style={styles.semesterCardContent}>
        <View style={[styles.gradeSection, styles.gpaSection]}>
          <View style={styles.gradeContent}>
            <Text style={[styles.gradeLabel, styles.gpaLabel]}>GPA</Text>
            <Text style={[styles.gradeValue, { color: getGpaColor(gpa) }]}>
              {gpa !== "-" ? gpa : "N/A"}
            </Text>
          </View>
          {credits && credits !== "-" && (
            <Text style={[styles.creditsText, styles.gpaCredits]}>{credits} Credits</Text>
          )}
        </View>

        <View style={[styles.gradeSection, styles.cgpaSection]}>
          <View style={styles.gradeContent}>
            <Text style={[styles.gradeLabel, styles.cgpaLabel]}>CGPA</Text>
            <Text style={[styles.gradeValue, { color: getCgpaColor(cgpa) }]}>
              {cgpa !== "-" ? cgpa : "N/A"}
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}

const Cgpa = () => {
  const router = useRouter()
  const [cgpaData, setCgpaData] = useState<SemesterData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userName, setUserName] = useState('')
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [examNotificationsEnabled, setExamNotificationsEnabled] = useState(true)
  const [refreshLoading, setRefreshLoading] = useState(false)

  useEffect(() => {
    const fetchCgpaData = async () => {
      const credentials = await getStoredCredentials()
      if (!credentials) {
        Alert.alert(
          'Login Required',
          'Please log in to access CGPA data.',
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
        const greeting = await getCachedOrFreshData('greeting', credentials.rollNo, credentials.password)
        const name = (greeting.split(',')[1]?.trim() || greeting.split(' ')[1] || 'User').replace('!', '')
        setUserName(name)
      } catch (nameError) {
        console.error('Error fetching user name:', nameError)
        setUserName('User')
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

      // Fetch CGPA data
      try {
        setLoading(true)
        const data = await getCachedOrFreshData('cgpa', credentials.rollNo, credentials.password)
        if (data && Array.isArray(data)) {
          setCgpaData(data)
        } else {
          setCgpaData([])
        }
      } catch (fetchError) {
        console.error('Error fetching CGPA data:', fetchError)
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to fetch CGPA data')
      } finally {
        setLoading(false)
      }
    }

    fetchCgpaData()
  }, [router])

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
            try {
              await sessionManager.logout()
              router.replace('/login')
            } catch (error) {
              console.error('Logout error:', error)
              // Fallback to manual cleanup if sessionManager fails
              await clearCredentials()
              try {
                await AsyncStorage.removeItem('saved_rollno')
                await AsyncStorage.removeItem('saved_password')
              } catch (storageError) {
                console.error('Error clearing saved credentials:', storageError)
              }
              router.replace('/login')
            }
          }
        }
      ]
    )
  }

  const handleProfileMenuClose = () => {
    setShowProfileMenu(false)
  }

  const handleSettingsOpen = () => {
    setShowSettingsModal(true)
  }

  const handleSettingsClose = () => {
    setShowSettingsModal(false)
  }

  const handleLogoutFromMenu = () => {
    handleLogout()
  }

  const handleToggleNotifications = async () => {
    const newState = !notificationsEnabled
    setNotificationsEnabled(newState)
    await notificationService.setNotificationsEnabled(newState)
  }

  const handleToggleExamNotifications = async () => {
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

      // Clear cache for CGPA data to force fresh data
      setLoading(true)
      setError(null)

      // Get user name for display
      try {
        const greeting = await getCachedOrFreshData('greeting', credentials.rollNo, credentials.password);
        const name = (greeting.split(',')[1]?.trim() || greeting.split(' ')[1] || 'User').replace('!', '');
        setUserName(name);
      } catch (nameError) {
        console.error('Error fetching user name:', nameError);
        setUserName('User');
      }

      // Get fresh CGPA data
      const data = await getCachedOrFreshData('cgpa', credentials.rollNo, credentials.password);

      if (data && data.length > 0) {
        setCgpaData(data);
      } else {
        setCgpaData([]);
        setError('No CGPA data found');
      }
    } catch (err: any) {
      console.error('Error refreshing CGPA data:', err)
      setError(err.message || 'Failed to refresh CGPA data')
      Alert.alert('Error', err.message || 'Failed to refresh CGPA data')
    } finally {
      setRefreshLoading(false)
      setLoading(false)
    }
  }

  // Get the latest CGPA info if available
  const latestCgpaData = cgpaData.length > 0 ?
    cgpaData.filter(sem => sem.CGPA !== "-").slice(-1)[0] : null

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
        <View style={styles.content}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3b82f6" />
              <Text style={styles.loadingText}>Loading CGPA data...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorTitle}>No CGPA Data Available</Text>
              <Text style={styles.errorMessage}>
                Your CGPA data will appear here once it&apos;s published by your institution.
              </Text>
            </View>
          ) : (
            <View style={styles.mainContent}>
              {latestCgpaData && (
                <View style={styles.currentCgpaCard}>
                  <View style={styles.currentCgpaHeader}>
                    <Text style={styles.currentCgpaLabel}>Current CGPA</Text>
                    <Text style={styles.currentCgpaValue}>{latestCgpaData.CGPA}</Text>
                  </View>
                  <View style={styles.currentCgpaDetails}>
                    <Text style={styles.latestSemesterText}>Latest Semester</Text>
                    <Text style={styles.semesterNumber}>Semester {latestCgpaData.SEMESTER}</Text>
                  </View>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${(parseFloat(latestCgpaData.CGPA) / 10) * 100}%` }
                      ]}
                    />
                  </View>
                </View>
              )}

              <View style={styles.semesterHistoryHeader}>
                <Text style={styles.semesterHistoryTitle}>Semester History</Text>
                <View style={styles.semesterCountContainer}>
                  <Text style={styles.semesterCountLabel}>Total Semesters:</Text>
                  <Text style={styles.semesterCountValue}>{cgpaData.length}</Text>
                </View>
              </View>

              <View style={styles.semesterGrid}>
                {cgpaData.length > 0 ? (
                  <>
                    {cgpaData.filter(semester =>
                      semester.GPA !== "-" ||
                      semester.CGPA !== "-" ||
                      (semester.CREDITS && semester.CREDITS !== "-")
                    ).map((semester, index) => (
                      <SemesterCard
                        key={index}
                        semester={semester.SEMESTER}
                        gpa={semester.GPA}
                        cgpa={semester.CGPA}
                        credits={semester.CREDITS}
                      />
                    ))}

                    {cgpaData.filter(semester =>
                      semester.GPA !== "-" ||
                      semester.CGPA !== "-" ||
                      (semester.CREDITS && semester.CREDITS !== "-")
                    ).length === 0 && (
                      <View style={styles.emptyState}>
                        <Text style={styles.emptyStateTitle}>No Semester Data Yet</Text>
                        <Text style={styles.emptyStateMessage}>
                          Your CGPA data will appear here once you have completed courses.
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateTitle}>No Semester Data Yet</Text>
                    <Text style={styles.emptyStateMessage}>
                      Your CGPA data will appear here once you have completed courses.
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Profile Menu */}
      <ProfileMenu
        visible={showProfileMenu}
        onClose={handleProfileMenuClose}
        onSettings={handleSettingsOpen}
        onLogout={handleLogoutFromMenu}
      />

      {/* Settings Modal */}
      <SettingsModal
        visible={showSettingsModal}
        onClose={handleSettingsClose}
        notificationsEnabled={notificationsEnabled}
        examNotificationsEnabled={examNotificationsEnabled}
        onToggleNotifications={handleToggleNotifications}
        onToggleExamNotifications={handleToggleExamNotifications}
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
    paddingTop: 16, // Reduced since status bar is hidden
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
    alignItems: 'center',
    justifyContent: 'space-between',
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
  content: {
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  mainContent: {
    flex: 1,
  },
  currentCgpaCard: {
    backgroundColor: '#1e40af',
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  currentCgpaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  currentCgpaLabel: {
    fontSize: 18,
    fontWeight: '500',
    color: '#ffffff',
    opacity: 0.9,
  },
  currentCgpaValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  currentCgpaDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  latestSemesterText: {
    fontSize: 14,
    color: '#ffffff',
    opacity: 0.9,
  },
  semesterNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 2,
  },
  semesterHistoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  semesterHistoryTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
  },
  semesterCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  semesterCountLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginRight: 4,
  },
  semesterCountValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e40af',
  },
  semesterGrid: {
    flex: 1,
  },
  semesterCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  semesterCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  semesterTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  semesterCardContent: {
    flex: 1,
  },
  gradeSection: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  gradeContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gradeLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  gradeValue: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  creditsText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  gpaSection: {
    backgroundColor: '#dbeafe',
    borderWidth: 2,
    borderColor: '#2563eb',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  gpaLabel: {
    color: '#1e40af',
    fontWeight: '600',
  },
  gpaCredits: {
    color: '#1e40af',
    fontWeight: '600',
  },
  cgpaSection: {
    backgroundColor: '#f3e8ff',
    borderWidth: 2,
    borderColor: '#7c3aed',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cgpaLabel: {
    color: '#6b21a8',
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateMessage: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
})

export default Cgpa