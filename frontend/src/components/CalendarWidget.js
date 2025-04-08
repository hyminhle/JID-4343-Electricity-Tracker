import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import './Calendar.css';

const CalendarWidget = ({ buildingStats, simplified = true }) => {
  const loadDateFromLocalStorage = () => {
    try {
      const savedDate = localStorage.getItem('selectedDate');
      return savedDate ? new Date(savedDate) : new Date();
    } catch (error) {
      console.error('Error loading date from localStorage:', error);
      return new Date();
    }
  };

  const initialDate = loadDateFromLocalStorage();

  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [selectedBuilding, setSelectedBuilding] = useState('');
  const [displayMode, setDisplayMode] = useState('consumption');
  const [consumptionData, setConsumptionData] = useState({});
  const [buildingOptions, setBuildingOptions] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(initialDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(initialDate.getFullYear());
  const [isLoading, setIsLoading] = useState(false);

  // Function to load data from localStorage
  const loadDataFromLocalStorage = () => {
    try {
      const savedData = localStorage.getItem('consumptionData');
      return savedData ? JSON.parse(savedData) : {};
    } catch (error) {
      console.error('Error loading from localStorage:', error);
      return {};
    }
  };

  // Function to load selected building from localStorage
  const loadSelectedBuildingFromLocalStorage = () => {
    try {
      return localStorage.getItem('selectedBuilding') || '';
    } catch (error) {
      console.error('Error loading building from localStorage:', error);
      return '';
    }
  };

  // Load saved data and date on component mount
  useEffect(() => {
    // Load data from localStorage first
    const savedData = loadDataFromLocalStorage();
    if (Object.keys(savedData).length > 0) {
      setConsumptionData(savedData);
    }
    
    // Load saved date from localStorage
    const savedDate = loadDateFromLocalStorage();
    setSelectedDate(savedDate);
    setSelectedMonth(savedDate.getMonth() + 1);
    setSelectedYear(savedDate.getFullYear());
  }, []);
  
  // Fetch available data on component mount
  useEffect(() => {
    const fetchAvailableData = async () => {
      try {
        const response = await fetch('http://127.0.0.1:5000/get-available-data');
        const data = await response.json();

        // Extract building names from available data
        const buildings = Object.keys(data).map(building => decodeURIComponent(building));
        setBuildingOptions(buildings);
        
        // Try to get selected building from localStorage first
        const savedBuilding = loadSelectedBuildingFromLocalStorage();
        if (savedBuilding && buildings.includes(savedBuilding)) {
          setSelectedBuilding(savedBuilding);
        } else if (buildings.length > 0) {
          setSelectedBuilding(buildings[0]);
        }
      } catch (error) {
        console.error('Error fetching available data:', error);
      }
    };

    fetchAvailableData();
  }, []);

  // Process building stats to get consumption data for dates
  useEffect(() => {
    if (!buildingStats || Object.keys(buildingStats).length === 0) return;
    
    const data = { ...consumptionData };
    Object.entries(buildingStats).forEach(([building, stats]) => {
      if (stats.date) {
        const date = new Date(stats.date);
        const dateKey = date.toISOString().split('T')[0];
        if (!data[dateKey]) {
          data[dateKey] = {};
        }
        
        // Store data by building name
        data[dateKey][building] = {
          consumption: parseFloat(stats.consumption || 0),
          buildings: [{
            name: building,
            consumption: parseFloat(stats.consumption || 0)
          }]
        };
      }
    });
    
    setConsumptionData(data);
  }, [buildingStats]);

  // Handle date change
  const handleDateChange = (date) => {
    const newMonth = date.getMonth() + 1;
    const newYear = date.getFullYear();
    
    setSelectedDate(date);
    
    // Only trigger month/year change if they actually changed
    if (newMonth !== selectedMonth || newYear !== selectedYear) {
      setSelectedMonth(newMonth);
      setSelectedYear(newYear);
    }
  };

  // Handle month navigation
  const handleMonthChange = (date) => {
    const newMonth = date.getMonth() + 1;
    const newYear = date.getFullYear();
    
    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
    
    // Update the selected date to be within the new month
    const newDate = new Date(date);
    newDate.setDate(1); // Set to the first day of the month
    setSelectedDate(newDate);
  };

  // Custom day class names based on consumption
  const getDayClassName = (date) => {
    const dateKey = date.toISOString().split('T')[0];
    const dayData = consumptionData[dateKey] && consumptionData[dateKey][selectedBuilding];
    
    if (!dayData) return "calendar-day";
    
    // Get the date's month and year
    const month = date.getMonth();
    const year = date.getFullYear();
    
    // Calculate monthly average for the current building
    const monthlyData = Object.entries(consumptionData)
      .filter(([key, value]) => {
        const keyDate = new Date(key);
        return keyDate.getMonth() === month && 
              keyDate.getFullYear() === year &&
              value[selectedBuilding];
      })
      .map(([_, value]) => value[selectedBuilding]?.consumption || 0);
    
    const monthlyAvg = monthlyData.length > 0 ? 
      monthlyData.reduce((sum, val) => sum + val, 0) / monthlyData.length : 0;
    
    if (monthlyAvg === 0) return "calendar-day"; // No average data available
    
    const consumption = dayData.consumption;
    const percentageDiff = ((consumption - monthlyAvg) / monthlyAvg) * 100;
    
    // Classification based on percentage difference from monthly average
    if (percentageDiff < -20) return "calendar-day very-low-consumption"; // Very under (more than 20% below average)
    if (percentageDiff < 0) return "calendar-day low-consumption"; // Slightly under (0-20% below average)
    if (percentageDiff < 20) return "calendar-day medium-consumption"; // Slightly above (0-20% above average)
    return "calendar-day high-consumption"; // Very above (more than 20% above average)
  };

  // Get consumption class based on percentage difference from monthly average
  const getConsumptionClass = (date) => {
    const dateKey = date.toISOString().split('T')[0];
    const dayData = consumptionData[dateKey] && consumptionData[dateKey][selectedBuilding];
    
    if (!dayData) return "";
    
    // Get the date's month and year
    const month = date.getMonth();
    const year = date.getFullYear();
    
    // Calculate monthly average for the current building
    const monthlyData = Object.entries(consumptionData)
      .filter(([key, value]) => {
        const keyDate = new Date(key);
        return keyDate.getMonth() === month && 
              keyDate.getFullYear() === year &&
              value[selectedBuilding];
      })
      .map(([_, value]) => value[selectedBuilding]?.consumption || 0);
    
    const monthlyAvg = monthlyData.length > 0 ? 
      monthlyData.reduce((sum, val) => sum + val, 0) / monthlyData.length : 0;
    
    if (monthlyAvg === 0) return ""; // No average data available
    
    const consumption = dayData.consumption;
    const percentageDiff = ((consumption - monthlyAvg) / monthlyAvg) * 100;
    
    // Classification based on percentage difference from monthly average
    if (percentageDiff < -20) return "very-low-consumption-text"; // Very under (more than 20% below average)
    if (percentageDiff < 0) return "low-consumption-text"; // Slightly under (0-20% below average)
    if (percentageDiff < 20) return "medium-consumption-text"; // Slightly above (0-20% above average)
    return "high-consumption-text"; // Very above (more than 20% above average)
  };

  // Calculate price from consumption
  const calculatePrice = (consumption) => {
    return ((consumption || 0) * 0.11).toFixed(2);
  };

  // Custom day content with improved styling
  const renderDayContents = (day, date) => {
    const dateKey = date.toISOString().split('T')[0];
    const dayData = consumptionData[dateKey] && consumptionData[dateKey][selectedBuilding];
    
    const consumptionValue = dayData?.consumption;
    const displayValue = displayMode === 'consumption' 
      ? `${Math.round(consumptionValue || 0)}` 
      : `$${calculatePrice(consumptionValue)}`;

    const isCurrentDate = date.toDateString() === selectedDate.toDateString();
    const hasData = !!dayData;
    const textColorClass = hasData ? getConsumptionClass(date) : "";
    
    // Determine consumption level class for the dot
    let consumptionLevelClass = "";
    if (hasData) {
      const month = date.getMonth();
      const year = date.getFullYear();
      
      // Calculate monthly average
      const monthlyData = Object.entries(consumptionData)
        .filter(([key, value]) => {
          const keyDate = new Date(key);
          return keyDate.getMonth() === month && 
                keyDate.getFullYear() === year &&
                value[selectedBuilding];
        })
        .map(([_, value]) => value[selectedBuilding]?.consumption || 0);
      
      const monthlyAvg = monthlyData.length > 0 ? 
        monthlyData.reduce((sum, val) => sum + val, 0) / monthlyData.length : 0;
      
      if (monthlyAvg > 0) {
        const percentageDiff = ((consumptionValue - monthlyAvg) / monthlyAvg) * 100;
        
        if (percentageDiff < -20) consumptionLevelClass = "very-low-consumption";
        else if (percentageDiff < 0) consumptionLevelClass = "low-consumption";
        else if (percentageDiff < 20) consumptionLevelClass = "medium-consumption";
        else consumptionLevelClass = "high-consumption";
      }
    }

    // Use a more compact display for the dashboard widget
    if (simplified) {
      return (
        <div className={`day-content-simple ${isCurrentDate ? 'selected-day' : ''}`} onClick={() => {
          setSelectedDate(date);
        }}>
          <span className="day-number">{day}</span>
          {hasData && (
            <>
              <span className={`consumption-value ${textColorClass}`}>
                {displayValue}
                <span className="consumption-unit"> kWh</span>
              </span>
            </>
          )}
        </div>
      );
    }

    // Full display for the Calendar page
    return (
      <div className={`day-content ${isCurrentDate ? 'selected-day' : ''}`} onClick={() => {
        setSelectedDate(date);
      }}>
        <span className="day-number">{day}</span>
        {hasData ? (
          <div className="day-stats">
            <span className={`consumption-indicator ${textColorClass}`}>
              {displayMode === 'consumption' ? (
                <>
                  <span className="consumption-value">{displayValue}</span>
                  <span className="consumption-unit"> kWh</span>
                </>
              ) : (
                <span className="price-value">{displayValue}</span>
              )}
            </span>
          </div>
        ) : (
          <div className="day-stats">
            <span className="no-data-indicator">-</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`calendar-widget ${simplified ? 'simplified' : ''}`}>
      {isLoading && (
        <div className="loading-indicator-small">
          <div className="spinner-small"></div>
        </div>
      )}
      
      <DatePicker
        selected={selectedDate}
        onChange={handleDateChange}
        onMonthChange={handleMonthChange}
        inline
        calendarClassName={`custom-calendar ${simplified ? 'calendar-widget-small' : ''}`}
        dayClassName={getDayClassName}
        renderDayContents={renderDayContents}
        showMonthYearPicker={false}
      />
    </div>
  );
};

export default CalendarWidget;