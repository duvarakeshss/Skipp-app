import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

interface ProfileMenuProps {
  visible: boolean;
  onClose: () => void;
  onSettings: () => void;
  onLogout: () => void;
}

export default function ProfileMenu({
  visible,
  onClose,
  onSettings,
  onLogout,
}: ProfileMenuProps) {
  const handleSettings = () => {
    onClose();
    onSettings();
  };

  const handleLogout = () => {
    onClose();
    onLogout();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.menuContainer}>
          <View style={styles.menuItems}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleSettings}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#7c3aed', '#a855f7', '#c084fc']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.menuItemGradient}
              >
                <View style={styles.menuItemContent}>
                  <Ionicons name="settings" size={20} color="#ffffff" />
                  <Text style={styles.menuItemText}>Settings</Text>
                  <Ionicons name="chevron-forward" size={16} color="#ffffff" />
                </View>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#dc2626', '#ef4444', '#f87171']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.menuItemGradient}
              >
                <View style={styles.menuItemContent}>
                  <Ionicons name="log-out" size={20} color="#ffffff" />
                  <Text style={styles.menuItemText}>Logout</Text>
                  <Ionicons name="chevron-forward" size={16} color="#ffffff" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 60,
    paddingRight: 20,
  },
  menuContainer: {
    width: width * 0.6,
    maxWidth: 240,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    marginTop: 10,
  },
  menuItems: {
    paddingVertical: 4,
  },
  menuItem: {
    marginHorizontal: 8,
    marginVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  menuItemGradient: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
    marginLeft: 12,
  },
});
