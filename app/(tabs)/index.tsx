import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { getStoredCredentials, getCachedOrFreshData, dataCache } from '../../utils/attendanceService'
import { notificationService } from '../../utils/notificationService'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
  PanResponder,
  PanResponderInstance
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import LogoutModal from '../../components/LogoutModal'
import { sessionManager } from '../../utils/sessionManager'
import SettingsModal from '../../components/SettingsModal'
import ProfileMenu from '../../components/ProfileMenu'
import { StatusBar } from 'expo-status-bar'
import * as Haptics from 'expo-haptics'

export default function Home() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const { rollNo, password } = params as { rollNo?: string; password?: string }
  const [loading, setLoading] = useState(true)
  const [greeting, setGreeting] = useState('')
  const [customPercentage, setCustomPercentage] = useState(80)
  const [combinedData, setCombinedData] = useState<any[]>([])
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [logoutLoading, setLogoutLoading] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [examNotificationsEnabled, setExamNotificationsEnabled] = useState(true)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [refreshLoading, setRefreshLoading] = useState(false)
  const attendanceDataRef = useRef<any[]>([])
  const [updateCounter, setUpdateCounter] = useState(0)

  const calculateIndividualLeaves = useCallback((classesPresent: number, classesTotal: number, maintenancePercentage: number) => {
    if (classesTotal === 0) return 0

    let affordableLeaves = 0
    let i = 1
    const MAX_ITERATIONS = 1000

    // Special case for 100% attendance target
    if (maintenancePercentage === 100) {
      return (classesPresent / classesTotal) * 100 === 100 ? 0 : -(classesTotal - classesPresent)
    }

    const currentPercentage = (classesPresent / classesTotal) * 100

    if (currentPercentage < maintenancePercentage) {
      // Need to attend more classes
      let iterations = 0
      while (((classesPresent + i) / (classesTotal + i)) * 100 <= maintenancePercentage && iterations < MAX_ITERATIONS) {
        affordableLeaves -= 1
        i += 1
        iterations += 1
      }
      return iterations >= MAX_ITERATIONS ? Math.floor(-MAX_ITERATIONS / 10) : affordableLeaves
    } else {
      // Can afford some leaves
      let iterations = 0
      while ((classesPresent / (classesTotal + i)) * 100 >= maintenancePercentage && iterations < MAX_ITERATIONS) {
        affordableLeaves += 1
        i += 1
        iterations += 1
      }
      return iterations >= MAX_ITERATIONS ? Math.floor(MAX_ITERATIONS / 10) : affordableLeaves
    }
  }, [])

  const calculateCombinedData = useCallback((data: any[], percentage: number) => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return
    }

    try {
      const result = data.map((course, index) => {
        if (!Array.isArray(course) || course.length < 6) {
          return null
        }

        const classesTotal = parseInt(course[1]) || 0
        const classesPresent = parseInt(course[4]) || 0
        const leaves = calculateIndividualLeaves(classesPresent, classesTotal, percentage)

        return {
          courseCode: course[0] || 'Unknown',
          totalClasses: course[1] || '0',
          present: course[4] || '0',
          absent: course[2] || '0',
          percentage: course[5] || '0',
          affordableLeaves: leaves
        }
      }).filter(course => course !== null)

      setCombinedData(result)
      setUpdateCounter(prev => prev + 1)
    } catch (error) {
      console.error('💥 Error in calculateCombinedData:', error)
      setCombinedData([])
    }
  }, [calculateIndividualLeaves])

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

        // Load notification preferences
        const notificationsPref = await notificationService.getNotificationsEnabled()
        setNotificationsEnabled(notificationsPref)

        // Load exam notification preferences
        const examNotificationsPref = await notificationService.getExamNotificationsEnabled()
        setExamNotificationsEnabled(examNotificationsPref)

        // Get user greeting first to verify credentials
        const userGreeting = await getCachedOrFreshData('greeting', credentials.rollNo, credentials.password);
        setGreeting(userGreeting);

        // Only fetch attendance data if greeting was successful
        if (userGreeting) {
          const data = await getCachedOrFreshData('attendance', credentials.rollNo, credentials.password);
          attendanceDataRef.current = data;

          // Calculate affordable leaves with default percentage
          calculateCombinedData(data, customPercentage);

          // Extract user name from greeting for notifications
          const userName = userGreeting.split(',')[1]?.trim().split(' ')[0] || 'Student';

          // Check and send notifications for low attendance courses
          if (data && Array.isArray(data) && data.length > 0) {
            // Request notification permissions if not already granted
            const permissionsGranted = await notificationService.requestPermissions();
            if (permissionsGranted) {
              // Convert raw data to combined format for notification checking
              const combinedForNotification = data
                .filter((course: any) => course && Array.isArray(course) && course.length >= 6)
                .map((course: any) => ({
                  courseCode: course[0],
                  percentage: course[5]
                }))
                .filter(course => course.courseCode && course.percentage);

              if (combinedForNotification.length > 0) {
                await notificationService.checkAndSendLowAttendanceNotifications(
                  combinedForNotification,
                  userName
                );
              }
            }
          }
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
  }, [rollNo, password, calculateCombinedData, customPercentage, router])

  const getMaintenanceColor = (percentage: number): [string, string] => {
    if (percentage >= 90) return ['#10b981', '#059669'] // Green for high maintenance
    if (percentage >= 80) return ['#3b82f6', '#2563eb'] // Blue for good maintenance
    if (percentage >= 70) return ['#f59e0b', '#d97706'] // Orange for moderate
    return ['#ef4444', '#dc2626'] // Red for low maintenance
  }

  const [isDragging, setIsDragging] = useState(false)
  const sliderRef = useRef<View>(null)
  const sliderWidth = useRef(0)
  const sliderX = useRef(0)
  const lastCalculatedPercentage = useRef(80) // Store the last valid percentage

  // Create PanResponder for better touch handling
  const panResponder = useRef<PanResponderInstance>(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        setIsDragging(true)
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        // Measure slider position and dimensions
        if (sliderRef.current) {
          sliderRef.current.measure((x, y, width, height, pageX, pageY) => {
            sliderWidth.current = width
            sliderX.current = pageX
          })
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        if (sliderWidth.current > 0) {
          const touchX = evt.nativeEvent.pageX
          const relativeX = touchX - sliderX.current
          const percentage = Math.max(0, Math.min(1, relativeX / sliderWidth.current))
          const newValue = Math.round(50 + (percentage * 50))
          const finalValue = Math.max(50, Math.min(100, newValue))

          // Store the last calculated value
          lastCalculatedPercentage.current = finalValue

          // Only update if the value has actually changed
          if (finalValue !== customPercentage) {
            setCustomPercentage(finalValue)

            // Simple immediate calculation
            if (attendanceDataRef.current && attendanceDataRef.current.length > 0) {
              calculateCombinedData(attendanceDataRef.current, finalValue)
            }
          }
        }
      },
      onPanResponderRelease: () => {
        setIsDragging(false)
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        // Use the last calculated percentage to ensure accuracy
        setCustomPercentage(lastCalculatedPercentage.current)
        calculateCombinedData(attendanceDataRef.current, lastCalculatedPercentage.current)
      },
      onPanResponderTerminate: () => {
        setIsDragging(false)
        // Use the last calculated percentage to ensure accuracy
        setCustomPercentage(lastCalculatedPercentage.current)
        calculateCombinedData(attendanceDataRef.current, lastCalculatedPercentage.current)
      }
    })
  )

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
    let credentials = { rollNo: rollNo || '', password: password || '' }

    // If no credentials from params, try to get from storage
    if (!credentials.rollNo || !credentials.password) {
      const stored = await getStoredCredentials()
      if (stored) {
        credentials = stored
      }
    }

    if (!credentials.rollNo || !credentials.password) {
      Alert.alert('Error', 'No credentials found. Please log in again.')
      return
    }

    try {
      setRefreshLoading(true)

      // Clear cache first to force fresh data
      await dataCache.clearAllCache()

      // Fetch fresh data
      const userGreeting = await getCachedOrFreshData('greeting', credentials.rollNo, credentials.password);
      setGreeting(userGreeting);

      if (userGreeting) {
        const data = await getCachedOrFreshData('attendance', credentials.rollNo, credentials.password);
        attendanceDataRef.current = data;
        calculateCombinedData(data, customPercentage);
      }
    } catch (err: any) {
      console.error('Error refreshing data:', err)
      Alert.alert('Error', err.message || 'Failed to refresh data')
    } finally {
      setRefreshLoading(false)
    }
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

  if (loading) {
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
            <View style={[styles.loadingOrb, styles.loadingOrb3]} />
          </View>

          <View style={styles.loadingContent}>
            {/* Main loading card */}
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
                  <Ionicons name="analytics" size={32} color="#ffffff" />
                </LinearGradient>
              </View>

              <Text style={styles.loadingTitle}>Loading Your Data</Text>
              <Text style={styles.loadingSubtitle}>Fetching your attendance information...</Text>

              {/* Modern loading animation */}
              <View style={styles.loadingAnimationContainer}>
                <View style={styles.loadingSpinner}>
                  <ActivityIndicator size="large" color="#3b82f6" />
                </View>

                {/* Progress dots */}
                <View style={styles.loadingDots}>
                  <View style={[styles.loadingDot, styles.loadingDot1]} />
                  <View style={[styles.loadingDot, styles.loadingDot2]} />
                  <View style={[styles.loadingDot, styles.loadingDot3]} />
                </View>
              </View>

              {/* Loading steps */}
              <View style={styles.loadingSteps}>
                <View style={styles.stepItem}>
                  <View style={[styles.stepDot, styles.stepDotActive]} />
                  <Text style={styles.stepText}>Connecting to server</Text>
                </View>
                <View style={styles.stepItem}>
                  <View style={[styles.stepDot, styles.stepDotActive]} />
                  <Text style={styles.stepText}>Fetching attendance data</Text>
                </View>
                <View style={styles.stepItem}>
                  <View style={styles.stepDot} />
                  <Text style={styles.stepText}>Processing information</Text>
                </View>
              </View>
            </LinearGradient>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.fullScreenContainer}>
      <StatusBar style="light" hidden={true} />
      {/* Top Bar */}
      <View style={styles.topBar}>
        <View style={styles.topBarContent}>
          <View style={styles.spacer} />
          <View style={styles.profileSection}>
            <Text style={styles.topBarName}>{(greeting.split(',')[1]?.trim() || greeting.split(' ')[1] || 'User').replace('!', '')}</Text>
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
                          greeting.split(',')[0].includes('Afternoon') ? 'partly-sunny' :
                          greeting.split(',')[0].includes('Night') ? 'moon' : 'moon'}
                    size={24}
                    color="#ffffff"
                  />
                </View>
                <View style={styles.greetingTextSection}>
                  <Text style={styles.greetingBelowBarText}>{greeting.split(',')[0]}</Text>
          
                </View>
                <View style={styles.greetingDecoration}>
                  <TouchableOpacity
                    onPress={handleRefresh}
                    disabled={refreshLoading}
                    style={styles.refreshButton}
                  >
                    {refreshLoading ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Ionicons name="refresh" size={16} color="#ffffff" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </LinearGradient>

            {/* Birthday Card - only show if it's birthday */}
            {greeting.includes("Birthday") && (
              <LinearGradient
                colors={['#fef3c7', '#fde68a', '#f59e0b']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.birthdayCard}
              >
                <View style={styles.birthdayIconContainer}>
                  <Ionicons name="gift" size={24} color="#92400e" />
                </View>
                <View style={styles.birthdayTextContainer}>
                  <Text style={styles.birthdayTitle}>Happy Birthday!</Text>
                  <Text style={styles.birthdayText}>Wishing you a fantastic day!</Text>
                </View>
                <View style={styles.birthdayIconContainer}>
                  <Ionicons name="gift" size={24} color="#92400e" />
                </View>
              </LinearGradient>
            )}

          {/* Maintenance Target */}
          {combinedData.length > 0 && (
            <LinearGradient
              colors={['#f8fafc', '#f1f5f9', '#e2e8f0']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.overviewCard}
            >
              <View style={styles.percentageContainer}>
                <View style={styles.percentageHeader}>
                  <View style={styles.percentageIconContainer}>
                    <Ionicons name="shield-checkmark" size={24} color="#10b981" />
                  </View>
                  <View style={styles.percentageTextContainer}>
                    <Text style={styles.percentageLabel}>Maintenance Target</Text>
                    <Text style={styles.percentageSubLabel}>Set your desired attendance percentage</Text>
                  </View>
                  <View style={styles.percentageValueContainer}>
                    <LinearGradient
                      colors={getMaintenanceColor(customPercentage)}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.percentageValueBadge}
                    >
                      <Text style={styles.percentageValue}>{customPercentage}%</Text>
                    </LinearGradient>
                  </View>
                </View>

                {/* Percentage Dragger */}
                <View style={styles.sliderContainer}>
                  <View
                    ref={sliderRef}
                    style={styles.draggerTrack}
                    {...panResponder.current.panHandlers}
                  >
                    <View style={styles.draggerRail} />
                    <LinearGradient
                      colors={['#3b82f6', '#1d4ed8', '#1e40af']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[
                        styles.draggerProgress,
                        { width: `${((customPercentage - 50) / 50) * 100}%` }
                      ]}
                    />
                    <View
                      style={[
                        styles.draggerThumb,
                        {
                          left: `${((customPercentage - 50) / 50) * 100}%`,
                          marginLeft: -35, // Half of thumb width for center alignment
                        }
                      ]}
                    >
                      <LinearGradient
                        colors={['#10b981', '#059669', '#047857']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        style={[styles.draggerThumbInner, isDragging && styles.draggerThumbDragging]}
                      >
                        <Text style={styles.draggerThumbText}>{customPercentage}%</Text>
                      </LinearGradient>
                    </View>
                  </View>
                  <View style={styles.draggerLabels}>
                    <Text style={styles.draggerLabel}>50%</Text>
                    <Text style={styles.draggerLabel}>60%</Text>
                    <Text style={styles.draggerLabel}>70%</Text>
                    <Text style={styles.draggerLabel}>80%</Text>
                    <Text style={styles.draggerLabel}>90%</Text>
                    <Text style={styles.draggerLabel}>100%</Text>
                  </View>
                </View>
                <Text style={styles.sliderHint}>
                  🎯 Drag to set your target attendance percentage. This helps calculate how many classes you can safely miss.
                </Text>
              </View>
            </LinearGradient>
          )}

          {/* Attendance Data */}
          {combinedData.length > 0 && (
            <View key={`attendance-data-${updateCounter}`} style={styles.dataCard}>
              <View style={styles.dataCardContent}>
                {/* Sort courses by attendance percentage (low to high) to highlight courses needing attention */}
                {combinedData
                  .sort((a, b) => {
                    const aPercent = parseFloat(a.percentage) || 0;
                    const bPercent = parseFloat(b.percentage) || 0;
                    return aPercent - bPercent;
                  })
                  .map((course, index) => {
                const isLowAttendance = parseInt(course.percentage) < 75
                const canAffordLeaves = course.affordableLeaves >= 0

                return (
                  <View key={`${course.courseCode}-${index}-${course.affordableLeaves}`} style={styles.courseCard}>
                    <LinearGradient
                      colors={['#1e3a8a', '#3b82f6', '#60a5fa']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.courseHeader}
                    >
                      <View style={styles.courseIconContainer}>
                        <Ionicons name="school" size={20} color="#ffffff" />
                      </View>
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
                    </LinearGradient>

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
                      <View style={[styles.statItem, styles.totalClassesBox]}>
                        <Text style={styles.statLabel}>Total Classes</Text>
                        <Text style={[styles.statValue, styles.totalClassesValue]}>{course.totalClasses}</Text>
                      </View>

                      <View style={[styles.statItem, styles.presentBox]}>
                        <Text style={styles.statLabel}>Present</Text>
                        <Text style={[styles.statValueGood, styles.presentValue]}>{course.present}</Text>
                      </View>

                      <View style={[styles.statItem, styles.absentBox]}>
                        <Text style={styles.statLabel}>Absent</Text>
                        <Text style={[styles.statValueWarning, styles.absentValue]}>{course.absent}</Text>
                      </View>

                      <View style={[styles.statItem, styles.leavesBox]}>
                        <Text style={styles.statLabel}>Leaves</Text>
                        <View style={styles.leavesContainer}>
                          <Text style={[
                            styles.statValue,
                            canAffordLeaves ? styles.statValueGood : styles.statValueWarning,
                            styles.leavesValue
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
            </View>
          )}

          {/* No Data State */}
          {combinedData.length === 0 && !loading && (
            <LinearGradient
              colors={['#f0f9ff', '#e0f2fe']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.messageCard}
            >
              <View style={styles.messageIcon}>
                <Ionicons name="time" size={32} color="#0369a1" />
              </View>
              <View style={styles.messageContent}>
                <Text style={styles.messageTitle}>Attendance Data</Text>
                <Text style={styles.messageText}>In progress ...</Text>
              </View>
            </LinearGradient>
          )}
        </>
      )}
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
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: 0,
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
  topBarName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    flex: 1,
    marginTop: 2,
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
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  greetingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  greetingTextSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  greetingBelowBarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 2,
    textAlign: 'center',
  },
  greetingSubText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
    textAlign: 'center',
  },
  greetingDecoration: {
    opacity: 0.8,
    marginLeft: 16,
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
    width: 200,
    height: 200,
    backgroundColor: '#3b82f6',
    top: '10%',
    left: '10%',
  },
  loadingOrb2: {
    width: 150,
    height: 150,
    backgroundColor: '#1d4ed8',
    top: '60%',
    right: '15%',
  },
  loadingOrb3: {
    width: 100,
    height: 100,
    backgroundColor: '#1e40af',
    bottom: '20%',
    left: '70%',
  },
  loadingContent: {
    alignItems: 'center',
    padding: 32,
    width: '100%',
    maxWidth: 400,
  },
  loadingCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 20,
  },
  loadingIconContainer: {
    marginBottom: 24,
  },
  loadingIcon: {
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
  },
  loadingTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  loadingSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 22,
  },
  loadingAnimationContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  loadingSpinner: {
    marginBottom: 20,
  },
  loadingDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(59, 130, 246, 0.5)',
    marginHorizontal: 4,
  },
  loadingDot1: {
    backgroundColor: '#3b82f6',
  },
  loadingDot2: {
    backgroundColor: '#3b82f6',
  },
  loadingDot3: {
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
  },
  loadingSteps: {
    width: '100%',
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
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginRight: 12,
  },
  stepDotActive: {
    backgroundColor: '#3b82f6',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
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
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  birthdayIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(146, 64, 14, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  overviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
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
  overviewHeaderPlain: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  overviewTitlePlain: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#374151',
  },
  percentageContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 20,
    margin: 16,
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
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 18,
    marginTop: 8,
    paddingHorizontal: 16,
  },
  draggerTrack: {
    position: 'relative',
    height: 50,
    marginBottom: 20,
    justifyContent: 'center',
    marginHorizontal: 20,
    paddingVertical: 10,
  },
  draggerRail: {
    height: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    marginTop: -4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  draggerProgress: {
    height: 8,
    borderRadius: 4,
    position: 'absolute',
    left: 0,
    top: '50%',
    marginTop: -4,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  draggerThumb: {
    position: 'absolute',
    width: 70,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    top: '50%',
    marginTop: -20,
  },
  draggerThumbInner: {
    width: 60,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  draggerThumbDragging: {
    transform: [{ scale: 1.2 }],
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 12,
    borderColor: '#f0fdf4',
  },
  draggerThumbText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  draggerLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20, // Account for margins
    marginTop: 8,
  },
  draggerLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
    textAlign: 'center',
    minWidth: 40,
  },
  dataCardContent: {
    padding: 16,
  },
  courseCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  courseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  courseIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  courseCode: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusGood: {
    backgroundColor: '#064e3b',
    borderWidth: 1,
    borderColor: '#065f46',
  },
  statusWarning: {
    backgroundColor: '#dc2626',
    borderWidth: 1,
    borderColor: '#b91c1c',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextGood: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  statusTextWarning: {
    color: '#ffffff',
    fontWeight: 'bold',
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
    color: '#dc2626',
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
    backgroundColor: '#dc2626',
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  progressLabelMin: {
    fontSize: 10,
    color: '#374151',
    fontWeight: '600',
  },
  progressLabelMid: {
    fontSize: 10,
    color: '#374151',
    fontWeight: '600',
  },
  progressLabelMax: {
    fontSize: 10,
    color: '#374151',
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  statItem: {
    width: '48%', // Slightly less than 50% to account for gap
    paddingHorizontal: 8,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  totalClassesBox: {
    backgroundColor: '#fef3c7',
    borderColor: '#fbbf24',
  },
  presentBox: {
    backgroundColor: '#dcfce7',
    borderColor: '#10b981',
  },
  absentBox: {
    backgroundColor: '#fee2e2',
    borderColor: '#ef4444',
  },
  leavesBox: {
    backgroundColor: '#f3e8ff',
    borderColor: '#a855f7',
  },
  totalClassesValue: {
    color: '#92400e',
  },
  presentValue: {
    color: '#047857',
  },
  absentValue: {
    color: '#dc2626',
  },
  leavesValue: {
    color: '#6b21a8',
  },
  statLabel: {
    fontSize: 12,
    color: '#374151',
    marginBottom: 4,
    textAlign: 'center',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
  },
  statValueGood: {
    color: '#10b981',
    fontWeight: 'bold',
  },
  statValueWarning: {
    color: '#dc2626',
    fontWeight: 'bold',
  },
  leavesContainer: {
    alignItems: 'center',
  },
  attendText: {
    fontSize: 10,
    color: '#dc2626',
    fontWeight: '600',
    marginTop: 2,
  },
  dataCard: {
    backgroundColor: '#ffffff',
    margin: 16,
    marginTop: 0,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    margin: 12,
    marginTop: 0,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  emptyIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  emptyHeaderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  emptyContent: {
    padding: 16,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
    marginTop: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 20,
  },
  emptyStatus: {
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    padding: 8,
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
  messageCard: {
    margin: 16,
    marginBottom: 8,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
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
    color: '#0369a1',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    color: '#075985',
    lineHeight: 22,
  },
  percentageTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  percentageSubLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '400',
    marginTop: 2,
  },
  percentageValueBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  refreshButton: {
    padding: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
})
