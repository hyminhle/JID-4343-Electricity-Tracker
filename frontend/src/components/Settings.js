import React, { useState, useEffect } from 'react';
import './Settings.css';

function Settings() {
    // Initialize theme from localStorage or default to light
    const [darkMode, setDarkMode] = useState(() => {
      const savedTheme = localStorage.getItem('theme');
      return savedTheme === 'dark';
    });
  
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
      
      <div className="settings-section">
        <h2 className="section-title">Data Preferences</h2>
        
        <div className="setting-item">
          <div className="setting-info">
            <h3>Default View</h3>
            <p>Set your default landing page</p>
          </div>
          <div className="setting-control">
            <select className="select-control">
              <option value="dashboard">Dashboard</option>
              <option value="graph">Graph</option>
              <option value="map">Map</option>
              <option value="calendar">Calendar</option>
            </select>
          </div>
        </div>
        
        <div className="setting-item">
          <div className="setting-info">
            <h3>Data Refresh</h3>
            <p>Set how often data should automatically refresh</p>
          </div>
          <div className="setting-control">
            <select className="select-control">
              <option value="manual">Manual only</option>
              <option value="15min">Every 15 minutes</option>
              <option value="1hour">Every hour</option>
              <option value="daily">Daily</option>
            </select>
          </div>
        </div>
      </div>
      
      <div className="settings-section">
        <h2 className="section-title">Account</h2>
        <div className="setting-item">
          <div className="setting-info">
            <h3>Notifications</h3>
            <p>Manage email and in-app notifications</p>
          </div>
          <div className="setting-control">
            <button className="settings-button">Manage</button>
          </div>
        </div>
        
        <div className="setting-item">
          <div className="setting-info">
            <h3>Profile Settings</h3>
            <p>Update your profile information</p>
          </div>
          <div className="setting-control">
            <button className="settings-button">Edit Profile</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;