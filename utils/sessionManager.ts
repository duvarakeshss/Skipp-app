import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { validateSession, isLoggedIn, getStoredCredentials } from './attendanceService';
import { fetchAndCacheAllData } from './attendanceService';
import { notificationService } from './notificationService';

export interface SessionState {
  isAuthenticated: boolean;
  isLoading: boolean;
  userRollNo?: string;
  lastLoginTime?: number;
}

class SessionManager {
  private static instance: SessionManager;
  private sessionState: SessionState = {
    isAuthenticated: false,
    isLoading: true,
  };
  private listeners: ((state: SessionState) => void)[] = [];
  private scheduledRefreshCleanup?: () => void;

  private constructor() {}

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  // Subscribe to session state changes
  subscribe(listener: (state: SessionState) => void): () => void {
    this.listeners.push(listener);
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // Notify all listeners of state changes
  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.sessionState));
  }

  // Get current session state
  getSessionState(): SessionState {
    return { ...this.sessionState };
  }

  // ===== SCHEDULED REFRESH SYSTEM =====
  // Automatically refreshes data at 12:00 AM and 5:00 PM daily
  // Uses background monitoring with 5-minute interval checks
  // Prevents duplicate refreshes by tracking completion per day

  // Check if it's time for scheduled data refresh (12 AM or 5 PM)
  private isScheduledRefreshTime(): boolean {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();

    // Check if it's exactly 12:00 AM or 5:00 PM (within 5-minute window)
    return (
      (hour === 0 && minute <= 5) || // 12:00 AM - 12:05 AM
      (hour === 17 && minute <= 5)   // 5:00 PM - 5:05 PM
    );
  }

  // Check if we already refreshed today at this time
  private async hasRefreshedToday(scheduleType: 'midnight' | 'afternoon'): Promise<boolean> {
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

  // Mark refresh as completed for today
  private async markRefreshCompleted(scheduleType: 'midnight' | 'afternoon'): Promise<void> {
    try {
      const today = new Date().toDateString();
      const lastRefreshKey = `last_${scheduleType}_refresh`;
      await AsyncStorage.setItem(lastRefreshKey, today);
    } catch (error) {
      console.error('Error marking refresh completed:', error);
    }
  }

  // Perform scheduled data refresh
  async performScheduledRefresh(): Promise<void> {
    try {
      console.log('🔄 Performing scheduled data refresh...');

      const hasCredentials = await isLoggedIn();
      if (!hasCredentials) {
        console.log('No credentials found, skipping scheduled refresh');
        return;
      }

      const now = new Date();
      const hour = now.getHours();
      let scheduleType: 'midnight' | 'afternoon';

      if (hour === 0) {
        scheduleType = 'midnight';
        console.log('🌙 Midnight refresh (12 AM)');
      } else if (hour === 17) {
        scheduleType = 'afternoon';
        console.log('🌅 Afternoon refresh (5 PM)');
      } else {
        console.log('Not a scheduled refresh time');
        return;
      }

      // Check if we already refreshed today
      const alreadyRefreshed = await this.hasRefreshedToday(scheduleType);
      if (alreadyRefreshed) {
        console.log(`Already refreshed today at ${scheduleType}, skipping`);
        return;
      }

      // Perform the refresh
      await fetchAndCacheAllData();
      await this.markRefreshCompleted(scheduleType);

      console.log(`✅ Scheduled refresh completed successfully at ${scheduleType}`);

      // Check for low attendance notifications after refresh
      try {
        const hasCredentials = await isLoggedIn();
        if (!hasCredentials) {
          console.log('📱 No credentials available, skipping notifications');
          return;
        }

        const credentials = await getStoredCredentials();
        if (!credentials || !credentials.rollNo || !credentials.password) {
          console.log('📱 Invalid credentials, skipping notifications');
          return;
        }

        // Get fresh attendance data
        const { getStudentAttendance } = await import('./attendanceService');
        const attendanceData = await getStudentAttendance(credentials.rollNo, credentials.password);

        if (attendanceData && Array.isArray(attendanceData) && attendanceData.length > 0) {
          // Get user name from greeting
          const { greetUser } = await import('./attendanceService');
          const greeting = await greetUser(credentials.rollNo, credentials.password);

          if (greeting && typeof greeting === 'string') {
            const userName = greeting.split(',')[1]?.trim().split(' ')[0] || 'Student';

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
            } else {
              console.log('📱 No valid attendance data to process for notifications');
            }
          } else {
            console.log('📱 Could not get user greeting, skipping attendance notifications');
          }
        } else {
          console.log('📱 No attendance data available');
        }

        // Get exam data and send exam notifications
        const { getExamSchedule } = await import('./attendanceService');
        const examData = await getExamSchedule(credentials.rollNo, credentials.password);

        if (examData && Array.isArray(examData) && examData.length > 0) {
          // Get user name from greeting (reuse from above if available)
          let userName = 'Student';
          try {
            const { greetUser } = await import('./attendanceService');
            const greeting = await greetUser(credentials.rollNo, credentials.password);
            if (greeting && typeof greeting === 'string') {
              userName = greeting.split(',')[1]?.trim().split(' ')[0] || 'Student';
            }
          } catch (error) {
            console.error('Error getting user name for exam notifications:', error);
          }

          // Send exam notifications
          await notificationService.checkAndSendExamNotifications(
            examData,
            userName
          );
        } else {
          console.log('📱 No exam data available');
        }
      } catch (error) {
        console.error('❌ Error checking notifications after scheduled refresh:', error);
      }

      // Notify listeners that data has been refreshed
      this.notifyListeners();

    } catch (error) {
      console.error('❌ Error during scheduled refresh:', error);
    }
  }

  // Start background monitoring for scheduled refreshes
  startScheduledRefreshMonitoring(): () => void {
    console.log('🚀 Starting scheduled refresh monitoring...');
    console.log('Next refresh:', this.getNextScheduledRefresh());

    // Check every 5 minutes
    const intervalId = setInterval(async () => {
      if (this.isScheduledRefreshTime()) {
        await this.performScheduledRefresh();
      }
    }, 5 * 60 * 1000); // 5 minutes

    // Return cleanup function
    return () => {
      console.log('🛑 Stopping scheduled refresh monitoring');
      clearInterval(intervalId);
    };
  }

  // Get next scheduled refresh time
  getNextScheduledRefresh(): { time: string; type: 'midnight' | 'afternoon' } {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(0, 0, 0, 0);

    const afternoon = new Date(now);
    afternoon.setHours(17, 0, 0, 0);

    // If we already passed today's times, get tomorrow's
    if (now > afternoon) {
      midnight.setDate(midnight.getDate() + 1);
      afternoon.setDate(afternoon.getDate() + 1);
    }

    const nextTime = now < midnight ? midnight : afternoon;
    const type = nextTime.getHours() === 0 ? 'midnight' : 'afternoon';

    return {
      time: nextTime.toLocaleTimeString(),
      type
    };
  }

  // Manually trigger scheduled refresh (for testing)
  async triggerManualRefresh(): Promise<void> {
    console.log('🔧 Manual refresh triggered');
    await this.performScheduledRefresh();
  }

  // Initialize session on app startup
  async initializeSession(): Promise<void> {
    try {
      this.sessionState.isLoading = true;
      this.notifyListeners();

      const hasCredentials = await isLoggedIn();
      if (!hasCredentials) {
        this.sessionState = {
          isAuthenticated: false,
          isLoading: false,
        };
        this.notifyListeners();
        return;
      }

      // Skip session validation - assume stored credentials are always valid
      // Get user info from storage
      const rollNo = await AsyncStorage.getItem('nimora_rollno');
      const timestamp = await AsyncStorage.getItem('session_timestamp');

      this.sessionState = {
        isAuthenticated: true,
        isLoading: false,
        userRollNo: rollNo || undefined,
        lastLoginTime: timestamp ? parseInt(timestamp) : undefined,
      };

      // Start scheduled refresh monitoring
      this.scheduledRefreshCleanup = this.startScheduledRefreshMonitoring();

      this.notifyListeners();
    } catch (error) {
      console.error('Error initializing session:', error);
      this.sessionState = {
        isAuthenticated: false,
        isLoading: false,
      };
      this.notifyListeners();
    }
  }

  // Login user and update session state
  async login(rollNo: string, password: string): Promise<void> {
    try {
      this.sessionState.isLoading = true;
      this.notifyListeners();

      // Store credentials (this is handled by loginUser in attendanceService)
      const timestamp = Date.now();

      this.sessionState = {
        isAuthenticated: true,
        isLoading: false,
        userRollNo: rollNo,
        lastLoginTime: timestamp,
      };

      this.notifyListeners();
    } catch (error) {
      this.sessionState.isLoading = false;
      this.notifyListeners();
      throw error;
    }
  }

  // Logout user and clear session
  async logout(): Promise<void> {
    try {
      this.sessionState.isLoading = true;
      this.notifyListeners();

      await this.clearSession();

      this.sessionState = {
        isAuthenticated: false,
        isLoading: false,
      };

      this.notifyListeners();
    } catch (error) {
      console.error('Error during logout:', error);
      this.sessionState.isLoading = false;
      this.notifyListeners();
      throw error;
    }
  }

  // Clear all session data
  private async clearSession(): Promise<void> {
    try {
      const keys = [
        'saved_rollno',
        'saved_password',
        'session_timestamp',
        'nimora_rollno',
        'nimora_auth'
      ];

      await AsyncStorage.multiRemove(keys);

      // Stop scheduled refresh monitoring
      if (this.scheduledRefreshCleanup) {
        this.scheduledRefreshCleanup();
        this.scheduledRefreshCleanup = undefined;
      }
    } catch (error) {
      console.error('Error clearing session data:', error);
      throw error;
    }
  }

  // Check if session is expired (optional feature)
  isSessionExpired(maxAge: number = 24 * 60 * 60 * 1000): boolean { // 24 hours default
    if (!this.sessionState.lastLoginTime) return true;
    const now = Date.now();
    return (now - this.sessionState.lastLoginTime) > maxAge;
  }

  // Refresh session (validate current credentials)
  async refreshSession(): Promise<boolean> {
    try {
      const isValid = await validateSession();
      if (!isValid) {
        await this.clearSession();
        this.sessionState = {
          isAuthenticated: false,
          isLoading: false,
        };
        this.notifyListeners();
      }
      return isValid;
    } catch (error) {
      console.error('Error refreshing session:', error);
      return false;
    }
  }
}

// Export singleton instance
export const sessionManager = SessionManager.getInstance();

// React hook for using session state
export const useSession = () => {
  const [sessionState, setSessionState] = React.useState(sessionManager.getSessionState());

  React.useEffect(() => {
    const unsubscribe = sessionManager.subscribe(setSessionState);
    return unsubscribe;
  }, []);

  return {
    ...sessionState,
    login: sessionManager.login.bind(sessionManager),
    logout: sessionManager.logout.bind(sessionManager),
    refreshSession: sessionManager.refreshSession.bind(sessionManager),
    isSessionExpired: sessionManager.isSessionExpired.bind(sessionManager),
  };
};
