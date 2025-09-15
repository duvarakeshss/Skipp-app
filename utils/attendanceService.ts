import AsyncStorage from '@react-native-async-storage/async-storage';

// Environment variables for React Native
const API_BASE_URL = 'https://nimora-server.vercel.app';
const PAYLOAD_SALT = 'nimora_secure_payload_2025';

// Security utilities for Nimora client
export const securityUtils = {
  // Sanitize input to prevent XSS
  sanitizeInput: (input: string): string => {
    if (typeof input !== 'string') return input;
    return input.replace(/[<>]/g, '');
  },

  // Validate roll number format
  validateRollNumber: (rollNo: string): boolean => {
    if (!rollNo || typeof rollNo !== 'string') return false;
    // Basic validation - adjust regex based on your roll number format
    return /^[A-Za-z0-9]{6,20}$/.test(rollNo);
  },

  // Validate password strength
  validatePassword: (password: string): boolean => {
    if (!password || typeof password !== 'string') return false;
    return password.length >= 6; // Minimum length check
  },

  // Generate secure random string for additional security
  generateSecureToken: (): string => {
    return btoa(Math.random().toString()).substr(10, 10);
  }
};

// Simple encoding/decoding utility for payload security
const payloadSecurity = {
  // Encode payload data
  encode: (data: any): string => {
    try {
      // Convert to JSON string
      const jsonString = JSON.stringify(data);
      // Base64 encode
      const encoded = btoa(jsonString);
      // Add simple obfuscation (reverse and add salt)
      const obfuscated = encoded.split('').reverse().join('') + PAYLOAD_SALT;
      return btoa(obfuscated);
    } catch (error) {
      console.error('Error encoding payload:', error);
      throw new Error('Failed to encode payload');
    }
  },

  // Decode payload data
  decode: (encodedData: string): any => {
    try {
      // Remove base64 encoding
      const obfuscated = atob(encodedData);
      // Remove salt and reverse
      const reversed = obfuscated.slice(0, -PAYLOAD_SALT.length).split('').reverse().join('');
      // Decode base64
      const jsonString = atob(reversed);
      // Parse JSON
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('Error decoding payload:', error);
      throw new Error('Failed to decode payload');
    }
  }
};

// Secure storage utilities using AsyncStorage
const secureStorage = {
  setCredentials: async (rollNo: string, password: string): Promise<void> => {
    try {
      await AsyncStorage.setItem('nimora_rollno', rollNo);
      await AsyncStorage.setItem('nimora_auth', btoa(password)); // Base64 encoded for minimal obfuscation
    } catch (error) {
      console.warn('Failed to store credentials securely:', error);
      throw error;
    }
  },

  getCredentials: async (): Promise<{ rollNo: string; password: string } | null> => {
    try {
      const rollNo = await AsyncStorage.getItem('nimora_rollno');
      const auth = await AsyncStorage.getItem('nimora_auth');
      return rollNo && auth ? { rollNo, password: atob(auth) } : null;
    } catch (error) {
      console.warn('Failed to retrieve credentials:', error);
      return null;
    }
  },

  clearCredentials: async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem('nimora_rollno');
      await AsyncStorage.removeItem('nimora_auth');
    } catch (error) {
      console.warn('Failed to clear credentials:', error);
      throw error;
    }
  }
};

// Generic API request function with error handling
const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;

  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const finalOptions = { ...defaultOptions, ...options };

  // Encode payload data for POST requests
  if (finalOptions.method === 'POST' && finalOptions.body) {
    try {
      const originalData = JSON.parse(finalOptions.body as string);
      const encodedData = payloadSecurity.encode(originalData);
      finalOptions.body = JSON.stringify({ data: encodedData });
    } catch (error) {
      console.error('Error encoding request payload:', error);
    }
  }

  try {
    const response = await fetch(url, finalOptions);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`API request failed for ${endpoint}:`, error);
    throw error;
  }
};

// POST request helper
export const apiPost = (endpoint: string, data: any) => {
  return apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

// GET request helper
export const apiGet = (endpoint: string) => {
  return apiRequest(endpoint, {
    method: 'GET',
  });
};

// PUT request helper
export const apiPut = (endpoint: string, data: any) => {
  return apiRequest(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

// DELETE request helper
export const apiDelete = (endpoint: string) => {
  return apiRequest(endpoint, {
    method: 'DELETE',
  });
};

// Function to handle login request
export const loginUser = async (rollNo: string, password: string) => {
  // Validate inputs
  if (!securityUtils.validateRollNumber(rollNo)) {
    throw new Error('Invalid roll number format');
  }

  if (!securityUtils.validatePassword(password)) {
    throw new Error('Password must be at least 6 characters long');
  }

  // Sanitize inputs
  const sanitizedRollNo = securityUtils.sanitizeInput(rollNo);
  const sanitizedPassword = securityUtils.sanitizeInput(password);

  try {
    const result = await apiPost('/login', {
      rollno: sanitizedRollNo,
      password: sanitizedPassword
    });

    // Store credentials securely after successful login
    await secureStorage.setCredentials(sanitizedRollNo, sanitizedPassword);
    return result;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

// Function to fetch student attendance
export const getStudentAttendance = async (rollNo?: string, password?: string) => {
  try {
    // Use provided credentials or get from secure storage
    let credentials: { rollNo: string; password: string } | null = null;

    if (rollNo && password) {
      // Validate and sanitize provided credentials
      if (!securityUtils.validateRollNumber(rollNo)) {
        throw new Error('Invalid roll number format');
      }
      credentials = {
        rollNo: securityUtils.sanitizeInput(rollNo),
        password: securityUtils.sanitizeInput(password)
      };
    } else {
      // Get credentials from secure storage
      credentials = await secureStorage.getCredentials();
    }

    if (!credentials) {
      throw new Error('No credentials available. Please login first.');
    }

    const data = await apiPost('/attendance', {
      rollno: credentials.rollNo,
      password: credentials.password
    });

    // Transform API response to format expected by the frontend
    return data.map((item: any) => [
      item.course_code || item[0] || '',              // [0] Course code
      (item.total_classes || item[1] || 0).toString(), // [1] Total classes
      (item.absent || item[2] || 0).toString(),       // [2] Absent
      "0",                                           // [3] OD value (not provided in the API)
      (item.present || item[4] || 0).toString(),      // [4] Present
      (item.percentage || item[5] || 0).toString(),   // [5] Percentage
      (item.percentage || item[6] || 0).toString()    // [6] Percentage (duplicate for compatibility)
    ]);
  } catch (error) {
    console.error('Attendance fetch error:', error);
    throw error;
  }
};

// Greet user function
export const greetUser = async (rollNo?: string, password?: string) => {
  try {
    // Use provided credentials or get from secure storage
    let credentials: { rollNo: string; password: string } | null = null;

    if (rollNo && password) {
      // Validate and sanitize provided credentials
      if (!securityUtils.validateRollNumber(rollNo)) {
        throw new Error('Invalid roll number format');
      }
      credentials = {
        rollNo: securityUtils.sanitizeInput(rollNo),
        password: securityUtils.sanitizeInput(password)
      };
    } else {
      // Get credentials from secure storage
      credentials = await secureStorage.getCredentials();
    }

    if (!credentials) {
      throw new Error('No credentials available. Please login first.');
    }

    const data = await apiPost('/user-info', {
      rollno: credentials.rollNo,
      password: credentials.password
    });

    const username = data.username || credentials.rollNo;
    const isBirthday = data.is_birthday || false;

    const hour = new Date().getHours();
    let timeGreeting = '';

    if (hour < 12) {
      timeGreeting = 'Good Morning';
    } else if (hour < 18) {
      timeGreeting = 'Good Afternoon';
    } else if (hour < 20) {
      timeGreeting = 'Good Evening';
    } else {
      timeGreeting = 'Good Night';
    }

    if (isBirthday) {
      return `${timeGreeting} & Happy Birthday, ${username}!`;
    } else {
      return `${timeGreeting}, ${username}!`;
    }
  } catch (error) {
    console.error('Error fetching user greeting:', error);

    // Fallback to basic greeting with roll number if fetch fails
    const fallbackRollNo = rollNo || 'User';
    const hour = new Date().getHours();
    let greeting = '';

    if (hour < 12) {
      greeting = 'Good Morning';
    } else if (hour < 18) {
      greeting = 'Good Afternoon';
    } else if (hour < 20) {
      greeting = 'Good Evening';
    } else {
      greeting = 'Good Night';
    }

    return `${greeting}, ${fallbackRollNo}!`;
  }
};

// Function to fetch exam schedule
export const getExamSchedule = async (rollNo?: string, password?: string) => {
  try {
    // Use provided credentials or get from secure storage
    let credentials: { rollNo: string; password: string } | null = null;

    if (rollNo && password) {
      // Validate and sanitize provided credentials
      if (!securityUtils.validateRollNumber(rollNo)) {
        throw new Error('Invalid roll number format');
      }
      credentials = {
        rollNo: securityUtils.sanitizeInput(rollNo),
        password: securityUtils.sanitizeInput(password)
      };
    } else {
      // Get credentials from secure storage
      credentials = await secureStorage.getCredentials();
    }

    if (!credentials) {
      throw new Error('No credentials available. Please login first.');
    }

    const data = await apiPost('/exam-schedule', {
      rollno: credentials.rollNo,
      password: credentials.password
    });

    // Transform API response to format expected by the frontend
    if (data && data.exams && Array.isArray(data.exams)) {
      return data.exams.map((exam: any) => ({
        COURSE_CODE: exam.course_code || exam.COURSE_CODE || exam[0] || '',
        DATE: exam.date || exam.DATE || exam[1] || '',
        TIME: exam.time || exam.TIME || exam[2] || ''
      }));
    }

    // If no exams array, return empty array
    return [];
  } catch (error) {
    console.error('Exam schedule fetch error:', error);
    throw error;
  }
};

// Function to fetch internal marks
export const getInternals = async (rollNo?: string, password?: string) => {
  try {
    // Use provided credentials or get from secure storage
    let credentials: { rollNo: string; password: string } | null = null;

    if (rollNo && password) {
      // Validate and sanitize provided credentials
      if (!securityUtils.validateRollNumber(rollNo)) {
        throw new Error('Invalid roll number format');
      }
      credentials = {
        rollNo: securityUtils.sanitizeInput(rollNo),
        password: securityUtils.sanitizeInput(password)
      };
    } else {
      // Get credentials from secure storage
      credentials = await secureStorage.getCredentials();
    }

    if (!credentials) {
      throw new Error('No credentials available. Please login first.');
    }

    const data = await apiPost('/internals', {
      rollno: credentials.rollNo,
      password: credentials.password
    });

    // Return the internals data as received from API
    if (data && data.internals && Array.isArray(data.internals)) {
      return data.internals;
    }

    // If no internals array, return empty array
    return [];
  } catch (error) {
    console.error('Internals fetch error:', error);
    throw error;
  }
};

// Function to fetch CGPA data
export const getCgpa = async (rollNo?: string, password?: string) => {
  try {
    // Use provided credentials or get from secure storage
    let credentials: { rollNo: string; password: string } | null = null;

    if (rollNo && password) {
      // Validate and sanitize provided credentials
      if (!securityUtils.validateRollNumber(rollNo)) {
        throw new Error('Invalid roll number format');
      }
      credentials = {
        rollNo: securityUtils.sanitizeInput(rollNo),
        password: securityUtils.sanitizeInput(password)
      };
    } else {
      // Get credentials from secure storage
      credentials = await secureStorage.getCredentials();
    }

    if (!credentials) {
      throw new Error('No credentials available. Please login first.');
    }

    const data = await apiPost('/cgpa', {
      rollno: credentials.rollNo,
      password: credentials.password
    });

    // Return the CGPA data as received from API
    if (data && Array.isArray(data)) {
      return data;
    }

    // If no CGPA array, return empty array
    return [];
  } catch (error) {
    console.error('CGPA fetch error:', error);
    throw error;
  }
};

// Function to handle auto feedback
export const autoFeedback = async (rollNo?: string, password?: string, feedbackIndex?: number) => {
  try {
    // Use provided credentials or get from secure storage
    let credentials: { rollNo: string; password: string } | null = null;

    if (rollNo && password) {
      // Validate and sanitize provided credentials
      if (!securityUtils.validateRollNumber(rollNo)) {
        throw new Error('Invalid roll number format');
      }
      credentials = {
        rollNo: securityUtils.sanitizeInput(rollNo),
        password: securityUtils.sanitizeInput(password)
      };
    } else {
      // Get credentials from secure storage
      credentials = await secureStorage.getCredentials();
    }

    if (!credentials) {
      throw new Error('No credentials available. Please login first.');
    }

    if (feedbackIndex === undefined || feedbackIndex === null) {
      throw new Error('Feedback index is required');
    }

    const data = await apiPost('/auto-feedback', {
      rollno: credentials.rollNo,
      password: credentials.password,
      feedback_index: feedbackIndex
    });

    return data;
  } catch (error) {
    console.error('Auto feedback error:', error);
    throw error;
  }
};

// Data caching utilities
export const dataCache = {
  // Cache keys
  ATTENDANCE_DATA: 'nimora_attendance_data',
  EXAM_SCHEDULE: 'nimora_exam_schedule',
  INTERNALS_DATA: 'nimora_internals_data',
  CGPA_DATA: 'nimora_cgpa_data',
  USER_GREETING: 'nimora_user_greeting',
  LAST_UPDATE: 'nimora_last_update',

  // Cache data with timestamp
  async setAttendanceData(data: any[]): Promise<void> {
    try {
      const cacheData = {
        data,
        timestamp: Date.now(),
        type: 'attendance'
      };
      await AsyncStorage.setItem(this.ATTENDANCE_DATA, JSON.stringify(cacheData));
      await AsyncStorage.setItem(this.LAST_UPDATE, Date.now().toString());
    } catch (error) {
      console.error('Error caching attendance data:', error);
    }
  },

  async getAttendanceData(): Promise<any[] | null> {
    try {
      const cached = await AsyncStorage.getItem(this.ATTENDANCE_DATA);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      // Check if data is less than 24 hours old
      const isValid = Date.now() - cacheData.timestamp < 24 * 60 * 60 * 1000;
      return isValid ? cacheData.data : null;
    } catch (error) {
      console.error('Error retrieving cached attendance data:', error);
      return null;
    }
  },

  async setExamSchedule(data: any[]): Promise<void> {
    try {
      const cacheData = {
        data,
        timestamp: Date.now(),
        type: 'exam_schedule'
      };
      await AsyncStorage.setItem(this.EXAM_SCHEDULE, JSON.stringify(cacheData));
      await AsyncStorage.setItem(this.LAST_UPDATE, Date.now().toString());
    } catch (error) {
      console.error('Error caching exam schedule:', error);
    }
  },

  async getExamSchedule(): Promise<any[] | null> {
    try {
      const cached = await AsyncStorage.getItem(this.EXAM_SCHEDULE);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      // Check if data is less than 24 hours old
      const isValid = Date.now() - cacheData.timestamp < 24 * 60 * 60 * 1000;
      return isValid ? cacheData.data : null;
    } catch (error) {
      console.error('Error retrieving cached exam schedule:', error);
      return null;
    }
  },

  async setInternalsData(data: any[]): Promise<void> {
    try {
      const cacheData = {
        data,
        timestamp: Date.now(),
        type: 'internals'
      };
      await AsyncStorage.setItem(this.INTERNALS_DATA, JSON.stringify(cacheData));
      await AsyncStorage.setItem(this.LAST_UPDATE, Date.now().toString());
    } catch (error) {
      console.error('Error caching internals data:', error);
    }
  },

  async getInternalsData(): Promise<any[] | null> {
    try {
      const cached = await AsyncStorage.getItem(this.INTERNALS_DATA);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      // Check if data is less than 24 hours old
      const isValid = Date.now() - cacheData.timestamp < 24 * 60 * 60 * 1000;
      return isValid ? cacheData.data : null;
    } catch (error) {
      console.error('Error retrieving cached internals data:', error);
      return null;
    }
  },

  async setUserGreeting(data: string): Promise<void> {
    try {
      const cacheData = {
        data,
        timestamp: Date.now(),
        type: 'greeting'
      };
      await AsyncStorage.setItem(this.USER_GREETING, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error caching user greeting:', error);
    }
  },

  async getUserGreeting(): Promise<string | null> {
    try {
      const cached = await AsyncStorage.getItem(this.USER_GREETING);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      // Check if data is less than 24 hours old
      const isValid = Date.now() - cacheData.timestamp < 24 * 60 * 60 * 1000;
      return isValid ? cacheData.data : null;
    } catch (error) {
      console.error('Error retrieving cached user greeting:', error);
      return null;
    }
  },

  async setCgpaData(data: any[]): Promise<void> {
    try {
      const cacheData = {
        data,
        timestamp: Date.now(),
        type: 'cgpa'
      };
      await AsyncStorage.setItem(this.CGPA_DATA, JSON.stringify(cacheData));
      await AsyncStorage.setItem(this.LAST_UPDATE, Date.now().toString());
    } catch (error) {
      console.error('Error caching CGPA data:', error);
    }
  },

  async getCgpaData(): Promise<any[] | null> {
    try {
      const cached = await AsyncStorage.getItem(this.CGPA_DATA);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      // Check if data is less than 24 hours old
      const isValid = Date.now() - cacheData.timestamp < 24 * 60 * 60 * 1000;
      return isValid ? cacheData.data : null;
    } catch (error) {
      console.error('Error retrieving cached CGPA data:', error);
      return null;
    }
  },

  // Clear all cached data
  async clearAllCache(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        this.ATTENDANCE_DATA,
        this.EXAM_SCHEDULE,
        this.INTERNALS_DATA,
        this.CGPA_DATA,
        this.USER_GREETING,
        this.LAST_UPDATE
      ]);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }
};

// Function to fetch and cache all data at once
export const fetchAndCacheAllData = async (rollNo?: string, password?: string): Promise<void> => {
  try {
    // Get credentials
    let credentials: { rollNo: string; password: string } | null = null;

    if (rollNo && password) {
      credentials = {
        rollNo: securityUtils.sanitizeInput(rollNo),
        password: securityUtils.sanitizeInput(password)
      };
    } else {
      credentials = await secureStorage.getCredentials();
    }

    if (!credentials) {
      throw new Error('No credentials available');
    }

    // Fetch all data in parallel
    const [attendanceData, examSchedule, userGreeting, internalsData, cgpaData] = await Promise.allSettled([
      getStudentAttendance(credentials.rollNo, credentials.password),
      getExamSchedule(credentials.rollNo, credentials.password),
      greetUser(credentials.rollNo, credentials.password),
      getInternals(credentials.rollNo, credentials.password),
      getCgpa(credentials.rollNo, credentials.password)
    ]);

    // Cache successful results
    if (attendanceData.status === 'fulfilled') {
      await dataCache.setAttendanceData(attendanceData.value);
    } else {
      console.error('Failed to fetch attendance data:', attendanceData.reason);
    }

    if (examSchedule.status === 'fulfilled') {
      await dataCache.setExamSchedule(examSchedule.value);
    } else {
      console.error('Failed to fetch exam schedule:', examSchedule.reason);
    }

    if (userGreeting.status === 'fulfilled') {
      await dataCache.setUserGreeting(userGreeting.value);
    } else {
      console.error('Failed to fetch user greeting:', userGreeting.reason);
    }

    if (internalsData.status === 'fulfilled') {
      await dataCache.setInternalsData(internalsData.value);
    } else {
      console.error('Failed to fetch internals data:', internalsData.reason);
    }

    if (cgpaData.status === 'fulfilled') {
      await dataCache.setCgpaData(cgpaData.value);
    } else {
      console.error('Failed to fetch CGPA data:', cgpaData.reason);
    }

  } catch (error) {
    console.error('Error in fetchAndCacheAllData:', error);
    throw error;
  }
};

// Function to get cached data or fetch fresh data
export const getCachedOrFreshData = async (dataType: 'attendance' | 'exam_schedule' | 'internals' | 'cgpa' | 'greeting', rollNo?: string, password?: string) => {
  try {
    let cachedData = null;

    switch (dataType) {
      case 'attendance':
        cachedData = await dataCache.getAttendanceData();
        if (!cachedData) {
          cachedData = await getStudentAttendance(rollNo, password);
          await dataCache.setAttendanceData(cachedData);
        }
        break;
      case 'exam_schedule':
        cachedData = await dataCache.getExamSchedule();
        if (!cachedData) {
          cachedData = await getExamSchedule(rollNo, password);
          await dataCache.setExamSchedule(cachedData);
        }
        break;
      case 'internals':
        cachedData = await dataCache.getInternalsData();
        if (!cachedData) {
          cachedData = await getInternals(rollNo, password);
          await dataCache.setInternalsData(cachedData);
        }
        break;
      case 'cgpa':
        cachedData = await dataCache.getCgpaData();
        if (!cachedData) {
          cachedData = await getCgpa(rollNo, password);
          await dataCache.setCgpaData(cachedData);
        }
        break;
      case 'greeting':
        cachedData = await dataCache.getUserGreeting();
        if (!cachedData) {
          cachedData = await greetUser(rollNo, password);
          await dataCache.setUserGreeting(cachedData);
        }
        break;
    }

    return cachedData;
  } catch (error) {
    console.error(`Error getting ${dataType} data:`, error);
    throw error;
  }
};

// Function to validate existing session
export const validateSession = async (): Promise<boolean> => {
  try {
    const credentials = await getStoredCredentials();

    if (!credentials) {
      return false;
    }

    // Validate credentials by making a test API call (user greeting)
    await greetUser(credentials.rollNo, credentials.password);
    return true;
  } catch (error) {
    console.warn('Session validation failed:', error);
    // Clear invalid credentials
    await secureStorage.clearCredentials();
    return false;
  }
};

// Function to get stored credentials (with migration support)
export const getStoredCredentials = async (): Promise<{ rollNo: string; password: string } | null> => {
  try {
    let credentials = await secureStorage.getCredentials();

    // If no secure credentials, try to migrate from old storage
    if (!credentials) {
      const oldRollNo = await AsyncStorage.getItem('saved_rollno');
      const oldPassword = await AsyncStorage.getItem('saved_password');

      if (oldRollNo && oldPassword) {
        // Migrate old credentials to new secure storage
        await secureStorage.setCredentials(oldRollNo, oldPassword);
        credentials = { rollNo: oldRollNo, password: oldPassword };

        // Clear old storage
        await AsyncStorage.multiRemove(['saved_rollno', 'saved_password']);
      }
    }

    return credentials;
  } catch (error) {
    console.warn('Error retrieving stored credentials:', error);
    return null;
  }
};

// Function to get cache status information
export const getCacheStatus = async (): Promise<{
  attendance: boolean;
  exam_schedule: boolean;
  internals: boolean;
  cgpa: boolean;
  greeting: boolean;
  lastUpdate: number | null;
}> => {
  try {
    const [
      attendanceData,
      examSchedule,
      internalsData,
      cgpaData,
      userGreeting,
      lastUpdate
    ] = await AsyncStorage.multiGet([
      dataCache.ATTENDANCE_DATA,
      dataCache.EXAM_SCHEDULE,
      dataCache.INTERNALS_DATA,
      dataCache.CGPA_DATA,
      dataCache.USER_GREETING,
      dataCache.LAST_UPDATE
    ]);

    return {
      attendance: !!attendanceData[1],
      exam_schedule: !!examSchedule[1],
      internals: !!internalsData[1],
      cgpa: !!cgpaData[1],
      greeting: !!userGreeting[1],
      lastUpdate: lastUpdate[1] ? parseInt(lastUpdate[1]) : null
    };
  } catch (error) {
    console.error('Error getting cache status:', error);
    return {
      attendance: false,
      exam_schedule: false,
      internals: false,
      cgpa: false,
      greeting: false,
      lastUpdate: null
    };
  }
};

// Function to force refresh all cached data
export const forceRefreshCache = async (rollNo?: string, password?: string): Promise<void> => {
  try {
    // Clear existing cache
    await dataCache.clearAllCache();

    // Fetch fresh data
    await fetchAndCacheAllData(rollNo, password);

  } catch (error) {
    console.error('Error force refreshing cache:', error);
    throw error;
  }
};

// Function to check if cache is stale (older than specified hours)
export const isCacheStale = async (maxAgeHours: number = 24): Promise<boolean> => {
  try {
    const lastUpdate = await AsyncStorage.getItem(dataCache.LAST_UPDATE);
    if (!lastUpdate) return true;

    const lastUpdateTime = parseInt(lastUpdate);
    const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert hours to milliseconds
    const now = Date.now();

    return (now - lastUpdateTime) > maxAge;
  } catch (error) {
    console.error('Error checking cache staleness:', error);
    return true; // Assume stale if error
  }
};

// Function to get cache size information
export const getCacheSize = async (): Promise<{
  totalItems: number;
  estimatedSize: string;
  items: { [key: string]: boolean };
}> => {
  try {
    const keys = [
      dataCache.ATTENDANCE_DATA,
      dataCache.EXAM_SCHEDULE,
      dataCache.INTERNALS_DATA,
      dataCache.CGPA_DATA,
      dataCache.USER_GREETING,
      dataCache.LAST_UPDATE
    ];

    const results = await AsyncStorage.multiGet(keys);
    const items: { [key: string]: boolean } = {};
    let totalItems = 0;
    let estimatedSize = 0;

    results.forEach(([key, value]) => {
      const hasData = !!value;
      items[key] = hasData;
      if (hasData) {
        totalItems++;
        estimatedSize += value.length;
      }
    });

    // Convert bytes to human readable format
    const sizeInKB = (estimatedSize / 1024).toFixed(2);
    const sizeDisplay = estimatedSize > 1024 ? `${sizeInKB} KB` : `${estimatedSize} bytes`;

    return {
      totalItems,
      estimatedSize: sizeDisplay,
      items
    };
  } catch (error) {
    console.error('Error getting cache size:', error);
    return {
      totalItems: 0,
      estimatedSize: '0 bytes',
      items: {}
    };
  }
};

// Function to clear all stored credentials
export const clearCredentials = async (): Promise<void> => {
  try {
    // Clear secure storage
    await secureStorage.clearCredentials();

    // Also clear old storage keys for consistency
    await AsyncStorage.multiRemove(['saved_rollno', 'saved_password']);
  } catch (error) {
    console.warn('Error clearing credentials:', error);
    throw error;
  }
};
