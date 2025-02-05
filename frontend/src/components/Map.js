import React, { useState, useEffect } from 'react';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Polygon, Tooltip, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';

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
        console.log('Available Data:', data); // Debugging log
        setAvailableData(data);
        setSelectedBuilding(Object.keys(data)[0] || '');
      } catch (error) {
        console.error('Error fetching available data:', error);
        setError('Failed to fetch available data'); // Now using setError properly
        setAvailableData({});
      }
    };
  
    fetchAvailableData();
  }, []);
  

  // Add a building to the map
  const addBuilding = () => {
    if (selectedBuilding) {
      const newBuilding = {
        name: selectedBuilding,
        coordinates: [
          [29.979500, -95.834000], // Example coordinates, replace with actual data
          [29.979600, -95.833900],
          [29.979550, -95.833800],
          [29.979450, -95.833900]
        ],
        color: "#0066cc"
      };
      setBuildings({ ...buildings, [selectedBuilding]: newBuilding });
    }
  };

  // Delete a building from the map
  const deleteBuilding = (buildingName) => {
    const updatedBuildings = { ...buildings };
    delete updatedBuildings[buildingName];
    setBuildings(updatedBuildings);
  };

  // Move a building on the map (example implementation)
  const moveBuilding = (buildingName, newCoordinates) => {
    const updatedBuildings = { ...buildings };
    if (updatedBuildings[buildingName]) {
      updatedBuildings[buildingName].coordinates = newCoordinates;
      setBuildings(updatedBuildings);
    }
  };
  
  const handleDragEnd = (buildingName, newLatLng) => {
    setBuildings((prevBuildings) => {
      const prevCoords = prevBuildings[buildingName].coordinates;
      if (!prevCoords || prevCoords.length === 0) return prevBuildings;

      // Calculate movement delta
      const deltaLat = newLatLng.lat - prevCoords[0][0];
      const deltaLng = newLatLng.lng - prevCoords[0][1];

      // Shift all coordinates by the delta
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
    <div style={{ 
      height: '500px',  // Changed from 100vh
      width: '80%',     // Changed from 100%
      margin: '20px auto',  // Centers the map and adds spacing
      border: '1px solid #ccc',  // Optional: adds a border
      borderRadius: '8px',       // Optional: rounds the corners
    }}>
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
          <option value="" disabled>
            Select Building
          </option>
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
        <button onClick={addBuilding}
          style={{
            marginTop: '5px',
            marginLeft: '10px',
            marginBottom: '5px',
            padding: '5px 9px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >Add Building</button>
        <button onClick={() => setIsEditing(!isEditing)}
          style={{
            marginTop: '5px',
            marginLeft: '10px',
            marginBottom: '5px',
            padding: '5px 9px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
          >
          {isEditing ? "Exit Edit Mode" : "Edit Buildings"}
        </button>
      </div>
      {typeof window !== 'undefined' && (
        <MapContainer
          center={[29.979400, -95.833700]}
          zoom={17}
          style={{ 
            height: '100%', 
            width: '100%',
            borderRadius: '8px',  // Optional: matches parent's border radius
          }}
          scrollWheelZoom={true}
        >
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
              draggable={isEditing} // Allow dragging only in edit mode
              eventHandlers={{
                dragend: (e) => {
                  const { lat, lng } = e.target.getLatLngs()[0][0]; // Get new position
                  handleDragEnd(buildingName, { lat, lng });
                }
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
                        // Rename key in the buildings object
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
                        if (e.key === "Enter") e.target.blur(); // Save on Enter
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
          {/* Drag markers for movement */}
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
  );
};

// Wrap the component in a loading check
const Map = () => {
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) return null;

  return <MapComponent />;
};

export default Map; 