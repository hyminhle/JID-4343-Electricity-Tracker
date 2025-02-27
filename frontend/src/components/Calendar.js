import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import './Calendar.css';

const Calendar = ({ buildingStats }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedBuilding, setSelectedBuilding] = useState('all');
  const [displayMode, setDisplayMode] = useState('consumption'); // 'consumption' or 'price'
  const [consumptionData, setConsumptionData] = useState({});
  const [showStatsBox, setShowStatsBox] = useState(false);

  // Process building stats to get consumption data for dates
  useEffect(() => {
    const data = {};
    Object.entries(buildingStats || {}).forEach(([building, stats]) => {
      if (stats.date) {
        const date = new Date(stats.date);
        const dateKey = date.toISOString().split('T')[0];
        if (!data[dateKey]) {
          data[dateKey] = {
            consumption: 0,
            buildings: []
          };
        }
        data[dateKey].consumption += parseFloat(stats.consumption || 0);
        data[dateKey].buildings.push({
          name: building,
          consumption: parseFloat(stats.consumption || 0)
        });
      }
    });
    setConsumptionData(data);
  }, [buildingStats]);

  // Custom day class names based on consumption
  const getDayClassName = (date) => {
    const dateKey = date.toISOString().split('T')[0];
    const dayData = consumptionData[dateKey];
    
    if (!dayData) return "calendar-day";
    
    const consumption = dayData.consumption;
    if (consumption > 10000) return "calendar-day high-consumption";
    if (consumption > 5000) return "calendar-day medium-consumption";
    return "calendar-day low-consumption";
  };

  // Custom day content
  const renderDayContents = (day, date) => {
    const dateKey = date.toISOString().split('T')[0];
    const dayData = consumptionData[dateKey];
    
    return (
      <div className="day-content">
        <span className="day-number">{day}</span>
        {dayData && (
          <span className="consumption-indicator">
            {Math.round(dayData.consumption)} kWh
          </span>
        )}
      </div>
    );
  };

  // Handle date selection
  const handleDateChange = (date) => {
    setSelectedDate(date);
    setShowStatsBox(true);
  };

  // Get statistics for the selected date
  const getSelectedDateStats = () => {
    const dateKey = selectedDate.toISOString().split('T')[0];
    return consumptionData[dateKey] || { consumption: 0, buildings: [] };
  };

  // Calculate price (for demo purposes)
  const calculatePrice = (consumption) => {
    // Assuming a rate of $0.12 per kWh
    return (consumption * 0.12).toFixed(2);
  };

  // Get buildings data filtered by selection
  const getFilteredBuildingsData = () => {
    const stats = getSelectedDateStats();
    if (selectedBuilding === 'all') {
      return stats.buildings;
    }
    return stats.buildings.filter(building => building.name === selectedBuilding);
  };

  // Get comparison class
  const getComparisonClass = (value) => {
    const numValue = parseFloat(value);
    if (numValue > 0) return "positive";
    if (numValue < 0) return "negative";
    return "";
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
            <option value="all">All Buildings</option>
            <option value="110">Building 110</option>
            <option value="121">Building 121</option>
            {/* Add more buildings as needed */}
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
      <div className="calendar-content">
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
          <DatePicker
            selected={selectedDate}
            onChange={handleDateChange}
            inline
            calendarClassName="custom-calendar"
            dayClassName={getDayClassName}
            renderDayContents={renderDayContents}
            showMonthYearPicker={false}
          />
        </div>
        
        {showStatsBox && (
          <div className="stats-box">
            <div className="stats-header">
              <h2>Statistics for {selectedDate.toLocaleDateString()}</h2>
              <button className="close-button" onClick={() => setShowStatsBox(false)}>×</button>
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
                            width: `${Math.min(100, (building.consumption / 10000) * 100)}%`,
                            backgroundColor: building.consumption > 5000 
                              ? (building.consumption > 10000 ? 'rgba(231, 76, 60, 0.8)' : 'rgba(241, 196, 15, 0.8)') 
                              : 'rgba(46, 204, 113, 0.8)'
                          }}
                        ></div>
                      </div>
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
                    <span className={`comparison-value ${getComparisonClass('+5%')}`}>+5%</span>
                  </div>
                  <div className="comparison-item">
                    <span className="comparison-label">Compared to Weekly Average:</span>
                    <span className={`comparison-value ${getComparisonClass('-3%')}`}>-3%</span>
                  </div>
                  <div className="comparison-item">
                    <span className="comparison-label">Compared to Monthly Average:</span>
                    <span className={`comparison-value ${getComparisonClass('+12%')}`}>+12%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Calendar;