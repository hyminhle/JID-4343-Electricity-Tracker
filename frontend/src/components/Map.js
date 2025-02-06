import React, { useState, useEffect } from 'react';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Polygon, Tooltip, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

// Fix for default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png'
});

// Add this CSS at the top of your file or in your CSS file
const statsBoxStyles = {
  container: {
    backgroundColor: '#ffffff',
    borderRadius: '10px',
    padding: '20px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    marginTop: '20px',
    border: '1px solid #e0e0e0'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '15px',
    padding: '10px 0',
    borderBottom: '2px solid #f0f0f0'
  },
  buildingName: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: '#2c3e50',
    margin: '0'
  },
  dateContainer: {
    marginBottom: '15px'
  },
  dateLabel: {
    fontSize: '0.9rem',
    color: '#666',
    marginBottom: '5px'
  },
  datePicker: {
    width: '100%',
    padding: '8px',
    border: '1px solid #ddd',
    borderRadius: '5px',
    fontSize: '1rem'
  },
  statsContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
    padding: '15px',
    marginTop: '10px'
  },
  statItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
    borderBottom: '1px solid #eee'
  },
  statLabel: {
    color: '#666',
    fontSize: '0.9rem'
  },
  statValue: {
    color: '#2c3e50',
    fontSize: '1.1rem',
    fontWeight: '500'
  },
  consumptionValue: {
    fontSize: '1.2rem',
    fontWeight: 'bold',
    color: '#2ecc71'  // Green for good, can be dynamic based on value
  },
  noStats: {
    textAlign: 'center',
    color: '#666',
    padding: '20px 0'
  }
};

const MapComponent = () => {
  const [buildings, setBuildings] = useState({});
  const [availableBuildings, setAvailableBuildings] = useState([]);
  const [availableData, setAvailableData] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [stats, setStats] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAvailableData = async () => {
      try {
        const response = await fetch('http://127.0.0.1:5000/get-available-data');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        // Add Buildings A-J to the available buildings
        const extendedData = {
          ...data,
          'Building A': {},
          'Building B': {},
          'Building C': {},
          'Building D': {},
          'Building E': {},
          'Building F': {},
          'Building G': {},
          'Building H': {},
          'Building I': {},
          'Building J': {}
        };
        
        setAvailableData(extendedData);
        setSelectedBuilding(Object.keys(extendedData)[0] || '');
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
            const url = `http://127.0.0.1:5000/fetch-data/${year}/${month}/0/${encodeURIComponent(selectedBuilding)}`;
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
      } catch (error) {
        console.error('Error in addBuilding:', error);
      }
    }
  };

  const fetchBuildingStats = async (building, date) => {
    if (!building) return;
    
    try {
      const formattedDate = date.toISOString().split('T')[0];
      const response = await fetch(`http://127.0.0.1:5000/building-stats/${building}/${formattedDate}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching building stats:', error);
      setStats(null);
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

  return (
    <div style={{ height: '100vh', display: 'flex' }}>
      <div style={{ 
        flex: '1.4',
        position: 'relative',
        paddingRight: '10px',
        maxWidth: '65%'
      }}>
        <div style={{
          height: '90%',
          margin: '20px',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}>
          <MapContainer 
            center={[29.628014, -95.610553]}
            zoom={16}
            style={{ height: '100%', width: '100%', borderRadius: '12px' }}
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
                  color: building.color,
                  fillOpacity: isEditing ? 0.8 : 0.6,
                  weight: 2,
                  opacity: 1,
                  color: selectedBuilding === building.name ? '#000' : building.color
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

      <div style={{ 
        flex: '1',
        padding: '20px',
        paddingLeft: '10px',
        backgroundColor: '#f8f9fa',
        overflowY: 'auto',
        minWidth: '350px',
        maxWidth: '400px',
        borderLeft: '1px solid #e0e0e0'
      }}>
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
        }}>
          <h3 style={{ 
            color: '#2c3e50', 
            marginBottom: '20px',
            fontSize: '1.5rem',
            borderBottom: '2px solid #f0f0f0',
            paddingBottom: '10px'
          }}>Building Controls</h3>
          
          <select 
            value={selectedBuilding || ''} 
            onChange={(e) => setSelectedBuilding(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '12px',
              marginBottom: '15px',
              borderRadius: '8px',
              border: '1px solid #ddd',
              fontSize: '1rem',
              backgroundColor: '#fff',
              cursor: 'pointer'
            }}
          >
            <option value="">Select a building</option>
            {Object.keys(availableData).map(building => (
              <option key={building} value={building}>{building}</option>
            ))}
          </select>
          
          <button 
            onClick={addBuilding}
            style={{ 
              width: '100%',
              padding: '12px',
              backgroundColor: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              cursor: 'pointer',
              marginBottom: '20px',
              transition: 'all 0.3s ease',
              fontWeight: '500'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#2980b9'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#3498db'}
          >
            Add Building
          </button>

          <button 
            onClick={() => setIsEditing(!isEditing)} 
            style={{ 
              width: '100%',
              padding: '12px',
              backgroundColor: isEditing ? '#e74c3c' : '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              cursor: 'pointer',
              marginBottom: '20px',
              transition: 'all 0.3s ease',
              fontWeight: '500'
            }}
          >
            {isEditing ? "Exit Edit Mode" : "Edit Buildings"}
          </button>

          {selectedBuilding && buildings[selectedBuilding] && (
            <div style={statsBoxStyles.container}>
              <div style={statsBoxStyles.header}>
                <h4 style={statsBoxStyles.buildingName}>{selectedBuilding}</h4>
                <button
                  onClick={() => setSelectedBuilding(null)}
                  style={{
                    marginLeft: 'auto',
                    padding: '5px 10px',
                    border: 'none',
                    borderRadius: '4px',
                    backgroundColor: '#f0f0f0',
                    cursor: 'pointer'
                  }}
                >
                  ✕
                </button>
              </div>
              
              <div style={statsBoxStyles.dateContainer}>
                <div style={statsBoxStyles.dateLabel}>Select Date</div>
                <DatePicker
                  selected={selectedDate}
                  onChange={(date) => {
                    setSelectedDate(date);
                    fetchBuildingStats(selectedBuilding, date);
                  }}
                  dateFormat="yyyy/MM/dd"
                  customInput={
                    <input style={statsBoxStyles.datePicker} />
                  }
                />
              </div>

              <div style={statsBoxStyles.statsContainer}>
                {stats ? (
                  <>
                    {Array.isArray(stats.data) ? (
                      stats.data.map((entry, index) => (
                        <div key={index}>
                          <div style={statsBoxStyles.statItem}>
                            <span style={statsBoxStyles.statLabel}>Consumption</span>
                            <span style={{
                              ...statsBoxStyles.consumptionValue,
                              color: entry.consumption > 1000 ? '#e74c3c' : '#2ecc71'
                            }}>
                              {entry.consumption} kWh
                            </span>
                          </div>
                          <div style={statsBoxStyles.statItem}>
                            <span style={statsBoxStyles.statLabel}>Estimated Cost</span>
                            <span style={statsBoxStyles.statValue}>
                              ${(entry.consumption * 0.1).toFixed(2)}
                            </span>
                          </div>
                          {index < stats.data.length - 1 && <hr style={{ margin: '10px 0', border: 'none', borderTop: '1px solid #eee' }} />}
                        </div>
                      ))
                    ) : (
                      <div style={statsBoxStyles.noStats}>
                        No data available for this date
                      </div>
                    )}
                  </>
                ) : (
                  <div style={statsBoxStyles.noStats}>
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