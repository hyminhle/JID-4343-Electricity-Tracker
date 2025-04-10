import React, { useState, useEffect, useRef } from 'react';
import { useAppDate } from './DateContext';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import './Report.css';
import { Chart, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';

Chart.register(ArcElement, Tooltip, Legend);

const Report = () => {
  const { appDate } = useAppDate();
  const [buildings, setBuildings] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState('All Buildings');
  const [reportData, setReportData] = useState({
    todayConsumption: 0,
    dailyAverage: 0,
    monthlyAverage: 0,
    yearlyAverage: 0,
    highestMonth: { month: '', value: 0 },
    lowestMonth: { month: '', value: 0 },
    buildingStats: {}
  });
  const [isLoading, setIsLoading] = useState(true);
  const reportRef = useRef(null);
  const [showPieChart, setShowPieChart] = useState(false);

  useEffect(() => {
    // Fetch available buildings
    fetchAvailableBuildings();
  }, []);

  useEffect(() => {
    // Check local storage for cached report data when date or building changes
    if (buildings.length > 0) {
      const cachedReport = checkCachedReport();
      if (cachedReport) {
        console.log('Loading report from cache:', selectedBuilding, appDate.toDateString());
        setReportData(cachedReport);
        setIsLoading(false);
      } else {
        console.log('No cached report found, fetching new data:', selectedBuilding, appDate.toDateString());
        fetchReportData();
      }
    }
  }, [appDate, selectedBuilding, buildings]);

  // Generate a unique key for the report based on date and building
  const getReportStorageKey = () => {
    const dateKey = appDate.toISOString().split('T')[0]; // Format: YYYY-MM-DD
    return `electricity_report_${dateKey}_${selectedBuilding.replace(/\s+/g, '_')}`;
  };

  // Check if we have a cached report for the current date and building
  const checkCachedReport = () => {
    const storageKey = getReportStorageKey();
    const cachedReportJson = localStorage.getItem(storageKey);
    
    if (cachedReportJson) {
      try {
        const cachedReport = JSON.parse(cachedReportJson);
        
        // For "All Buildings" selection, verify that all current buildings are included
        // This prevents showing incomplete data if buildings have been added since caching
        if (selectedBuilding === 'All Buildings') {
          const cachedBuildings = Object.keys(cachedReport.buildingStats || {});
          const currentBuildings = buildings.filter(b => b !== 'All Buildings');
          
          // Check if all current buildings are in the cached report
          const missingBuildings = currentBuildings.filter(
            building => !cachedBuildings.includes(building)
          );
          
          if (missingBuildings.length > 0) {
            console.log('Cache invalid - missing buildings:', missingBuildings);
            return null; // Cache is invalid, need to fetch fresh data
          }
        }
        
        return cachedReport;
      } catch (error) {
        console.error('Error parsing cached report:', error);
        return null;
      }
    }
    
    return null;
  };

  // Save the report data to local storage
  const saveReportToLocalStorage = (data) => {
    const storageKey = getReportStorageKey();
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
      console.log('Saved report to cache for', appDate.toDateString(), 'and', selectedBuilding);
    } catch (error) {
      console.error('Error saving report to cache:', error);
      
      // If localStorage is full, try clearing older reports
      if (error.name === 'QuotaExceededError') {
        try {
          // Clean up old reports (older than 7 days)
          cleanupOldReports();
          // Try saving again
          localStorage.setItem(storageKey, JSON.stringify(data));
        } catch (e) {
          console.error('Still unable to save to localStorage after cleanup:', e);
        }
      }
    }
  };
  
  // Clean up older reports from localStorage to free up space
  const cleanupOldReports = () => {
    const reportKeyPrefix = 'electricity_report_';
    const today = new Date();
    
    // Keep reports from the last 7 days
    const oldestDate = new Date();
    oldestDate.setDate(today.getDate() - 7);
    
    // Go through all localStorage items
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      
      // Only process our report keys
      if (key && key.startsWith(reportKeyPrefix)) {
        try {
          // Extract the date part from the key (format: electricity_report_YYYY-MM-DD_...)
          const datePart = key.split('_')[2];
          const reportDate = new Date(datePart);
          
          // If this is an old report, remove it
          if (reportDate < oldestDate) {
            localStorage.removeItem(key);
            console.log('Removed old report from cache:', key);
          }
        } catch (e) {
          console.error('Error processing localStorage key:', key, e);
        }
      }
    }
  };

  const fetchAvailableBuildings = async () => {
    try {
      const response = await fetch('http://localhost:5000/get-available-data');
      const data = await response.json();
      
      // Extract unique building names from the response
      const buildingList = Object.keys(data).sort();
      setBuildings(buildingList);
    } catch (error) {
      console.error('Error fetching buildings:', error);
    }
  };

  const fetchBuilding = async (building, year, month, day) => {
    try {
      const encodedBuilding = encodeURIComponent(building);
      let dailyDataResponse, yearlyDataResponse;

      // Fetch daily or monthly data
      if (day) {
        dailyDataResponse = await fetch(`http://localhost:5000/fetch-data/${year}/${month}/${day}/${encodedBuilding}`);
      } else {
        dailyDataResponse = await fetch(`http://localhost:5000/fetch-data/${year}/${month}/0/${encodedBuilding}`);
      }

      if (!dailyDataResponse.ok) {
        throw new Error(`Failed to fetch daily/monthly data for ${building}`);
      }

      const dailyData = await dailyDataResponse.json();

      // Fetch yearly statistics
      yearlyDataResponse = await fetch(`http://localhost:5000/stats/${year}/${month}/0/${encodedBuilding}`);
      if (!yearlyDataResponse.ok) {
        throw new Error(`Failed to fetch yearly stats for ${building}`);
      }

      const yearlyStats = await yearlyDataResponse.json();

      // Calculate highest and lowest month by summing daily data for each month
      const monthlyTotals = yearlyStats.monthlyData.reduce((acc, entry) => {
        acc[entry.month] = (acc[entry.month] || 0) + entry.consumption;
        return acc;
      }, {});

      const highestMonth = Object.entries(monthlyTotals).reduce((max, [month, value]) => {
        return value > max.value ? { month, value } : max;
      }, { month: '', value: 0 });

      const lowestMonth = Object.entries(monthlyTotals).reduce((min, [month, value]) => {
        return value < min.value || min.value === 0 ? { month, value } : min;
      }, { month: '', value: Number.MAX_VALUE });

      return {
        todayConsumption: day ? dailyData.consumption || 0 : (Array.isArray(dailyData) ? dailyData[day - 1]?.consumption || 0 : 0),
        dailyAverage: yearlyStats.mean || 0,
        monthlyAverage: yearlyStats.mean * 30 || 0, // Approximate monthly average
        yearlyAverage: yearlyStats.mean * 365 || 0, // Approximate yearly average
        totalConsumption: Array.isArray(dailyData) ?
          dailyData.reduce((sum, entry) => sum + (entry.consumption || 0), 0) :
          (dailyData.consumption || 0),
        highestMonth,
        lowestMonth,
        monthlyData: yearlyStats.monthlyData
      };
    } catch (error) {
      console.error(`Error fetching data for ${building}:`, error);
      return {
        todayConsumption: 0,
        dailyAverage: 0,
        monthlyAverage: 0,
        yearlyAverage: 0,
        totalConsumption: 0,
        highestMonth: { month: '', value: 0 },
        lowestMonth: { month: '', value: 0 },
        monthlyData: []
      };
    }
  };

  const fetchReportData = async () => {
    setIsLoading(true);
    try {
      const year = appDate.getFullYear();
      const month = appDate.getMonth() + 1;
      const day = appDate.getDate();

      if (selectedBuilding === 'All Buildings') {
        let allBuildingsData = {
          todayConsumption: 0,
          dailyAverage: 0,
          monthlyAverage: 0,
          yearlyAverage: 0,
          highestMonth: { month: '', value: 0 },
          lowestMonth: { month: '', value: Number.MAX_VALUE },
          buildingStats: {}
        };

        const relevantBuildings = buildings.filter(b => b !== 'All Buildings');
        for (const building of relevantBuildings) {
          const buildingData = await fetchBuilding(building, year, month, day);

          allBuildingsData.todayConsumption += buildingData.todayConsumption;
          allBuildingsData.dailyAverage += buildingData.dailyAverage;
          allBuildingsData.monthlyAverage += buildingData.monthlyAverage;
          allBuildingsData.yearlyAverage += buildingData.yearlyAverage;

          if (buildingData.highestMonth.value > allBuildingsData.highestMonth.value) {
            allBuildingsData.highestMonth = {
              month: buildingData.highestMonth.month,
              value: buildingData.highestMonth.value,
              building: building
            };
          }

          if (buildingData.lowestMonth.value < allBuildingsData.lowestMonth.value && buildingData.lowestMonth.value > 0) {
            allBuildingsData.lowestMonth = {
              month: buildingData.lowestMonth.month,
              value: buildingData.lowestMonth.value,
              building: building
            };
          }

          allBuildingsData.buildingStats[building] = buildingData;
        }

        if (allBuildingsData.lowestMonth.value === Number.MAX_VALUE) {
          allBuildingsData.lowestMonth = { month: '', value: 0 };
        }

        setReportData(allBuildingsData);
        // Save to local storage
        saveReportToLocalStorage(allBuildingsData);
      } else {
        const buildingData = await fetchBuilding(selectedBuilding, year, month, day);
        const reportData = {
          todayConsumption: buildingData.todayConsumption,
          dailyAverage: buildingData.dailyAverage,
          monthlyAverage: buildingData.monthlyAverage,
          yearlyAverage: buildingData.yearlyAverage,
          highestMonth: buildingData.highestMonth,
          lowestMonth: buildingData.lowestMonth,
          buildingStats: { [selectedBuilding]: buildingData }
        };
        
        setReportData(reportData);
        // Save to local storage
        saveReportToLocalStorage(reportData);
      }
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBuildingChange = (e) => {
    setSelectedBuilding(e.target.value);
  };

  const exportToPDF = async () => {
    if (!reportRef.current) return;
    
    try {
      // Show a loading or processing message
      const loadingMessage = document.createElement('div');
      loadingMessage.className = 'export-loading';
      loadingMessage.textContent = 'Generating PDF...';
      document.body.appendChild(loadingMessage);
      
      // Allow the loading message to render
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const imgWidth = 210; // A4 width in mm
      const imgHeight = canvas.height * imgWidth / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      
      // Generate filename with date information
      const dateStr = appDate.toISOString().split('T')[0];
      const filename = `Electricity_Report_${selectedBuilding.replace(/\s+/g, '_')}_${dateStr}.pdf`;
      
      pdf.save(filename);
      
      // Remove the loading message
      document.body.removeChild(loadingMessage);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  // Format numbers with commas for thousands
  const formatNumber = (num) => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // Convert large kWh values to appropriate units (kWh, MWh, GWh, TWh)
  const formatEnergyValue = (value) => {
    if (value === undefined || value === null) {
      return { value: 0, unit: 'kWh' };
    }
    
    if (value >= 1_000_000_000) {
      // Convert to TWh for values >= 1 billion kWh
      return { 
        value: (value / 1_000_000_000).toFixed(2), 
        unit: 'TWh' 
      };
    } else if (value >= 1_000_000) {
      // Convert to GWh for values >= 1 million kWh
      return { 
        value: (value / 1_000_000).toFixed(2), 
        unit: 'GWh' 
      };
    } else if (value >= 1_000) {
      // Convert to MWh for values >= 1000 kWh
      return { 
        value: (value / 1_000).toFixed(2), 
        unit: 'MWh' 
      };
    } else {
      // Keep as kWh for smaller values
      return { 
        value: value.toFixed(2), 
        unit: 'kWh' 
      };
    }
  };

  // Display energy value with appropriate unit
  const displayEnergyValue = (value) => {
    const { value: formattedValue, unit } = formatEnergyValue(value);
    return `${formatNumber(formattedValue)} ${unit}`;
  };

  const togglePieChart = () => {
    setShowPieChart(!showPieChart);
  };

  const getPieChartData = () => {
    const labels = [];
    const data = [];
    const backgroundColor = [];
    
    // Generate a unique bright color for each building
    Object.entries(reportData.buildingStats).forEach(([building, stats], index) => {
      labels.push(building);
      data.push(stats.totalConsumption || 0);
      
      // Golden ratio conjugate to create visually distinct hues
      const hue = (index * 0.618033988749895) % 1;
      // High saturation and lightness for brightness
      const saturation = 0.85 + Math.random() * 0.15; // 85-100%
      const lightness = 0.5 + Math.random() * 0.2; // 50-70%
      
      // Convert HSL to hexadecimal color
      const color = hslToHex(hue * 360, saturation * 100, lightness * 100);
      backgroundColor.push(color);
    });
    
    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor,
          borderWidth: 1,
        },
      ],
    };
  };
  
  // Helper function to convert HSL to hex color format
  function hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }

  // Force refresh the report (bypass cache)
  const handleRefreshData = () => {
    console.log('Forcing refresh of report data');
    fetchReportData();
  };

  return (
    <div className="report-container">
      <div className="report-header">
        <h1>Report</h1>
        <div className="report-date">
          {appDate.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </div>
        
        <div className="report-controls">
          <div className="building-selector">
            <label htmlFor="building-select">Building:</label>
            <select 
              id="building-select" 
              value={selectedBuilding} 
              onChange={handleBuildingChange}
            >
              <option value="All Buildings">All Buildings</option>
              {buildings.filter(b => b !== 'All Buildings').map(building => (
                <option key={building} value={building}>
                  {building}
                </option>
              ))}
            </select>
          </div>
          <button className="refresh-button" onClick={handleRefreshData} title="Refresh data">
            ↻ Refresh
          </button>
          <button className="export-button" onClick={exportToPDF}>
            Export to PDF
          </button>
          
        </div>
        
      </div>
      
      {isLoading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading report data...</p>
        </div>
      ) : (
        <div className="report-content" ref={reportRef}>
          <div className="metrics-grid">
            <div className="metric-card">
              <h2>Today's Consumption</h2>
              <div className="metric-value">{displayEnergyValue(reportData.todayConsumption)}</div>
              <div className="metric-comparison">
                {reportData.dailyAverage && reportData.todayConsumption > reportData.dailyAverage ? (
                  <span className="negative">+{((reportData.todayConsumption / reportData.dailyAverage - 1) * 100).toFixed(1)}% above daily average</span>
                ) : reportData.dailyAverage ? (
                  <span className="positive">-{((1 - reportData.todayConsumption / reportData.dailyAverage) * 100).toFixed(1)}% below daily average</span>
                ) : (
                  <span>No daily average data available</span>
                )}
              </div>
            </div>
            
            <div className="metric-card">
              <h2>Daily Average</h2>
              <div className="metric-value">{displayEnergyValue(reportData.dailyAverage)}</div>
              <div className="metric-detail">Based on the last 30 days</div>
            </div>
            
            <div className="metric-card">
              <h2>Monthly Average</h2>
              <div className="metric-value">{displayEnergyValue(reportData.monthlyAverage)}</div>
              <div className="metric-detail">Based on the last 12 months</div>
            </div>
          </div>
          
          {selectedBuilding === 'All Buildings' && reportData.buildingStats && Object.keys(reportData.buildingStats).length > 0 && (
            <div className="buildings-breakdown">
                <h2>Buildings Breakdown</h2>
                <button className="toggle-pie-chart-button" onClick={togglePieChart}>
                    {showPieChart ? 'Show List View' : 'Show Pie Chart'}
                </button>
                {showPieChart ? (
                    <div className="pie-chart-container">
                        <Pie data={getPieChartData()} />
                    </div>
                ) : (
                    <div className="breakdown-table-container">
                        <table className="breakdown-table">
                            <thead>
                                <tr>
                                    <th>Building</th>
                                    <th>Today</th>
                                    <th>Daily Avg</th>
                                    <th>Monthly Avg</th>
                                    <th>Highest Month</th>
                                    <th>Lowest Month</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(reportData.buildingStats).map(([building, stats]) => (
                                    <tr key={building}>
                                        <td>{building}</td>
                                        <td>{displayEnergyValue(stats.todayConsumption)}</td>
                                        <td>{displayEnergyValue(stats.dailyAverage)}</td>
                                        <td>{displayEnergyValue(stats.monthlyAverage)}</td>
                                        <td>
                                            {stats.highestMonth && stats.highestMonth.month}
                                            <span className="month-value"> ({displayEnergyValue(stats.highestMonth.value)})</span>
                                        </td>
                                        <td>
                                            {stats.lowestMonth && stats.lowestMonth.month}
                                            <span className="month-value"> ({displayEnergyValue(stats.lowestMonth.value)})</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
          )}
          
          {selectedBuilding !== 'All Buildings' && reportData.buildingStats[selectedBuilding] && (
            <div className="building-details">
              <h2>{selectedBuilding} Details</h2>
              
              <div className="consumption-highlights">
                <div className="highlight-card highest-month">
                  <h2>Highest Consumption Month</h2>
                  <div className="highlight-value">{reportData.highestMonth.month}</div>
                  <div className="highlight-detail">
                    {displayEnergyValue(reportData.highestMonth.value)}
                  </div>
                </div>
                
                <div className="highlight-card lowest-month">
                  <h2>Lowest Consumption Month</h2>
                  <div className="highlight-value">{reportData.lowestMonth.month}</div>
                  <div className="highlight-detail">
                    {displayEnergyValue(reportData.lowestMonth.value)}
                  </div>
                </div>
              </div>
              
              <div className="detail-section">
                <h2>Total Monthly Consumption</h2>
                <div className="total-consumption">
                  {displayEnergyValue(reportData.buildingStats[selectedBuilding].totalConsumption)}
                </div>
              </div>
            </div>
          )}
          
          <div className="report-footer">
            <p>This report was generated on {new Date().toLocaleString()}.</p>
            <p>For more detailed analytics, please visit the Dashboard.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Report;