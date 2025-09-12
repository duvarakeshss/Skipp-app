# Background Service Implementation

This document explains the background service implementation for API fetching and notifications in the Nimora app.

## Overview

The background service automatically fetches attendance and exam data, and sends notifications at scheduled times (12:00 AM and 5:00 PM) even when the app is closed.

## Key Components

### 1. Background Service (`backgroundService.ts`)
- Defines the background task using `expo-task-manager`
- Handles API fetching and notification sending
- Runs independently of the main app

### 2. Session Manager (`sessionManager.ts`)
- Registers/unregisters the background service
- Manages authentication state
- Provides background service status

### 3. Background Service Utils (`backgroundServiceUtils.ts`)
- Utility functions for debugging and testing
- Manual refresh triggering
- Service status checking

## How It Works

### Background Task Registration
```typescript
// Automatically registered when user logs in
await registerBackgroundRefresh();
```

### Scheduled Execution
- **12:00 AM (Midnight)**: Daily data refresh
- **5:00 PM (Afternoon)**: Daily data refresh
- Runs with 30-minute window to account for timing variations

### What Happens During Background Refresh
1. Check if user has stored credentials
2. Fetch latest attendance data from API
3. Fetch latest exam schedule from API
4. Send low attendance notifications (< 80%)
5. Send exam reminder notifications
6. Cache data for offline use

## Platform Support

### iOS
- Uses Background App Refresh
- Minimum interval: 15 minutes (iOS limitation)
- May be limited by system settings

### Android
- Uses WorkManager for reliable background execution
- More flexible scheduling
- Better battery optimization

## Configuration

### App.json Configuration
```json
{
  "plugins": [
    [
      "expo-task-manager",
      {
        "taskManager": {
          "background-refresh-task": {
            "taskName": "background-refresh-task",
            "taskType": "background-fetch",
            "minimumInterval": 900
          }
        }
      }
    ]
  ]
}
```

## Testing and Debugging

### Check Service Status
```typescript
import { BackgroundServiceUtils } from './utils/backgroundServiceUtils';

const status = await BackgroundServiceUtils.getServiceStatus();
console.log('Service Status:', status);
```

### Force Manual Refresh
```typescript
await BackgroundServiceUtils.forceRefresh();
```

### Clear Refresh History
```typescript
await BackgroundServiceUtils.clearRefreshHistory();
```

## Limitations

1. **iOS Restrictions**: Background execution is limited by iOS Background App Refresh settings
2. **Battery Optimization**: Android may restrict background work to save battery
3. **Network Requirements**: Requires internet connection for API calls
4. **Minimum Intervals**: iOS enforces 15-minute minimum interval

## Troubleshooting

### Service Not Running
1. Check if notifications are enabled in device settings
2. Verify Background App Refresh is enabled (iOS)
3. Check battery optimization settings (Android)
4. Ensure app has necessary permissions

### Notifications Not Sending
1. Verify notification permissions are granted
2. Check if user has enabled notifications in app settings
3. Ensure credentials are properly stored
4. Check device notification settings

### API Errors
1. Verify internet connection
2. Check if API endpoints are accessible
3. Validate stored credentials
4. Check server response format

## Best Practices

1. **Error Handling**: All background operations include comprehensive error handling
2. **Resource Management**: Background tasks are properly cleaned up on logout
3. **Battery Efficiency**: Tasks run only when necessary and at optimal times
4. **User Control**: Users can disable notifications and background refresh
5. **Data Validation**: All API responses are validated before processing

## Future Improvements

1. **Push Notifications**: Implement server-side push notifications for more reliable delivery
2. **Flexible Scheduling**: Allow users to customize refresh times
3. **Offline Support**: Better handling of offline scenarios
4. **Analytics**: Track background task success/failure rates
5. **User Feedback**: Provide status indicators for background operations