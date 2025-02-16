import React, { useState, useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Polygon, Tooltip, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import axios from 'axios';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import './Map.css';
import HeatmapLayer from './HeatmapLayer';

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
  const [isHeatmap, setIsHeatmap] = useState(false);
  const [heatmapPoints, setHeatmapPoints] = useState([]);
  const [selectedDay, setSelectedDay] = useState(1);


  // Add MapTiler key from environment variable
  const MAPTILER_KEY = process.env.REACT_APP_MAPTILER_KEY;

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
        const buildingLocations = {
          'Building 110': [29.628014, -95.610553],
          'Building 121': [29.629014, -95.611553],
          'Building 200':   [29.629514, -95.609553],
          'Building 210':   [29.626514, -95.611953],
          'Building 300':   [29.627014, -95.608953],
          'Building 525':   [29.629014, -95.612553],
          'Building 545':   [29.628514, -95.608753],
          'Building 555':   [29.626514, -95.609953],
          'Building 125':   [29.629514, -95.610353],
          'Building 145':   [29.628514, -95.612953],
          'Building 150':   [29.627014, -95.611753],
          'Building 155':   [29.629514, -95.608553],
          'Building 170':   [29.630124, -95.608653],
          'Building 180':   [29.627124, -95.608653]
        };

        // All building sizes increased by 1.5x
        const buildingSizes = {
          'Building 110': 0.00052,   // Was 0.00035
          'Building 121': 0.00045,   // Was 0.00030
          'Building 200':   0.00022,   // Was 0.00015
          'Building 210':   0.00037,   // Was 0.00025
          'Building 300':   0.00015,   // Was 0.00010
          'Building 525':   0.00048,   // Was 0.00032
          'Building 545':   0.00027,   // Was 0.00018
          'Building 555':   0.00033,   // Was 0.00022
          'Building 125':   0.00018,   // Was 0.00012
          'Building 145':   0.00042,   // Was 0.00028
          'Building 150':   0.00030,   // Was 0.00020
          'Building 155':   0.00024,    // Was 0.00016
          'Building 170':   0.00034,    // Was 0.00016
          'Building 180':   0.00034    // Was 0.00016
        };

        // Keep the same consumption-based colors
        const buildingColors = {
          'Building 110': '#ff3300', // High consumption - More red
          'Building 121': '#ff6600', // High-medium consumption
          'Building 200':   '#ff9900', // Medium-high consumption
          'Building 210':   '#ffcc00', // Medium consumption
          'Building 300':   '#cccc00', // Medium consumption
          'Building 525':   '#99cc00', // Medium-low consumption
          'Building 545':   '#66cc00', // Low-medium consumption
          'Building 555':   '#33cc00', // Low consumption
          'Building 125':   '#00cc00', // Very low consumption
          'Building 145':   '#ff8000', // High-medium consumption
          'Building 150':   '#99ff00', // Low consumption
          'Building 155':   '#66ff00',  // Very low consumption
          'Building 170':   '#66ff00',
          'Building 180':   '#66ff00'
        };


        // Add all buildings to the map
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
            color: buildingColors[buildingName],
            data: [] // Empty data array for now
          };
        }
        setBuildings(newBuildings);
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
          'Building 200':   [29.629514, -95.609553],
          'Building 210':   [29.626514, -95.611953],
          'Building 300':   [29.627014, -95.608953],
          'Building 525':   [29.629014, -95.612553],
          'Building 545':   [29.628514, -95.608753],
          'Building 555':   [29.626514, -95.609953],
          'Building 125':   [29.629514, -95.610353],
          'Building 145':   [29.628514, -95.612953],
          'Building 150':   [29.627014, -95.611753],
          'Building 155':   [29.629514, -95.608553],
          'Building 170':   [29.630124, -95.608653],
          'Building 180':   [29.627124, -95.608653]
        };

        // All building sizes increased by 1.5x
        const buildingSizes = {
          'Building 110': 0.00052,   // Was 0.00035
          'Building 121': 0.00045,   // Was 0.00030
          'Building 200':   0.00022,   // Was 0.00015
          'Building 210':   0.00037,   // Was 0.00025
          'Building 300':   0.00015,   // Was 0.00010
          'Building 525':   0.00048,   // Was 0.00032
          'Building 545':   0.00027,   // Was 0.00018
          'Building 555':   0.00033,   // Was 0.00022
          'Building 125':   0.00018,   // Was 0.00012
          'Building 145':   0.00042,   // Was 0.00028
          'Building 150':   0.00030,   // Was 0.00020
          'Building 155':   0.00024,    // Was 0.00016
          'Building 170':   0.00034,    // Was 0.00016
          'Building 180':   0.00034    // Was 0.00016
        };

        // Keep the same consumption-based colors
        const buildingColors = {
          'Building 110': '#ff3300', // High consumption - More red
          'Building 121': '#ff6600', // High-medium consumption
          'Building 200':   '#ff9900', // Medium-high consumption
          'Building 210':   '#ffcc00', // Medium consumption
          'Building 300':   '#cccc00', // Medium consumption
          'Building 525':   '#99cc00', // Medium-low consumption
          'Building 545':   '#66cc00', // Low-medium consumption
          'Building 555':   '#33cc00', // Low consumption
          'Building 125':   '#00cc00', // Very low consumption
          'Building 145':   '#ff8000', // High-medium consumption
          'Building 150':   '#99ff00', // Low consumption
          'Building 155':   '#66ff00',  // Very low consumption
          'Building 170':   '#66ff00',
          'Building 180':   '#66ff00'
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

  const getHeatmapColor = (consumption, average) => {
    if (!consumption) return '#cccccc'; // Default gray for no data
  
    // Adjust the ranges based on the average consumption
    const low = average * 0.85;     // Green zone
    const medium = average;         // Yellow zone
    const high = average * 1.15;    // Red zone
  
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
  
  // Update the fetchBuildingStats function to use the new getHeatmapColor function
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
  
      const API_URL2 = `http://127.0.0.1:5000/stats/${year}/${month}/${buildingName}`;
      console.log('Fetching from URL:', API_URL2);
  
      const response2 = await fetch(API_URL2);
      if (!response2.ok) {
        throw new Error(`HTTP error! status: ${response2.status}`);
      }
      
      const stat_data = await response2.json();
      console.log('Received data:', stat_data);
  
      // Update stats with the processed data
      setStats({
        consumption: data.consumption,
        month: `${month}/${year}`,
        day: day,
        average: stat_data.mean,
        max: stat_data.highest,
        min: stat_data.lowest,
        median: stat_data.median
      });
      
      // Update building colors based on consumption and average
      if (buildings[buildingName]) {
        setBuildings(prev => ({
          ...prev,
          [buildingName]: {
            ...prev[buildingName],
            color: getHeatmapColor(parseFloat(data.consumption), parseFloat(stat_data.mean))
          }
        }));
      }
  
      setBuildingStats(prev => ({
        ...prev,
        [buildingName]: {
          ...prev[buildingName],
          consumption: data.consumption,
          average: stat_data.mean
        }
      }));
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

  const handleDayChange = (event) => {
    const day = parseInt(event.target.value);
    setSelectedDay(day);
    const newDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
    setSelectedDate(newDate);
    if (selectedBuilding) {
      fetchBuildingStats(selectedBuilding, newDate);
      updateAllBuildings(newDate);
    }
  };
  
  const updateAllBuildings = async (newDate) => {
    try {
      const updatedBuildings = { ...buildings };
  
      for (const buildingName of Object.keys(updatedBuildings)) {
        // First check if data is available for the building
        if (!availableData[buildingName]) {
          console.log('No data available for building:', buildingName);
          continue;
        }
  
        const year = newDate.getFullYear();
        const month = newDate.getMonth() + 1; // JavaScript months are 0-based
        const day = newDate.getDate();
  
        const buildingInfo = availableData[buildingName];
        console.log(`Available data for ${buildingName}:`, buildingInfo);
  
        // Validate year availability
        const availableYears = Object.keys(buildingInfo);
        if (!availableYears.includes(year.toString())) {
          console.log(`No data for year ${year} in ${buildingName}`);
          continue;
        }
  
        // Validate month availability
        const availableMonths = Object.keys(buildingInfo[year.toString()]);
        if (!availableMonths.includes(month.toString())) {
          console.log(`No data for month ${month} in ${buildingName}`);
          continue;
        }
  
        const API_URL = `http://127.0.0.1:5000/fetch-data/${year}/${month}/${day}/${buildingName}`;
        console.log(`Fetching stats for ${buildingName} from ${API_URL}`);
  
        const response = await fetch(API_URL);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
  
        const data = await response.json();
        console.log(`Received data for ${buildingName}:`, data);
  
        const API_URL2 = `http://127.0.0.1:5000/stats/${year}/${month}/${buildingName}`;
        console.log(`Fetching stats for ${buildingName} from ${API_URL2}`);
  
        const response2 = await fetch(API_URL2);
        if (!response2.ok) {
          throw new Error(`HTTP error! status: ${response2.status}`);
        }
  
        const stat_data = await response2.json();
        console.log(`Received stats for ${buildingName}:`, stat_data);
  
        // Update building stats and colors
        updatedBuildings[buildingName] = {
          ...updatedBuildings[buildingName],
          stats: {
            consumption: data.consumption,
            month: `${month}/${year}`,
            day: day,
            average: stat_data.mean,
          },
          color: getHeatmapColor(parseFloat(data.consumption), parseFloat(stat_data.mean)), // Dynamically update color
        };
      }
  
      // Update the state with new building data
      setBuildings(updatedBuildings);
    } catch (error) {
      console.error('Error updating all buildings:', error);
      setError('Failed to update all buildings');
    }
  };
  
  

  // Add this function to check if a date has data available
  const isDateAvailable = (date) => {
    if (!selectedBuilding || !availableData[selectedBuilding]) return false;
    
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString();
    
    return availableData[selectedBuilding][year] && 
           availableData[selectedBuilding][year][month];
  };

  // Add function to toggle between point and heatmap view
  const toggleHeatmap = () => {
    setIsHeatmap(!isHeatmap);
  };

  // Update generateHeatmapData function
  const generateHeatmapData = () => {
    const points = [];
    
    // First find the max consumption to normalize properly
    let maxConsumption = 0;
    Object.entries(buildingStats).forEach(([name, stats]) => {
      if (stats && stats.consumption) {
        maxConsumption = Math.max(maxConsumption, parseFloat(stats.consumption));
      }
    });

    console.log('Max consumption:', maxConsumption);

    Object.entries(buildings).forEach(([name, building]) => {
      if (building.coordinates && 
          Array.isArray(building.coordinates) && 
          building.coordinates.length > 0 && 
          Array.isArray(building.coordinates[0]) && 
          building.coordinates[0].length >= 2) {
        
        // Get consumption from buildingStats
        const consumption = buildingStats[name]?.consumption 
          ? parseFloat(buildingStats[name].consumption) 
          : 0;
        
        // Only process if we have valid consumption data
        if (consumption > 0 && maxConsumption > 0) {
          const intensity = consumption / maxConsumption;
          
          // Get center point of the building
          const lat = parseFloat(building.coordinates[0][0]);
          const lng = parseFloat(building.coordinates[0][1]);
          
          // Validate coordinates
          if (!isNaN(lat) && !isNaN(lng) && 
              lat >= -90 && lat <= 90 && 
              lng >= -180 && lng <= 180) {
            
            console.log(`Building ${name}: lat=${lat}, lng=${lng}, consumption=${consumption}, intensity=${intensity}`);
            
            // Add center point
            points.push([lat, lng, intensity]);
            
            // Add spread points if intensity is valid
            if (!isNaN(intensity) && intensity > 0) {
              const spread = Math.min(intensity * 0.0002, 0.001);
              points.push([lat + spread, lng + spread, intensity * 0.8]);
              points.push([lat - spread, lng - spread, intensity * 0.8]);
              points.push([lat + spread, lng - spread, intensity * 0.8]);
              points.push([lat - spread, lng + spread, intensity * 0.8]);
            }
          } else {
            console.warn(`Invalid coordinates for building ${name}: lat=${lat}, lng=${lng}`);
          }
        } else {
          console.warn(`No consumption data for building ${name}`);
        }
      }
    });

    console.log('Generated heatmap points:', points);
    setHeatmapPoints(points);
  };

  // Update heatmap when buildingStats changes
  useEffect(() => {
    if (isHeatmap) {
      generateHeatmapData();
    }
  }, [buildingStats, isHeatmap]);

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
            <div className="map-controls">
              <button 
                className="control-button toggle-view"
                onClick={toggleHeatmap}
                style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  zIndex: 1000,
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {isHeatmap ? 'Show Points' : 'Show Heatmap'}
              </button>
            </div>
            
            {isHeatmap ? (
              <HeatmapLayer points={heatmapPoints} />
            ) : (
              <>
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
                        ? getHeatmapColor(parseFloat(buildingStats[building.name].consumption), parseFloat(buildingStats[building.name].average))
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
              </>
            )}
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
              <div className="slider-container">
                <label>Day: {selectedDay}</label>
                <input
                  type="range"
                  min="1"
                  max={new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate()} 
                  value={selectedDay}
                  onChange={handleDayChange}
                  className="slider"
                />
              </div>

              <div className="stats-container">
                {stats ? (
                  <div>
                    <div className="stat-item">
                      <span className="stat-label">Consumption</span>
                      <span className={`consumption-value ${stats.consumption > stats.average ? 'bad' : 'good'}`}>
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
                      <span className="stat-label">Month/Year</span>
                      <span className="stat-value">{stats.month}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Average</span>
                      <span className="stat-value">
                        {(stats.average)}
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Max</span>
                      <span className="stat-value">
                        {(stats.max)}
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Min</span>
                      <span className="stat-value">
                        {(stats.min)}
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Median</span>
                      <span className="stat-value">
                        {(stats.median)}
                      </span>
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