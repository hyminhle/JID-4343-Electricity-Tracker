import React, { useState, useEffect } from 'react';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Polygon, Tooltip, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import './Map.css';

// Fix for default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png'
});

const MapComponent = () => {
  const [buildings, setBuildings] = useState({});
  const [availableBuildings, setAvailableBuildings] = useState([]);
  const [availableData, setAvailableData] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [stats, setStats] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState(null);
  const [buildingStats, setBuildingStats] = useState({});
  const [minDate, setMinDate] = useState(null);
  const [maxDate, setMaxDate] = useState(null);

  useEffect(() => {
    const fetchAvailableData = async () => {
      try {
        const response = await fetch('http://127.0.0.1:5000/get-available-data');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        // Find min and max dates from available data
        let minYear = '9999', maxYear = '0';
        let minMonth = '12', maxMonth = '1';
        
        Object.entries(data).forEach(([building, years]) => {
          Object.keys(years).forEach(year => {
            if (year < minYear) minYear = year;
            if (year > maxYear) maxYear = year;
            
            Object.keys(years[year]).forEach(month => {
              if (year === minYear && month < minMonth) minMonth = month;
              if (year === maxYear && month > maxMonth) maxMonth = month;
            });
          });
        });
        
        setMinDate(new Date(minYear, parseInt(minMonth) - 1, 1));
        setMaxDate(new Date(maxYear, parseInt(maxMonth) - 1, 31));
        setSelectedDate(new Date(minYear, parseInt(minMonth) - 1, 1));
        
        setAvailableData(data);
      } catch (error) {
        console.error('Error fetching available data:', error);
        setError('Failed to fetch available data');
        setAvailableData({});
      }
    };
  
    fetchAvailableData();
  }, []);
  

  const addBuilding = async () => {
    console.log('Starting addBuilding function...');
    if (selectedBuilding) {
      try {
        // Predefined building locations - much wider spread
        const buildingLocations = {
            'Building 110': [29.628014, -95.610553],
            'Building 121': [29.629014, -95.611553],
            'Building A':   [29.629514, -95.609553],
            'Building B':   [29.626514, -95.611953],
            'Building C':   [29.627014, -95.608953],
            'Building D':   [29.629014, -95.612553],
            'Building E':   [29.628514, -95.608753],
            'Building F':   [29.626514, -95.609953],
            'Building G':   [29.629514, -95.610353],
            'Building H':   [29.628514, -95.612953],
            'Building I':   [29.627014, -95.611753],
            'Building J':   [29.629514, -95.608553]
          };
    
          // All building sizes increased by 1.5x
          const buildingSizes = {
            'Building 110': 0.00052,   // Was 0.00035
            'Building 121': 0.00045,   // Was 0.00030
            'Building A':   0.00022,   // Was 0.00015
            'Building B':   0.00037,   // Was 0.00025
            'Building C':   0.00015,   // Was 0.00010
            'Building D':   0.00048,   // Was 0.00032
            'Building E':   0.00027,   // Was 0.00018
            'Building F':   0.00033,   // Was 0.00022
            'Building G':   0.00018,   // Was 0.00012
            'Building H':   0.00042,   // Was 0.00028
            'Building I':   0.00030,   // Was 0.00020
            'Building J':   0.00024    // Was 0.00016
          };
    
          // Keep the same consumption-based colors
          const buildingColors = {
            'Building 110': '#ff3300', // High consumption - More red
            'Building 121': '#ff6600', // High-medium consumption
            'Building A':   '#ff9900', // Medium-high consumption
            'Building B':   '#ffcc00', // Medium consumption
            'Building C':   '#cccc00', // Medium consumption
            'Building D':   '#99cc00', // Medium-low consumption
            'Building E':   '#66cc00', // Low-medium consumption
            'Building F':   '#33cc00', // Low consumption
            'Building G':   '#00cc00', // Very low consumption
            'Building H':   '#ff8000', // High-medium consumption
            'Building I':   '#99ff00', // Low consumption
            'Building J':   '#66ff00'  // Very low consumption
          };

        // For Buildings A-J, we'll skip the data fetching and just place them on the map
        if (!selectedBuilding.includes('Building 1')) {
          const baseCoordinates = buildingLocations[selectedBuilding];
          const buildingSize = buildingSizes[selectedBuilding];
          
          const newBuilding = {
            name: selectedBuilding,
            coordinates: [
              [baseCoordinates[0], baseCoordinates[1]],
              [baseCoordinates[0], baseCoordinates[1] + buildingSize],
              [baseCoordinates[0] + buildingSize, baseCoordinates[1] + buildingSize],
              [baseCoordinates[0] + buildingSize, baseCoordinates[1]]
            ],
            color: buildingColors[selectedBuilding],
            data: [] // Empty data array for now
          };

          setBuildings(prev => ({
            ...prev,
            [selectedBuilding]: newBuilding
          }));
          return;
        }

        // Original data fetching logic for Buildings 110 and 121
        const buildingData = [];
        const buildingInfo = availableData[selectedBuilding];
        console.log('Building info:', buildingInfo);
        const availableYears = Object.keys(buildingInfo);
        console.log('Years info:', availableYears);
        
        for (const year of availableYears) {
          const availableMonths = Object.keys(buildingInfo[year]);
          for (const month of availableMonths) {
            const url = `http://127.0.0.1:5000/fetch-data/${year}/${month}/0/${selectedBuilding}`;
            console.log('Fetching from URL:', url);
            try {
              const response = await axios.get(url);
              buildingData.push(...response.data);
            } catch (error) {
              console.error('Failed to fetch data:', error);
              throw error;
            }
          }
        }

        const baseCoordinates = buildingLocations[selectedBuilding];
        const buildingSize = buildingSizes[selectedBuilding];
        
        const newBuilding = {
          name: selectedBuilding,
          coordinates: [
            [baseCoordinates[0], baseCoordinates[1]],
            [baseCoordinates[0], baseCoordinates[1] + buildingSize],
            [baseCoordinates[0] + buildingSize, baseCoordinates[1] + buildingSize],
            [baseCoordinates[0] + buildingSize, baseCoordinates[1]]
          ],
          color: buildingColors[selectedBuilding],
          data: buildingData
        };

        setBuildings(prev => ({
          ...prev,
          [selectedBuilding]: newBuilding
        }));

        // After adding the building, fetch its stats
        await fetchBuildingStats(selectedBuilding, selectedDate);
      } catch (error) {
        console.error('Error in addBuilding:', error);
      }
    }
  };

  // Modify getHeatmapColor to use actual consumption data ranges
  const getHeatmapColor = (consumption) => {
    if (!consumption) return '#cccccc'; // Default gray for no data
    
    // Using the ranges we see in LineGraph data (8000-12000 kWh)
    const low = 8500;     // Green zone
    const medium = 10000; // Yellow zone
    const high = 11500;   // Red zone
    
    if (consumption <= low) {
      // Green to Yellow gradient
      const ratio = consumption / low;
      return `rgb(${Math.floor(255 * ratio)}, 255, 0)`;
    } else if (consumption <= medium) {
      // Yellow to Red gradient
      const ratio = (consumption - low) / (medium - low);
      return `rgb(255, ${Math.floor(255 * (1 - ratio))}, 0)`;
    } else {
      // Deep red for high consumption
      return '#ff0000';
    }
  };

  // Add function to fetch and calculate building statistics
  const fetchBuildingStats = async (buildingName, date) => {
    try {
      // First check if we have data for this building and date
      if (!availableData[buildingName]) {
        console.log('No data available for building:', buildingName);
        return;
      }

      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();  // Get the actual selected day

      // Check if we have data for this year and month
      const buildingInfo = availableData[buildingName];
      console.log('Available data for building:', buildingInfo);

      // Get available years
      const availableYears = Object.keys(buildingInfo);
      if (!availableYears.includes(year.toString())) {
        console.log('No data for year:', year);
        setError(`No data available for ${year}`);
        return;
      }

      // Get available months for this year
      const availableMonths = Object.keys(buildingInfo[year.toString()]);
      if (!availableMonths.includes(month.toString())) {
        console.log('No data for month:', month);
        setError(`No data available for month ${month}`);
        return;
      }

      const API_URL = `http://127.0.0.1:5000/fetch-data/${year}/${month}/${day}/${buildingName}`;
      console.log('Fetching from URL:', API_URL);

      const response = await fetch(API_URL);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Received data:', data);

      // Update stats with the processed data
      setStats({
        consumption: data.consumption,
        month: `${month}/${year}`,
        day: day
      });
      
      // Update building colors based on consumption
      if (buildings[buildingName]) {
        setBuildings(prev => ({
          ...prev,
          [buildingName]: {
            ...prev[buildingName],
            color: getHeatmapColor(parseFloat(data.consumption))
          }
        }));
      }
    } catch (error) {
      console.error('Error fetching building stats:', error);
      setError('Failed to fetch building statistics');
      setStats(null);
    }
  };

  // Update the DatePicker onChange handler
  const handleDateChange = (date) => {
    setSelectedDate(date);
    if (selectedBuilding) {
      fetchBuildingStats(selectedBuilding, date);
    }
  };

  const deleteBuilding = (buildingName) => {  
    const updatedBuildings = { ...buildings };
    delete updatedBuildings[buildingName];
    setBuildings(updatedBuildings);
  };

  const handleBuildingClick = (buildingName) => {
    setSelectedBuilding(buildingName);
    fetchBuildingStats(buildingName, selectedDate);
  };

  const handleDragEnd = (buildingName, newLatLng) => {
    setBuildings((prevBuildings) => {
      const prevCoords = prevBuildings[buildingName].coordinates;
      if (!prevCoords || prevCoords.length === 0) return prevBuildings;

      const deltaLat = newLatLng.lat - prevCoords[0][0];
      const deltaLng = newLatLng.lng - prevCoords[0][1];

      const updatedCoords = prevCoords.map(([lat, lng]) => [lat + deltaLat, lng + deltaLng]);

      return {
        ...prevBuildings,
        [buildingName]: {
          ...prevBuildings[buildingName],
          coordinates: updatedCoords
        }
      };
    });
  };

  // Add this function to check if a date has data available
  const isDateAvailable = (date) => {
    if (!selectedBuilding || !availableData[selectedBuilding]) return false;
    
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString();
    
    return availableData[selectedBuilding][year] && 
           availableData[selectedBuilding][year][month];
  };

  return (
    <div className="map-container">
      <div className="map-section">
        <div className="map-wrapper">
          <MapContainer 
            center={[29.628014, -95.610553]}
            zoom={16}
            className="leaflet-container"
            scrollWheelZoom={true}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            
            {Object.values(buildings).map((building) => (
              <Polygon
                key={building.name}
                positions={building.coordinates}
                pathOptions={{ 
                  color: selectedBuilding === building.name ? '#000' : building.color,
                  fillColor: buildingStats[building.name]?.average 
                    ? getHeatmapColor(parseFloat(buildingStats[building.name].average))
                    : building.color,
                  fillOpacity: isEditing ? 0.8 : 0.6,
                  weight: 2,
                  opacity: 1
                }}
                draggable={isEditing}
                eventHandlers={{
                  dragend: (e) => {
                    const { lat, lng } = e.target.getLatLngs()[0][0];
                    handleDragEnd(building.name, { lat, lng });
                  },
                  click: () => {
                    if (!isEditing) {
                      handleBuildingClick(building.name);
                    }
                  }
                }}
              >
                <Tooltip>
                  {building.name}
                  {buildingStats[building.name] && 
                    ` - ${buildingStats[building.name].average} kWh`}
                  {!isEditing && " (Click for stats)"}
                </Tooltip>
              </Polygon>
            ))}

            {isEditing && Object.values(buildings).map((building) => (
              <Marker
                key={`marker-${building.name}`}
                position={building.coordinates[0]}
                draggable={true}
                eventHandlers={{
                  dragend: (e) => {
                    const { lat, lng } = e.target.getLatLng();
                    handleDragEnd(building.name, { lat, lng });
                  }
                }}
              >
                <Popup>Drag to move building</Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>

      <div className="controls-section">
        <div className="controls-container">
          <h3 className="controls-header">Building Controls</h3>
          <select 
            className="building-select"
            value={selectedBuilding || ''}
            onChange={(e) => setSelectedBuilding(e.target.value)}
          >
            <option value="">Select a building</option>
            {Object.keys(availableData).map(building => (
              <option key={building} value={building}>{building}</option>
            ))}
          </select>
          
          <button 
            className="control-button add-button"
            onClick={addBuilding}
          >
            Add Building
          </button>

          <button 
            className={`control-button edit-button ${isEditing ? 'active' : ''}`}
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? "Exit Edit Mode" : "Edit Buildings"}
          </button>

          {selectedBuilding && buildings[selectedBuilding] && (
            <div className="stats-box">
              <div className="stats-header">
                <h4 className="building-name">{selectedBuilding}</h4>
                <button
                  onClick={() => setSelectedBuilding(null)}
                  className="close-button"
                >
                  ✕
                </button>
              </div>
              
              <div className="date-container">
                <div className="date-label">Select Date</div>
                <DatePicker
                  selected={selectedDate}
                  onChange={handleDateChange}
                  dateFormat="yyyy/MM/dd"
                  minDate={minDate}
                  maxDate={maxDate}
                  filterDate={isDateAvailable}
                  customInput={
                    <input className="date-picker" />
                  }
                />
              </div>

              <div className="stats-container">
                {stats ? (
                  <div>
                    <div className="stat-item">
                      <span className="stat-label">Consumption</span>
                      <span className={`consumption-value ${stats.consumption > 1000 ? 'bad' : 'good'}`}>
                        {stats.consumption} kWh
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Estimated Cost</span>
                      <span className="stat-value">
                        ${(stats.consumption * 0.1).toFixed(2)}
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Month</span>
                      <span className="stat-value">{stats.month}</span>
                    </div>
                  </div>
                ) : (
                  <div className="no-stats">
                    Select a date to view statistics
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Map = () => {
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) return null;

  return <MapComponent />;
};

export default Map;