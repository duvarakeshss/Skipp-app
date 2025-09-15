import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  notificationsEnabled: boolean;
  examNotificationsEnabled: boolean;
  onToggleNotifications: () => void;
  onToggleExamNotifications: () => void;
  onRefreshData?: () => void;
  isRefreshingData?: boolean;
}

export default function SettingsModal({
  visible,
  onClose,
  notificationsEnabled,
  examNotificationsEnabled,
  onToggleNotifications,
  onToggleExamNotifications,
  onRefreshData,
  isRefreshingData = false,
}: SettingsModalProps) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={['#1e3a8a', '#3b82f6', '#60a5fa']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.modalHeader}
          >
            <View style={styles.modalTitleContainer}>
              <Ionicons name="settings" size={24} color="#ffffff" />
              <Text style={styles.modalTitle}>Settings</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#ffffff" />
            </TouchableOpacity>
          </LinearGradient>

          <View style={styles.modalContent}>
            {/* Attendance Notifications */}
            <View style={styles.settingItem}>
              <LinearGradient
                colors={['#7c3aed', '#a855f7', '#c084fc']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.settingHeader}
              >
                <View style={styles.settingIconContainer}>
                  <Ionicons name="notifications" size={20} color="#7c3aed" />
                </View>
                <Text style={styles.settingTitle}>Attendance Alerts</Text>
                <TouchableOpacity
                  style={styles.settingToggle}
                  onPress={onToggleNotifications}
                >
                  <View style={[
                    styles.toggleSwitch,
                    notificationsEnabled && styles.toggleSwitchEnabled
                  ]}>
                    <View style={[
                      styles.toggleKnob,
                      notificationsEnabled && styles.toggleKnobEnabled
                    ]} />
                  </View>
                </TouchableOpacity>
              </LinearGradient>

              <View style={styles.settingContent}>
                <Text style={styles.settingText}>
                  Get notified when your attendance drops below 80% in any course
                </Text>
              </View>
            </View>

            {/* Exam Notifications */}
            <View style={styles.settingItem}>
              <LinearGradient
                colors={['#059669', '#10b981', '#34d399']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.settingHeader}
              >
                <View style={styles.settingIconContainer}>
                  <Ionicons name="calendar" size={20} color="#059669" />
                </View>
                <Text style={styles.settingTitle}>Exam Reminders</Text>
                <TouchableOpacity
                  style={styles.settingToggle}
                  onPress={onToggleExamNotifications}
                >
                  <View style={[
                    styles.toggleSwitch,
                    examNotificationsEnabled && styles.toggleSwitchEnabled
                  ]}>
                    <View style={[
                      styles.toggleKnob,
                      examNotificationsEnabled && styles.toggleKnobEnabled
                    ]} />
                  </View>
                </TouchableOpacity>
              </LinearGradient>

              <View style={styles.settingContent}>
                <Text style={styles.settingText}>
                  Get reminded about exams: 6PM the day before and 6AM on exam day
                </Text>
              </View>
            </View>

            {/* Refresh Data */}
            <View style={styles.settingItem}>
              <LinearGradient
                colors={['#dc2626', '#ef4444', '#f87171']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.settingHeader}
              >
                <View style={styles.settingIconContainer}>
                  <Ionicons name="refresh" size={20} color="#dc2626" />
                </View>
                <Text style={styles.settingTitle}>Refresh Data</Text>
                <TouchableOpacity
                  style={styles.settingButton}
                  onPress={onRefreshData}
                  disabled={isRefreshingData}
                >
                  <Ionicons
                    name={isRefreshingData ? "hourglass" : "refresh"}
                    size={20}
                    color="#ffffff"
                  />
                </TouchableOpacity>
              </LinearGradient>

              <View style={styles.settingContent}>
                <Text style={styles.settingText}>
                  {isRefreshingData
                    ? "Refreshing data from server..."
                    : "Manually refresh all attendance, exam, and grade data"
                  }
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: width * 0.9,
    maxHeight: height * 0.7,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginLeft: 10,
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    padding: 20,
  },
  settingItem: {
    marginBottom: 20,
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  settingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  settingToggle: {
    padding: 4,
  },
  toggleSwitch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#d1d5db',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleSwitchEnabled: {
    backgroundColor: '#ffffff',
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#6b7280',
    alignSelf: 'flex-start',
  },
  toggleKnobEnabled: {
    backgroundColor: '#3b82f6',
    alignSelf: 'flex-end',
  },
  settingContent: {
    marginTop: 12,
    paddingHorizontal: 16,
  },
  settingText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  settingButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
