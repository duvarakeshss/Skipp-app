import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchAndCacheAllData } from './attendanceService';
import { notificationService } from './notificationService';

// Background task name
const BACKGROUND_REFRESH_TASK = 'background-refresh-task';

// Define the background task
TaskManager.defineTask(BACKGROUND_REFRESH_TASK, async () => {
  try {
    console.log('🔄 Background refresh task started');

    // Check if user has credentials
    const rollNo = await AsyncStorage.getItem('nimora_rollno');
    if (!rollNo) {
      console.log('No credentials found, skipping background refresh');
      return BackgroundFetch.BackgroundFetchResult.NoData;
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
      console.log('Not scheduled refresh time, skipping');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Determine schedule type
    let scheduleType: 'midnight' | 'afternoon';
    if (hour === 0) {
      scheduleType = 'midnight';
      console.log('🌙 Midnight background refresh (12 AM)');
    } else {
      scheduleType = 'afternoon';
      console.log('🌅 Afternoon background refresh (5 PM)');
    }

    // Check if we already refreshed today
    const alreadyRefreshed = await hasRefreshedToday(scheduleType);
    if (alreadyRefreshed) {
      console.log(`Already refreshed today at ${scheduleType}, skipping`);
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Perform the refresh
    await fetchAndCacheAllData();
    await markRefreshCompleted(scheduleType);

    console.log(`✅ Background refresh completed successfully at ${scheduleType}`);

    // Send notifications
    await sendBackgroundNotifications();

    return BackgroundFetch.BackgroundFetchResult.NewData;

  } catch (error) {
    console.error('❌ Error in background refresh task:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
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
      console.log('📱 Background notifications disabled by user');
      return;
    }

    // Get stored credentials
    const rollNo = await AsyncStorage.getItem('nimora_rollno');
    const auth = await AsyncStorage.getItem('nimora_auth');

    if (!rollNo || !auth) {
      console.log('📱 No credentials available for background notifications');
      return;
    }

    const password = atob(auth);

    // Get user name from greeting
    const { greetUser } = await import('./attendanceService');
    const greeting = await greetUser(rollNo, password);

    if (!greeting || typeof greeting !== 'string') {
      console.log('📱 Could not get user greeting for background notifications');
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
      console.log('🚀 Background refresh task already registered');
      return;
    }

    // Register for background fetch
    await BackgroundFetch.registerTaskAsync(BACKGROUND_REFRESH_TASK, {
      minimumInterval: 15 * 60, // 15 minutes minimum (iOS limitation)
      stopOnTerminate: false, // Continue when app terminates
      startOnBoot: true, // Start when device boots
    });

    console.log('✅ Background refresh task registered successfully');

  } catch (error) {
    console.error('❌ Error registering background task:', error);
  }
}

// Unregister the background task
export async function unregisterBackgroundRefresh(): Promise<void> {
  try {
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_REFRESH_TASK);
    console.log('🛑 Background refresh task unregistered');
  } catch (error) {
    console.error('❌ Error unregistering background task:', error);
  }
}

// Get background task status
export async function getBackgroundTaskStatus(): Promise<{
  isRegistered: boolean;
  status: BackgroundFetch.BackgroundFetchStatus;
}> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_REFRESH_TASK);
    const status = await BackgroundFetch.getStatusAsync();

    // Handle null status by providing a default
    const safeStatus = status || BackgroundFetch.BackgroundFetchStatus.Denied;

    return { isRegistered, status: safeStatus };
  } catch (error) {
    console.error('Error getting background task status:', error);
    return {
      isRegistered: false,
      status: BackgroundFetch.BackgroundFetchStatus.Denied
    };
  }
}