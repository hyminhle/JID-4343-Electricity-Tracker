import React, { useState, useEffect, useRef } from 'react';
import './Dashboard.css';
import FileUploadWidget from './FileUploadWidget';
import ChartContainer from './LineGraph/ChartContainer';
import MapWidget from './Heatmap/MapWidget';
import CalendarWidget from './CalendarWidget';
import ReportWidget from './ReportWidget';
import ReportSummaryWidget from './ReportSummaryWidget';

const WIDGET_TYPES = {
  ENERGY_USAGE: 'Energy-Usage-Linegraph',
  LOCATION_MAP: 'Heatmap',
  CALENDAR_VIEW: 'Calendar-View',
  REPORT_SUMMARY: 'Report-Summary',
  DAILY_METRICS: 'Daily-Metrics',
};

const Dashboard = () => {
  const [activeAlert, setActiveAlert] = useState(true);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [dashboardTheme, setDashboardTheme] = useState('light');
  const [dashboardLayout, setDashboardLayout] = useState([
    { id: 1, type: WIDGET_TYPES.ENERGY_USAGE, visible: true, position: 0 },
    { id: 2, type: WIDGET_TYPES.LOCATION_MAP, visible: true, position: 1 },
    { id: 3, type: WIDGET_TYPES.CALENDAR_VIEW, visible: true, position: 2 },
    { id: 4, type: WIDGET_TYPES.REPORT_SUMMARY, visible: true, position: 3 },
    // Removed Daily Metrics from main grid - we'll place it in sidebar
  ]);
  
  const [userPreferences, setUserPreferences] = useState({
    defaultTimeRange: 'daily',
    showMetricIcons: true,
    alertsEnabled: true,
    chartType: 'line',
  });
  
  // Drag state
  const [draggedWidgetId, setDraggedWidgetId] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);
  
  // Load saved preferences from localStorage on mount
  useEffect(() => {
    const savedLayout = localStorage.getItem('dashboardLayout');
    const savedTheme = localStorage.getItem('dashboardTheme');
    const savedPreferences = localStorage.getItem('userPreferences');
    
    if (savedLayout) setDashboardLayout(JSON.parse(savedLayout));
    if (savedTheme) setDashboardTheme(savedTheme);
    if (savedPreferences) setUserPreferences(JSON.parse(savedPreferences));
  }, []);
  
  // Save preferences to localStorage when they change
  useEffect(() => {
    localStorage.setItem('dashboardLayout', JSON.stringify(dashboardLayout));
    localStorage.setItem('dashboardTheme', dashboardTheme);
    localStorage.setItem('userPreferences', JSON.stringify(userPreferences));
  }, [dashboardLayout, dashboardTheme, userPreferences]);
  
  const closeAlert = () => {
    setActiveAlert(false);
  };
  
  const toggleWidgetVisibility = (widgetId) => {
    setDashboardLayout(dashboardLayout.map(widget => 
      widget.id === widgetId ? { ...widget, visible: !widget.visible } : widget
    ));
  };
  
  const toggleCustomizeMode = () => {
    setIsCustomizing(!isCustomizing);
  };
  
  const updateUserPreference = (key, value) => {
    setUserPreferences({
      ...userPreferences,
      [key]: value
    });
  };
  
  // Drag and drop handlers
  const handleDragStart = (e, widgetId) => {
    setDraggedWidgetId(widgetId);
    e.dataTransfer.effectAllowed = 'move';
    // Add a custom class to the dragged element for styling
    e.target.classList.add('dragging');
  };
  
  const handleDragEnd = (e) => {
    setDraggedWidgetId(null);
    setDropTargetId(null);
    // Remove the custom class
    e.target.classList.remove('dragging');
  };
  
  const handleDragOver = (e, widgetId) => {
    e.preventDefault();
    if (draggedWidgetId !== widgetId) {
      setDropTargetId(widgetId);
    }
  };
  
  const handleDragLeave = () => {
    setDropTargetId(null);
  };
  
  const handleDrop = (e, targetWidgetId) => {
    e.preventDefault();
    if (draggedWidgetId === targetWidgetId) return;
    
    // Find position indices
    const draggedIndex = dashboardLayout.findIndex(w => w.id === draggedWidgetId);
    const targetIndex = dashboardLayout.findIndex(w => w.id === targetWidgetId);
    
    if (draggedIndex < 0 || targetIndex < 0) return;
    
    // Create a new layout with reordered widgets
    const newLayout = [...dashboardLayout];
    const [draggedWidget] = newLayout.splice(draggedIndex, 1);
    newLayout.splice(targetIndex, 0, draggedWidget);
    
    // Update positions
    newLayout.forEach((widget, index) => {
      widget.position = index;
    });
    
    setDashboardLayout(newLayout);
    setDraggedWidgetId(null);
    setDropTargetId(null);
  };
  
  // Add a widget from the hidden panel
  const addWidget = (widgetId) => {
    const newLayout = [...dashboardLayout];
    const widgetIndex = newLayout.findIndex(w => w.id === widgetId);
    
    if (widgetIndex >= 0) {
      // Make the widget visible and put it at the end of the visible widgets
      newLayout[widgetIndex].visible = true;
      
      // Find the highest position value among visible widgets
      const highestPosition = Math.max(
        ...newLayout.filter(w => w.visible && w.id !== widgetId).map(w => w.position),
        -1
      );
      
      newLayout[widgetIndex].position = highestPosition + 1;
      setDashboardLayout(newLayout);
    }
  };
  
  // Function to render widget based on type
  const renderWidget = (widget) => {
    if (!widget.visible) return null;
  
    const isDragging = draggedWidgetId === widget.id;
    const isDropTarget = dropTargetId === widget.id;
    
    // Common attributes for draggable widgets in customize mode
    const dragAttributes = isCustomizing ? {
      draggable: true,
      onDragStart: (e) => handleDragStart(e, widget.id),
      onDragEnd: handleDragEnd,
      onDragOver: (e) => handleDragOver(e, widget.id),
      onDragLeave: handleDragLeave,
      onDrop: (e) => handleDrop(e, widget.id)
    } : {};
    
    // CSS classes for drag and drop styling
    const dragClass = isDragging ? 'dragging' : '';
    const dropTargetClass = isDropTarget ? 'drop-target' : '';
    const customizingClass = isCustomizing ? 'customizing' : '';
  
    // Add a fixed-size class to all widgets
    const fixedSizeClass = 'fixed-size-widget';
    
    switch (widget.type) {
      case WIDGET_TYPES.ENERGY_USAGE:
        return (
          <div 
            key={widget.id} 
            className={`dashboard-card Energy-Usage-Linegraph ${dragClass} ${dropTargetClass} ${customizingClass}`}
            {...dragAttributes}
          >
            <div className="card-header">
              <h2>Energy Usage</h2>
              <div className="card-actions">
                <select 
                  className="time-selector"
                  value={userPreferences.defaultTimeRange}
                  onChange={(e) => updateUserPreference('defaultTimeRange', e.target.value)}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
                {isCustomizing && (
                  <button 
                    className="widget-remove-btn" 
                    onClick={() => toggleWidgetVisibility(widget.id)}
                    title="Hide Widget"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
            <div className="card-content">
              <ChartContainer chartType={userPreferences.chartType} />
            </div>
            {isCustomizing && (
              <div className="widget-drag-handle">
                <span>⋮⋮</span>
              </div>
            )}
          </div>
        );
        
      case WIDGET_TYPES.LOCATION_MAP:
        return (
          <div 
            key={widget.id} 
            className={`dashboard-card Heatmap ${dragClass} ${dropTargetClass} ${customizingClass}`}
            {...dragAttributes}
          >
            <div className="card-header">
              <h2>Usage by Location</h2>
              <div className="card-actions">
                <button className="icon-button">
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                  </svg>
                </button>
                {isCustomizing && (
                  <button 
                    className="widget-remove-btn" 
                    onClick={() => toggleWidgetVisibility(widget.id)}
                    title="Hide Widget"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
            <div className="card-content">
              <MapWidget showBuildingNames={userPreferences.showBuildingNames || false} />
            </div>
            {isCustomizing && (
              <div className="widget-drag-handle">
                <span>⋮⋮</span>
              </div>
            )}
          </div>
        );
        
      case WIDGET_TYPES.CALENDAR_VIEW:
        return (
          <div 
            key={widget.id} 
            className={`dashboard-card Calendar-View ${dragClass} ${dropTargetClass} ${customizingClass}`}
            {...dragAttributes}
          >
            <div className="card-header">
              <h2>Usage Calendar</h2>
              <div className="card-actions">
                <button className="icon-button">
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7v-5z"/>
                  </svg>
                </button>
                {isCustomizing && (
                  <button 
                    className="widget-remove-btn" 
                    onClick={() => toggleWidgetVisibility(widget.id)}
                    title="Hide Widget"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
            <div className="card-content">
              <CalendarWidget simplified={true} />
            </div>
            {isCustomizing && (
              <div className="widget-drag-handle">
                <span>⋮⋮</span>
              </div>
            )}
          </div>
        );
        
        case WIDGET_TYPES.REPORT_SUMMARY:
          return (
            <ReportSummaryWidget 
              id={widget.id}
              isCustomizing={isCustomizing}
              dragClass={dragClass}
              dropTargetClass={dropTargetClass}
              customizingClass={customizingClass}
              dragAttributes={dragAttributes}
              toggleWidgetVisibility={toggleWidgetVisibility}
            />
          );
        
      default:
        return null;
    }
  };
  
  // Get sorted visible widgets
  const visibleWidgets = [...dashboardLayout]
    .filter(widget => widget.visible)
    .sort((a, b) => a.position - b.position);
  
  // Get hidden widgets for the customization panel
  const hiddenWidgets = dashboardLayout.filter(widget => !widget.visible);
  
  return (
    <div className={`dashboard ${dashboardTheme}`}>
      <div className="dashboard-header">
        <h1 className="dashboard-title">Energy Tracker</h1>
        <div className="dashboard-actions">
          <button className={`action-button customize-button ${isCustomizing ? 'active' : ''}`} onClick={toggleCustomizeMode}>
            {isCustomizing ? 'Save Layout' : 'Customize Dashboard'}
          </button>
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
    
      {isCustomizing && (
        <div className="customization-panel">
          <div className="customization-section">
            <h3>Display Settings</h3>
            <div className="preference-item">
              <label>
                <input 
                  type="checkbox" 
                  checked={userPreferences.alertsEnabled} 
                  onChange={(e) => updateUserPreference('alertsEnabled', e.target.checked)}
                />
                Enable Alerts
              </label>
            </div>
          </div>
          
          <div className="customization-section">
            <h3>Hidden Widgets</h3>
            {hiddenWidgets.length === 0 ? (
              <p>No hidden widgets</p>
            ) : (
              <ul className="hidden-widgets-list">
                {hiddenWidgets.map(widget => (
                  <li key={widget.id}>
                    {widget.type.replace(/-/g, ' ')}
                    <button onClick={() => addWidget(widget.id)}>Show</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      
      <div className="dashboard-content">
        <div className={`dashboard-grid ${isCustomizing ? 'customizing' : ''}`}>
          {visibleWidgets.map(renderWidget)}
        </div>
        
        <div className="dashboard-sidebar">
          {activeAlert && userPreferences.alertsEnabled && (
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
          
          {/* Daily Metrics Widget - Now in sidebar */}
          <div className="sidebar-widget daily-metrics-widget">
            <h3>Daily Metrics</h3>
            <div className="sidebar-widget-content">
              <ReportWidget />
            </div>
          </div>
          
          <div className="quick-upload">
            <h3>Quick Upload</h3>
            <FileUploadWidget />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;