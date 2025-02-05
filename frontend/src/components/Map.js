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
        console.log('Available Data:', data);
        setAvailableData(data);
        setSelectedBuilding(Object.keys(data)[0] || '');
      } catch (error) {
        console.error('Error fetching available data:', error);
        setError('Failed to fetch available data');
        setAvailableData({});
      }
    };
  
    fetchAvailableData();
  }, []);
  

  const addBuilding = async () => {
    if (selectedBuilding) {
      try {
        const buildingData = [];
        const buildingInfo = availableData[selectedBuilding];
        console.log('Building info:', buildingInfo);
        const availableYears = Object.keys(buildingInfo);
        console.log('Years info:', availableYears);
        for (const year of availableYears) {
          const availableMonths = Object.keys(buildingInfo[year]);
          for (const month of availableMonths) {
            const response = await axios.get(`http://localhost:5000/fetch-data/${year}/${month}/0/${selectedBuilding}`);
            buildingData.push(...response.data);
          }
        }
        const newBuilding = {
          name: selectedBuilding,
          coordinates: [
            [29.979500, -95.834000],
            [29.979600, -95.833900],
            [29.979550, -95.833800],
            [29.979450, -95.833900]
          ],
          color: "#0066cc",
          data: buildingData
        };
        setBuildings({ ...buildings, [selectedBuilding]: newBuilding });
      } catch (error) {
        console.error('Error fetching building data:', error);
      }
    }
  };


  const fetchBuildingStats = async (buildingName, date) => {
    try {
      // Extract year, month, and day from the selected date
      const year = date.getFullYear();
      const month = date.getMonth() + 1; // getMonth() returns 0-based month (0 = January)
      const day = date.getDate();
  
      // Construct the API URL with the full building name
      const apiUrl = `http://localhost:5000/fetch-data/${year}/${month}/${day}/${buildingName}`;
  
      // Fetch data from the API
      const response = await axios.get(apiUrl);
  
      // Log the API response for debugging
      console.log('API Response:', response.data);
  
      // Check if the response contains data
      if (response.data.error) {
        console.error('No data found for the specified parameters:', response.data.error);
        setStats(null); // Clear stats if no data is found
      } else {
        // Ensure the response is an array
        const data = Array.isArray(response.data) ? response.data : [response.data];
  
        // Set the fetched data as stats
        setStats({
          date: selectedDate.toISOString().split('T')[0], // Format the date as YYYY-MM-DD
          data: data, // Store the fetched data
        });
      }
    } catch (error) {
      console.error('Error fetching building stats:', error);
      setStats(null); // Clear stats on error
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
    <div style={{ display: 'flex', height: '500px', width: '80%', margin: '20px auto', border: '1px solid #ccc', borderRadius: '8px' }}>
      <div style={{ flex: 3 }}>
        <div>
          <select 
            value={selectedBuilding}
            onChange={(e) => {
              setSelectedBuilding(e.target.value);
            }}
            style={{
              marginTop: '5px',
              marginLeft: '10px',
              marginBottom: '5px',
              padding: '5px 9px',
              border: '1px solid black',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            <option value="" disabled>Select Building</option>
            {availableData && Object.keys(availableData).length > 0 ? (
              Object.keys(availableData).map((building) => (
                <option key={building} value={building}>
                  {building}
                </option>
              ))
            ) : (
              <option disabled>No buildings available</option>
            )}
          </select>
          <button onClick={addBuilding} style={{ marginTop: '5px', marginLeft: '10px', padding: '5px 9px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Add Building</button>
          <button onClick={() => setIsEditing(!isEditing)} style={{ marginTop: '5px', marginLeft: '10px', padding: '5px 9px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            {isEditing ? "Exit Edit Mode" : "Edit Buildings"}
          </button>
        </div>

        {typeof window !== 'undefined' && (
          <MapContainer center={[29.979400, -95.833700]} zoom={17} style={{ height: '100%', width: '100%', borderRadius: '8px' }} scrollWheelZoom={true}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />

            {Object.keys(buildings).map((buildingName) => (
              <Polygon
                key={buildingName}
                positions={buildings[buildingName].coordinates}
                pathOptions={{
                  fillColor: buildings[buildingName].color,
                  fillOpacity: 0.7,
                  weight: 2,
                  opacity: 1,
                  color: 'white'
                }}
                draggable={isEditing}
                eventHandlers={{
                  dragend: (e) => {
                    const { lat, lng } = e.target.getLatLngs()[0][0];
                    handleDragEnd(buildingName, { lat, lng });
                  },
                  click: () => handleBuildingClick(buildingName), 
                }}
              >
                <Tooltip sticky>
                  <div>
                    <h3>{buildings[buildingName].name}</h3>
                    <p>{isEditing ? "Drag to move or delete below" : "Click for more info"}</p>
                  </div>
                </Tooltip>
                <Popup>
                  {isEditing ? (
                    <div>
                      <input
                        type="text"
                        value={buildings[buildingName].name}
                        onChange={(e) => {
                          const updatedBuildings = { ...buildings };
                          updatedBuildings[buildingName].name = e.target.value;
                          setBuildings(updatedBuildings);
                        }}
                        onBlur={() => {
                          const newName = buildings[buildingName].name.trim();
                          if (newName && newName !== buildingName) {
                            setBuildings((prevBuildings) => {
                              const updatedBuildings = { ...prevBuildings };
                              updatedBuildings[newName] = { ...updatedBuildings[buildingName] };
                              delete updatedBuildings[buildingName];
                              return updatedBuildings;
                            });
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.target.blur();
                        }}
                        autoFocus
                      />
                    </div>
                  ) : (
                    <h3>{buildings[buildingName].name}</h3>
                  )}

                  {isEditing && <button onClick={() => deleteBuilding(buildingName)}>Delete</button>}
                </Popup>
              </Polygon>
            ))}

            {isEditing &&
              Object.keys(buildings).map((buildingName) => (
                <Marker
                  key={buildingName}
                  position={buildings[buildingName].coordinates[0]}
                  draggable={true}
                  eventHandlers={{
                    dragend: (e) => {
                      const { lat, lng } = e.target.getLatLng();
                      handleDragEnd(buildingName, { lat, lng });
                    }
                  }}
                >
                  <Popup>Drag to move building</Popup>
                </Marker>
              ))}
          </MapContainer>
        )}
      </div>
        {selectedBuilding && (
        <div style={{
          flex: 1,
          margin: '20px',
          padding: '20px',
          backgroundColor: '#f4f4f4',
          borderRadius: '8px',
          border: '1px solid #ccc',
        }}>
          <h3>Building Stats</h3>
          <h4>{selectedBuilding}</h4>
          <DatePicker
            selected={selectedDate}
            onChange={(date) => {
              setSelectedDate(date);
              fetchBuildingStats(selectedBuilding, date);
            }}
            dateFormat="yyyy/MM/dd"
            style={{ marginBottom: '20px' }}
          />
          <div>
            {stats ? (
              <div>
                <h5>Stats for {stats.date}:</h5>
                {/* Safeguard against non-array data */}
                {Array.isArray(stats.data) ? (
                  stats.data.map((entry, index) => (
                    <div key={index} style={{ marginBottom: '10px' }}>
                      <p><strong>Consumption:</strong> {entry.consumption} kWh</p>
                      <p><strong>Cost:</strong> ${(entry.consumption * 0.1).toFixed(2)}</p>
                      <hr />
                    </div>
                  ))
                ) : (
                  <p>No valid data available for this day.</p>
                )}
              </div>
            ) : (
              <p>No stats available for this day.</p>
            )}
          </div>
        </div>
      )}
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