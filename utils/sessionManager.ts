import * as React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { validateSession, getStoredCredentials, dataCache } from './attendanceService';
import { fetchAndCacheAllData } from './attendanceService';
import { notificationService } from './notificationService';
import { registerBackgroundRefresh, unregisterBackgroundRefresh } from './backgroundService';
import { versionTracker } from './versionTracker';

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
  private backgroundRefreshCleanup?: () => void;

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

  // ===== BACKGROUND SERVICE SYSTEM =====
  // Automatically refreshes data at 12:00 AM and 5:00 PM daily using background tasks
  // Background tasks continue even when app is closed
  // Handles API fetching and notification sending



  // Start background refresh service
  private async startBackgroundRefreshService(): Promise<() => void> {
    // Register the background task
    await registerBackgroundRefresh();

    // Return cleanup function
    return async () => {
      await unregisterBackgroundRefresh();
    };
  }



  // Initialize session on app startup
  async initializeSession(): Promise<void> {
    try {
      this.sessionState.isLoading = true;
      this.notifyListeners();

      // Directly check if roll number is stored (skip full credential validation for faster startup)
      const rollNo = await AsyncStorage.getItem('nimora_rollno');
      if (!rollNo) {
        this.sessionState = {
          isAuthenticated: false,
          isLoading: false,
        };
        this.notifyListeners();
        return;
      }

      // Assume stored credentials are valid and get user info
      const timestamp = await AsyncStorage.getItem('session_timestamp');

      this.sessionState = {
        isAuthenticated: true,
        isLoading: false,
        userRollNo: rollNo,
        lastLoginTime: timestamp ? parseInt(timestamp) : undefined,
      };

      // Check for app updates and refresh data if needed
      try {
        await versionTracker.handleAppUpdate();
      } catch (updateError) {
        console.warn('⚠️ App update check failed, continuing with normal startup:', updateError);
      }

      // Start background refresh service
      this.backgroundRefreshCleanup = await this.startBackgroundRefreshService();

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

      // Initialize cache with fresh data
      try {
        await fetchAndCacheAllData(rollNo, password);
      } catch (cacheError) {
        console.warn('⚠️ Failed to initialize cache, but login successful:', cacheError);
        // Don't block login if cache fails
      }

      // Start background refresh service
      try {
        this.backgroundRefreshCleanup = await this.startBackgroundRefreshService();
      } catch (bgError) {
        console.warn('⚠️ Failed to start background refresh service:', bgError);
        // Don't block login if background service fails
      }

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

      // Clear all cached data
      await dataCache.clearAllCache();

      // Stop background refresh service
      if (this.backgroundRefreshCleanup) {
        await this.backgroundRefreshCleanup();
        this.backgroundRefreshCleanup = undefined;
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

  // Get background service status
  async getBackgroundServiceStatus(): Promise<{
    isRegistered: boolean;
    status: any;
  }> {
    const { getBackgroundTaskStatus } = await import('./backgroundService');
    return await getBackgroundTaskStatus();
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
