import React, { useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { getStoredCredentials, clearCredentials, getCachedOrFreshData } from '../../utils/attendanceService'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
  StatusBar
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { notificationService } from '../../utils/notificationService'
import ProfileMenu from '../../components/ProfileMenu'
import SettingsModal from '../../components/SettingsModal'

const InternalCard = ({ course, marks, index }: { course: string; marks: string[]; index: number }) => {
  // Extract course code from the course string and course name and marks from assessments array
  const processCourseData = (courseString: string, marksArray: string[]) => {
    // Course code is from the course string (before the dash)
    let courseCode = courseString.split(' - ')[0] || courseString

    // Course name is the first element in marks array
    let courseName = marksArray[0] || ''

    // Remove unwanted course shortforms
    const unwantedPatterns = ['BDAMD', 'JP', 'BTECH', 'CSE', 'ECE', 'EEE', 'MECH', 'CIVIL']

    // Clean course code - remove unwanted patterns
    unwantedPatterns.forEach(pattern => {
      courseCode = courseCode.replace(new RegExp(pattern, 'gi'), '').trim()
    })

    // Clean course name - remove unwanted patterns
    if (courseName) {
      unwantedPatterns.forEach(pattern => {
        courseName = courseName.replace(new RegExp(pattern, 'gi'), '').trim()
      })
    }

    // Clean up extra spaces and dashes
    courseCode = courseCode.replace(/\s+/g, ' ').replace(/^[-\s]+|[-\s]+$/g, '').trim()
    courseName = courseName.replace(/\s+/g, ' ').replace(/^[-\s]+|[-\s]+$/g, '').trim()

    // Extract marks: Test1 (index 1), Test2 (index 2), Final/50 (index 6), Final/40 (last element)
    const test1 = marksArray[1] || ''
    const test2 = marksArray[2] || ''
    const final50 = marksArray[6] || '' // 7th element (index 6)
    const final40 = marksArray[marksArray.length - 1] || '' // Last element

    // Create actual marks array for calculations
    const actualMarks = [test1, test2, final50, final40].filter(mark => mark && mark !== '*' && mark !== ' ')

    return { courseCode, courseName, test1, test2, final50, final40, actualMarks }
  }

  const { courseCode, courseName, test1, test2, final50, final40 } = processCourseData(course, marks)

  return (
    <View style={styles.internalCard}>
      <View style={styles.internalCardHeader}>
        <View style={styles.headerContent}>
          <View style={styles.courseInfo}>
            <Text style={styles.internalCourseCode}>{courseCode || 'N/A'}</Text>
            <Text style={styles.internalCourseName}>{courseName || 'Course Name Not Available'}</Text>
          </View>
          <View style={styles.headerAccent} />
        </View>
      </View>

      <View style={styles.internalCardContent}>
        <View style={styles.marksGrid}>
          <View style={[styles.markBox, styles.test1Box]}>
            <Text style={styles.markLabel}>Test 1</Text>
            <Text style={[styles.markValue, styles.test1Value]}>
              {test1 && test1 !== '*' && test1 !== ' ' ? test1 : '-'}
            </Text>
          </View>

          <View style={[styles.markBox, styles.test2Box]}>
            <Text style={styles.markLabel}>Test 2</Text>
            <Text style={[styles.markValue, styles.test2Value]}>
              {test2 && test2 !== '*' && test2 !== ' ' ? test2 : '-'}
            </Text>
          </View>

          <View style={[styles.markBox, styles.final50Box]}>
            <Text style={styles.markLabel}>Final /50</Text>
            <Text style={[styles.markValue, styles.final50Value]}>
              {final50 && final50 !== '*' && final50 !== ' ' ? final50 : '-'}
            </Text>
          </View>

          <View style={[styles.markBox, styles.final40Box]}>
            <Text style={styles.markLabel}>Final /40</Text>
            <Text style={[styles.markValue, styles.final40Value]}>
              {final40 && final40 !== '*' && final40 !== ' ' ? final40 : '-'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}

const Internals = () => {
  const router = useRouter()
  const [internalsData, setInternalsData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userName, setUserName] = useState('')
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [examNotificationsEnabled, setExamNotificationsEnabled] = useState(true)
  const [refreshLoading, setRefreshLoading] = useState(false)

  useEffect(() => {
    const fetchInternalsData = async () => {
      const credentials = await getStoredCredentials()
      if (!credentials) {
        Alert.alert(
          'Login Required',
          'Please log in to access internal marks.',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/login')
            }
          ]
        )
        setLoading(false)
        return
      }

      try {
        // Get user name for display
        const greeting = await getCachedOrFreshData('greeting', credentials.rollNo, credentials.password)
        const name = (greeting.split(',')[1]?.trim() || greeting.split(' ')[1] || 'User').replace('!', '')
        setUserName(name)

        // Fetch internals data
        const internals = await getCachedOrFreshData('internals', credentials.rollNo, credentials.password)
        setInternalsData(internals || [])

        // Load notification preferences
        const notificationsPref = await notificationService.getNotificationsEnabled()
        const examNotificationsPref = await notificationService.getExamNotificationsEnabled()
        setNotificationsEnabled(notificationsPref)
        setExamNotificationsEnabled(examNotificationsPref)

        setLoading(false)
      } catch (error) {
        console.error('Error fetching internals data:', error)
        setError('Failed to load internal marks data')
        setLoading(false)
      }
    }

    fetchInternalsData()
  }, [router])

  // Process internals data to extract course and marks information
  const processedData = internalsData && Array.isArray(internalsData) && internalsData.length > 0
    ? internalsData.map(record => {
        const courseName = record[0] || "Unknown Course"
        const marks = record.slice(1, -1).filter((mark: any) => mark !== undefined) // Remove last element and undefined values
        return { course: courseName, marks }
      })
    : []

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

      // Clear cache for internals data to force fresh data
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

      // Get fresh internals data
      const internals = await getCachedOrFreshData('internals', credentials.rollNo, credentials.password);

      if (internals && internals.length > 0) {
        setInternalsData(internals);
      } else {
        setInternalsData([]);
        setError('No internals data found');
      }
    } catch (err: any) {
      console.error('Error refreshing internals data:', err)
      setError(err.message || 'Failed to refresh internals data')
      Alert.alert('Error', err.message || 'Failed to refresh internals data')
    } finally {
      setRefreshLoading(false)
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
          <View style={styles.spacer} />
          <View style={styles.profileSection}>
            <Text style={styles.topBarName}>{userName || 'User'}</Text>
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
              <Text style={styles.loadingText}>Loading internal marks...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={64} color="#ef4444" />
              <Text style={styles.errorTitle}>No Internal Marks Data Available</Text>
              <Text style={styles.errorMessage}>
                Your internal assessment data will appear here once it&apos;s published by your institution.
              </Text>
            </View>
          ) : (
            <View>
              <View style={styles.infoContainer}>
                <Text style={styles.infoText}>
                  Your internal assessment marks are listed below. Each course shows individual test scores and final assessments.
                </Text>
              </View>

              <View style={styles.cardsContainer}>
                {processedData.map((item, index) => (
                  <InternalCard key={index} course={item.course} marks={item.marks} index={index} />
                ))}
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
    backgroundColor: '#000000',
    paddingTop: 16,
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
  topBarName: {
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  infoContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  infoText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 16,
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  legendItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '500',
  },
  cardsContainer: {
    gap: 16,
  },
  internalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  internalCardHeader: {
    backgroundColor: '#6366f1',
    borderBottomWidth: 1,
    borderBottomColor: '#4f46e5',
    padding: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  courseInfo: {
    flex: 1,
  },
  headerAccent: {
    width: 4,
    height: 40,
    backgroundColor: '#a78bfa',
    borderRadius: 2,
  },
  internalCourseCode: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  internalCourseName: {
    fontSize: 14,
    color: '#e0e7ff',
    fontWeight: '500',
    lineHeight: 20,
  },
  internalCardContent: {
    padding: 16,
  },
  marksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  markBox: {
    width: '48%', // Fixed width for 2 boxes per row
    backgroundColor: '#f8fafc',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 12,
  },
  markLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  markValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'center',
  },
  test1Box: {
    backgroundColor: '#fef3c7',
    borderColor: '#fbbf24',
  },
  test2Box: {
    backgroundColor: '#dbeafe',
    borderColor: '#3b82f6',
  },
  final50Box: {
    backgroundColor: '#dcfce7',
    borderColor: '#10b981',
  },
  final40Box: {
    backgroundColor: '#f3e8ff',
    borderColor: '#8b5cf6',
  },
  test1Value: {
    color: '#92400e',
  },
  test2Value: {
    color: '#1e40af',
  },
  final50Value: {
    color: '#047857',
  },
  final40Value: {
    color: '#6b21a8',
  },
  internalCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  totalMarksText: {
    fontSize: 14,
    color: '#6b7280',
  },
  totalMarksValue: {
    fontWeight: '600',
    color: '#374151',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
})

export default Internals