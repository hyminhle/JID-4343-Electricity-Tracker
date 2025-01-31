import React from 'react';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Polygon, Tooltip } from 'react-leaflet';
import L from 'leaflet';

// Fix for default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png'
});

const MapComponent = () => {
  // Building coordinates (these are approximate - you'll need exact coordinates)
  const buildings = {
    slbForum: {
      name: "SLB Forum",
      coordinates: [
        [29.979500, -95.834000],
        [29.979600, -95.833900],
        [29.979550, -95.833800],
        [29.979450, -95.833900]
      ],
      color: "#0066cc"
    },
    learningCenter: {
      name: "Sugar Land Learning Center",
      coordinates: [
        [29.979500, -95.833700],
        [29.979600, -95.833600],
        [29.979550, -95.833500],
        [29.979450, -95.833600]
      ],
      color: "#0066cc"
    },
    slb225: {
      name: "SLB 225",
      coordinates: [
        [29.979400, -95.833700],
        [29.979500, -95.833600],
        [29.979450, -95.833500],
        [29.979350, -95.833600]
      ],
      color: "#0066cc"
    },
    techCorp: {
      name: "Schlumberger Technology Corporation",
      coordinates: [
        [29.979300, -95.833800],
        [29.979400, -95.833700],
        [29.979350, -95.833600],
        [29.979250, -95.833700]
      ],
      color: "#0066cc"
    }
  };

  return (
    <div style={{ 
      height: '500px',  // Changed from 100vh
      width: '80%',     // Changed from 100%
      margin: '20px auto',  // Centers the map and adds spacing
      border: '1px solid #ccc',  // Optional: adds a border
      borderRadius: '8px',       // Optional: rounds the corners
    }}>
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
          
          {Object.entries(buildings).map(([key, building]) => (
            <Polygon
              key={key}
              positions={building.coordinates}
              pathOptions={{
                fillColor: building.color,
                fillOpacity: 0.7,
                weight: 2,
                opacity: 1,
                color: 'white'
              }}
            >
              <Tooltip sticky>
                <div>
                  <h3>{building.name}</h3>
                  <p>Click for more information</p>
                </div>
              </Tooltip>
            </Polygon>
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