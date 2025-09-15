import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchAndCacheAllData } from './attendanceService';
import { notificationService } from './notificationService';

// Background task name
const BACKGROUND_REFRESH_TASK = 'background-refresh-task';

// Define the background task
TaskManager.defineTask(BACKGROUND_REFRESH_TASK, async () => {
  try {
    // Check if user has credentials
    const rollNo = await AsyncStorage.getItem('nimora_rollno');
    if (!rollNo) {
      return;
    }

    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();

    // Check if it's scheduled refresh time (12 AM or 5 PM with 30-minute window)
    const isScheduledTime = (
      (hour === 0 && minute <= 30) || // 12:00 AM - 12:30 AM
      (hour === 17 && minute <= 30)   // 5:00 PM - 5:30 PM
    );

    if (!isScheduledTime) {
      return;
    }

    // Determine schedule type
    let scheduleType: 'midnight' | 'afternoon';
    if (hour === 0) {
      scheduleType = 'midnight';
    } else {
      scheduleType = 'afternoon';
    }

    // Check if we already refreshed today
    const alreadyRefreshed = await hasRefreshedToday(scheduleType);
    if (alreadyRefreshed) {
      return;
    }

    // Perform the refresh
    await fetchAndCacheAllData();
    await markRefreshCompleted(scheduleType);

    // Send notifications
    await sendBackgroundNotifications();

  } catch (error) {
    console.error('❌ Error in background refresh task:', error);
  }
});

// Helper function to check if we already refreshed today
async function hasRefreshedToday(scheduleType: 'midnight' | 'afternoon'): Promise<boolean> {
  try {
    const today = new Date().toDateString();
    const lastRefreshKey = `last_${scheduleType}_refresh`;
    const lastRefresh = await AsyncStorage.getItem(lastRefreshKey);
    return lastRefresh === today;
  } catch (error) {
    console.error('Error checking refresh status:', error);
    return false;
  }
}

// Helper function to mark refresh as completed
async function markRefreshCompleted(scheduleType: 'midnight' | 'afternoon'): Promise<void> {
  try {
    const today = new Date().toDateString();
    const lastRefreshKey = `last_${scheduleType}_refresh`;
    await AsyncStorage.setItem(lastRefreshKey, today);
  } catch (error) {
    console.error('Error marking refresh completed:', error);
  }
}

// Send notifications from background
async function sendBackgroundNotifications(): Promise<void> {
  try {
    // Check if notifications are enabled
    const notificationsEnabled = await AsyncStorage.getItem('notifications_enabled');
    if (notificationsEnabled === 'false') {
      return;
    }

    // Get stored credentials
    const rollNo = await AsyncStorage.getItem('nimora_rollno');
    const auth = await AsyncStorage.getItem('nimora_auth');

    if (!rollNo || !auth) {
      return;
    }

    const password = atob(auth);

    // Get user name from greeting
    const { greetUser } = await import('./attendanceService');
    const greeting = await greetUser(rollNo, password);

    if (!greeting || typeof greeting !== 'string') {
      return;
    }

    const userName = greeting.split(',')[1]?.trim().split(' ')[0] || 'Student';

    // Send attendance notifications
    await sendAttendanceNotifications(rollNo, password, userName);

    // Send exam notifications
    await sendExamNotifications(rollNo, password, userName);

  } catch (error) {
    console.error('❌ Error sending background notifications:', error);
  }
}

// Send attendance notifications
async function sendAttendanceNotifications(rollNo: string, password: string, userName: string): Promise<void> {
  try {
    const { getStudentAttendance } = await import('./attendanceService');
    const attendanceData = await getStudentAttendance(rollNo, password);

    if (attendanceData && Array.isArray(attendanceData) && attendanceData.length > 0) {
      // Convert data format for notifications
      const formattedData = attendanceData
        .filter(course => course && Array.isArray(course) && course.length >= 6)
        .map((course: any) => ({
          courseCode: course[0],
          percentage: course[5]
        }))
        .filter(course => course.courseCode && course.percentage);

      if (formattedData.length > 0) {
        // Send notifications for low attendance
        await notificationService.checkAndSendLowAttendanceNotifications(
          formattedData,
          userName
        );
      }
    }
  } catch (error) {
    console.error('Error sending attendance notifications:', error);
  }
}

// Send exam notifications
async function sendExamNotifications(rollNo: string, password: string, userName: string): Promise<void> {
  try {
    const { getExamSchedule } = await import('./attendanceService');
    const examData = await getExamSchedule(rollNo, password);

    if (examData && Array.isArray(examData) && examData.length > 0) {
      // Send exam notifications
      await notificationService.checkAndSendExamNotifications(
        examData,
        userName
      );
    }
  } catch (error) {
    console.error('Error sending exam notifications:', error);
  }
}

// Register the background task
export async function registerBackgroundRefresh(): Promise<void> {
  try {
    // Check if task is already registered
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_REFRESH_TASK);

    if (isRegistered) {
      return;
    }

    // Note: Background task registration is now handled by the system
    // The task will be triggered by the app's background processing

  } catch (error) {
    console.error('❌ Error registering background task:', error);
  }
}

// Unregister the background task
export async function unregisterBackgroundRefresh(): Promise<void> {
  try {
    // Note: With the new approach, we don't need to explicitly unregister
    // The task will be managed by the system
  } catch (error) {
    console.error('❌ Error updating background task:', error);
  }
}

// Get background task status
export async function getBackgroundTaskStatus(): Promise<{
  isRegistered: boolean;
  status: string;
}> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_REFRESH_TASK);

    return {
      isRegistered,
      status: isRegistered ? 'Available' : 'Not Registered'
    };
  } catch (error) {
    console.error('Error getting background task status:', error);
    return {
      isRegistered: false,
      status: 'Error'
    };
  }
}