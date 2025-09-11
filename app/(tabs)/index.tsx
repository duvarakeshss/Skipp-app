import React, { useEffect, useState, useRef } from 'react'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { getStudentAttendance, greetUser, getStoredCredentials, clearCredentials } from '../../utils/attendanceService'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  Platform
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { LinearGradient } from 'expo-linear-gradient'

const { width } = Dimensions.get('window')

export default function Home() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const { rollNo, password } = params as { rollNo?: string; password?: string }
  const [loading, setLoading] = useState(true)
  const [greeting, setGreeting] = useState('')
  const [attendanceData, setAttendanceData] = useState<any[]>([])
  const [customPercentage, setCustomPercentage] = useState(80)
  const [combinedData, setCombinedData] = useState<any[]>([])
  const toastShownRef = useRef(false)

  useEffect(() => {
    const fetchData = async () => {
      let credentials = { rollNo: rollNo || '', password: password || '' }

      // If no credentials from params, try to get from storage
      if (!credentials.rollNo || !credentials.password) {
        const stored = await getStoredCredentials()
        if (stored) {
          credentials = stored
        }
      }

      if (!credentials.rollNo || !credentials.password) {
        Alert.alert(
          'Login Required',
          'Login credentials not found. Please log in again.',
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
        setLoading(true)

        // Get user greeting first to verify credentials
        const userGreeting = await greetUser(credentials.rollNo, credentials.password)
        setGreeting(userGreeting)

        // Only fetch attendance data if greeting was successful
        if (userGreeting) {
          const data = await getStudentAttendance(credentials.rollNo, credentials.password)
          setAttendanceData(data)

          // Calculate affordable leaves with default percentage
          calculateCombinedData(data, customPercentage)
        }
      } catch (err: any) {
        console.error('Error loading data:', err)

        Alert.alert(
          'Error',
          err.message || 'Failed to load data',
          [
            {
              text: 'Retry',
              onPress: () => fetchData()
            },
            {
              text: 'Login Again',
              onPress: () => router.replace('/login'),
              style: 'destructive'
            }
          ]
        )
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [rollNo, password])

  const calculateCombinedData = (data: any[], percentage: number) => {
    if (!data || data.length === 0) return

    const result = data.map(course => {
      const classesTotal = parseInt(course[1])
      const classesPresent = parseInt(course[4])
      const leaves = calculateIndividualLeaves(classesPresent, classesTotal, percentage)

      return {
        courseCode: course[0],
        totalClasses: course[1],
        present: course[4],
        absent: course[2],
        percentage: course[5],
        affordableLeaves: leaves
      }
    })

    setCombinedData(result)
  }

  const calculateIndividualLeaves = (classesPresent: number, classesTotal: number, maintenancePercentage: number) => {
    let affordableLeaves = 0
    let i = 1
    const MAX_ITERATIONS = 1000 // Safety limit to prevent infinite loops

    // Special case for 100% attendance target
    if (maintenancePercentage === 100) {
      if ((classesPresent / classesTotal) * 100 === 100) {
        return classesPresent === classesTotal ? 0 : 0
      } else {
        return -(classesTotal - classesPresent)
      }
    }

    if ((classesPresent / classesTotal) * 100 < maintenancePercentage) {
      let iterations = 0
      while (((classesPresent + i) / (classesTotal + i)) * 100 <= maintenancePercentage && iterations < MAX_ITERATIONS) {
        affordableLeaves -= 1
        i += 1
        iterations += 1
      }

      if (iterations >= MAX_ITERATIONS) {
        return Math.floor(-MAX_ITERATIONS / 10)
      }
    } else {
      let iterations = 0
      while ((classesPresent / (classesTotal + i)) * 100 >= maintenancePercentage && iterations < MAX_ITERATIONS) {
        affordableLeaves += 1
        i += 1
        iterations += 1
      }

      if (iterations >= MAX_ITERATIONS) {
        return Math.floor(MAX_ITERATIONS / 10)
      }
    }

    return affordableLeaves
  }

  const handlePercentageChange = (newPercentage: number) => {
    setCustomPercentage(newPercentage)
    calculateCombinedData(attendanceData, newPercentage)
  }

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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={['#1e3a8a', '#3b82f6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.loadingGradient}
        >
          <View style={styles.loadingContent}>
            <View style={styles.loadingIcon}>
              <Ionicons name="analytics" size={48} color="#ffffff" />
            </View>
            <Text style={styles.loadingTitle}>Loading Your Data</Text>
            <Text style={styles.loadingSubtitle}>Fetching your attendance information...</Text>

            <View style={styles.loadingAnimation}>
              <ActivityIndicator size="large" color="#ffffff" />
              <View style={styles.loadingBar}>
                <LinearGradient
                  colors={['#ffffff', '#e0e7ff', '#c7d2fe']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.loadingProgress}
                />
              </View>
            </View>

            <View style={styles.loadingSteps}>
              <View style={styles.stepItem}>
                <View style={styles.stepDot} />
                <Text style={styles.stepText}>Verifying credentials</Text>
              </View>
              <View style={styles.stepItem}>
                <View style={styles.stepDot} />
                <Text style={styles.stepText}>Fetching attendance data</Text>
              </View>
              <View style={styles.stepItem}>
                <View style={styles.stepDot} />
                <Text style={styles.stepText}>Calculating statistics</Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>
    )
  }

  return (
    <View style={styles.fullScreenContainer}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <View style={styles.topBarContent}>
          <Text style={styles.topBarName}>{(greeting.split(',')[1]?.trim() || greeting.split(' ')[1] || 'User').replace('!', '')}</Text>
          <TouchableOpacity
            style={styles.topBarLogoutButton}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollContainer}>
        {greeting && (
          <>
            {/* Greeting below topbar */}
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.greetingBelowBar}
            >
              <View style={styles.greetingContentNew}>
                <View style={styles.greetingIconContainer}>
                  <Ionicons
                    name={greeting.split(',')[0].includes('Morning') ? 'sunny' :
                          greeting.split(',')[0].includes('Afternoon') ? 'partly-sunny' : 'moon'}
                    size={24}
                    color="#ffffff"
                  />
                </View>
                <View style={styles.greetingTextSection}>
                  <Text style={styles.greetingBelowBarText}>{greeting.split(',')[0]}</Text>
          
                </View>
                <View style={styles.greetingDecoration}>
                  <Ionicons name="sparkles" size={16} color="#ffffff" />
                </View>
              </View>
            </LinearGradient>

            {/* Birthday Card - only show if it's birthday */}
            {greeting.includes("Birthday") && (
              <View style={styles.birthdayCard}>
                <Ionicons name="gift" size={24} color="#f59e0b" />
                <View style={styles.birthdayTextContainer}>
                  <Text style={styles.birthdayTitle}>Happy Birthday!</Text>
                  <Text style={styles.birthdayText}>Wishing you a fantastic day!</Text>
                </View>
                <Ionicons name="gift" size={24} color="#f59e0b" />
              </View>
            )}

          {/* Attendance Overview */}
          {combinedData.length > 0 && (
            <View style={styles.overviewCard}>
              <View style={styles.overviewHeader}>
                <View style={styles.overviewIconContainer}>
                  <Ionicons name="document-text" size={24} color="#ffffff" />
                </View>
                <Text style={styles.overviewTitle}>Attendance Overview</Text>
              </View>

              <View style={styles.percentageContainer}>
                <View style={styles.percentageHeader}>
                  <View style={styles.percentageIconContainer}>
                    <Text style={styles.percentageIcon}>%</Text>
                  </View>
                  <Text style={styles.percentageLabel}>Maintenance Target:</Text>
                  <View style={styles.percentageValueContainer}>
                    <Text style={styles.percentageValue}>{customPercentage}%</Text>
                  </View>
                </View>

                {/* Percentage Slider */}
                <View style={styles.sliderContainer}>
                  <View style={styles.sliderTrack}>
                    {[50, 60, 70, 80, 90, 100].map((value) => (
                      <TouchableOpacity
                        key={value}
                        style={styles.sliderTick}
                        onPress={() => handlePercentageChange(value)}
                      >
                        <View style={[
                          styles.sliderTickMark,
                          customPercentage === value && styles.sliderTickMarkActive
                        ]} />
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={styles.sliderLabels}>
                    <Text style={styles.sliderLabel}>50%</Text>
                    <Text style={styles.sliderLabel}>60%</Text>
                    <Text style={styles.sliderLabel}>70%</Text>
                    <Text style={styles.sliderLabel}>80%</Text>
                    <Text style={styles.sliderLabel}>90%</Text>
                    <Text style={styles.sliderLabel}>100%</Text>
                  </View>
                </View>
                <Text style={styles.sliderHint}>
                  Tap on the values above to adjust your attendance maintenance target.
                </Text>
              </View>
            </View>
          )}

          {/* Attendance Data */}
          {combinedData.length > 0 && (
            <View style={styles.dataCard}>
              {combinedData.map((course, index) => {
                const isLowAttendance = parseInt(course.percentage) < 75
                const canAffordLeaves = course.affordableLeaves >= 0

                return (
                  <View key={index} style={styles.courseCard}>
                    <View style={styles.courseHeader}>
                      <Text style={styles.courseCode}>{course.courseCode}</Text>
                      <View style={[
                        styles.statusBadge,
                        canAffordLeaves ? styles.statusGood : styles.statusWarning
                      ]}>
                        <Text style={[
                          styles.statusText,
                          canAffordLeaves ? styles.statusTextGood : styles.statusTextWarning
                        ]}>
                          {canAffordLeaves ? 'Good Standing' : 'Action Needed'}
                        </Text>
                      </View>
                    </View>

                    {/* Progress Bar */}
                    <View style={styles.progressContainer}>
                      <View style={styles.progressHeader}>
                        <Text style={styles.progressLabel}>Current Attendance:</Text>
                        <Text style={[
                          styles.progressValue,
                          isLowAttendance ? styles.progressValueWarning : styles.progressValueGood
                        ]}>
                          {course.percentage}%
                        </Text>
                      </View>
                      <View style={styles.progressBar}>
                        <View
                          style={[
                            styles.progressFill,
                            isLowAttendance ? styles.progressFillWarning : styles.progressFillGood,
                            { width: `${course.percentage}%` }
                          ]}
                        />
                      </View>
                      <View style={styles.progressLabels}>
                        <Text style={styles.progressLabelMin}>0%</Text>
                        <Text style={styles.progressLabelMid}>{customPercentage}%</Text>
                        <Text style={styles.progressLabelMax}>100%</Text>
                      </View>
                    </View>

                    {/* Stats Grid */}
                    <View style={styles.statsGrid}>
                      <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Total Classes</Text>
                        <Text style={styles.statValue}>{course.totalClasses}</Text>
                      </View>

                      <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Present</Text>
                        <Text style={styles.statValueGood}>{course.present}</Text>
                      </View>

                      <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Absent</Text>
                        <Text style={styles.statValueWarning}>{course.absent}</Text>
                      </View>

                      <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Leaves</Text>
                        <View style={styles.leavesContainer}>
                          <Text style={[
                            styles.statValue,
                            canAffordLeaves ? styles.statValueGood : styles.statValueWarning
                          ]}>
                            {course.affordableLeaves >= 0 ? course.affordableLeaves : Math.abs(course.affordableLeaves)}
                          </Text>
                          {course.affordableLeaves < 0 && (
                            <Text style={styles.attendText}>attend</Text>
                          )}
                        </View>
                      </View>
                    </View>
                  </View>
                )
              })}
            </View>
          )}

          {/* No Data State */}
          {combinedData.length === 0 && !loading && (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="time" size={48} color="#64748b" />
              </View>
              <Text style={styles.emptyTitle}>Attendance Data Unavailable</Text>
              <Text style={styles.emptyText}>
                Your attendance data is currently being updated. Please check back later for the latest information.
              </Text>
              <View style={styles.emptyStatus}>
                <Text style={styles.emptyStatusText}>Data synchronization in progress...</Text>
              </View>
            </View>
          )}
        </>
      )}
    </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: 0,
  },
  topBar: {
    backgroundColor: '#1e3a8a',
    paddingTop: Platform.OS === 'ios' ? 20 : 16,
    paddingBottom: 16,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#3b82f6',
  },
  topBarContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greetingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  topBarGreetingTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  topBarGreeting: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  topBarSubtext: {
    fontSize: 14,
    color: '#e0e7ff',
    marginTop: 2,
  },
  topBarName: {
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
  greetingBelowBar: {
    margin: 16,
    marginTop: 8,
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  greetingContentNew: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  greetingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  greetingTextSection: {
    flex: 1,
  },
  greetingBelowBarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 2,
  },
  greetingSubText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  greetingDecoration: {
    opacity: 0.8,
  },
  logoutText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  scrollContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
  },
  loadingGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
    padding: 32,
  },
  loadingIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  loadingTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  loadingSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 32,
    textAlign: 'center',
  },
  loadingAnimation: {
    alignItems: 'center',
    marginBottom: 32,
  },
  loadingBar: {
    width: 200,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    marginTop: 20,
    overflow: 'hidden',
  },
  loadingProgress: {
    height: '100%',
    borderRadius: 2,
  },
  loadingSteps: {
    width: '100%',
    maxWidth: 280,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    marginRight: 12,
  },
  stepText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  greetingCard: {
    backgroundColor: '#f1f5f9',
    margin: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  greetingContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  greetingTextContainer: {
    flex: 1,
  },
  greetingText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  greetingSubtext: {
    fontSize: 16,
    color: '#6b7280',
  },
  birthdayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  birthdayTextContainer: {
    marginHorizontal: 12,
  },
  birthdayTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#92400e',
    textAlign: 'center',
  },
  birthdayText: {
    fontSize: 14,
    color: '#a16207',
    textAlign: 'center',
  },
  overviewCard: {
    backgroundColor: '#ffffff',
    margin: 16,
    marginTop: 0,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  overviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  overviewIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  overviewTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  percentageContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  percentageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  percentageIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  percentageIcon: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  percentageLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
  },
  percentageValueContainer: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  percentageValue: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sliderContainer: {
    marginBottom: 12,
  },
  sliderTrack: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sliderTick: {
    alignItems: 'center',
  },
  sliderTickMark: {
    width: 4,
    height: 20,
    backgroundColor: '#d1d5db',
    borderRadius: 2,
  },
  sliderTickMarkActive: {
    backgroundColor: '#10b981',
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  sliderHint: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  dataCard: {
    backgroundColor: '#ffffff',
    margin: 16,
    marginTop: 0,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  courseCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  courseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  courseCode: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusGood: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  statusWarning: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextGood: {
    color: '#166534',
  },
  statusTextWarning: {
    color: '#92400e',
  },
  progressContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  progressValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  progressValueGood: {
    color: '#10b981',
  },
  progressValueWarning: {
    color: '#f59e0b',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressFillGood: {
    backgroundColor: '#10b981',
  },
  progressFillWarning: {
    backgroundColor: '#f59e0b',
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabelMin: {
    fontSize: 12,
    color: '#6b7280',
  },
  progressLabelMid: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  progressLabelMax: {
    fontSize: 12,
    color: '#6b7280',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statItem: {
    width: '50%',
    padding: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
  },
  statValueGood: {
    color: '#10b981',
  },
  statValueWarning: {
    color: '#f59e0b',
  },
  leavesContainer: {
    alignItems: 'center',
  },
  attendText: {
    fontSize: 10,
    color: '#f59e0b',
    fontWeight: '600',
    marginTop: 2,
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    margin: 16,
    marginTop: 0,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyStatus: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
  },
  emptyStatusText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  logoutButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
})
