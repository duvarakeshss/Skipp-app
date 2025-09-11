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
    } else {
      timeGreeting = 'Good Evening';
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
    } else {
      greeting = 'Good Evening';
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

// Export secure storage utilities
export const clearCredentials = secureStorage.clearCredentials;
export const getStoredCredentials = secureStorage.getCredentials;

// Export additional API helpers
export { payloadSecurity };
