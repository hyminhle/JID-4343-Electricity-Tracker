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
        if (buildings.length > 0) {
          setSelectedBuilding(buildings[0]); // Set the first building as the default selected building
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
    
    const data = {};
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

  const fetchAndCacheData = async (date, building) => {
    if (!building) return;
    
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // JavaScript months are 0-based
    const day = date.getDate();
    const dateKey = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    const encodedBuilding = encodeURIComponent(building);

    if (consumptionData[dateKey] && consumptionData[dateKey][building]) {
      return; // Data already cached
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

      // Update the consumption data with the new data
      setConsumptionData(prevData => ({
        ...prevData,
        [dateKey]: {
          ...(prevData[dateKey] || {}),
          [building]: {
            consumption: data.consumption,
            buildings: [{
              name: building,
              consumption: data.consumption,
              average: stat_data.mean,
              max: stat_data.highest,
              min: stat_data.lowest,
              median: stat_data.median
            }]
          }
        }
      }));
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  // Fetch data when month or year changes
  useEffect(() => {
    const fetchDataForMonth = async () => {
      if (!selectedBuilding) return;
      
      setIsLoading(true);
      
      try {
        const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
        
        // Create an array of promises for parallel fetching
        const fetchPromises = [];
        
        for (let day = 1; day <= daysInMonth; day++) {
          const date = new Date(selectedYear, selectedMonth - 1, day);
          fetchPromises.push(fetchAndCacheData(date, selectedBuilding));
        }
        
        // Wait for all fetches to complete
        await Promise.all(fetchPromises);
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

  // Handle date change, including month navigation
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

  // Handle month navigation via DatePicker navigation buttons
  const handleMonthChange = (date) => {
    const newMonth = date.getMonth() + 1;
    const newYear = date.getFullYear();
    
    // Set the date to the 1st of the month
    const newDate = new Date(date);
    newDate.setDate(1);
    setSelectedDate(newDate);
    
    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
  };

  // Custom day class names based on consumption
  const getDayClassName = (date) => {
    const dateKey = date.toISOString().split('T')[0];
    const dayData = consumptionData[dateKey] && consumptionData[dateKey][selectedBuilding];
    
    if (!dayData) return "calendar-day";
    
    const consumption = dayData.consumption;
    if (consumption > 10000) return "calendar-day high-consumption";
    if (consumption > 5000) return "calendar-day medium-consumption";
    return "calendar-day low-consumption";
  };

  // Custom day content
  const renderDayContents = (day, date) => {
    // Format the date to match the format used in consumptionData
    const dateKey = date.toISOString().split('T')[0];
    const dayData = consumptionData[dateKey] && consumptionData[dateKey][selectedBuilding];
    
    const consumptionValue = dayData?.consumption;
    const displayValue = displayMode === 'consumption' 
      ? `${Math.round(consumptionValue || 0)} kWh` 
      : `$${((consumptionValue || 0) * 0.12).toFixed(2)}`;

    return (
      <div className="day-content">
        <span className="day-number">{day}</span>
        {dayData && (
          <div className="day-stats">
            <span className="consumption-indicator">
              {displayValue}
            </span>
          </div>
        )}
      </div>
    );
  };

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
      <div className="calendar-container">
        <div className="calendar-legend">
          <div className="legend-item">
            <div className="legend-color low-consumption"></div>
            <span>Low (&lt;5000 kWh)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color medium-consumption"></div>
            <span>Medium (5000-10000 kWh)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color high-consumption"></div>
            <span>High (&gt;10000 kWh)</span>
          </div>
        </div>
        
        {isLoading && (
          <div className="loading-indicator">
            Loading consumption data...
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
      
      {/* Detail view for selected date */}
      {selectedDate && (
        <div className="selected-date-details">
          {selectedBuilding && (
            <div className="building-details">
              <h3>{selectedBuilding} - {selectedDate.toLocaleDateString()}</h3>
              {(() => {
                const dateKey = selectedDate.toISOString().split('T')[0];
                const dayData = consumptionData[dateKey] && consumptionData[dateKey][selectedBuilding];
                
                if (dayData) {
                  const buildingStats = dayData.buildings[0];
                  return (
                    <div>
                      <p><strong>Consumption:</strong> {Math.round(dayData.consumption)} kWh</p>
                      {buildingStats.average && (
                        <>
                          <p><strong>Monthly Average:</strong> {Math.round(buildingStats.average)} kWh</p>
                          <p><strong>Monthly Maximum:</strong> {Math.round(buildingStats.max)} kWh</p>
                          <p><strong>Monthly Minimum:</strong> {Math.round(buildingStats.min)} kWh</p>
                        </>
                      )}
                      {displayMode === 'price' && (
                        <p><strong>Estimated Cost:</strong> ${(dayData.consumption * 0.12).toFixed(2)}</p>
                      )}
                    </div>
                  );
                } else {
                  return <p>No data available for this date</p>;
                }
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Calendar;