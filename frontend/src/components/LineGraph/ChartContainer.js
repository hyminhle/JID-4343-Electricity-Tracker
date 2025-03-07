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
  
  if (loading) return <div>Loading chart data...</div>;
  
  // If no datasets are available, show a message or placeholder
  if (!datasets || datasets.length === 0) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100%',
        flexDirection: 'column',
        padding: '20px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px'
      }}>
        <p>No data available to display.</p>
        <p>Go to the Graph page to add datasets.</p>
      </div>
    );
  }
  
  return (
    <ChartDisplay 
      datasets={datasets} 
      height="300px" // Adjust height to fit in dashboard card
    />
  );
};

export default ChartContainer;