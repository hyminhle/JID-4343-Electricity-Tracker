import React, { useState, useEffect } from 'react';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Polygon, Tooltip, Marker } from 'react-leaflet';
import L from 'leaflet';
import './MapWidget.css';

// Fix for default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png'
});

const MapWidget = () => {
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

  const [buildings, setBuildings] = useState({});
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [selectedDay, setSelectedDay] = useState(initialDate.getDate());
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [buildingStats, setBuildingStats] = useState({});
  const [showBuildingNames, setShowBuildingNames] = useState(true);
  const [error, setError] = useState(null);

  // Function to format date as MM/DD/YYYY
  const formatDate = (date) => {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  // Function to get color based on consumption value
  const getHeatmapColor = (consumption, average) => {
    if (!consumption) return '#cccccc'; // Default gray for no data
  
    // Adjust the ranges based on the average consumption
    const low = average;       // Green zone
    const high = average * 1.000005;    // Red zone
  
    if (consumption <= low) {
      // Green to Yellow gradient
      const ratio = consumption / low;
      return `rgb(${Math.floor(255 * ratio)}, 255, 0)`;
    } else {
      // Yellow to Red gradient
      const ratio = (consumption - low) / (high - low);
      return `rgb(255, ${Math.floor(255 * (1 - ratio))}, 0)`;
    }
  };

  // Fetch building data from API
  const fetchBuildings = async () => {
    try {
      const response = await fetch('http://127.0.0.1:5000/get-available-data');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      const buildingLocations = {
        'Building 110': [29.628014, -95.610553],
        'Building 121': [29.629014, -95.611553],
        'Building 200': [29.629514, -95.609553],
        'Building 210': [29.626514, -95.611953],
        'Building 300': [29.627014, -95.608953],
        'Building 525': [29.629014, -95.612553],
        'Building 545': [29.628514, -95.608753],
        'Building 555': [29.626514, -95.609953],
        'Building 125': [29.629514, -95.610353],
        'Building 145': [29.628514, -95.612953],
        'Building 150': [29.627014, -95.611753],
        'Building 155': [29.629514, -95.608553],
        'Building 170': [29.630124, -95.608653],
        'Building 180': [29.627124, -95.608253]
      };

      const buildingSizes = {
        'Building 110': 0.00048,
        'Building 121': 0.00048,
        'Building 200': 0.00048,
        'Building 210': 0.00048,
        'Building 300': 0.00048,
        'Building 525': 0.00048,
        'Building 545': 0.00048,
        'Building 555': 0.00048,
        'Building 125': 0.00048,
        'Building 145': 0.00048,
        'Building 150': 0.00048,
        'Building 155': 0.00048,
        'Building 170': 0.00048,    
        'Building 180': 0.00048    
      };

      const newBuildings = {};
      for (const [buildingName, coordinates] of Object.entries(buildingLocations)) {
        const buildingSize = buildingSizes[buildingName];
        newBuildings[buildingName] = {
          name: buildingName,
          coordinates: [
            [coordinates[0], coordinates[1]],
            [coordinates[0], coordinates[1] + buildingSize],
            [coordinates[0] + buildingSize, coordinates[1] + buildingSize],
            [coordinates[0] + buildingSize, coordinates[1]]
          ],
          color: '#cccccc', // Default color
          data: {} // Empty data object for stats
        };
      }
      setBuildings(newBuildings);
      
      // Fetch stats for all buildings with the initial date
      fetchAllBuildingStats(newBuildings, initialDate);
    } catch (error) {
      console.error('Error fetching buildings:', error);
      setError('Failed to fetch buildings');
    }
  };

  // Fetch stats for all buildings
  const fetchAllBuildingStats = async (buildingList, date) => {
    try {
      // Save date to localStorage
      localStorage.setItem('selectedDate', date.toString());
      
      const buildingNames = Object.keys(buildingList || buildings);
      const statsPromises = buildingNames.map(buildingName => 
        fetchBuildingStats(buildingName, date)
      );
      
      await Promise.all(statsPromises);
    } catch (error) {
      console.error('Error fetching all building stats:', error);
      setError('Failed to fetch all building statistics');
    }
  };

  // Fetch building stats from API
  const fetchBuildingStats = async (buildingName, date) => {
    try {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const API_URL = `http://127.0.0.1:5000/fetch-data/${year}/${month}/${day}/${buildingName}`;
      const response = await fetch(API_URL);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      const API_URL2 = `http://127.0.0.1:5000/stats/${year}/${month}/${day}/${buildingName}`;
      const response2 = await fetch(API_URL2);
      if (!response2.ok) {
        throw new Error(`HTTP error! status: ${response2.status}`);
      }
      const stat_data = await response2.json();

      const statsData = {
        consumption: data.consumption,
        average: stat_data.mean,
        max: stat_data.highest,
        min: stat_data.lowest,
        median: stat_data.median,
        color: getHeatmapColor(parseFloat(data.consumption), parseFloat(stat_data.mean))
      };

      setBuildingStats(prev => ({
        ...prev,
        [buildingName]: statsData
      }));
    } catch (error) {
      console.error(`Error fetching stats for ${buildingName}:`, error);
      // Don't set global error to prevent error messages for individual building failures
    }
  };

  useEffect(() => {
    fetchBuildings();
  }, []);

  const handleBuildingClick = (buildingName) => {
    setSelectedBuilding(buildingName);
  };

  const handleDayChange = (event) => {
    const day = parseInt(event.target.value);
    setSelectedDay(day);
    const newDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
    setSelectedDate(newDate);
    
    // Fetch stats for all buildings when date changes
    fetchAllBuildingStats(buildings, newDate);
  };

  return (
    <div className="map-widget">
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
                fillColor: buildingStats[building.name] 
                  ? getHeatmapColor(
                      buildingStats[building.name].consumption, 
                      buildingStats[building.name].average
                    )
                  : building.color,
                fillOpacity: 0.6,
                weight: 2,
                opacity: 1
              }}
              eventHandlers={{
                click: () => handleBuildingClick(building.name)
              }}
            >
              <Tooltip>
                {building.name}
                {buildingStats[building.name] && 
                  ` - ${buildingStats[building.name].consumption.toFixed(1)} kWh`}
              </Tooltip>
            </Polygon>
          ))}

          {showBuildingNames && Object.values(buildings).map((building) => {
            const buildingNumber = building.name.split(' ')[1]; // Extract the number from the building name
            const centerLat = (building.coordinates[0][0] + building.coordinates[2][0]) / 2;
            const centerLng = (building.coordinates[0][1] + building.coordinates[2][1]) / 2;

            return (
              <Marker
                key={`label-${building.name}`}
                position={[centerLat, centerLng]}
                icon={L.divIcon({
                  className: 'building-label',
                  html: `<div>${buildingNumber}</div>`,
                  iconSize: [40, 40],
                  iconAnchor: [20, 20]
                })}
                interactive={false}
              />
            );
          })}
        </MapContainer>
      </div>

      <div className="widget-controls">
        <div className="slider-container">
          <label>Date: {formatDate(selectedDate)}</label>
          <input
            type="range"
            min="1"
            max={new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate()} 
            value={selectedDay}
            onChange={handleDayChange}
            className="slider"
          />
        </div>

        {selectedBuilding && (
          <div className="building-info">
            <h4>{selectedBuilding}</h4>
            {buildingStats[selectedBuilding] && (
              <div className="energy-consumption">
                <span>{buildingStats[selectedBuilding].consumption.toFixed(1)} kWh</span>
                <div 
                  className="color-indicator" 
                  style={{
                    backgroundColor: getHeatmapColor(
                      buildingStats[selectedBuilding].consumption,
                      buildingStats[selectedBuilding].average
                    )
                  }}
                ></div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MapWidget;