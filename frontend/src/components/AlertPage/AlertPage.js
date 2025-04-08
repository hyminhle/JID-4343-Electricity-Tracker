import React, { useState, useEffect } from 'react';
import './AlertPage.css';

const AlertPage = () => {
  // State for alerts and filtering
  const [alerts, setAlerts] = useState([]);
  const [alertStats, setAlertStats] = useState({
    total: 0,
    critical: 0,
    error: 0,
    warning: 0,
    sdt: 0,
    acknowledged: 0
  });
  
  // State for filtering and searching
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState({
    acknowledged: 'No',
    sdt: 'No',
    cleared: 'No'
  });
  
  // State for anomaly detection settings
  const [availableData, setAvailableData] = useState({});
  const [buildingOptions, setBuildingOptions] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(0); // 0 means all months
  const [detectionMethod, setDetectionMethod] = useState('z_score');
  const [thresholdValue, setThresholdValue] = useState(3.0);
  const [yearOptions, setYearOptions] = useState([]);
  const [monthOptions, setMonthOptions] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [timeRange, setTimeRange] = useState('past24h');
  const [analysisStats, setAnalysisStats] = useState(null);
  
  // Month names lookup
  const monthNames = {
    1: 'January', 2: 'February', 3: 'March', 4: 'April',
    5: 'May', 6: 'June', 7: 'July', 8: 'August',
    9: 'September', 10: 'October', 11: 'November', 12: 'December'
  };
  
  // Load saved preferences from localStorage
  const loadSelectedBuildingFromLocalStorage = () => {
    return localStorage.getItem('selectedBuilding');
  };
  
  const saveSelectedBuildingToLocalStorage = (building) => {
    localStorage.setItem('selectedBuilding', building);
  };
  
  // Fetch available data on component mount
  useEffect(() => {
    const fetchAvailableData = async () => {
      try {
        const response = await fetch('http://127.0.0.1:5000/get-available-data');
        const data = await response.json();
        setAvailableData(data);

        // Extract building names from available data
        const buildings = Object.keys(data).map(building => decodeURIComponent(building));
        setBuildingOptions(buildings);
        
        // Try to get selected building from localStorage first
        const savedBuilding = loadSelectedBuildingFromLocalStorage();
        if (savedBuilding && buildings.includes(savedBuilding)) {
          setSelectedBuilding(savedBuilding);
        } else if (buildings.length > 0) {
          setSelectedBuilding(buildings[0]);
          saveSelectedBuildingToLocalStorage(buildings[0]);
        }
      } catch (error) {
        console.error('Error fetching available data:', error);
      }
    };
    
    fetchAvailableData();
    fetchAlerts();
  }, []);
  
  // Update year options when building changes
  useEffect(() => {
    if (selectedBuilding && availableData[selectedBuilding]) {
      const years = Object.keys(availableData[selectedBuilding])
        .map(year => parseInt(year))
        .sort((a, b) => b - a); // Sort in descending order
      
      setYearOptions(years);
      
      if (years.length > 0 && !years.includes(selectedYear)) {
        setSelectedYear(years[0]);
      }
    }
  }, [selectedBuilding, availableData]);
  
  // Update month options when year changes
  useEffect(() => {
    if (selectedBuilding && availableData[selectedBuilding] && 
        availableData[selectedBuilding][selectedYear]) {
      const months = Object.keys(availableData[selectedBuilding][selectedYear])
        .map(month => parseInt(month))
        .sort((a, b) => a - b);
      
      setMonthOptions(months);
      
      if (!months.includes(selectedMonth) && selectedMonth !== 0) {
        setSelectedMonth(0); // Default to "All Months"
      }
    }
  }, [selectedYear, selectedBuilding, availableData]);
  
  // Fetch alerts based on current filters
  const fetchAlerts = async () => {
    setIsLoading(true);
    
    try {
      // Prepare filter parameters
      const params = new URLSearchParams();
      
      if (selectedBuilding) {
        params.append('building', selectedBuilding);
      }
      
      if (activeFilters.acknowledged) {
        params.append('acknowledged', activeFilters.acknowledged === 'Yes');
      }
      
      if (activeFilters.sdt) {
        params.append('sdt', activeFilters.sdt === 'Yes');
      }
      
      if (activeFilters.cleared) {
        params.append('cleared', activeFilters.cleared === 'Yes');
      }
      
      // Add time range filter
      const now = new Date();
      if (timeRange === 'past24h') {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        params.append('start_date', yesterday.toISOString().split('T')[0]);
      } else if (timeRange === 'past7d') {
        const lastWeek = new Date(now);
        lastWeek.setDate(lastWeek.getDate() - 7);
        params.append('start_date', lastWeek.toISOString().split('T')[0]);
      } else if (timeRange === 'past30d') {
        const lastMonth = new Date(now);
        lastMonth.setDate(lastMonth.getDate() - 30);
        params.append('start_date', lastMonth.toISOString().split('T')[0]);
      }
      
      // Fetch alerts from API
      const response = await fetch(`http://127.0.0.1:5000/api/anomalies/get-anomalies?${params}`);
      const data = await response.json();
      
      if (data.alerts) {
        // Filter alerts based on search query
        let filteredAlerts = data.alerts;
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          filteredAlerts = filteredAlerts.filter(alert => 
            alert.building.toLowerCase().includes(query) ||
            alert.severity.toLowerCase().includes(query) ||
            alert.detection_method.toLowerCase().includes(query)
          );
        }
        
        setAlerts(filteredAlerts);
        setAlertStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Run anomaly detection using the new endpoint
  const runAnomalyDetection = async () => {
    setIsLoading(true);
    setAnalysisStats(null); // Reset previous stats
    
    try {
      const response = await fetch('http://127.0.0.1:5000/api/anomalies/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          building: selectedBuilding,
          year: selectedYear,
          month: selectedMonth,
          method: detectionMethod,
          threshold: thresholdValue,
          store_results: true,
          include_stats: true
        })
      });
      
      const result = await response.json();
      
      if (result.error) {
        alert(`Error: ${result.error}`);
      } else {
        // Store the statistics for display
        if (result.statistics) {
          setAnalysisStats(result.statistics);
        }
        
        alert(`Anomaly analysis complete. Found ${result.count} anomalies (${result.critical} critical, ${result.error} error, ${result.warning} warning)`);
        fetchAlerts(); // Refresh the alerts list
      }
    } catch (error) {
      console.error('Error running anomaly detection:', error);
      alert('Error running anomaly detection. Please check console for details.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle alert status update (acknowledge, clear, SDT)
  const updateAlertStatus = async (alertId, statusType, statusValue) => {
    try {
      const response = await fetch('http://127.0.0.1:5000/update-anomaly-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: alertId,
          type: statusType,
          value: statusValue
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Update the alert in the UI
        setAlerts(alerts.map(alert => {
          if (alert.id === alertId) {
            return {
              ...alert,
              is_acknowledged: statusType === 'acknowledge' ? statusValue : alert.is_acknowledged,
              is_cleared: statusType === 'clear' ? statusValue : alert.is_cleared,
              is_sdt: statusType === 'sdt' ? statusValue : alert.is_sdt
            };
          }
          return alert;
        }));
        
        // Refresh stats
        fetchAlerts();
      }
    } catch (error) {
      console.error('Error updating alert status:', error);
    }
  };
  
  // Handle filter change
  const handleFilterChange = (filterName, value) => {
    setActiveFilters({
      ...activeFilters,
      [filterName]: value
    });
    
    // Apply filters
    setTimeout(() => {
      fetchAlerts();
    }, 100);
  };
  
  // Clear all filters
  const clearAllFilters = () => {
    setActiveFilters({
      acknowledged: 'No',
      sdt: 'No',
      cleared: 'No'
    });
    setSearchQuery('');
    
    // Apply changes
    setTimeout(() => {
      fetchAlerts();
    }, 100);
  };
  
  // Handle time range change
  const handleTimeRangeChange = (range) => {
    setTimeRange(range);
    
    // Apply changes
    setTimeout(() => {
      fetchAlerts();
    }, 100);
  };
  
  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    return `${date.toLocaleString()} (${diffHours} hours ago)`;
  };
  
  // Format number with commas for thousands
  const formatNumber = (num) => {
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };
  
  return (
    <div className="alert-page">
      {/* Alert Statistics Header */}
      <div className="alert-stats">
        <h1>{alertStats.total} Anomaly Alerts</h1>
        <div className="stat-chips">
          <div className="stat-chip critical">
            <span className="stat-icon">⚠️</span>
            <span>{alertStats.critical} Critical</span>
          </div>
          <div className="stat-chip error">
            <span className="stat-icon">❌</span>
            <span>{alertStats.error} Error</span>
          </div>
          <div className="stat-chip warning">
            <span className="stat-icon">⚡</span>
            <span>{alertStats.warning} Warning</span>
          </div>
          <div className="stat-chip sdt">
            <span className="stat-icon">🕒</span>
            <span>{alertStats.sdt} SDT</span>
          </div>
          <div className="stat-chip acknowledged">
            <span className="stat-icon">✓</span>
            <span>{alertStats.acknowledged} Acknowledged</span>
          </div>
        </div>
      </div>

      {/* Anomaly Detection Settings */}
      <div className="anomaly-settings-bar">
        <button 
          className="settings-toggle" 
          onClick={() => setShowSettings(!showSettings)}
        >
          {showSettings ? 'Hide Settings' : 'Show Anomaly Detection Settings'}
        </button>
        
        {showSettings && (
          <div className="anomaly-settings-panel">
            <div className="settings-grid">
              <div className="settings-group">
                <h3>Building & Time Period</h3>
                <div className="settings-row">
                  <label>Building:</label>
                  <select 
                    value={selectedBuilding} 
                    onChange={(e) => {
                      setSelectedBuilding(e.target.value);
                      saveSelectedBuildingToLocalStorage(e.target.value);
                    }}
                  >
                    {buildingOptions.map(building => (
                      <option key={building} value={building}>{building}</option>
                    ))}
                  </select>
                </div>
                
                <div className="settings-row">
                  <label>Year:</label>
                  <select 
                    value={selectedYear} 
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  >
                    {yearOptions.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
                
                <div className="settings-row">
                  <label>Month:</label>
                  <select 
                    value={selectedMonth} 
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  >
                    <option value={0}>All Months</option>
                    {monthOptions.map(month => (
                      <option key={month} value={month}>{monthNames[month]}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="settings-group">
                <h3>Detection Method</h3>
                <div className="settings-row">
                  <label>Method:</label>
                  <select 
                    value={detectionMethod} 
                    onChange={(e) => setDetectionMethod(e.target.value)}
                  >
                    <option value="z_score">Z-Score (Standard Deviation)</option>
                    <option value="iqr">IQR (Interquartile Range)</option>
                    <option value="rolling_mean">Rolling Mean</option>
                  </select>
                </div>
                
                <div className="settings-row">
                  <label>Threshold:</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="10" 
                    step="0.1"
                    value={thresholdValue} 
                    onChange={(e) => setThresholdValue(parseFloat(e.target.value))}
                  />
                </div>
                
                <div className="settings-description">
                  {detectionMethod === 'z_score' && (
                    <p>Z-Score method detects points that are multiple standard deviations away from the mean. Lower threshold = more anomalies.</p>
                  )}
                  {detectionMethod === 'iqr' && (
                    <p>IQR method detects points outside the interquartile range. Works well for skewed distributions.</p>
                  )}
                  {detectionMethod === 'rolling_mean' && (
                    <p>Rolling Mean method compares each point to the average of previous points. Good for detecting trend changes.</p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="settings-actions">
              <button 
                className="run-button" 
                onClick={runAnomalyDetection}
                disabled={isLoading}
              >
                {isLoading ? 'Processing...' : 'Run Anomaly Detection'}
              </button>
            </div>

            {/* Analysis Statistics Panel */}
            {analysisStats && (
              <div className="analysis-stats-panel">
                <h3>Analysis Results</h3>
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-label">Total Days Analyzed:</span>
                    <span className="stat-value">{analysisStats.total_days}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Days with Anomalies:</span>
                    <span className="stat-value">{analysisStats.days_with_anomalies}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Anomaly Percentage:</span>
                    <span className="stat-value">{analysisStats.anomaly_percentage.toFixed(2)}%</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Total Consumption:</span>
                    <span className="stat-value">{formatNumber(analysisStats.building_overall_consumption)} kWh</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Highest Consumption Day:</span>
                    <span className="stat-value">{analysisStats.highest_consumption_day} ({formatNumber(analysisStats.highest_consumption_value)} kWh)</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Lowest Consumption Day:</span>
                    <span className="stat-value">{analysisStats.lowest_consumption_day} ({formatNumber(analysisStats.lowest_consumption_value)} kWh)</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Search and Filter Bar */}
      <div className="search-filter-bar">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search All Alerts"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && fetchAlerts()}
          />
          <button className="search-button" onClick={fetchAlerts}>
            <span>🔍</span>
          </button>
        </div>
        <div className="filter-options">
          <select 
            className="filter-button" 
            value={timeRange} 
            onChange={(e) => handleTimeRangeChange(e.target.value)}
          >
            <option value="past24h">Past 24 hours</option>
            <option value="past7d">Past 7 days</option>
            <option value="past30d">Past 30 days</option>
            <option value="all">All Time</option>
          </select>
          <button className="filter-button">
            Detection Method ▼
            <div className="dropdown-menu">
              <div className="dropdown-item">
                <input 
                  type="checkbox" 
                  id="method-zscore" 
                  checked={true}
                  onChange={() => {}} 
                />
                <label htmlFor="method-zscore">Z-Score</label>
              </div>
              <div className="dropdown-item">
                <input 
                  type="checkbox" 
                  id="method-iqr" 
                  checked={true}
                  onChange={() => {}} 
                />
                <label htmlFor="method-iqr">IQR</label>
              </div>
              <div className="dropdown-item">
                <input 
                  type="checkbox" 
                  id="method-rolling" 
                  checked={true}
                  onChange={() => {}} 
                />
                <label htmlFor="method-rolling">Rolling Mean</label>
              </div>
            </div>
          </button>
          <button className="filter-button">
            Severity ▼
            <div className="dropdown-menu">
              <div className="dropdown-item">
                <input 
                  type="checkbox" 
                  id="severity-critical" 
                  checked={true}
                  onChange={() => {}} 
                />
                <label htmlFor="severity-critical">Critical</label>
              </div>
              <div className="dropdown-item">
                <input 
                  type="checkbox" 
                  id="severity-error" 
                  checked={true}
                  onChange={() => {}} 
                />
                <label htmlFor="severity-error">Error</label>
              </div>
              <div className="dropdown-item">
                <input 
                  type="checkbox" 
                  id="severity-warning" 
                  checked={true}
                  onChange={() => {}} 
                />
                <label htmlFor="severity-warning">Warning</label>
              </div>
            </div>
          </button>
          <button className="filter-button">
            Status ▼
            <div className="dropdown-menu">
              <div className="dropdown-item">
                <select 
                  id="filter-acknowledged"
                  value={activeFilters.acknowledged}
                  onChange={(e) => handleFilterChange('acknowledged', e.target.value)}
                >
                  <option value="All">Any Acknowledged</option>
                  <option value="Yes">Acknowledged: Yes</option>
                  <option value="No">Acknowledged: No</option>
                </select>
              </div>
              <div className="dropdown-item">
                <select 
                  id="filter-sdt"
                  value={activeFilters.sdt}
                  onChange={(e) => handleFilterChange('sdt', e.target.value)}
                >
                  <option value="All">Any SDT</option>
                  <option value="Yes">SDT: Yes</option>
                  <option value="No">SDT: No</option>
                </select>
              </div>
              <div className="dropdown-item">
                <select 
                  id="filter-cleared"
                  value={activeFilters.cleared}
                  onChange={(e) => handleFilterChange('cleared', e.target.value)}
                >
                  <option value="All">Any Cleared</option>
                  <option value="Yes">Cleared: Yes</option>
                  <option value="No">Cleared: No</option>
                </select>
              </div>
            </div>
          </button>
          <button 
            className="clear-filters-button" 
            onClick={clearAllFilters}
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Alert Table */}
      <div className="alert-table-container">
        <table className="alert-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Severity</th>
              <th>Building</th>
              <th>Detection Time</th>
              <th>Value</th>
              <th>Expected Range</th>
              <th>Method</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="8" className="loading-cell">
                  <div className="loading-spinner"></div>
                  <p>Loading alerts...</p>
                </td>
              </tr>
            ) : alerts.length === 0 ? (
              <tr>
                <td colSpan="8" className="empty-cell">
                  <p>No alerts found matching your filters.</p>
                </td>
              </tr>
            ) : (
              alerts.map(alert => (
                <tr 
                  key={alert.id} 
                  className={`alert-row severity-${alert.severity.toLowerCase()}`}
                >
                  <td className="value-cell">
                    {alert.actual_value !== undefined && alert.actual_value !== null
                      ? alert.actual_value.toFixed(2)
                      : 'N/A'}
                  </td>
                  <td className="range-cell">
                    {alert.expected_low !== undefined && alert.expected_low !== null
                      ? alert.expected_low.toFixed(2)
                      : 'N/A'} - 
                    {alert.expected_high !== undefined && alert.expected_high !== null
                      ? alert.expected_high.toFixed(2)
                      : 'N/A'}
                  </td>
                  {/* Other cells */}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="pagination-controls">
        <button className="page-button" disabled>Previous</button>
        <span className="page-info">Page 1 of 1</span>
        <button className="page-button" disabled>Next</button>
      </div>
    </div>
  );
};

export default AlertPage;