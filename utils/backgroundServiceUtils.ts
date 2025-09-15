import { registerBackgroundRefresh, unregisterBackgroundRefresh, getBackgroundTaskStatus } from './backgroundService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Background service utilities for debugging and management
export class BackgroundServiceUtils {

  // Register background service
  static async registerService(): Promise<void> {
    try {
      await registerBackgroundRefresh();
    } catch (error) {
      console.error('❌ Failed to register background service:', error);
      throw error;
    }
  }

  // Unregister background service
  static async unregisterService(): Promise<void> {
    try {
      await unregisterBackgroundRefresh();
    } catch (error) {
      console.error('❌ Failed to unregister background service:', error);
      throw error;
    }
  }

  // Get service status
  static async getServiceStatus(): Promise<{
    isRegistered: boolean;
    status: any;
    lastRefresh: {
      midnight: string | null;
      afternoon: string | null;
    };
  }> {
    try {
      const { isRegistered, status } = await getBackgroundTaskStatus();

      // Get last refresh times
      const lastMidnightRefresh = await AsyncStorage.getItem('last_midnight_refresh');
      const lastAfternoonRefresh = await AsyncStorage.getItem('last_afternoon_refresh');

      return {
        isRegistered,
        status,
        lastRefresh: {
          midnight: lastMidnightRefresh,
          afternoon: lastAfternoonRefresh
        }
      };
    } catch (error) {
      console.error('❌ Failed to get background service status:', error);
      throw error;
    }
  }

  // Force trigger background refresh (for testing)
  static async forceRefresh(): Promise<void> {
    try {
      // Import required services
      const { fetchAndCacheAllData } = await import('./attendanceService');
      const { notificationService } = await import('./notificationService');

      // Check credentials
      const rollNo = await AsyncStorage.getItem('nimora_rollno');
      if (!rollNo) {
        throw new Error('No credentials found');
      }

      // Perform refresh
      await fetchAndCacheAllData();

      // Send notifications
      const auth = await AsyncStorage.getItem('nimora_auth');
      if (auth) {
        const password = atob(auth);

        // Get user name
        const { greetUser } = await import('./attendanceService');
        const greeting = await greetUser(rollNo, password);

        if (greeting && typeof greeting === 'string') {
          const userName = greeting.split(',')[1]?.trim().split(' ')[0] || 'Student';

          // Send attendance notifications
          const { getStudentAttendance } = await import('./attendanceService');
          const attendanceData = await getStudentAttendance(rollNo, password);

          if (attendanceData && Array.isArray(attendanceData)) {
            const formattedData = attendanceData
              .filter(course => course && Array.isArray(course) && course.length >= 6)
              .map((course: any) => ({
                courseCode: course[0],
                percentage: course[5]
              }))
              .filter(course => course.courseCode && course.percentage);

            if (formattedData.length > 0) {
              await notificationService.checkAndSendLowAttendanceNotifications(formattedData, userName);
            }
          }

          // Send exam notifications
          const { getExamSchedule } = await import('./attendanceService');
          const examData = await getExamSchedule(rollNo, password);

          if (examData && Array.isArray(examData)) {
            await notificationService.checkAndSendExamNotifications(examData, userName);
          }
        }
      }

    } catch (error) {
      console.error('❌ Failed to force refresh:', error);
      throw error;
    }
  }

  // Clear refresh history (for testing)
  static async clearRefreshHistory(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        'last_midnight_refresh',
        'last_afternoon_refresh'
      ]);

    } catch (error) {
      console.error('❌ Failed to clear refresh history:', error);
      throw error;
    }
  }
}