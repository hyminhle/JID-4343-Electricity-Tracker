import React, { useState, useEffect } from 'react';
import './AlertPage.css';

const AlertPage = () => {
  // State for alerts and filtering
  const [alerts, setAlerts] = useState([]);
  const [alertStats, setAlertStats] = useState({
    total: 0,
    critical: 0,
    error: 0,
    warning: 0
  });
  
  // State for filtering and searching
  const [searchQuery, setSearchQuery] = useState('');
  
  // State for filter settings
  const [availableData, setAvailableData] = useState({});
  const [buildingOptions, setBuildingOptions] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState('All Buildings');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(0); // 0 means all months
  const [yearOptions, setYearOptions] = useState([]);
  const [monthOptions, setMonthOptions] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [timeRange, setTimeRange] = useState('all'); // Changed default to 'all'
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
  
  // Fetch available data and run initial anomaly detection on component mount
  useEffect(() => {
    const initialize = async () => {
      await fetchAvailableData();
      await runInitialAnomalyDetection();
    };
    
    initialize();
  }, []);
  
  // Fetch available data
  const fetchAvailableData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://127.0.0.1:5000/get-available-data');
      const data = await response.json();
      setAvailableData(data);

      // Extract building names from available data
      const buildings = Object.keys(data).map(building => decodeURIComponent(building));
      setBuildingOptions(['All Buildings', ...buildings]);
      
      // Try to get selected building from localStorage first
      const savedBuilding = loadSelectedBuildingFromLocalStorage();
      if (savedBuilding && buildings.includes(savedBuilding)) {
        setSelectedBuilding(savedBuilding);
      } else {
        setSelectedBuilding('All Buildings');
        saveSelectedBuildingToLocalStorage('All Buildings');
      }
      
      return buildings.length > 0 ? buildings[0] : null;
    } catch (error) {
      console.error('Error fetching available data:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Run anomaly detection
  const runAnomalyDetection = async () => {
    setIsLoading(true);

    try {
      const building = selectedBuilding === 'All Buildings' ? 
        (buildingOptions.length > 1 ? buildingOptions[1] : '') : 
        selectedBuilding;
      
      if (!building) {
        console.error('No building available for anomaly detection');
        setIsLoading(false);
        return;
      }
      
      // Run anomaly detection with current parameters
      const response = await fetch('http://127.0.0.1:5000/api/anomalies/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          building: building,
          year: selectedYear,
          month: selectedMonth,
          method: 'LOF', // Use Local Outlier Factor
          threshold: 3.0,
          store_results: true,
          include_stats: true
        })
      });
      
      const result = await response.json();
      
      if (result.error) {
        console.error(`Error in anomaly detection: ${result.error}`);
      } else {
        // Store the statistics for display
        if (result.statistics) {
          setAnalysisStats(result.statistics);
        }
        
        console.log(`Anomaly analysis complete. Found ${result.count} anomalies`);
        
        // Fetch alerts to display them
        fetchAlerts();
      }
    } catch (error) {
      console.error('Error running anomaly detection:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Run initial anomaly detection when app opens
  const runInitialAnomalyDetection = async () => {
    setIsLoading(true);
    
    try {
      // Wait a moment to ensure selectedBuilding is set
      setTimeout(async () => {
        const building = selectedBuilding === 'All Buildings' ? 
          (buildingOptions.length > 1 ? buildingOptions[1] : '') : 
          selectedBuilding;
        
        if (!building) {
          console.error('No building available for anomaly detection');
          setIsLoading(false);
          return;
        }
        
        const currentYear = new Date().getFullYear();
        
        // Run anomaly detection with default parameters
        const response = await fetch('http://127.0.0.1:5000/api/anomalies/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            building: building,
            year: currentYear,
            month: 0, // All months
            method: 'LOF', // Use Local Outlier Factor as default
            threshold: 3.0,
            store_results: true,
            include_stats: true
          })
        });
        
        const result = await response.json();
        
        if (result.error) {
          console.error(`Error in initial anomaly detection: ${result.error}`);
        } else {
          // Store the statistics for display
          if (result.statistics) {
            setAnalysisStats(result.statistics);
          }
          
          console.log(`Initial anomaly analysis complete. Found ${result.count} anomalies`);
          
          // Fetch alerts to display them
          fetchAlerts();
        }
        
        setIsLoading(false);
      }, 500);
    } catch (error) {
      console.error('Error running initial anomaly detection:', error);
      setIsLoading(false);
    }
  };
  
  // Update year options when building changes
  useEffect(() => {
    if (selectedBuilding !== 'All Buildings' && availableData[selectedBuilding]) {
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
    if (selectedBuilding !== 'All Buildings' && availableData[selectedBuilding] && 
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
      
      if (selectedBuilding && selectedBuilding !== 'All Buildings') {
        params.append('building', selectedBuilding);
      }
      
      if (selectedYear) {
        params.append('year', selectedYear);
      }
      
      if (selectedMonth !== 0) {
        params.append('month', selectedMonth);
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
            alert.severity.toLowerCase().includes(query)
            // Removed detection_method from the filter
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
  
  // Apply filters when they change
  useEffect(() => {
    fetchAlerts();
  }, [selectedBuilding, selectedYear, selectedMonth, timeRange]);
  
  // Handle filter change
  const handleFilterChange = (filterName, value) => {
    setSearchQuery('');
    setSelectedMonth(0);
    
    // Apply changes
    setTimeout(() => {
      fetchAlerts();
    }, 100);
  };
  
  // Clear all filters
  const clearAllFilters = () => {
    setSelectedBuilding('All Buildings');
    saveSelectedBuildingToLocalStorage('All Buildings');
    setSearchQuery('');
    setSelectedMonth(0);
    setTimeRange('all');
    
    // Apply changes
    setTimeout(() => {
      fetchAlerts();
    }, 100);
  };
  
  // Handle time range change
  const handleTimeRangeChange = (range) => {
    setTimeRange(range);
  };
  
  // Format date for display - now includes full date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    const formattedDate = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const formattedTime = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    return `${formattedDate} ${formattedTime} (${diffHours} hours ago)`;
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
        </div>
      </div>

      {/* Filter Settings */}
      <div className="anomaly-settings-bar">
        
        <button 
          className="settings-toggle" 
          onClick={() => setShowFilters(!showFilters)}
        >
          {showFilters ? 'Hide Filters' : 'Show Alert Filters'}
        </button>
        
        
        {showFilters && (
          <div className="anomaly-settings-panel">
            <div className="settings-grid">
              <div className="settings-group">
                <h3>Filter Alerts</h3>
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
                    disabled={selectedBuilding === 'All Buildings'}
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
                    disabled={selectedBuilding === 'All Buildings'}
                  >
                    <option value={0}>All Months</option>
                    {monthOptions.map(month => (
                      <option key={month} value={month}>{monthNames[month]}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            
            <div className="settings-actions">
              {/* Add Refresh Button */}
              <button 
                className="refresh-button" 
                onClick={runAnomalyDetection}
                disabled={isLoading}
              >
                {isLoading ? 'Analyzing...' : 'Run LOF Analysis'}
              </button>
              <button 
                className="clear-filters-button" 
                onClick={clearAllFilters}
              >
                Reset Filters
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
            <option value="all">All Time</option>
            <option value="past24h">Past 24 hours</option>
            <option value="past7d">Past 7 days</option>
            <option value="past30d">Past 30 days</option>
          </select>
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
              <th>Severity</th>
              <th>Building</th>
              <th>Date</th>
              <th>Detection Time</th>
              <th>Value</th>
              <th>Expected Range</th>
              {/* Removed Method header */}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="6" className="loading-cell">
                  <div className="loading-spinner"></div>
                  <p>Loading alerts...</p>
                </td>
              </tr>
            ) : alerts.length === 0 ? (
              <tr>
                <td colSpan="6" className="empty-cell">
                  <p>No alerts found matching your filters.</p>
                </td>
              </tr>
            ) : (
              alerts.map(alert => (
                <tr 
                  key={alert.id} 
                  className={`alert-row severity-${alert.severity.toLowerCase()}`}
                >
                  <td className="severity-cell">{alert.severity}</td>
                  <td className="building-cell">{alert.building}</td>
                  <td className="date-cell">{alert.date}</td>
                  <td className="date-cell">{formatDate(alert.detection_time || alert.created_at)}</td>
                  <td className="value-cell">
                    {alert.actual_value !== undefined && alert.actual_value !== null
                      ? alert.actual_value.toFixed(2)
                      : alert.consumption ? alert.consumption.toFixed(2) : 'N/A'}
                  </td>
                  <td className="range-cell">
                    {alert.expected_low !== undefined && alert.expected_low !== null
                      ? `${alert.expected_low.toFixed(2)} - ${alert.expected_high.toFixed(2)}`
                      : 'N/A'}
                  </td>
                  {/* Removed Method column */}
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