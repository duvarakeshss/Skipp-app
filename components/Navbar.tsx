import React, { useState } from 'react'
import { useRouter, usePathname } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native'

const Navbar = () => {
  const router = useRouter()
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  // Define navigation items with Expo Router paths
  const navItems = [
    { path: '/(tabs)' as const, name: 'Home', icon: 'home' },
    { path: '/login' as const, name: 'Login', icon: 'log-in' },
  ]

  const handleLogout = () => {
    // Clear stored credentials (implement based on your auth system)
    // For now, just navigate to login
    router.replace('/login')
  }

  const handleNavigation = (path: '/(tabs)' | '/login') => {
    router.push(path)
  }

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  return (
    <View style={styles.navbarContainer}>
      <View style={styles.navbarContent}>
        <View style={styles.logoContainer}>
          <View style={styles.logoWrapper}>
            <Image
              source={require('../assets/images/icon.png')}
              style={styles.logo}
            />
            <View style={styles.logoGlow} />
          </View>
          <Text style={styles.brandText}>NIMORA</Text>
        </View>

        {/* Mobile menu button - hidden for now */}
        <TouchableOpacity
          onPress={toggleMenu}
          style={styles.mobileMenuButton}
        >
          <Ionicons
            name={isMenuOpen ? 'close' : 'menu'}
            size={20}
            color="#ffffff"
          />
        </TouchableOpacity>

        {/* Desktop navigation */}
        <View style={styles.navContainer}>
          {navItems.map((item) => {
            const isActive = pathname === item.path
            return (
              <TouchableOpacity
                key={item.path}
                onPress={() => handleNavigation(item.path)}
                style={[
                  styles.navButton,
                  isActive && styles.navButtonActive
                ]}
              >
                <Ionicons
                  name={item.icon as any}
                  size={16}
                  color={isActive ? '#ffffff' : '#cbd5e1'}
                />
                <Text style={[
                  styles.navText,
                  isActive && styles.navTextActive
                ]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Desktop logout button */}
        <TouchableOpacity
          onPress={handleLogout}
          style={styles.logoutButton}
        >
          <Ionicons name="log-out" size={16} color="#ffffff" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Mobile navigation menu */}
      {isMenuOpen && (
        <View style={styles.mobileMenu}>
          <View style={styles.mobileMenuContent}>
            {navItems.map((item) => {
              const isActive = pathname === item.path
              return (
                <TouchableOpacity
                  key={item.path}
                  onPress={() => {
                    handleNavigation(item.path)
                    setIsMenuOpen(false)
                  }}
                  style={[
                    styles.mobileNavButton,
                    isActive && styles.mobileNavButtonActive
                  ]}
                >
                  <Ionicons
                    name={item.icon as any}
                    size={20}
                    color={isActive ? '#ffffff' : '#cbd5e1'}
                  />
                  <Text style={[
                    styles.mobileNavText,
                    isActive && styles.mobileNavTextActive
                  ]}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )
            })}

            <TouchableOpacity
              onPress={handleLogout}
              style={styles.mobileLogoutButton}
            >
              <Ionicons name="log-out" size={20} color="#ffffff" />
              <Text style={styles.mobileLogoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  navbarContainer: {
    backgroundColor: '#0f172a',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(71, 85, 105, 0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  navbarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  logo: {
    width: 40,
    height: 40,
  },
  logoGlow: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    backgroundColor: 'rgba(37, 99, 235, 0.3)',
    borderRadius: 24,
  },
  brandText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  mobileMenuButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(51, 65, 85, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
  },
  navContainer: {
    flexDirection: 'row',
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginRight: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.3)',
  },
  navButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: 'rgba(37, 99, 235, 0.5)',
    transform: [{ scale: 1.05 }],
  },
  navText: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  navTextActive: {
    color: '#ffffff',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#dc2626',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.3)',
  },
  logoutText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },
  mobileMenu: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(71, 85, 105, 0.5)',
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: 12,
    padding: 16,
  },
  mobileMenuContent: {
    gap: 8,
  },
  mobileNavButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(51, 65, 85, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.3)',
  },
  mobileNavButtonActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.8)',
    borderColor: 'rgba(37, 99, 235, 0.5)',
  },
  mobileNavText: {
    color: '#cbd5e1',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  mobileNavTextActive: {
    color: '#ffffff',
  },
  mobileLogoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(220, 38, 38, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.3)',
  },
  mobileLogoutText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
})

export default Navbar