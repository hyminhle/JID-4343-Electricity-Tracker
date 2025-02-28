import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import './Calendar.css';

const Calendar = ({ buildingStats }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedBuilding, setSelectedBuilding] = useState('');
  const [displayMode, setDisplayMode] = useState('consumption'); // 'consumption' or 'price'
  const [consumptionData, setConsumptionData] = useState({});
  const [availableData, setAvailableData] = useState({});
  const [buildingOptions, setBuildingOptions] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(selectedDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(selectedDate.getFullYear());
  const [isLoading, setIsLoading] = useState(false);

  // Function to save data to localStorage
  const saveDataToLocalStorage = (data) => {
    try {
      localStorage.setItem('consumptionData', JSON.stringify(data));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  };
  
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
  const saveDateToLocalStorage = (date) => {
    try {
      localStorage.setItem('selectedDate', JSON.stringify(date));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  };
  
  // Function to load data from localStorage
  const loadDateFromLocalStorage = () => {
    try {
      const savedDate = localStorage.getItem('selectedDate');
      return savedDate ? JSON.parse(savedDate) : {};
    } catch (error) {
      console.error('Error loading from localStorage:', error);
      return {};
    }
  };
  // Function to save selected building to localStorage
  const saveSelectedBuildingToLocalStorage = (building) => {
    try {
      localStorage.setItem('selectedBuilding', building);
    } catch (error) {
      console.error('Error saving building to localStorage:', error);
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

  // Load saved data on component mount
  useEffect(() => {
    // Load data from localStorage first
    const savedData = loadDataFromLocalStorage();
    if (Object.keys(savedData).length > 0) {
      setConsumptionData(savedData);
    }
  }, []);
  
  
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
    
    // Save to localStorage
    saveDataToLocalStorage(data);
  }, [buildingStats]);

  // Save selected building to localStorage when it changes
  useEffect(() => {
    if (selectedBuilding) {
      saveSelectedBuildingToLocalStorage(selectedBuilding);
    }
  }, [selectedBuilding]);

  // Improved fetch and cache function
  const fetchAndCacheData = async (date, building) => {
    if (!building) return null;
    
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // JavaScript months are 0-based
    const day = date.getDate();
    const dateKey = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    const encodedBuilding = encodeURIComponent(building);

    // Check if we already have this data cached
    if (consumptionData[dateKey] && consumptionData[dateKey][building]) {
      return consumptionData[dateKey][building];
    }

    try {
      const response = await fetch(`http://127.0.0.1:5000/fetch-data/${year}/${month}/${day}/${encodedBuilding}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      const response2 = await fetch(`http://127.0.0.1:5000/stats/${year}/${month}/${encodedBuilding}`);
      if (!response2.ok) {
        throw new Error(`HTTP error! status: ${response2.status}`);
      }
      const stat_data = await response2.json();

      // Create the new entry
      const newEntry = {
        consumption: data.consumption,
        buildings: [{
          name: building,
          consumption: data.consumption,
          average: stat_data.mean,
          max: stat_data.highest,
          min: stat_data.lowest,
          median: stat_data.median
        }]
      };

      // Update the consumptionData state with the new data
      setConsumptionData(prevData => {
        const updatedData = {
          ...prevData,
          [dateKey]: {
            ...(prevData[dateKey] || {}),
            [building]: newEntry
          }
        };
        
        // Save to localStorage
        saveDataToLocalStorage(updatedData);
        
        return updatedData;
      });

      return newEntry;
    } catch (error) {
      console.error(`Error fetching data for ${dateKey}:`, error);
      return null;
    }
  };

  // Fetch data when month or year changes
  useEffect(() => {
    const fetchDataForMonth = async () => {
      if (!selectedBuilding) return;
      
      setIsLoading(true);
      
      try {
        const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
        const fetchResults = [];
        
        // Create an array of dates for the current month
        for (let day = 1; day <= daysInMonth; day++) {
          const date = new Date(selectedYear, selectedMonth - 1, day);
          fetchResults.push(fetchAndCacheData(date, selectedBuilding));
        }
        
        // Wait for all fetches to complete
        await Promise.all(fetchResults);
      } catch (error) {
        console.error('Error fetching month data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (selectedBuilding) {
      fetchDataForMonth();
    }
  }, [selectedBuilding, selectedMonth, selectedYear]);

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

  // Helper function to calculate price
  const calculatePrice = (consumption) => {
    return ((consumption || 0) * 0.11).toFixed(2);
  };

  // Helper function to get selected date stats
  const getSelectedDateStats = () => {
    const dateKey = selectedDate.toISOString().split('T')[0];
    const dayData = consumptionData[dateKey] && consumptionData[dateKey][selectedBuilding];
    
    if (dayData) {
      return {
        consumption: dayData.consumption || 0,
        buildings: dayData.buildings || []
      };
    }
    
    return { consumption: 0, buildings: [] };
  };

  // Helper function to get filtered buildings data
  const getFilteredBuildingsData = () => {
    const dateKey = selectedDate.toISOString().split('T')[0];
    const dayData = consumptionData[dateKey] && consumptionData[dateKey][selectedBuilding];
    
    if (dayData && dayData.buildings) {
      return dayData.buildings;
    }
    
    return [];
  };

  // Helper function to determine comparison class
  const getComparisonClass = (value) => {
    if (value.startsWith('-')) return 'negative';
    if (value.startsWith('+')) return 'positive';
    return '';
  };

  // Calculate usage comparisons
  const calculateComparisons = () => {
    const dateKey = selectedDate.toISOString().split('T')[0];
    const currentDayData = consumptionData[dateKey]?.[selectedBuilding];
    if (!currentDayData) return { previousDay: '+0%', weeklyAvg: '+0%', monthlyAvg: '+0%' };

    const currentConsumption = currentDayData.consumption || 0;
    
    // Previous day comparison
    const yesterday = new Date(selectedDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = yesterday.toISOString().split('T')[0];
    const yesterdayData = consumptionData[yesterdayKey]?.[selectedBuilding];
    const yesterdayConsumption = yesterdayData?.consumption || 0;
    
    const previousDayChange = yesterdayConsumption === 0 ? 0 : 
      ((currentConsumption - yesterdayConsumption) / yesterdayConsumption) * 100;
    
    // Calculate weekly average (last 7 days)
    let weeklyTotal = 0;
    let weeklyCount = 0;
    for (let i = 1; i <= 7; i++) {
      const pastDate = new Date(selectedDate);
      pastDate.setDate(pastDate.getDate() - i);
      const pastDateKey = pastDate.toISOString().split('T')[0];
      const pastDateData = consumptionData[pastDateKey]?.[selectedBuilding];
      if (pastDateData) {
        weeklyTotal += pastDateData.consumption || 0;
        weeklyCount++;
      }
    }
    const weeklyAvg = weeklyCount > 0 ? weeklyTotal / weeklyCount : 0;
    const weeklyChange = weeklyAvg === 0 ? 0 : 
      ((currentConsumption - weeklyAvg) / weeklyAvg) * 100;
    
    // Monthly average (current month)
    const monthlyData = Object.entries(consumptionData)
      .filter(([key, value]) => {
        const keyDate = new Date(key);
        return keyDate.getMonth() === selectedDate.getMonth() && 
               keyDate.getFullYear() === selectedDate.getFullYear() &&
               value[selectedBuilding];
      })
      .map(([_, value]) => value[selectedBuilding]?.consumption || 0);
    
    const monthlyAvg = monthlyData.length > 0 ? 
      monthlyData.reduce((sum, val) => sum + val, 0) / monthlyData.length : 0;
    
    const monthlyChange = monthlyAvg === 0 ? 0 : 
      ((currentConsumption - monthlyAvg) / monthlyAvg) * 100;
    
    return {
      previousDay: `${previousDayChange >= 0 ? '+' : ''}${previousDayChange.toFixed(1)}%`,
      weeklyAvg: `${weeklyChange >= 0 ? '+' : ''}${weeklyChange.toFixed(1)}%`,
      monthlyAvg: `${monthlyChange >= 0 ? '+' : ''}${monthlyChange.toFixed(1)}%`
    };
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
                  <span className="price-value">{displayValue}</span>
                  <span className="consumption-unit">kWh</span>
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

  // Get the actual comparisons
  const comparisons = calculateComparisons();

  return (
    <div className="calendar-page">
      <h1>Electricity Consumption Calendar</h1>
      <div className="calendar-controls">
        <div className="control-group">
          <label>Select Building:</label>
          <select 
            value={selectedBuilding} 
            onChange={(e) => setSelectedBuilding(e.target.value)}
            className="building-select"
          >
            {buildingOptions.map(building => (
              <option key={building} value={building}>{building}</option>
            ))}
          </select>
        </div>
        <div className="control-group">
          <label>Display:</label>
          <div className="toggle-buttons">
            <button 
              className={`toggle-button ${displayMode === 'consumption' ? 'active' : ''}`}
              onClick={() => setDisplayMode('consumption')}
            >
              Consumption (kWh)
            </button>
            <button 
              className={`toggle-button ${displayMode === 'price' ? 'active' : ''}`}
              onClick={() => setDisplayMode('price')}
            >
              Price ($)
            </button>
          </div>
        </div>
      </div>
      
      <div className="calendar-with-stats">
        <div className="calendar-container">
        <div className="calendar-legend">
          <div className="legend-item">
            <div className="legend-color very-low-consumption"></div>
            <span> Below Average (&gt;20% under)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color low-consumption"></div>
            <span>Slightly Below Average (0-20% under)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color medium-consumption"></div>
            <span>Slightly Above Average (0-20% over)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color high-consumption"></div>
            <span> Above Average (&gt;20% over)</span>
          </div>
        </div>
          
          {isLoading && (
            <div className="loading-indicator">
              <div className="spinner"></div>
              <span>Loading consumption data...</span>
            </div>
          )}
          
          <DatePicker
            selected={selectedDate}
            onChange={handleDateChange}
            onMonthChange={handleMonthChange}
            inline
            calendarClassName="custom-calendar"
            dayClassName={getDayClassName}
            renderDayContents={renderDayContents}
            showMonthYearPicker={false}
          />
        </div>
        
        {/* Stats Box - Side panel */}
        <div className="stats-box">
          <div className="stats-header">
            <h2>Statistics for {selectedDate.toLocaleDateString()}</h2>
          </div>
          <div className="stats-content">
            <div className="stats-overview">
              <div className="stats-item">
                <span className="stats-label">Total Consumption:</span>
                <span className="stats-value">{Math.round(getSelectedDateStats().consumption)} kWh</span>
              </div>
              <div className="stats-item">
                <span className="stats-label">Estimated Price:</span>
                <span className="stats-value">${calculatePrice(getSelectedDateStats().consumption)}</span>
              </div>
            </div>
            
            <h3>Building Breakdown</h3>
            {getFilteredBuildingsData().length > 0 ? (
              <div className="building-breakdown">
                {getFilteredBuildingsData().map((building, index) => (
                  <div key={index} className="building-stats">
                    <div className="building-name">Building {building.name}</div>
                    <div className="building-consumption">
                      {displayMode === 'consumption' ? (
                        <span>{Math.round(building.consumption)} kWh</span>
                      ) : (
                        <span>${calculatePrice(building.consumption)}</span>
                      )}
                    </div>
                    <div className="consumption-bar-container">
                    <div 
                      className="consumption-bar" 
                      style={{ 
                        width: `${Math.min(100, (building.consumption / building.average) * 100)}%`,
                        backgroundColor: building.consumption < building.average * 0.8 
                          ? 'rgba(46, 204, 113, 0.8)' // Green if 20% below average
                          : (building.consumption > building.average 
                            ? 'rgba(231, 76, 60, 0.8)' // Red if above average
                            : 'rgba(22, 203, 97, 0.25)') // Yellow if within ±20% of average
                      }}
                    ></div>
                  </div>
                    {building.average && (
                      <div className="building-averages">
                        <div className="average-item">
                          <span>Monthly Avg:</span>
                          <span>{Math.round(building.average)} kWh</span>
                        </div>
                        <div className="average-item">
                          <span>Monthly Max:</span>
                          <span>{Math.round(building.max)} kWh</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-data-message">No data available for this date or building.</p>
            )}
            
            <div className="additional-stats">
              <h3>Usage Comparison</h3>
              <div className="comparison-stats">
                <div className="comparison-item">
                  <span className="comparison-label">Compared to Previous Day:</span>
                  <span className={`comparison-value ${getComparisonClass(comparisons.previousDay)}`}>
                    {comparisons.previousDay}
                  </span>
                </div>
                <div className="comparison-item">
                  <span className="comparison-label">Compared to Weekly Average:</span>
                  <span className={`comparison-value ${getComparisonClass(comparisons.weeklyAvg)}`}>
                    {comparisons.weeklyAvg}
                  </span>
                </div>
                <div className="comparison-item">
                  <span className="comparison-label">Compared to Monthly Average:</span>
                  <span className={`comparison-value ${getComparisonClass(comparisons.monthlyAvg)}`}>
                    {comparisons.monthlyAvg}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Calendar;