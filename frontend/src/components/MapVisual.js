import React from 'react';
import Map from './Map';
import './Map.css';

function MapVisual() {
  return (
    <div className="map-page">
      <h1>Map Visualization</h1>
      <div className="map-visual-container">
        <Map />
      </div>
    </div>
  );
}

export default MapVisual; 