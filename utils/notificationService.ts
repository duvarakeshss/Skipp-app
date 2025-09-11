import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export class NotificationService {
  private static instance: NotificationService;

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // Request notification permissions
  async requestPermissions(): Promise<boolean> {
    if (!Device.isDevice) {
      console.log('Notifications only work on physical devices');
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Notification permissions not granted');
      return false;
    }

    return true;
  }

  // Check and send notifications for low attendance courses
  async checkAndSendLowAttendanceNotifications(
    attendanceData: any[],
    userName: string
  ): Promise<void> {
    try {
      // Check if notifications are enabled for this session
      const notificationsEnabled = await AsyncStorage.getItem('notifications_enabled');
      if (notificationsEnabled === 'false') {
        console.log('📱 Attendance notifications disabled by user');
        return;
      }

      // Validate input data
      if (!attendanceData || !Array.isArray(attendanceData) || attendanceData.length === 0) {
        console.log('📱 No attendance data available, skipping notifications');
        return;
      }

      // Validate userName
      if (!userName || typeof userName !== 'string' || userName.trim() === '') {
        console.log('📱 Invalid user name, skipping notifications');
        return;
      }

      // Get courses with attendance below 80%
      const lowAttendanceCourses = attendanceData.filter(course => {
        // Validate course data structure
        if (!course || typeof course !== 'object') return false;
        if (!course.percentage && !course[5]) return false;

        const percentage = parseFloat(course.percentage || course[5]);
        return !isNaN(percentage) && percentage < 80;
      });

      if (lowAttendanceCourses.length === 0) {
        console.log('📱 No courses with low attendance found');
        return;
      }

      // Check if we already sent notifications for these courses today
      const today = new Date().toDateString();
      const lastNotificationDate = await AsyncStorage.getItem('last_low_attendance_notification');

      if (lastNotificationDate === today) {
        console.log('📱 Already sent attendance notifications today');
        return;
      }

      // Send notification for each low attendance course
      for (const course of lowAttendanceCourses) {
        await this.sendLowAttendanceNotification(userName, course.courseCode, course.percentage);
        // Small delay between notifications to avoid spam
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Mark that we sent notifications today
      await AsyncStorage.setItem('last_low_attendance_notification', today);

    } catch (error) {
      console.error('Error sending low attendance notifications:', error);
    }
  }

  // Send individual low attendance notification
  private async sendLowAttendanceNotification(
    userName: string,
    courseCode: string,
    percentage: string
  ): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⚠️ Attendance Alert',
          body: `Hey ${userName}, ${courseCode} is at ${percentage}% - Action needed!`,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.HIGH,
          color: '#dc2626', // Red color for urgency
        },
        trigger: null, // Send immediately
      });

      console.log(`📱 Notification sent: ${courseCode} - ${percentage}%`);

    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }

  // Enable/disable notifications
  async setNotificationsEnabled(enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem('notifications_enabled', enabled.toString());
    } catch (error) {
      console.error('Error setting notification preference:', error);
    }
  }

  // Get notification preference
  async getNotificationsEnabled(): Promise<boolean> {
    try {
      const enabled = await AsyncStorage.getItem('notifications_enabled');
      return enabled !== 'false'; // Default to true
    } catch (error) {
      console.error('Error getting notification preference:', error);
      return true;
    }
  }

  // Clear notification history (for testing)
  async clearNotificationHistory(): Promise<void> {
    try {
      await AsyncStorage.removeItem('last_low_attendance_notification');
      await AsyncStorage.removeItem('last_exam_reminder_notification');
      console.log('🧹 Notification history cleared');
    } catch (error) {
      console.error('Error clearing notification history:', error);
    }
  }

  // Check and send exam notifications
  async checkAndSendExamNotifications(
    examData: any[],
    userName: string
  ): Promise<void> {
    try {
      // Check if exam notifications are enabled
      const examNotificationsEnabled = await AsyncStorage.getItem('exam_notifications_enabled');
      if (examNotificationsEnabled === 'false') {
        console.log('📱 Exam notifications disabled by user');
        return;
      }

      // Validate input data
      if (!examData || !Array.isArray(examData) || examData.length === 0) {
        console.log('📱 No exam data available, skipping notifications');
        return;
      }

      // Validate userName
      if (!userName || typeof userName !== 'string' || userName.trim() === '') {
        console.log('📱 Invalid user name, skipping exam notifications');
        return;
      }

      // Validate exam data structure
      const validExams = examData.filter(exam => {
        return exam &&
               typeof exam === 'object' &&
               (exam.COURSE_CODE || exam.course_code) &&
               (exam.DATE || exam.date) &&
               (exam.TIME || exam.time);
      });

      if (validExams.length === 0) {
        console.log('📱 No valid exam data found, skipping notifications');
        return;
      }

      console.log(`📱 Processing ${validExams.length} valid exams for notifications`);

      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Check for exams tomorrow at 6 PM
      const tomorrowExams = validExams.filter(exam => {
        const examDate = this.parseExamDate(exam.DATE || exam.date);
        return examDate && this.isSameDate(examDate, tomorrow);
      });

      if (tomorrowExams.length > 0) {
        console.log(`📱 Found ${tomorrowExams.length} exams tomorrow`);
        // Check if we already sent reminder today
        const today = now.toDateString();
        const lastReminderDate = await AsyncStorage.getItem('last_exam_reminder_notification');

        if (lastReminderDate !== today) {
          for (const exam of tomorrowExams) {
            await this.sendExamReminderNotification(
              userName,
              exam.COURSE_CODE || exam.course_code,
              exam.DATE || exam.date,
              exam.TIME || exam.time
            );
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

          // Mark reminder as sent today
          await AsyncStorage.setItem('last_exam_reminder_notification', today);
        } else {
          console.log('📱 Already sent exam reminders today');
        }
      } else {
        console.log('📱 No exams found for tomorrow');
      }

      // Schedule notifications for exam day at 6 AM
      for (const exam of validExams) {
        const examDate = this.parseExamDate(exam.DATE || exam.date);
        if (examDate && this.isSameDate(examDate, now)) {
          console.log(`📱 Found exam today: ${exam.COURSE_CODE || exam.course_code}`);
          // Check if we already sent today's exam notification
          const examKey = `exam_notification_${exam.COURSE_CODE || exam.course_code}_${exam.DATE || exam.date}`;
          const alreadySent = await AsyncStorage.getItem(examKey);

          if (!alreadySent) {
            await this.sendExamDayNotification(
              userName,
              exam.COURSE_CODE || exam.course_code,
              exam.TIME || exam.time
            );
            await AsyncStorage.setItem(examKey, 'sent');
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else {
            console.log(`📱 Already sent notification for today's exam: ${exam.COURSE_CODE || exam.course_code}`);
          }
        }
      }

    } catch (error) {
      console.error('Error sending exam notifications:', error);
    }
  }

  // Parse exam date string (DD-MM-YY format)
  private parseExamDate(dateString: string): Date | null {
    try {
      const parts = dateString.split('-');
      if (parts.length !== 3) return null;

      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1; // JS months are 0-based
      const year = 2000 + parseInt(parts[2]); // Convert YY to YYYY

      return new Date(year, month, day);
    } catch (error) {
      console.error('Error parsing exam date:', dateString, error);
      return null;
    }
  }

  // Check if two dates are the same day
  private isSameDate(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  // Send exam reminder notification (day before at 6 PM)
  private async sendExamReminderNotification(
    userName: string,
    courseCode: string,
    examDate: string,
    examTime: string
  ): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '📚 Exam Reminder',
          body: `Hey ${userName}, ${courseCode} exam tomorrow at ${examTime}`,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.HIGH,
          color: '#2563eb', // Blue color for information
        },
        trigger: null, // Send immediately
      });

      console.log(`📱 Exam reminder sent: ${courseCode} - ${examDate} at ${examTime}`);

    } catch (error) {
      console.error('Error sending exam reminder notification:', error);
    }
  }

  // Send exam day notification (same day at 6 AM)
  private async sendExamDayNotification(
    userName: string,
    courseCode: string,
    examTime: string
  ): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⏰ Exam Today',
          body: `Hey ${userName}, ${courseCode} exam time`,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.HIGH,
          color: '#dc2626', // Red color for urgency
        },
        trigger: null, // Send immediately
      });

      console.log(`📱 Exam day notification sent: ${courseCode} - exam time`);

    } catch (error) {
      console.error('Error sending exam day notification:', error);
    }
  }

  // Enable/disable exam notifications
  async setExamNotificationsEnabled(enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem('exam_notifications_enabled', enabled.toString());
    } catch (error) {
      console.error('Error setting exam notification preference:', error);
    }
  }

  // Get exam notification preference
  async getExamNotificationsEnabled(): Promise<boolean> {
    try {
      const enabled = await AsyncStorage.getItem('exam_notifications_enabled');
      return enabled !== 'false'; // Default to true
    } catch (error) {
      console.error('Error getting exam notification preference:', error);
      return true;
    }
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();
