import React, { useState } from 'react';
import './Dashboard.css';
import FileUpload from './FileUpload';
import ChartContainer from './LineGraph/ChartContainer';
import Map from './MapVisual';
import CalendarWidget from './CalendarWidget'; // Updated import

const Dashboard = () => {
  const [activeAlert, setActiveAlert] = useState(true);
  
  const closeAlert = () => {
    setActiveAlert(false);
  };
  
  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1 className="dashboard-title">Energy Tracker</h1>
        <div className="dashboard-actions">
          <button className="action-button">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
            New Report
          </button>
          <button className="action-button">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
            </svg>
            Export Data
          </button>
        </div>
      </div>
      
      <div className="dashboard-content">
        <div className="dashboard-grid">
          <div className="dashboard-card energy-usage">
            <div className="card-header">
              <h2>Energy Usage</h2>
              <div className="card-actions">
                <select className="time-selector">
                  <option>Daily</option>
                  <option>Weekly</option>
                  <option>Monthly</option>
                </select>
              </div>
            </div>
            <div className="card-content">
              <ChartContainer />
            </div>
          </div>
          
          <div className="dashboard-card location-map">
            <div className="card-header">
              <h2>Usage by Location</h2>
              <div className="card-actions">
                <button className="icon-button">
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                  </svg>
                </button>
              </div>
            </div>
            <div className="card-content">
              {/* <Map /> */}
            </div>
          </div>
          
          <div className="dashboard-card calendar-view">
            <div className="card-header">
              <h2>Usage Calendar</h2>
              <div className="card-actions">
                <button className="icon-button">
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7v-5z"/>
                  </svg>
                </button>
              </div>
            </div>
            <div className="card-content">
              <CalendarWidget simplified={true} 
              />
            </div>
          </div>
          
          <div className="dashboard-card report-summary">
            <div className="card-header">
              <h2>Monthly Report</h2>
              <div className="card-actions">
                <button className="icon-button">
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                  </svg>
                </button>
              </div>
            </div>
            <div className="card-content">
              <div className="report-highlights">
                <div className="highlight-item">
                  <span className="highlight-label">Total Usage</span>
                  <span className="highlight-value">920 kWh</span>
                  <span className="highlight-change increase">+5.2%</span>
                </div>
                <div className="highlight-item">
                  <span className="highlight-label">Peak Day</span>
                  <span className="highlight-value">Oct 15</span>
                  <span className="highlight-subvalue">45 kWh</span>
                </div>
                <div className="highlight-item">
                  <span className="highlight-label">Lowest Day</span>
                  <span className="highlight-value">Oct 3</span>
                  <span className="highlight-subvalue">22 kWh</span>
                </div>
                <div className="highlight-item">
                  <span className="highlight-label">Cost</span>
                  <span className="highlight-value">$243</span>
                  <span className="highlight-change decrease">-2.1%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="dashboard-sidebar">
          {activeAlert && (
            <div className="alert-card">
              <div className="alert-header">
                <h3>Alert - 10/9/24</h3>
                <button className="close-button" onClick={closeAlert}>×</button>
              </div>
              <p>Detected unusual energy usage pattern</p>
              <div className="alert-details">
                <span className="alert-metric">45 kWh</span>
                <span className="alert-time">2:00 PM - 4:00 PM</span>
              </div>
              <button className="review-button">Review Details</button>
            </div>
          )}
          
          <div className="metrics-card">
            <h3>Today's Metrics</h3>
            <div className="metrics-summary">
              <div className="metric-circle">
                <svg viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#4CAF50"
                    strokeWidth="3"
                    strokeDasharray="75, 100"
                  />
                  <text x="18" y="20.35" textAnchor="middle" className="percentage">75%</text>
                </svg>
                <span className="metric-label">Efficiency</span>
              </div>
            </div>
            <div className="metrics-data">
              <div className="metric-item">
                <span className="metric-icon">⚡</span>
                <div className="metric-info">
                  <span className="metric-label">Daily Avg</span>
                  <span className="metric-value">30 kWh</span>
                </div>
              </div>
              <div className="metric-item">
                <span className="metric-icon">📅</span>
                <div className="metric-info">
                  <span className="metric-label">Monthly</span>
                  <span className="metric-value">900 kWh</span>
                </div>
              </div>
              <div className="metric-item">
                <span className="metric-icon">💰</span>
                <div className="metric-info">
                  <span className="metric-label">Monthly Cost</span>
                  <span className="metric-value">$243</span>
                </div>
              </div>
              <div className="metric-item">
                <span className="metric-icon">🌱</span>
                <div className="metric-info">
                  <span className="metric-label">CO2 Emission</span>
                  <span className="metric-value">0.85 lbs</span>
                </div>
              </div>
            </div>
            <button className="view-details-button">View Full Report</button>
          </div>
          
          <div className="quick-upload">
            <h3>Quick Upload</h3>
            <FileUpload />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;