import React, { useState, useEffect } from 'react';
import { useAppDate } from './DateContext';
import { useNavigate } from 'react-router-dom';
import './AlertWidget.css';

const AlertWidget = ({ isDarkMode }) => {
  const navigate = useNavigate();
  const { appDate } = useAppDate();
  const [alerts, setAlerts] = useState({
    total: 0,
    critical: 0,
    warning: 0,
    recentAlerts: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    // Check local storage for cached data when the date changes
    const cachedAlerts = checkCachedAlerts();
    if (cachedAlerts) {
      setAlerts(cachedAlerts);
      setIsLoading(false);
    } else {
      fetchAlertData();
    }
  }, [appDate]);

  // Generate a unique key for the alerts based on date
  const getAlertsStorageKey = () => {
    const dateKey = appDate.toISOString().split('T')[0]; // Format: YYYY-MM-DD
    return `electricity_alerts_widget_${dateKey}`;
  };

  // Check if we have cached alerts for the current date
  const checkCachedAlerts = () => {
    const storageKey = getAlertsStorageKey();
    const cachedAlertsJson = localStorage.getItem(storageKey);
    
    if (cachedAlertsJson) {
      try {
        const data = JSON.parse(cachedAlertsJson);
        // Check if the cache is from today (less than 4 hours old)
        const cacheTime = localStorage.getItem(`${storageKey}_timestamp`);
        if (cacheTime) {
          const elapsed = Date.now() - parseInt(cacheTime);
          const fourHours = 4 * 60 * 60 * 1000;
          if (elapsed < fourHours) {
            return data;
          }
        }
        return null; // Cache exists but is too old
      } catch (error) {
        console.error('Error parsing cached alert data:', error);
        return null;
      }
    }
    
    return null;
  };

  // Save the alert data to local storage
  const saveAlertsToLocalStorage = (data) => {
    const storageKey = getAlertsStorageKey();
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
      localStorage.setItem(`${storageKey}_timestamp`, Date.now().toString());
    } catch (error) {
      console.error('Error saving alert data to cache:', error);
      
      // If localStorage is full, try clearing older data
      if (error.name === 'QuotaExceededError') {
        try {
          // Clean up old alerts (older than 7 days)
          cleanupOldAlerts();
          // Try saving again
          localStorage.setItem(storageKey, JSON.stringify(data));
          localStorage.setItem(`${storageKey}_timestamp`, Date.now().toString());
        } catch (e) {
          console.error('Still unable to save alert data to localStorage after cleanup:', e);
        }
      }
    }
  };
  
  // Clean up older alerts from localStorage to free up space
  const cleanupOldAlerts = () => {
    const alertKeyPrefix = 'electricity_alerts_widget_';
    const today = new Date();
    
    // Keep alerts from the last 7 days
    const oldestDate = new Date();
    oldestDate.setDate(today.getDate() - 7);
    
    // Go through all localStorage items
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      
      // Only process our alert widget keys
      if (key && key.startsWith(alertKeyPrefix)) {
        try {
          // Extract the date part from the key
          const datePart = key.split('_')[3];
          const alertDate = new Date(datePart);
          
          // If this is an old alert, remove it
          if (alertDate < oldestDate) {
            localStorage.removeItem(key);
            localStorage.removeItem(`${key}_timestamp`);
          }
        } catch (e) {
          console.error('Error processing localStorage key:', key, e);
        }
      }
    }
  };

  const fetchAlertData = async () => {
    setIsLoading(true);
    setErrorMessage(null); // Reset error message
    try {
      // Set up date range for past 30 days
      const now = appDate;
      const lastMonth = new Date(appDate);
      lastMonth.setDate(lastMonth.getDate() - 30);

      // Prepare filter parameters
      const params = new URLSearchParams();
      params.append('start_date', lastMonth.toISOString().split('T')[0]);
      params.append('end_date', now.toISOString().split('T')[0]);
      params.append('severity', 'warning,critical');
      params.append('building', 'All Buildings'); // Default to all buildings
      params.append('method', 'z_score'); // Default method, consistent with AlertPage

      // Log the API URL being called
      console.log(`Fetching alerts from: http://127.0.0.1:5000/api/anomalies/get-anomalies?${params}`);

      // Fetch alerts from API
      const response = await fetch(`http://127.0.0.1:5000/api/anomalies/get-anomalies?${params}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch alert data: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Received alert data:', data);
      
      if (data.alerts && Array.isArray(data.alerts)) {
        // Count alerts and get the most recent 3 alerts
        const sortedAlerts = data.alerts
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, 3)
          .map(alert => ({
            id: alert.id || Math.random().toString(36).substring(2, 11),
            severity: alert.severity || 'N/A',
            building: alert.building || 'N/A',
            date: alert.date || 'N/A',
            consumption: alert.consumption || 'N/A'
          }));

        const alertData = {
          total: data.alerts.length,
          critical: data.alerts.filter(a => a.severity.toLowerCase() === 'critical').length,
          warning: data.alerts.filter(a => a.severity.toLowerCase() === 'warning').length,
          recentAlerts: sortedAlerts
        };

        console.log('Processed alert data:', alertData);
        setAlerts(alertData);
        saveAlertsToLocalStorage(alertData);
      } else if (data.stats) {
        // Ensure recentAlerts is always an array
        const alertData = {
          total: data.stats.total || 0,
          critical: data.stats.critical || 0,
          warning: data.stats.warning || 0,
          recentAlerts: Array.isArray(data.alerts) ? data.alerts : []
        };
        
        console.log('Using stats from response:', alertData);
        setAlerts(alertData);
        saveAlertsToLocalStorage(alertData);
      } else {
        throw new Error('Unexpected response format from API');
      }
    } catch (error) {
      console.error('Error fetching alert data:', error);
      setErrorMessage('Failed to load alerts. Please try again later.');
      setAlerts({
        total: 0,
        critical: 0,
        warning: 0,
        recentAlerts: []
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString || dateString === 'N/A') return 'N/A';
    
    const date = new Date(dateString);
    
    // Format date
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const closeAlert = () => {
    // This method would be used to close the entire widget if needed
  };

  const viewAllAlerts = () => {
    navigate('/alerts');
  };

  // Force refresh data
  const refreshData = () => {
    fetchAlertData();
  };

  // Determine container class - explicitly add dark class if isDarkMode is true
  const containerClass = `alert-widget ${isDarkMode ? 'dark' : ''}`;

  return (
    <div className={containerClass}>
      <div className="alert-header">
        <h3>Alerts</h3>
        <div className="alert-actions">
          <button className="icon-button" onClick={refreshData} title="Refresh Alerts">
            <svg viewBox="0 0 24 24" className="icon" width="16" height="16">
              <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
            </svg>
          </button>
          <button className="close-button" onClick={closeAlert}>×</button>
        </div>
      </div>
      
      {isLoading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <div>Loading alerts...</div>
        </div>
      ) : errorMessage ? (
        <div className="error-container">
          <p>{errorMessage}</p>
          <button className="retry-button" onClick={refreshData}>Retry</button>
        </div>
      ) : (
        <>
          <div className="alert-summary">
            <div className="alert-counts">
              <div className="alert-count-item critical">
                <span className="count-value">{alerts.critical}</span>
                <span className="count-label">Critical⚠️</span>
              </div>
              <div className="alert-count-item warning">
                <span className="count-value">{alerts.warning}</span>
                <span className="count-label">Warning⚡</span>
              </div>
            </div>
            <div className="alert-timeframe">
              Past 30 Days
            </div>
          </div>
          
          {alerts.recentAlerts.length > 0 ? (
            <div className="recent-alerts">
              <h4>Recent Alerts</h4>
              <ul className="alert-list">
                {alerts.recentAlerts.map(alert => (
                  <li key={alert.id} className={`alert-item ${(alert.severity || '').toLowerCase()}`}>
                    <div className="alert-severity">{alert.severity}</div>
                    <div className="alert-content">
                      <div className="alert-building">{alert.building}</div>
                      <div className="alert-date">{formatDate(alert.date)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="no-alerts">
              <p>No recent anomalies detected</p>
            </div>
          )}
          
          <button className="view-all-button" onClick={viewAllAlerts}>
            View All Alerts
          </button>
        </>
      )}
    </div>
  );
};

export default AlertWidget;