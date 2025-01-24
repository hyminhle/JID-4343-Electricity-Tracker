import React from 'react';
import './Dashboard.css';
import FileUpload from './FileUpload';
import LineGraph from './LineGraph';

function Dashboard() {
  return (
    <div className="dashboard">
      <h1 className="dashboard-title">Energy Tracker</h1>
      <div className="dashboard-content">
        <div className="dashboard-grid">
          <div className="dashboard-card">
            <h2>Graph</h2>
            <div className="card-content">
              <LineGraph />
            </div>
          </div>
          <div className="dashboard-card">
            <h2>Map</h2>
            <div className="card-content map-placeholder">
              {/* Map component will go here */}
            </div>
          </div>
          <div className="dashboard-card">
            <h2>Calendar</h2>
            <div className="card-content calendar-placeholder">
              {/* Calendar component will go here */}
            </div>
          </div>
          <div className="dashboard-card">
            <h2>Report</h2>
            <div className="card-content report-placeholder">
              {/* Report component will go here */}
            </div>
          </div>
        </div>
        
        <div className="dashboard-sidebar">
          <div className="alert-card">
            <div className="alert-header">
              <h3>Alert - 10/9/24</h3>
              <button className="close-button">×</button>
            </div>
            <p>Detected Outlier Data</p>
            <button className="review-button">Review</button>
          </div>
          
          <div className="metrics-card">
            <h3>Today's Metrics</h3>
            <div className="pie-chart">
              {/* Pie chart will go here */}
            </div>
            <div className="metrics-data">
              <p>Daily Avg: 30 kWh</p>
              <p>Monthly: 900 kWh</p>
              <p>Hourly Cost: 15 cents</p>
              <p>Monthly Cost: 243$</p>
              <p>Emission: 0.85 lbs CO2</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard; 