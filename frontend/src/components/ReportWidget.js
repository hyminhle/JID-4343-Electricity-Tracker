import React, { useState, useEffect } from 'react';
import { useAppDate } from './DateContext';
import './ReportWidget.css';

const ReportWidget = () => {
  const { appDate } = useAppDate();
  const [reportData, setReportData] = useState({
    todayConsumption: 0,
    dailyAverage: 0,
    buildingStats: {}
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check local storage for cached data when the date changes
    const cachedReport = checkCachedReport();
    if (cachedReport) {
      console.log('Loading report widget data from cache:', appDate.toDateString());
      setReportData(cachedReport);
      setIsLoading(false);
    } else {
      console.log('No cached report widget data found, fetching new data:', appDate.toDateString());
      fetchReportData();
    }
  }, [appDate]);

  // Generate a unique key for the report based on date
  const getReportStorageKey = () => {
    const dateKey = appDate.toISOString().split('T')[0]; // Format: YYYY-MM-DD
    return `electricity_report_widget_${dateKey}`;
  };

  // Check if we have a cached report for the current date
  const checkCachedReport = () => {
    const storageKey = getReportStorageKey();
    const cachedReportJson = localStorage.getItem(storageKey);
    
    if (cachedReportJson) {
      try {
        const cachedReport = JSON.parse(cachedReportJson);
        return cachedReport;
      } catch (error) {
        console.error('Error parsing cached report widget data:', error);
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
      console.log('Saved report widget data to cache for', appDate.toDateString());
    } catch (error) {
      console.error('Error saving report widget data to cache:', error);
      
      // If localStorage is full, try clearing older reports
      if (error.name === 'QuotaExceededError') {
        try {
          // Clean up old reports (older than 7 days)
          cleanupOldReports();
          // Try saving again
          localStorage.setItem(storageKey, JSON.stringify(data));
        } catch (e) {
          console.error('Still unable to save widget data to localStorage after cleanup:', e);
        }
      }
    }
  };
  
  // Clean up older reports from localStorage to free up space
  const cleanupOldReports = () => {
    const reportKeyPrefix = 'electricity_report_widget_';
    const today = new Date();
    
    // Keep reports from the last 7 days
    const oldestDate = new Date();
    oldestDate.setDate(today.getDate() - 7);
    
    // Go through all localStorage items
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      
      // Only process our report widget keys
      if (key && key.startsWith(reportKeyPrefix)) {
        try {
          // Extract the date part from the key (format: electricity_report_widget_YYYY-MM-DD)
          const datePart = key.split('_')[3];
          const reportDate = new Date(datePart);
          
          // If this is an old report, remove it
          if (reportDate < oldestDate) {
            localStorage.removeItem(key);
            console.log('Removed old report widget data from cache:', key);
          }
        } catch (e) {
          console.error('Error processing localStorage key:', key, e);
        }
      }
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

  // Helper function to calculate price
  const calculatePrice = (consumption) => {
    return ((consumption || 0) * 0.11).toFixed(2);
  };

  // Helper function to calculate CO2 emissions (0.81 pounds per kWh)
  const calculateCO2 = (consumption) => {
    return ((consumption || 0) * 0.81).toFixed(2);
  };

  const fetchReportData = async () => {
    setIsLoading(true);
    try {
      // Get date from context instead of creating a new Date()
      const year = appDate.getFullYear();
      const month = appDate.getMonth() + 1;
      const day = appDate.getDate();

      // Fetch available buildings
      const buildingsResponse = await fetch('http://localhost:5000/get-available-data');
      const buildingsData = await buildingsResponse.json();
      const buildings = Object.keys(buildingsData).sort();

      let allBuildingsData = {
        todayConsumption: 0,
        dailyAverage: 0,
        buildingStats: {}
      };

      // Fetch data for each building
      for (const building of buildings) {
        if (building === 'All Buildings') continue;

        const buildingData = await fetchBuilding(building, year, month, day);

        allBuildingsData.todayConsumption += buildingData.todayConsumption;
        allBuildingsData.dailyAverage += buildingData.dailyAverage;
        allBuildingsData.buildingStats[building] = buildingData;
      }

      setReportData(allBuildingsData);
      
      // Save the fetched data to local storage
      saveReportToLocalStorage(allBuildingsData);
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBuilding = async (building, year, month, day) => {
    try {
      const encodedBuilding = encodeURIComponent(building);
      
      // Fetch daily data
      const dailyDataResponse = await fetch(
        `http://localhost:5000/fetch-data/${year}/${month}/${day}/${encodedBuilding}`
      );

      if (!dailyDataResponse.ok) {
        throw new Error(`Failed to fetch daily data for ${building}`);
      }

      const dailyData = await dailyDataResponse.json();

      // Fetch yearly statistics to get daily average
      const yearlyDataResponse = await fetch(
        `http://localhost:5000/stats/${year}/0/${encodedBuilding}`
      );
      
      if (!yearlyDataResponse.ok) {
        throw new Error(`Failed to fetch yearly stats for ${building}`);
      }

      const yearlyStats = await yearlyDataResponse.json();

      return {
        todayConsumption: dailyData.consumption || 0,
        dailyAverage: yearlyStats.mean || 0
      };
    } catch (error) {
      console.error(`Error fetching data for ${building}:`, error);
      return {
        todayConsumption: 0,
        dailyAverage: 0
      };
    }
  };

  // Calculate comparison percentage between today's consumption and daily average
  const getComparisonPercentage = () => {
    if (reportData.dailyAverage === 0) return { value: 0, isAbove: false };
    
    if (reportData.todayConsumption > reportData.dailyAverage) {
      return {
        value: ((reportData.todayConsumption / reportData.dailyAverage - 1) * 100).toFixed(1),
        isAbove: true
      };
    } else {
      return {
        value: ((1 - reportData.todayConsumption / reportData.dailyAverage) * 100).toFixed(1),
        isAbove: false
      };
    }
  };

  const comparison = getComparisonPercentage();
  
  // Format the current date from context
  const formatDisplayDate = () => {
    const options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
    return appDate.toLocaleDateString('en-US', options);
  };

  return (
    <div className="report-widget compact">
      {isLoading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <div>Loading energy data...</div>
        </div>
      ) : (
        <>
          <div className="report-date compact">
            <span>{formatDisplayDate()}</span>
          </div>
          <div className="report-metrics compact">
            <div className="metric-row">
              <div className="metric-item compact">
                <h3>⚡ Today's Usage</h3>
                <div className="metric-value">{displayEnergyValue(reportData.todayConsumption)}</div>
                <div className={`metric-comparison ${comparison.isAbove ? 'negative' : 'positive'}`}>
                  {comparison.isAbove ? `↑${comparison.value}%` : `↓${comparison.value}%`} vs avg
                </div>
              </div>
              
              <div className="metric-item compact">
                <h3>📊 Daily Average</h3>
                <div className="metric-value">{displayEnergyValue(reportData.dailyAverage)}</div>
                <div className="metric-comparison">year to date</div>
              </div>
            </div>

            <div className="metric-row">
              <div className="metric-item compact">
                <h3>💰 Estimated Cost</h3>
                <div className="metric-value">${formatNumber(calculatePrice(reportData.todayConsumption))}</div>
                <div className="metric-comparison">at $0.11/kWh</div>
              </div>

              <div className="metric-item compact">
                <h3>🌿 CO₂ Emissions</h3>
                <div className="metric-value">{formatNumber(calculateCO2(reportData.todayConsumption))} lbs</div>
                <div className="metric-comparison">carbon footprint</div>
              </div>
            </div>
            
            <div className="metric-item buildings-count compact">
              <div className="buildings-info">
                <span>🏢 {Object.keys(reportData.buildingStats).length} buildings monitored</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ReportWidget;