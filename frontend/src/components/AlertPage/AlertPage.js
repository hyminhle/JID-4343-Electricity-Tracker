import React, { useState, useEffect } from 'react';
import { useAppDate } from '../DateContext'; // Import useAppDate
import './AlertPage.css';
import { getEmailRecipients } from '../../utils/emailList';

const AlertPage = () => {
  const { appDate } = useAppDate(); // Use the system clock from DateContext
  // State for alerts and filtering
  const [alerts, setAlerts] = useState([]);
  const [alertStats, setAlertStats] = useState({
    total: 0,
    critical: 0,
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
  const [dataLoaded, setDataLoaded] = useState(false); // NEW: Track if data is loaded
  
  // Add detection method selection
  const [detectionMethod, setDetectionMethod] = useState('z_score'); // Default to z_score instead of LOF
  
  // Add sensitivity settings for both methods
  const [lofSensitivity, setLofSensitivity] = useState(2.0); // Lower threshold for more sensitivity
  const [zscoreThreshold, setZscoreThreshold] = useState(2.5); // Default Z-score threshold
  const [timeWindow, setTimeWindow] = useState(7); // Default 7-day window for Z-score
  
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
      // Anomaly detection will be triggered after data is loaded
    };
    
    initialize();
  }, []);

  // When data is loaded, run anomaly detection
  useEffect(() => {
    if (dataLoaded) {
      runAnomalyDetection();
    }
  }, [dataLoaded]);
  
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
      
      // Mark data as loaded, which will trigger the anomaly detection
      setDataLoaded(true);
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
      if (selectedBuilding === 'All Buildings') {
        // Handle "All Buildings" by iterating through all buildings
        // Make sure we actually have building options before proceeding
        const relevantBuildings = buildingOptions.filter(b => b !== 'All Buildings');
        
        if (relevantBuildings.length === 0) {
          console.error('No buildings available for anomaly detection');
          setIsLoading(false);
          return;
        }
        
        const allAlerts = [];

        for (const building of relevantBuildings) {
          try {
            const response = await fetch('http://127.0.0.1:5000/api/anomalies/analyze', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                building: building,
                year: selectedYear,
                month: selectedMonth,
                method: detectionMethod,
                threshold: detectionMethod === 'LOF' ? lofSensitivity : zscoreThreshold,
                time_window: timeWindow,
                store_results: true,
                include_stats: true,
                severity_levels: ['warning', 'critical']
              })
            });

            if (response.status === 404) {
              console.warn(`No data found for building: ${building}`);
              continue;
            }

            const result = await response.json();

            if (result.error) {
              console.error(`Error in anomaly detection for building ${building}: ${result.error}`);
              continue;
            }

            allAlerts.push(...result.anomalies);
          } catch (error) {
            console.error(`Error processing building ${building}:`, error);
          }
        }

        setAlerts(allAlerts);
        setAlertStats({
          total: allAlerts.length,
          critical: allAlerts.filter(a => a.severity === 'Critical').length,
          warning: allAlerts.filter(a => a.severity === 'Warning').length
        });
      } else {
        // Handle single building case
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
            threshold: detectionMethod === 'LOF' ? lofSensitivity : zscoreThreshold,
            time_window: timeWindow,
            store_results: true,
            include_stats: true,
            severity_levels: ['warning', 'critical']
          })
        });

        if (response.status === 404) {
          console.error('No data found for the specified parameters');
          setAlerts([]);
          setAlertStats({ total: 0, critical: 0, warning: 0 });
          return;
        }

        const result = await response.json();

        if (result.error) {
          console.error(`Error in anomaly detection: ${result.error}`);
        } else {
          setAlerts(result.anomalies);
          setAlertStats({
            total: result.anomalies.length,
            critical: result.anomalies.filter(a => a.severity === 'Critical').length,
            warning: result.anomalies.filter(a => a.severity === 'Warning').length
          });
        }
      }
    } catch (error) {
      console.error('Error running anomaly detection:', error);
    } finally {
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
    } else if (selectedBuilding === 'All Buildings') {
      // For All Buildings, gather all years from all buildings
      const allYears = new Set();
      
      Object.values(availableData).forEach(buildingData => {
        Object.keys(buildingData).forEach(year => {
          allYears.add(parseInt(year));
        });
      });
      
      const years = [...allYears].sort((a, b) => b - a);
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
    } else if (selectedBuilding === 'All Buildings') {
      // For All Buildings, gather all months from all buildings for the selected year
      const allMonths = new Set();
      
      Object.values(availableData).forEach(buildingData => {
        if (buildingData[selectedYear]) {
          Object.keys(buildingData[selectedYear]).forEach(month => {
            allMonths.add(parseInt(month));
          });
        }
      });
      
      const months = [...allMonths].sort((a, b) => a - b);
      setMonthOptions(months);
      
      if (!months.includes(selectedMonth) && selectedMonth !== 0) {
        setSelectedMonth(0); // Default to "All Months"
      }
    }
  }, [selectedYear, selectedBuilding, availableData]);
  
  // Fetch alerts based on current filters
  const [severityFilter, setSeverityFilter] = useState({
    warning: true,
    critical: true,
  });

  // Filter alerts based on the selected severity and time range in the frontend
  const filteredAlerts = alerts.filter(alert => {
    // Filter by severity
    const matchesSeverity = (severityFilter.warning && alert.severity === 'Warning') ||
                            (severityFilter.critical && alert.severity === 'Critical');

    // Filter by time range using the `date` field
    const alertDate = new Date(alert.date);
    const now = appDate; // Use the system clock
    let matchesTimeRange = true;

    if (timeRange === 'past24h') {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      matchesTimeRange = alertDate >= yesterday && alertDate <= now;
    } else if (timeRange === 'past7d') {
      const lastWeek = new Date(now);
      lastWeek.setDate(lastWeek.getDate() - 7);
      matchesTimeRange = alertDate >= lastWeek && alertDate <= now;
    } else if (timeRange === 'past30d') {
      const lastMonth = new Date(now);
      lastMonth.setDate(lastMonth.getDate() - 30);
      matchesTimeRange = alertDate >= lastMonth && alertDate <= now;
    }

    return matchesSeverity && matchesTimeRange;
  });

  // Update the fetchAlerts function to include severity filtering
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
      
      // Add time range filter based on the system clock (appDate)
      const now = appDate; // Use appDate as the current system clock
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
      
      // Add severity filter
      const selectedSeverities = [];
      if (severityFilter.warning) selectedSeverities.push('warning');
      if (severityFilter.critical) selectedSeverities.push('critical');
      if (selectedSeverities.length > 0) {
        params.append('severity', selectedSeverities.join(','));
      }
      
      // Add method parameter to get alerts from the correct method
      params.append('method', detectionMethod);
      
      if (selectedBuilding === 'All Buildings') {
        // Special handling for "All Buildings" - we need to manually gather all alerts
        await runAnomalyDetection(); // This will update the alerts state
        return;
      }
      
      // Fetch alerts from API for a single building
      const response = await fetch(`http://127.0.0.1:5000/api/anomalies/get-anomalies?${params}`);
      const data = await response.json();
      
      if (data.alerts) {
        // Ensure all alerts are displayed, even with missing fields
        const normalizedAlerts = data.alerts.map(alert => ({
          id: alert.id || Math.random(), // Generate a random ID if missing
          severity: alert.severity || 'N/A',
          building: alert.building || 'N/A',
          date: alert.date || 'N/A',
          detection_time: appDate.toISOString(), // Use the system clock from useAppDate
          consumption: alert.consumption || 'N/A',
          expected_low: alert.expected_low !== undefined ? alert.expected_low : 'N/A',
          expected_high: alert.expected_high !== undefined ? alert.expected_high : 'N/A'
        }));

        setAlerts(normalizedAlerts);
        setAlertStats({
          total: data.stats.total || 0,
          critical: data.stats.critical || 0,
          warning: data.stats.warning || 0
        });
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Apply filters when they change
  useEffect(() => {
    if (dataLoaded) { // Only fetch alerts when data is loaded
      fetchAlerts();
    }
  }, [selectedBuilding, selectedYear, selectedMonth, timeRange, detectionMethod, severityFilter, dataLoaded]);
  
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
  
  // Get button text based on method
  const getAnalysisButtonText = () => {
    if (isLoading) return 'Analyzing...';
    return `Run ${detectionMethod === 'LOF' ? 'LOF' : 'Z-Score'} Analysis`;
  };

  const [currentPage, setCurrentPage] = useState(1);
  const alertsPerPage = 30;

  // Calculate the alerts to display on the current page
  const indexOfLastAlert = currentPage * alertsPerPage;
  const indexOfFirstAlert = indexOfLastAlert - alertsPerPage;
  const currentAlerts = filteredAlerts.slice(indexOfFirstAlert, indexOfLastAlert);

  const handleNextPage = () => {
    if (currentPage < Math.ceil(filteredAlerts.length / alertsPerPage)) {
      setCurrentPage(prevPage => prevPage + 1);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prevPage => prevPage - 1);
    }
  };

  const sendDailyReport = async () => {
    const emailList = getEmailRecipients();
    if (emailList.length === 0) {
      alert('No email recipients found.');
      return;
    }
  
    try {
      const response = await fetch('http://127.0.0.1:5000/send-daily-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alerts, emailList })
      });
  
      const result = await response.json();
      if (response.ok) {
        alert('Daily report sent successfully.');
      } else {
        alert(`Error sending daily report: ${result.error}`);
      }
    } catch (error) {
      console.error('Error sending daily report:', error);
    }
  };
  
  const sendSpecificAlert = async (alertData) => {
    const emailList = getEmailRecipients();
    if (emailList.length === 0) {
      alert('No email recipients found.');
      return;
    }
  
    try {
      const response = await fetch('http://127.0.0.1:5000/send-specific-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert: alertData, emailList })
      });
  
      const result = await response.json();
      if (response.ok) {
        alert('Specific alert sent successfully.');
      } else {
        alert(`Error sending specific alert: ${result.error}`);
      }
    } catch (error) {
      console.error('Error sending specific alert:', error);
    }
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
                <div className="settings-row">
                  <label>Detection Method:</label>
                  <select 
                    value={detectionMethod} 
                    onChange={(e) => setDetectionMethod(e.target.value)}
                  >
                    <option value="LOF">Local Outlier Factor</option>
                    <option value="z_score">Z-Score Method</option>
                  </select>
                </div>
              </div>
              <div className="settings-group">
                <h3>{detectionMethod === 'LOF' ? 'LOF Settings' : 'Z-Score Settings'}</h3>
                {detectionMethod === 'LOF' ? (
                  <>
                    <div className="settings-row">
                      <label>Sensitivity:</label>
                      <select 
                        value={lofSensitivity} 
                        onChange={(e) => setLofSensitivity(parseFloat(e.target.value))}
                      >
                        <option value={1.0}>Very High</option>
                        <option value={1.5}>High</option>
                        <option value={2.0}>Medium</option>
                        <option value={2.5}>Low</option>
                        <option value={3.0}>Very Low</option>
                      </select>
                    </div>
                    <div className="settings-description">
                      Lower values increase sensitivity for detecting anomalies
                    </div>
                  </>
                ) : (
                  <>
                    <div className="settings-row">
                      <label>Z-Score Threshold:</label>
                      <select 
                        value={zscoreThreshold} 
                        onChange={(e) => setZscoreThreshold(parseFloat(e.target.value))}
                      >
                        <option value={1.5}>Very High (1.5)</option>
                        <option value={2.0}>High (2.0)</option>
                        <option value={2.5}>Medium (2.5)</option>
                        <option value={3.0}>Low (3.0)</option>
                        <option value={3.5}>Very Low (3.5)</option>
                      </select>
                    </div>
                    <div className="settings-row">
                      <label>Time Window (days):</label>
                      <select 
                        value={timeWindow} 
                        onChange={(e) => setTimeWindow(parseInt(e.target.value))}
                      >
                        <option value={3}>3 days</option>
                        <option value={5}>5 days</option>
                        <option value={7}>7 days</option>
                        <option value={14}>14 days</option>
                        <option value={30}>30 days</option>
                      </select>
                    </div>
                    <div className="settings-description">
                      Lower Z-Score values increase sensitivity. Time window controls the period used for calculating normal patterns.
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="settings-actions">
              <button 
                className="refresh-button" 
                onClick={runAnomalyDetection}
                disabled={isLoading}
              >
                {getAnalysisButtonText()}
              </button>
              <button 
                className="clear-filters-button" 
                onClick={clearAllFilters}
              >
                Reset Filters
              </button>
              <button 
                className="send-report-button" 
                onClick={sendDailyReport}
              >
                Send Daily Report
              </button>
            </div>
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
                  checked={severityFilter.critical}
                  onChange={() => setSeverityFilter(prev => ({ ...prev, critical: !prev.critical }))}
                />
                <label htmlFor="severity-critical">Critical</label>
              </div>
              <div className="dropdown-item">
                <input 
                  type="checkbox" 
                  id="severity-warning" 
                  checked={severityFilter.warning}
                  onChange={() => setSeverityFilter(prev => ({ ...prev, warning: !prev.warning }))}
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
              <th>Action</th>
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
            ) : filteredAlerts.length === 0 ? (
              <tr>
                <td colSpan="6" className="empty-cell">
                  <p>No alerts found matching your filters.</p>
                </td>
              </tr>
            ) : (
              currentAlerts.map(alert => (
                <tr 
                  key={alert.id} 
                  className={`alert-row severity-${alert.severity.toLowerCase()}`}
                >
                  <td className={`severity-cell ${alert.severity.toLowerCase()}`}>{alert.severity}</td>
                  <td className="building-cell">{alert.building}</td>
                  <td className="date-cell">{formatDate(alert.date)}</td>
                  <td className="date-cell">{formatDate(new Date().toISOString())}</td>
                  <td className="value-cell">
                    {alert.consumption !== 'N/A' ? parseFloat(alert.consumption).toFixed(2) : 'N/A'}
                  </td>
                  <td>
                    <button 
                      className="send-alert-button" 
                      onClick={() => sendSpecificAlert(alert)}
                    >
                      Send Alert
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="pagination-controls">
        <button 
          className="page-button" 
          onClick={handlePreviousPage} 
          disabled={currentPage === 1}
        >
          Previous
        </button>
        <span className="page-info">
          Page {currentPage} of {Math.ceil(filteredAlerts.length / alertsPerPage)}
        </span>
        <button 
          className="page-button" 
          onClick={handleNextPage} 
          disabled={currentPage === Math.ceil(filteredAlerts.length / alertsPerPage)}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default AlertPage;