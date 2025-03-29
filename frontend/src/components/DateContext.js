import React, { useState, useEffect, createContext, useContext } from 'react';

// Create a context to provide the selected date to other components
export const AppDateContext = createContext(null);

// Provider component to wrap your app
export function AppDateProvider({ children }) {
  const [appDate, setAppDate] = useState(() => {
    const savedDate = localStorage.getItem('appDate');
    return savedDate ? new Date(savedDate) : new Date();
  });

  useEffect(() => {
    localStorage.setItem('appDate', appDate.toISOString());
  }, [appDate]);

  return (
    <AppDateContext.Provider value={{ appDate, setAppDate }}>
      {children}
    </AppDateContext.Provider>
  );
}

// Custom hook to access the date from any component
export function useAppDate() {
  const context = useContext(AppDateContext);
  if (!context) {
    throw new Error('useAppDate must be used within an AppDateProvider');
  }
  return context;
}