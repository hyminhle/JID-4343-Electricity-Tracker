import React, { useEffect, useState } from 'react';
import ChartDisplay from './ChartDisplay';

const ChartContainer = () => {
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Load datasets from localStorage
    const savedDatasets = localStorage.getItem('selectedDatasets');
    if (savedDatasets) {
      setDatasets(JSON.parse(savedDatasets));
    }
    setLoading(false);
  }, []);
  
  // Style for the container box
  const boxStyle = {
    border: '1px solid rgba(0, 0, 0, 0.01)',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.10)',
    padding: '16px',
    backgroundColor: '#fff',
    margin: '10px 0',
    height: '100%',
    display: 'flex',
    flexDirection: 'column'
  };
  
  // Style for header
  const headerStyle = {
    marginBottom: '12px',
    paddingBottom: '8px',
    borderBottom: '1px solid #eee',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  };
  
  const titleStyle = {
    fontSize: '16px',
    fontWeight: '500',
    margin: '0',
    color: '#333'
  };
  
  if (loading) {
    return (
      <div style={boxStyle}>
        <div style={headerStyle}>
          <h3 style={titleStyle}>Energy Usage</h3>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
          Loading chart data...
        </div>
      </div>
    );
  }
  
  // If no datasets are available, show a message or placeholder
  if (!datasets || datasets.length === 0) {
    return (
      <div style={boxStyle}>
        <div style={headerStyle}>
          <h3 style={titleStyle}>Energy Usage</h3>
        </div>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          flex: 1,
          flexDirection: 'column',
          padding: '20px',
          backgroundColor: '#f8f9fa',
          borderRadius: '6px'
        }}>
          <p>No data available to display.</p>
          <p>Go to the Graph page to add datasets.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div style={boxStyle}>
      <div style={{ flex: 1 }}>
        <ChartDisplay 
          datasets={datasets} 
          height="300px" // Adjust height to fit in dashboard card
        />
      </div>
    </div>
  );
};

export default ChartContainer;