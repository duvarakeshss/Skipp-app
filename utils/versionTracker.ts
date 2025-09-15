import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchAndCacheAllData, getStoredCredentials } from './attendanceService';

// App version tracking and update detection
class VersionTracker {
  private static instance: VersionTracker;
  private readonly VERSION_KEY = 'nimora_app_version';
  private readonly LAST_UPDATE_CHECK = 'nimora_last_update_check';

  private constructor() {}

  static getInstance(): VersionTracker {
    if (!VersionTracker.instance) {
      VersionTracker.instance = new VersionTracker();
    }
    return VersionTracker.instance;
  }

  // Get current app version from package.json
  private getCurrentVersion(): string {
    // This would normally come from package.json, but we'll hardcode for now
    // In a real app, you might want to use a build-time constant
    return '1.0.0';
  }

  // Get stored app version
  async getStoredVersion(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(this.VERSION_KEY);
    } catch (error) {
      console.error('Error getting stored version:', error);
      return null;
    }
  }

  // Store current app version
  async storeCurrentVersion(): Promise<void> {
    try {
      const currentVersion = this.getCurrentVersion();
      await AsyncStorage.setItem(this.VERSION_KEY, currentVersion);
    } catch (error) {
      console.error('Error storing current version:', error);
    }
  }

  // Check if app was updated
  async wasAppUpdated(): Promise<boolean> {
    try {
      const storedVersion = await this.getStoredVersion();
      const currentVersion = this.getCurrentVersion();

      if (!storedVersion) {
        // First time running the app
        return false;
      }

      return storedVersion !== currentVersion;
    } catch (error) {
      console.error('Error checking app update:', error);
      return false;
    }
  }

  // Get last update check timestamp
  async getLastUpdateCheck(): Promise<number | null> {
    try {
      const timestamp = await AsyncStorage.getItem(this.LAST_UPDATE_CHECK);
      return timestamp ? parseInt(timestamp) : null;
    } catch (error) {
      console.error('Error getting last update check:', error);
      return null;
    }
  }

  // Update last update check timestamp
  async updateLastUpdateCheck(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.LAST_UPDATE_CHECK, Date.now().toString());
    } catch (error) {
      console.error('Error updating last update check:', error);
    }
  }

  // Check if we should perform update refresh (not too frequent)
  async shouldPerformUpdateRefresh(): Promise<boolean> {
    try {
      const lastCheck = await this.getLastUpdateCheck();
      if (!lastCheck) return true;

      const now = Date.now();
      const hoursSinceLastCheck = (now - lastCheck) / (1000 * 60 * 60);

      // Only check for updates once per day to avoid excessive refreshes
      return hoursSinceLastCheck >= 24;
    } catch (error) {
      console.error('Error checking update refresh timing:', error);
      return true;
    }
  }

  // Handle app update - refresh all data if app was updated
  async handleAppUpdate(): Promise<boolean> {
    try {
      // Check if we should perform update check
      const shouldCheck = await this.shouldPerformUpdateRefresh();
      if (!shouldCheck) {
        return false;
      }

      // Check if app was updated
      const wasUpdated = await this.wasAppUpdated();
      if (!wasUpdated) {
        await this.updateLastUpdateCheck();
        return false;
      }

      console.log('📱 App was updated, refreshing all data...');

      // Get stored credentials
      const credentials = await getStoredCredentials();
      if (!credentials) {
        console.log('No credentials found, skipping update refresh');
        await this.storeCurrentVersion();
        await this.updateLastUpdateCheck();
        return false;
      }

      // Clear all cached data and fetch fresh data
      await this.refreshAllDataAfterUpdate(credentials.rollNo, credentials.password);

      // Update stored version and timestamp
      await this.storeCurrentVersion();
      await this.updateLastUpdateCheck();

      console.log('✅ App update refresh completed successfully');
      return true;

    } catch (error) {
      console.error('❌ Error handling app update:', error);
      // Still update version to prevent repeated attempts
      await this.storeCurrentVersion();
      await this.updateLastUpdateCheck();
      return false;
    }
  }

  // Refresh all data after app update
  private async refreshAllDataAfterUpdate(rollNo: string, password: string): Promise<void> {
    try {
      console.log('🔄 Refreshing all cached data after app update...');

      // Import dataCache to clear all cached data
      const { dataCache } = await import('./attendanceService');

      // Clear all cached data
      await dataCache.clearAllCache();

      // Fetch fresh data for all types
      await fetchAndCacheAllData(rollNo, password);

      console.log('✅ All data refreshed after app update');

    } catch (error) {
      console.error('Error refreshing data after update:', error);
      throw error;
    }
  }

  // Force refresh for manual triggers
  async forceUpdateRefresh(): Promise<void> {
    try {
      console.log('🔧 Force update refresh triggered...');

      const credentials = await getStoredCredentials();
      if (!credentials) {
        throw new Error('No credentials found for force refresh');
      }

      await this.refreshAllDataAfterUpdate(credentials.rollNo, credentials.password);
      await this.storeCurrentVersion();
      await this.updateLastUpdateCheck();

      console.log('✅ Force update refresh completed');

    } catch (error) {
      console.error('Error during force update refresh:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const versionTracker = VersionTracker.getInstance();

// Export individual functions for convenience
export const handleAppUpdate = () => versionTracker.handleAppUpdate();
export const forceUpdateRefresh = () => versionTracker.forceUpdateRefresh();