import React, { useEffect, useState } from 'react'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { getStoredCredentials, clearCredentials, getExamSchedule } from '../utils/attendanceService'
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
import { LinearGradient } from 'expo-linear-gradient'
import { StatusBar } from 'expo-status-bar'

interface Exam {
  COURSE_CODE: string
  DATE: string
  TIME: string
}

const ExamCard = ({ exam, ...props }: { exam: Exam } & React.ComponentProps<typeof View>) => {
  // Determine the date format
  const formatDate = (dateStr: string) => {
    try {
      if (!dateStr) return "Invalid Date";

      // Handle DD-MM-YY format (expected from backend)
      const [day, month, year] = dateStr.split('-');
      if (day && month && year) {
        const date = new Date(parseInt(`20${year}`), parseInt(month) - 1, parseInt(day));
        if (isNaN(date.getTime())) {
          return dateStr; // Return original if invalid
        }
        return date.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }

      // Try other common formats
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }

      return dateStr; // Return original if parsing fails
    } catch {
      return dateStr; // Return original if parsing fails
    }
  };

  // Calculate days remaining
  const getDaysRemaining = (dateStr: string) => {
    try {
      if (!dateStr) return "";

      let examDate;

      // Handle DD-MM-YY format (expected from backend)
      const [day, month, year] = dateStr.split('-');
      if (day && month && year) {
        examDate = new Date(parseInt(`20${year}`), parseInt(month) - 1, parseInt(day));
        if (isNaN(examDate.getTime())) {
          return "";
        }
      } else {
        // Try parsing as regular date
        examDate = new Date(dateStr);
        if (isNaN(examDate.getTime())) {
          return "";
        }
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to beginning of day
      examDate.setHours(0, 0, 0, 0); // Set to beginning of day
      
      const diffTime = examDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));      if (diffDays < 0) return "Past";
      if (diffDays === 0) return "Today";
      if (diffDays === 1) return "Tomorrow";
      return `${diffDays} days`;
    } catch {
      return "";
    }
  };

  // Get status color based on days remaining
  const getStatusColor = (dateStr: string) => {
    try {
      if (!dateStr) return { backgroundColor: '#f3f4f6', textColor: '#6b7280' };

      let examDate;

      // Handle DD-MM-YY format (expected from backend)
      const [day, month, year] = dateStr.split('-');
      if (day && month && year) {
        examDate = new Date(parseInt(`20${year}`), parseInt(month) - 1, parseInt(day));
        if (isNaN(examDate.getTime())) {
          return { backgroundColor: '#f3f4f6', textColor: '#6b7280' };
        }
      } else {
        // Try parsing as regular date
        examDate = new Date(dateStr);
        if (isNaN(examDate.getTime())) {
          return { backgroundColor: '#f3f4f6', textColor: '#6b7280' };
        }
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      examDate.setHours(0, 0, 0, 0);
      
      const diffTime = examDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));      if (diffDays < 0) return { backgroundColor: '#e5e7eb', textColor: '#6b7280' }; // Past
      if (diffDays <= 2) return { backgroundColor: '#fee2e2', textColor: '#dc2626' }; // Urgent (0-2 days)
      if (diffDays <= 7) return { backgroundColor: '#fef3c7', textColor: '#d97706' }; // Soon (3-7 days)
      return { backgroundColor: '#dcfce7', textColor: '#16a34a' }; // Plenty of time (>7 days)
    } catch {
      return { backgroundColor: '#f3f4f6', textColor: '#6b7280' };
    }
  };

  const statusStyle = getStatusColor(exam.DATE);

  return (
    <View {...props} style={styles.examCard}>
      <LinearGradient
        colors={['#dbeafe', '#e9d5ff']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.examCardHeader}
      >
        <Text style={styles.examCourseCode}>{exam.COURSE_CODE}</Text>
      </LinearGradient>

      <View style={styles.examCardContent}>
        <View style={styles.examDetails}>
          <View style={styles.examDetail}>
            <Text style={styles.examDetailLabel}>Date</Text>
            <Text style={styles.examDetailValue}>{formatDate(exam.DATE)}</Text>
          </View>
          <View style={styles.examDetail}>
            <Text style={styles.examDetailLabel}>Time</Text>
            <Text style={styles.examDetailValue}>{exam.TIME}</Text>
          </View>
        </View>

        <View style={styles.examStatus}>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.backgroundColor }]}>
            <Text style={[styles.statusText, { color: statusStyle.textColor }]}>
              {getDaysRemaining(exam.DATE)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default function Timetable() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const { rollNo, password } = params as { rollNo?: string; password?: string }
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const fetchTimetable = async () => {
      try {
        setLoading(true)

        // Get credentials from params or storage
        let credentials = { rollNo: rollNo || '', password: password || '' }
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

        // Fetch exam schedule from API
        const examData = await getExamSchedule(credentials.rollNo, credentials.password);

        setExams(examData || [])
        setMessage(null)
      } catch (err: any) {
        console.error("Error fetching exam schedule:", err)
        setError(err.message || "Failed to fetch exam schedule")
      } finally {
        setLoading(false)
      }
    }

    fetchTimetable()
  }, [rollNo, password, router])

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

  // Sort exams by date
  const sortedExams = [...exams].sort((a, b) => {
    try {
      const [dayA, monthA, yearA] = a.DATE.split('-');
      const [dayB, monthB, yearB] = b.DATE.split('-');

      const dateA = new Date(parseInt(`20${yearA}`), parseInt(monthA) - 1, parseInt(dayA));
      const dateB = new Date(parseInt(`20${yearB}`), parseInt(monthB) - 1, parseInt(dayB));

      return dateA.getTime() - dateB.getTime();
    } catch {
      return 0;
    }
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading exam schedule...</Text>
        <Text style={styles.loadingSubtext}>Please wait while we fetch your exams</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" hidden={true} />

      {/* Top Bar */}
      <View style={styles.topBar}>
        <View style={styles.topBarContent}>
          <Text style={styles.topBarTitle}>Exam Schedule</Text>
          <TouchableOpacity
            style={styles.topBarLogoutButton}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollContainer}>
        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={48} color="#dc2626" />
            <Text style={styles.errorTitle}>Error</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : message ? (
          <View style={styles.messageCard}>
            <Ionicons name="calendar-outline" size={48} color="#2563eb" />
            <Text style={styles.messageText}>{message}</Text>
          </View>
        ) : (
          <>
            {/* Info Card */}
            <View style={styles.infoCard}>
              <Text style={styles.infoText}>
                Your upcoming exams are listed below. They are automatically sorted by date.
              </Text>
              <View style={styles.legendContainer}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#fee2e2' }]} />
                  <Text style={styles.legendText}>0-2 days: Urgent</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#fef3c7' }]} />
                  <Text style={styles.legendText}>3-7 days: Soon</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#dcfce7' }]} />
                  <Text style={styles.legendText}>&gt;7 days: Upcoming</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#e5e7eb' }]} />
                  <Text style={styles.legendText}>Past</Text>
                </View>
              </View>
            </View>

            {/* Exams Grid */}
            <View style={styles.examsGrid}>
              {sortedExams.map((exam, index) => (
                <ExamCard key={index} exam={exam} />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 20,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
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
  scrollContainer: {
    flex: 1,
  },
  errorCard: {
    backgroundColor: '#ffffff',
    margin: 16,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#dc2626',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  messageCard: {
    backgroundColor: '#ffffff',
    margin: 16,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  messageText: {
    fontSize: 18,
    color: '#2563eb',
    textAlign: 'center',
    marginTop: 16,
  },
  infoCard: {
    backgroundColor: '#ffffff',
    margin: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoText: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 16,
    lineHeight: 24,
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  examsGrid: {
    padding: 16,
    paddingTop: 0,
  },
  examCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  examCardHeader: {
    padding: 16,
  },
  examCourseCode: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e40af',
  },
  examCardContent: {
    padding: 16,
  },
  examDetails: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  examDetail: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginRight: 8,
  },
  examDetailLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  examDetailValue: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '600',
  },
  examStatus: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
})
