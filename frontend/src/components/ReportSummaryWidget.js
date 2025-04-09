import React, { useState, useEffect } from 'react';
import { useAppDate } from './DateContext';

const ReportSummaryWidget = ({ id, isCustomizing, dragClass, dropTargetClass, customizingClass, dragAttributes, toggleWidgetVisibility }) => {
  const { appDate } = useAppDate();
  const [buildings, setBuildings] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState('All Buildings');
  const [reportData, setReportData] = useState({
    totalUsage: 0,
    totalUsageChange: 0,
    peakDay: { date: '', usage: 0 },
    lowestDay: { date: '', usage: 0 },
    cost: 0, 
    costChange: 0,
    averageDailyUsage: 0,
    topChangeBuildingName: '', // Changed from highestBuilding to track building with biggest percentage change
    topChangePercentage: 0,    // Stores the percentage change
    topChangeAbsolute: 0       // Stores the absolute change
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Cost per kWh (this could be fetched from settings or API)
  const costPerKWh = 0.11; 

  useEffect(() => {
    // Fetch available buildings
    fetchAvailableBuildings();
  }, []);

  useEffect(() => {
    // Check local storage for cached report data when date or building changes
    if (buildings.length > 0) {
      const cachedReport = checkCachedReport();
      if (cachedReport) {
        console.log('Loading report summary from cache:', selectedBuilding, getMonthYearString());
        setReportData(cachedReport);
        setIsLoading(false);
      } else {
        console.log('No cached report summary found, fetching new data:', selectedBuilding, getMonthYearString());
        fetchSummaryData();
      }
    }
  }, [appDate, selectedBuilding, buildings]);

  const getMonthYearString = () => {
    return `${appDate.getFullYear()}-${appDate.getMonth() + 1}`;
  };

  // Generate a unique key for the report based on month and building
  const getReportStorageKey = () => {
    const monthKey = getMonthYearString();
    return `electricity_summary_${monthKey}_${selectedBuilding.replace(/\s+/g, '_')}`;
  };

  // Check if we have a cached report for the current month and building
  const checkCachedReport = () => {
    const storageKey = getReportStorageKey();
    const cachedReportJson = localStorage.getItem(storageKey);
    
    if (cachedReportJson) {
      try {
        const cachedReport = JSON.parse(cachedReportJson);
        
        // For "All Buildings" selection, verify that all current buildings are included
        if (selectedBuilding === 'All Buildings') {
          const cachedBuildings = Object.keys(cachedReport.buildingData || {});
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
      console.log('Saved report summary to cache for', getMonthYearString(), 'and', selectedBuilding);
    } catch (error) {
      console.error('Error saving report summary to cache:', error);
      
      // If localStorage is full, try clearing older reports
      if (error.name === 'QuotaExceededError') {
        try {
          // Clean up old reports (older than 3 months)
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
    const reportKeyPrefix = 'electricity_summary_';
    const today = new Date();
    
    // Keep reports from the last 3 months
    const oldestDate = new Date();
    oldestDate.setMonth(today.getMonth() - 3);
    
    // Go through all localStorage items
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      
      // Only process our report summary keys
      if (key && key.startsWith(reportKeyPrefix)) {
        try {
          // Extract the date part from the key (format: electricity_summary_YYYY-MM_...)
          const datePart = key.split('_')[2];
          const [year, month] = datePart.split('-').map(Number);
          const reportDate = new Date(year, month - 1);
          
          // If this is an old report, remove it
          if (reportDate < oldestDate) {
            localStorage.removeItem(key);
            console.log('Removed old report summary from cache:', key);
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

  const fetchMonthlyData = async (building, year, month) => {
    try {
      const encodedBuilding = encodeURIComponent(building);
      
      // Fetch monthly data
      const monthlyDataResponse = await fetch(`http://localhost:5000/fetch-data/${year}/${month}/0/${encodedBuilding}`);
      
      if (!monthlyDataResponse.ok) {
        throw new Error(`Failed to fetch monthly data for ${building}`);
      }
      
      const monthlyData = await monthlyDataResponse.json();
      
      // Fetch previous month data for comparison
      let prevMonth = month - 1;
      let prevYear = year;
      if (prevMonth === 0) {
        prevMonth = 12;
        prevYear = year - 1;
      }
      
      const prevMonthDataResponse = await fetch(`http://localhost:5000/fetch-data/${prevYear}/${prevMonth}/0/${encodedBuilding}`);
      let prevMonthData = [];
      
      if (prevMonthDataResponse.ok) {
        prevMonthData = await prevMonthDataResponse.json();
      }
      
      // Process daily data to find peak and lowest days
      let totalConsumption = 0;
      let peakDay = { day: 0, usage: 0 };
      let lowestDay = { day: 0, usage: Number.MAX_VALUE };
      
      // Process all days in the month data
      monthlyData.forEach(day => {
        // Extract the day number from the ISO date string
        const dateObj = day.date ? new Date(day.date) : null;
        const dayNumber = dateObj ? dateObj.getDate() : undefined;
        const consumption = day.consumption || 0;
        
        totalConsumption += consumption;
        
        if (consumption > peakDay.usage) {
          peakDay = { day: dayNumber, usage: consumption };
        }
        
        if (consumption < lowestDay.usage && consumption > 0) {
          lowestDay = { day: dayNumber, usage: consumption };
        }
      });
      
      // If we never found a lowest day (all zeros), reset to default
      if (lowestDay.usage === Number.MAX_VALUE) {
        lowestDay = { day: 0, usage: 0 };
      }
      
      // Calculate previous month total for change percentage
      const prevMonthTotal = prevMonthData.reduce((sum, day) => sum + (day.consumption || 0), 0);
      
      // Calculate percentage change
      let percentChange = 0;
      if (prevMonthTotal > 0) {
        percentChange = ((totalConsumption - prevMonthTotal) / prevMonthTotal) * 100;
      }
      
      // Calculate cost based on kWh rate
      const cost = totalConsumption * costPerKWh;
      const prevMonthCost = prevMonthTotal * costPerKWh;
      
      // Calculate cost percentage change
      let costPercentChange = 0;
      if (prevMonthCost > 0) {
        costPercentChange = ((cost - prevMonthCost) / prevMonthCost) * 100;
      }
      
      // Calculate daily average
      const daysInMonth = monthlyData.length;
      const dailyAverage = daysInMonth > 0 ? totalConsumption / daysInMonth : 0;
      
      // Return the processed data
      return {
        totalConsumption,
        percentChange,
        peakDay,
        lowestDay,
        cost,
        costPercentChange,
        dailyAverage,
        daysInMonth,
        dailyData: monthlyData, // Include the daily data for aggregation
        absoluteChange: totalConsumption - prevMonthTotal // Add absolute change value
      };
    } catch (error) {
      console.error(`Error fetching monthly data for ${building}:`, error);
      return {
        totalConsumption: 0,
        percentChange: 0,
        peakDay: { day: 0, usage: 0 },
        lowestDay: { day: 0, usage: 0 },
        cost: 0,
        costPercentChange: 0,
        dailyAverage: 0,
        daysInMonth: 0,
        dailyData: [],
        absoluteChange: 0
      };
    }
  };

  const fetchSummaryData = async (bypassCache = false) => {
    setIsLoading(true);
    setIsRefreshing(bypassCache);
    
    try {
      const year = appDate.getFullYear();
      const month = appDate.getMonth() + 1;
      const monthName = appDate.toLocaleString('default', { month: 'short' });

      // If we are bypassing cache, remove the current cache entry
      if (bypassCache) {
        const storageKey = getReportStorageKey();
        localStorage.removeItem(storageKey);
      }

      if (selectedBuilding === 'All Buildings') {
        let summaryData = {
          totalUsage: 0,
          totalUsageChange: 0,
          peakDay: { date: '', usage: 0 },
          lowestDay: { date: '', usage: Number.MAX_VALUE },
          cost: 0,
          costChange: 0,
          averageDailyUsage: 0,
          topChangeBuildingName: '',
          topChangePercentage: 0,
          topChangeAbsolute: 0,
          buildingData: {}
        };

        // Filter out the "All Buildings" option
        const relevantBuildings = buildings.filter(b => b !== 'All Buildings');
        
        // Create an array of promises for all building data fetches
        const buildingPromises = relevantBuildings.map(building => 
          fetchMonthlyData(building, year, month)
        );
        
        // Wait for all promises to resolve
        const buildingResults = await Promise.all(buildingPromises);
        
        // Aggregate daily data for all buildings
        const aggregatedDailyData = {};
        
        // Process the results for each building
        relevantBuildings.forEach((building, index) => {
          const buildingData = buildingResults[index];
          
          summaryData.buildingData[building] = buildingData;
          summaryData.totalUsage += buildingData.totalConsumption;
          summaryData.cost += buildingData.cost;
          
          // Track building with highest percentage change (for buildings with meaningful consumption)
          // Only consider buildings with at least 100 kWh in either current or previous month
          // to avoid emphasizing tiny changes in buildings with minimal usage
          const minimumUsageThreshold = 100; // kWh
          if (
            buildingData.percentChange > summaryData.topChangePercentage && 
            (buildingData.totalConsumption > minimumUsageThreshold || buildingData.absoluteChange > minimumUsageThreshold)
          ) {
            summaryData.topChangeBuildingName = building;
            summaryData.topChangePercentage = buildingData.percentChange;
            summaryData.topChangeAbsolute = buildingData.absoluteChange;
          }
          
          // Aggregate daily data for all buildings
          if (buildingData.dailyData) {
            buildingData.dailyData.forEach(day => {
              // Extract the day number from the ISO date string
              const dateObj = day.date ? new Date(day.date) : null;
              const dayNum = dateObj ? dateObj.getDate() : undefined;
              
              if (dayNum !== undefined) {
                if (!aggregatedDailyData[dayNum]) {
                  aggregatedDailyData[dayNum] = 0;
                }
                aggregatedDailyData[dayNum] += day.consumption || 0;
              } else {
                console.warn('Invalid day data found:', day);
              }
            });
          }
        });
        
        // Find the peak and lowest days across all buildings combined
        let peakDayNum = 0;
        let peakDayUsage = 0;
        let lowestDayNum = 0;
        let lowestDayUsage = Number.MAX_VALUE;
        
        // When finding peak and lowest days across all buildings
        Object.entries(aggregatedDailyData).forEach(([dayNum, usage]) => {
          const dayNumber = parseInt(dayNum);
          
          // Find peak day (highest combined usage)
          if (usage > peakDayUsage) {
            peakDayNum = dayNumber;
            peakDayUsage = usage;
          }
          
          // Find lowest day (lowest non-zero combined usage)
          if (usage < lowestDayUsage && usage > 0) {
            lowestDayNum = dayNumber;
            lowestDayUsage = usage;
          }
        });
        
        // Ensure we have valid date strings, even if no data was found
        if (peakDayNum > 0) {
          summaryData.peakDay = {
            date: `${monthName} ${peakDayNum}`,
            usage: peakDayUsage
          };
        } else {
          summaryData.peakDay = { date: 'N/A', usage: 0 };
        }
        
        // If we never found a lowest day (all data is zero or missing)
        if (lowestDayUsage === Number.MAX_VALUE) {
          summaryData.lowestDay = { date: 'N/A', usage: 0 };
        } else {
          summaryData.lowestDay = {
            date: `${monthName} ${lowestDayNum}`,
            usage: lowestDayUsage
          };
        }
        // Calculate weighted average for changes and daily average
        let totalWeightedChange = 0;
        let totalWeightedCostChange = 0;
        let totalDays = 0;
        
        relevantBuildings.forEach(building => {
          const data = summaryData.buildingData[building];
          if (data.totalConsumption > 0) {
            const weight = data.totalConsumption / summaryData.totalUsage;
            totalWeightedChange += data.percentChange * weight;
            totalWeightedCostChange += data.costPercentChange * weight;
          }
          totalDays += data.daysInMonth;
        });
        
        summaryData.totalUsageChange = totalWeightedChange;
        summaryData.costChange = totalWeightedCostChange;
        summaryData.averageDailyUsage = totalDays > 0 ? 
          summaryData.totalUsage / (totalDays / relevantBuildings.length) : 0;

        console.log('Aggregated daily data:', aggregatedDailyData);
        console.log('Peak day found:', peakDayNum, 'with usage:', peakDayUsage);
        console.log('Lowest day found:', lowestDayNum, 'with usage:', lowestDayUsage);
        console.log('Top change building:', summaryData.topChangeBuildingName, 'with change:', summaryData.topChangePercentage, '%');
        
        setReportData(summaryData);
        saveReportToLocalStorage(summaryData);
        
      } else {
        // Fetch data for a single building
        const buildingData = await fetchMonthlyData(selectedBuilding, year, month);
        
        // Format the peak and lowest day dates properly
        const peakDayDate = buildingData.peakDay && buildingData.peakDay.day > 0 
          ? `${monthName} ${buildingData.peakDay.day}` 
          : 'N/A';
          
        const lowestDayDate = buildingData.lowestDay && buildingData.lowestDay.day > 0 
          ? `${monthName} ${buildingData.lowestDay.day}` 
          : 'N/A';
        
        const summaryData = {
          totalUsage: buildingData.totalConsumption,
          totalUsageChange: buildingData.percentChange,
          peakDay: { 
            date: peakDayDate, 
            usage: buildingData.peakDay.usage 
          },
          lowestDay: { 
            date: lowestDayDate, 
            usage: buildingData.lowestDay.usage 
          },
          cost: buildingData.cost,
          costChange: buildingData.costPercentChange,
          averageDailyUsage: buildingData.dailyAverage,
          topChangeBuildingName: selectedBuilding,
          topChangePercentage: buildingData.percentChange,
          topChangeAbsolute: buildingData.absoluteChange,
          buildingData: { [selectedBuilding]: buildingData }
        };
        
        setReportData(summaryData);
        saveReportToLocalStorage(summaryData);
      }
      
    } catch (error) {
      console.error('Error fetching summary data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Handle manual refresh button click
  const handleRefresh = () => {
    // Fetch fresh data bypassing the cache
    fetchSummaryData(true);
  };

  // Handle download report button click
  const handleViewFullReport = () => {
    window.location.href = '/report';
  };

  // Format numbers with commas for thousands
  const formatNumber = (num) => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // Format energy value with appropriate unit
  const formatEnergyValue = (value) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(2)} GWh`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(2)} MWh`;
    } else {
      return `${Math.round(value)} kWh`;
    }
  };

  // Format percentage change with appropriate sign and class
  const formatChange = (value) => {
    const prefix = value >= 0 ? '+' : '';
    return `${prefix}${value.toFixed(1)}%`;
  };

  // Determine CSS class for percentage change
  const getChangeClass = (value) => {
    return value >= 0 ? 'decrease' : 'increase';
  };

  return (
    <div 
      key={id} 
      className={`dashboard-card Report-Summary ${dragClass} ${dropTargetClass} ${customizingClass}`}
      {...dragAttributes}
    >
      <div className="card-header">
        <h2>Monthly Report</h2>
        <div className="card-actions">
          {/* Refresh button */}
          <button 
            className="icon-button" 
            onClick={handleRefresh} 
            title="Refresh Data"
            disabled={isLoading || isRefreshing}
          >
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 12h7V5l-2.35 1.35z"/>
            </svg>
            {isRefreshing && <span className="refresh-spinner"></span>}
          </button>

          <button className="icon-button" onClick={handleViewFullReport} title="View Full Report">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
            </svg>
          </button>
          {isCustomizing && (
            <button 
              className="widget-remove-btn" 
              onClick={() => toggleWidgetVisibility(id)}
              title="Hide Widget"
            >
              ✕
            </button>
          )}
        </div>
      </div>
      
      <div className="card-content">
        {isLoading ? (
          <div className="widget-loading">
            <div className="widget-loading-spinner"></div>
          </div>
        ) : (
          <>
            <div className="month-indicator">
              {appDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </div>
            
            <div className="report-highlights">
              <div className="highlight-item">
                <span className="highlight-label">Total Usage</span>
                <span className="highlight-value">{formatEnergyValue(reportData.totalUsage)}</span>
                <span className={`highlight-change ${getChangeClass(reportData.totalUsageChange)}`}>
                  {formatChange(reportData.totalUsageChange)}
                </span>
              </div>
              
              <div className="highlight-item">
                <span className="highlight-label">Peak Day</span>
                <span className="highlight-value">{reportData.peakDay.date || 'N/A'}</span>
                <span className="highlight-subvalue">
                  {reportData.peakDay.usage > 0 ? `${Math.round(reportData.peakDay.usage)} kWh` : ''}
                </span>
              </div>
              
              <div className="highlight-item">
                <span className="highlight-label">Lowest Day</span>
                <span className="highlight-value">{reportData.lowestDay.date || 'N/A'}</span>
                <span className="highlight-subvalue">
                  {reportData.lowestDay.usage > 0 ? `${Math.round(reportData.lowestDay.usage)} kWh` : ''}
                </span>
              </div>
              
              <div className="highlight-item">
                <span className="highlight-label">Cost</span>
                <span className="highlight-value">${formatNumber(Math.round(reportData.cost))}</span>
              </div>
              
              <div className="highlight-item">
                <span className="highlight-label">Daily Average</span>
                <span className="highlight-value">{Math.round(reportData.averageDailyUsage)} kWh</span>
              </div>
              
              {selectedBuilding === 'All Buildings' && reportData.topChangeBuildingName && (
                <div className="highlight-item">
                  <span className="highlight-label">Top Change</span>
                  <span className="highlight-value">{reportData.topChangeBuildingName}</span>
                  <span className={`highlight-change ${getChangeClass(reportData.topChangePercentage)}`}>
                    {formatChange(reportData.topChangePercentage)}
                  </span>
                  <span className="highlight-subvalue">
                    {formatEnergyValue(Math.abs(reportData.topChangeAbsolute))}
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      
      {isCustomizing && (
        <div className="widget-drag-handle">
          <span>⋮⋮</span>
        </div>
      )}

      {/* Add CSS for the refresh spinner */}
      <style jsx>{`
        .refresh-spinner {
          display: inline-block;
          width: 12px;
          height: 12px;
          margin-left: 6px;
          border: 2px solid rgba(255,255,255,0.3);
          border-radius: 50%;
          border-top-color: #fff;
          animation: spin 1s ease-in-out infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default ReportSummaryWidget;