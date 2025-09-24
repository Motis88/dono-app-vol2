import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Load theme preference from localStorage
    const savedTheme = localStorage.getItem('dono-app-theme');
    if (savedTheme) {
      setIsDarkMode(savedTheme === 'dark');
    } else {
      // Default to system preference
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDarkMode(systemPrefersDark);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    localStorage.setItem('dono-app-theme', newTheme ? 'dark' : 'light');
  };

  const theme = {
    isDarkMode,
    toggleTheme,
    // Color schemes
    colors: {
      // Background colors
      bg: {
        primary: isDarkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100',
        secondary: isDarkMode ? 'bg-gray-800' : 'bg-white',
        tertiary: isDarkMode ? 'bg-gray-700' : 'bg-gray-50',
        form: isDarkMode ? 'bg-gray-800' : 'bg-white',
        card: isDarkMode ? 'bg-gray-800' : 'bg-white',
        input: isDarkMode ? 'bg-gray-800' : 'bg-white',
        inputHover: isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50',
        nav: isDarkMode ? 'bg-gray-900' : 'bg-white/95',
        gradient: isDarkMode 
          ? 'bg-gray-800' 
          : 'bg-gradient-to-br from-white to-blue-50',
        table: isDarkMode ? 'bg-gray-800' : 'bg-white',
        tableRow: isDarkMode ? 'bg-gray-700' : 'bg-gray-50',
        tableRowHover: isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-100',
      },
      // Text colors  
      text: {
        primary: isDarkMode ? 'text-white' : 'text-gray-800',
        secondary: isDarkMode ? 'text-gray-300' : 'text-gray-600',
        muted: isDarkMode ? 'text-gray-400' : 'text-gray-500',
        placeholder: isDarkMode ? 'placeholder-gray-400' : 'placeholder-gray-500',
        error: isDarkMode ? 'text-red-400' : 'text-red-700',
        success: isDarkMode ? 'text-green-400' : 'text-green-700',
      },
      // Border colors
      border: {
        primary: isDarkMode ? 'border-gray-600' : 'border-gray-200',
        secondary: isDarkMode ? 'border-gray-700' : 'border-gray-300',
        input: isDarkMode ? 'border-gray-600' : 'border-gray-300',
        focus: isDarkMode ? 'focus:border-blue-400' : 'focus:border-blue-500',
      },
      // Button colors (keeping gradients but adjusting for dark mode)
      button: {
        nav: isDarkMode ? 'text-gray-300 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50',
        navActive: isDarkMode 
          ? 'text-blue-400 font-bold bg-gray-800 border-b-2 border-blue-400' 
          : 'text-blue-600 font-bold bg-gradient-to-b from-blue-50 to-transparent shadow-inner border-b-2 border-blue-500'
      }
    }
  };

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};