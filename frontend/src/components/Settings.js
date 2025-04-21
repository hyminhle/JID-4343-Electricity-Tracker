import React, { useState, useEffect } from 'react';
import './Settings.css';
import { useAppDate } from './DateContext';
import { getEmailList, addEmailToList, removeEmailFromList } from '../utils/emailList'; // Import global email list functions

function Settings() {
  // Initialize theme from localStorage or default to light
  const [darkMode, setDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme === 'dark';
  });

  // Get app date from context
  const { appDate, setAppDate } = useAppDate();
  
  // State for date input fields
  const [dateValue, setDateValue] = useState(() => {
    return appDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
  });
  
  const [timeValue, setTimeValue] = useState(() => {
    return appDate.toTimeString().slice(0, 5); // Format as HH:MM
  });
  
  // New state for cache clearing feedback
  const [cacheClearFeedback, setCacheClearFeedback] = useState('');

  // State to manage email input
  const [email, setEmail] = useState('');
  const [emailList, setEmailList] = useState(getEmailList()); // Initialize from global list

  // Apply theme when component mounts and when darkMode changes
  useEffect(() => {
    const newTheme = darkMode ? 'dark' : 'light';
    // Apply to document element for CSS variable access
    document.documentElement.setAttribute('data-theme', newTheme);
    // Apply to body as a fallback
    document.body.setAttribute('data-theme', newTheme);
    // Store in localStorage
    localStorage.setItem('theme', newTheme);
    
    // Force a repaint if needed (sometimes helps with theme transitions)
    document.body.style.backgroundColor = '';
    
    // You can also add a class to body as an alternative approach
    if (darkMode) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(prevMode => !prevMode);
  };
  
  // Handle date and time changes
  const handleDateChange = (e) => {
    setDateValue(e.target.value);
    updateAppDate(e.target.value, timeValue);
  };
  
  const handleTimeChange = (e) => {
    setTimeValue(e.target.value);
    updateAppDate(dateValue, e.target.value);
  };
  
  // Update the global app date
  const updateAppDate = (date, time) => {
    const newDate = new Date(`${date}T${time}`);
    if (!isNaN(newDate.getTime())) {
      setAppDate(newDate);
    }
  };
  
  // Reset to current date and time
  const resetToCurrentDateTime = () => {
    const now = new Date();
    setAppDate(now);
    setDateValue(now.toISOString().split('T')[0]);
    setTimeValue(now.toTimeString().slice(0, 5));
  };


  // Function to clear all localStorage items
  const clearAllLocalData = () => {
    // This will clear everything in localStorage
    localStorage.clear();
    
    // Reset dark mode state to default (light)
    setDarkMode(false);
    
    // Show feedback to the user
    setCacheClearFeedback('All local data cleared successfully!');
    
    // Hide feedback after 3 seconds
    setTimeout(() => {
      setCacheClearFeedback('');
    }, 3000);
  };

  // Function to handle adding an email
  const addEmail = () => {
    if (email && !emailList.includes(email)) {
      addEmailToList(email); // Update global list
      setEmailList(getEmailList()); // Refresh local state
      setEmail(''); // Clear input field
    }
  };

  // Function to handle removing an email
  const removeEmail = (emailToRemove) => {
    removeEmailFromList(emailToRemove); // Update global list
    setEmailList(getEmailList()); // Refresh local state
  };

  return (
    <div className="settings-container">
      <h1 className="settings-title">Settings</h1>
      
      <div className="settings-section">
        <h2 className="section-title">Appearance</h2>
        
        <div className="setting-item">
          <div className="setting-info">
            <h3>Dark Mode</h3>
            <p>Switch between light and dark color themes</p>
          </div>
          <div className="setting-control">
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={darkMode} 
                onChange={toggleDarkMode}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>
      
      {/* Date/Time Setting Section */}
      <div className="settings-section">
        <h2 className="section-title">Date & Time</h2>
        
        <div className="setting-item">
          <div className="setting-info">
            <h3>Application Date</h3>
            <p>Set the global date for all app features</p>
          </div>
          <div className="setting-control date-time-control">
            <input 
              type="date" 
              className="date-input" 
              value={dateValue}
              onChange={handleDateChange}
            />
            <input 
              type="time" 
              className="time-input" 
              value={timeValue}
              onChange={handleTimeChange}
            />
            <button 
              className="add-email-button" 
              onClick={resetToCurrentDateTime}
              title="Reset to current time"
            >
              Reset
            </button>
          </div>
        </div>
        
        <div className="setting-item">
          <div className="setting-info">
            <h3>Current App Time</h3>
            <p>The date and time other app components will use</p>
          </div>
          <div className="setting-display">
            {appDate.toLocaleDateString()} {appDate.toLocaleTimeString()}
          </div>
        </div>
      </div>
      
      {/* Removed Data Preferences Section */}
      
      {/* Removed Cache Management Section */}
      
      <div className="settings-section">
        <h2 className="section-title">Account</h2>
        <div className="setting-item">
          <div className="setting-info">
            <h3>Notifications</h3>
            <p>Manage email and in-app notifications</p>
          </div>
          <div className="setting-control">
            <button className="add-email-button">Manage</button>
          </div>
        </div>
        
        <div className="setting-item">
          <div className="setting-info">
            <h3>Profile Settings</h3>
            <p>Update your profile information</p>
          </div>
          <div className="setting-control">
            <input 
              type="email" 
              placeholder="Enter your email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              className="email-input"
            />
            <button 
              className="add-email-button" 
              onClick={addEmail}
            >
              Add Email
            </button>
          </div>
        </div>

        <div className="setting-item">
          <div className="setting-info">
            <h3>Saved Emails</h3>
            <p>List of all saved emails</p>
          </div>
          <div className="setting-display">
            <ul>
              {emailList.map((email, index) => (
                <li key={index}>
                  {email}
                  <button 
                    className="remove-email-button" 
                    onClick={() => removeEmail(email)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;