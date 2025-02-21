import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import './Calendar.css';

const Calendar = ({ buildingStats }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedBuilding, setSelectedBuilding] = useState('all');
  const [displayMode, setDisplayMode] = useState('consumption'); // 'consumption' or 'price'
  const [consumptionData, setConsumptionData] = useState({});

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
          onChange={date => setSelectedDate(date)}
          inline
          calendarClassName="custom-calendar"
          dayClassName={getDayClassName}
          renderDayContents={renderDayContents}
          showMonthYearPicker={false}
        />
      </div>
    </div>
  );
};

export default Calendar; 