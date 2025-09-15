import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchAndCacheAllData, getStoredCredentials } from './attendanceService';
import { AppState } from 'react-native';

// Background data refresh utilities
export const backgroundRefresh = {
  // Check if it's time for daily refresh (5 PM)
  shouldRefreshData(): boolean {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Check if it's 5 PM (17:00)
    return currentHour === 17 && currentMinute >= 0 && currentMinute <= 59;
  },

  // Get last refresh timestamp
  async getLastRefreshTime(): Promise<number | null> {
    try {
      const timestamp = await AsyncStorage.getItem('nimora_last_refresh');
      return timestamp ? parseInt(timestamp) : null;
    } catch (error) {
      console.error('Error getting last refresh time:', error);
      return null;
    }
  },

  // Set last refresh timestamp
  async setLastRefreshTime(): Promise<void> {
    try {
      await AsyncStorage.setItem('nimora_last_refresh', Date.now().toString());
    } catch (error) {
      console.error('Error setting last refresh time:', error);
    }
  },

  // Check if we should perform daily refresh
  async shouldPerformDailyRefresh(): Promise<boolean> {
    try {
      const lastRefresh = await this.getLastRefreshTime();
      if (!lastRefresh) return true;

      const now = new Date();
      const lastRefreshDate = new Date(lastRefresh);

      // Check if it's a different day
      const isDifferentDay = now.getDate() !== lastRefreshDate.getDate() ||
                            now.getMonth() !== lastRefreshDate.getMonth() ||
                            now.getFullYear() !== lastRefreshDate.getFullYear();

      // Check if it's 5 PM and we haven't refreshed today
      const isRefreshTime = this.shouldRefreshData();

      return isDifferentDay && isRefreshTime;
    } catch (error) {
      console.error('Error checking daily refresh:', error);
      return false;
    }
  },

  // Perform background data refresh
  async performBackgroundRefresh(): Promise<void> {
    try {
      // Check if user is logged in
      const credentials = await getStoredCredentials();
      if (!credentials) {
        return;
      }

      // Check if we should perform daily refresh
      const shouldRefresh = await this.shouldPerformDailyRefresh();
      if (!shouldRefresh) {
        return;
      }

      // Perform the refresh
      await fetchAndCacheAllData(credentials.rollNo, credentials.password);

      // Update last refresh time
      await this.setLastRefreshTime();

    } catch (error) {
      console.error('Error during background refresh:', error);
    }
  },

  // Schedule next refresh (for manual triggering)
  async scheduleNextRefresh(): Promise<void> {
    try {
      // Calculate next 5 PM
      const now = new Date();
      const nextRefresh = new Date();

      // Set to 5 PM today
      nextRefresh.setHours(17, 0, 0, 0);

      // If it's already past 5 PM today, set to tomorrow
      if (now >= nextRefresh) {
        nextRefresh.setDate(nextRefresh.getDate() + 1);
      }

      const timeUntilRefresh = nextRefresh.getTime() - now.getTime();

      // Store the scheduled time
      await AsyncStorage.setItem('nimora_next_refresh', nextRefresh.getTime().toString());
    } catch (error) {
      console.error('Error scheduling next refresh:', error);
    }
  },

  // Get time until next refresh
  async getTimeUntilNextRefresh(): Promise<number | null> {
    try {
      const nextRefreshTime = await AsyncStorage.getItem('nimora_next_refresh');
      if (!nextRefreshTime) return null;

      const nextRefresh = parseInt(nextRefreshTime);
      const now = Date.now();

      return Math.max(0, nextRefresh - now);
    } catch (error) {
      console.error('Error getting time until next refresh:', error);
      return null;
    }
  }
};

// App state monitoring for background refresh
let refreshInterval: ReturnType<typeof setInterval> | null = null;

// Initialize background refresh system
export const initializeBackgroundRefresh = async (): Promise<void> => {
  try {
    // Schedule next refresh
    await backgroundRefresh.scheduleNextRefresh();

    // Set up periodic check (every 30 minutes when app is active)
    const startPeriodicCheck = () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }

      refreshInterval = setInterval(async () => {
        try {
          // Only perform refresh if app is active
          if (AppState.currentState === 'active') {
            await backgroundRefresh.performBackgroundRefresh();
          }
        } catch (error) {
          console.error('Error in background refresh interval:', error);
        }
      }, 30 * 60 * 1000); // 30 minutes
    };

    // Start periodic check
    startPeriodicCheck();

    // Listen to app state changes
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        // App became active, restart periodic check
        startPeriodicCheck();
      } else if (nextAppState === 'background') {
        // App went to background, clear interval to save battery
        if (refreshInterval) {
          clearInterval(refreshInterval);
          refreshInterval = null;
        }
      }
    });

    // Store subscription for cleanup
    await AsyncStorage.setItem('nimora_app_state_subscription', 'active');

  } catch (error) {
    console.error('Error initializing background refresh:', error);
  }
};

// Cleanup function
export const cleanupBackgroundRefresh = async (): Promise<void> => {
  try {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
    await AsyncStorage.removeItem('nimora_app_state_subscription');
  } catch (error) {
    console.error('Error cleaning up background refresh:', error);
  }
};

// Manual refresh function (can be called from UI)
export const manualRefreshData = async (): Promise<void> => {
  try {
    const credentials = await getStoredCredentials();
    if (!credentials) {
      throw new Error('No credentials found');
    }

    await fetchAndCacheAllData(credentials.rollNo, credentials.password);
    await backgroundRefresh.setLastRefreshTime();

  } catch (error) {
    console.error('Error during manual refresh:', error);
    throw error;
  }
};
