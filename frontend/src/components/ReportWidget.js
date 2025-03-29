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
    // Fetch report data when component mounts or when appDate changes
    fetchReportData();
  }, [appDate]);

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
    <div className="report-widget">
      {isLoading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading metrics...</p>
        </div>
      ) : (
        <>
          <div className="report-date">
            <span>{formatDisplayDate()}</span>
          </div>
          <div className="report-metrics">
            <div className="metric-item">
              <h3>⚡ Today's Consumption</h3>
              <div className="metric-value smaller">{displayEnergyValue(reportData.todayConsumption)}</div>
              <div className={`metric-comparison ${comparison.isAbove ? 'negative' : 'positive'}`}>
                {comparison.isAbove ? 
                  `+${comparison.value}% above average` : 
                  `-${comparison.value}% below average`}
              </div>
            </div>
            
            <div className="metric-item">
              <h3>📊 Daily Average</h3>
              <div className="metric-value smaller">{displayEnergyValue(reportData.dailyAverage)}</div>
              <div className="metric-detail">This Month</div>
            </div>

            <div className="metric-item">
              <h3>💰 Today's Cost</h3>
              <div className="metric-value smaller">${formatNumber(calculatePrice(reportData.todayConsumption))}</div>
            </div>

            <div className="metric-item">
              <h3>🌿 CO₂ Emissions</h3>
              <div className="metric-value smaller">{formatNumber(calculateCO2(reportData.todayConsumption))} lbs</div>
            </div>
            
            <div className="metric-item buildings-count">
              <h3>🏢 Buildings</h3>
              <div className="metric-value smaller">{Object.keys(reportData.buildingStats).length}</div>
              <div className="metric-detail">
                <button className="view-details-btn">View Details</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ReportWidget;