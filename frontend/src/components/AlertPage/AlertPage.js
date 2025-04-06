import React, { useState } from 'react';
import './AlertPage.css';

const AlertPage = () => {
  // Sample data - replace with actual data from your backend
  const [alerts] = useState([
    {
      id: 1,
      severity: 'Critical',
      startTime: '12:00 am (12 hours)',
      logicModule: 'Host Status',
      instance: 'HostStatus',
      groups: ['xiao_group', 'Misc'],
      resource: 'qauat01.logicmonitor.com',
      datapoint: 'idleInterval',
      value: '42291.0',
      threshold: '> 300 300 300',
      acknowledged: false,
      sdt: false,
      cleared: false
    },
    // Add more sample data as needed
  ]);

  const alertStats = {
    total: 1138,
    critical: 312,
    error: 395,
    warning: 419,
    sdt: 12,
    acknowledged: 70
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters] = useState({
    acknowledged: 'No',
    sdt: 'No',
    cleared: 'No'
  });

  return (
    <div className="alert-page">
      {/* Alert Statistics Header */}
      <div className="alert-stats">
        <h1>{alertStats.total} Alerts</h1>
        <div className="stat-chips">
          <div className="stat-chip critical">
            <span className="stat-icon">⚠️</span>
            <span>{alertStats.critical} Critical</span>
          </div>
          <div className="stat-chip error">
            <span className="stat-icon">❌</span>
            <span>{alertStats.error} Error</span>
          </div>
          <div className="stat-chip warning">
            <span className="stat-icon">⚡</span>
            <span>{alertStats.warning} Warning</span>
          </div>
          <div className="stat-chip sdt">
            <span className="stat-icon">🕒</span>
            <span>{alertStats.sdt} SDT</span>
          </div>
          <div className="stat-chip acknowledged">
            <span className="stat-icon">✓</span>
            <span>{alertStats.acknowledged} Acknowledged</span>
          </div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="search-filter-bar">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search All Alerts"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button className="search-button">
            <span>🔍</span>
          </button>
        </div>
        <div className="filter-options">
          <button className="filter-button">Past 24 hours ▼</button>
          <button className="filter-button">Saved Filters ▼</button>
          <button className="filter-button">More Filters (3)</button>
        </div>
      </div>

      {/* Active Filters */}
      <div className="active-filters">
        <span>3 Filters Applied</span>
        <div className="filter-chips">
          {Object.entries(activeFilters).map(([key, value]) => (
            <div key={key} className="filter-chip">
              <span>{key}: {value}</span>
              <button className="remove-filter">×</button>
            </div>
          ))}
        </div>
        <button className="clear-all">Clear All</button>
      </div>

      {/* Alerts Table */}
      <div className="alerts-table">
        <table>
          <thead>
            <tr>
              <th><input type="checkbox" /></th>
              <th>Severity</th>
              <th>Alert Began ▼</th>
              <th>LogicModule</th>
              <th>Instance</th>
              <th>Groups</th>
              <th>Resource/Website</th>
              <th>Datapoint</th>
              <th>Value</th>
              <th>Effective Threshold</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((alert) => (
              <tr key={alert.id} className={alert.severity.toLowerCase()}>
                <td><input type="checkbox" /></td>
                <td>
                  <div className={`severity-indicator ${alert.severity.toLowerCase()}`}>
                    {alert.severity}
                  </div>
                </td>
                <td>{alert.startTime}</td>
                <td>{alert.logicModule}</td>
                <td>{alert.instance}</td>
                <td>{alert.groups.join(', ')}</td>
                <td>{alert.resource}</td>
                <td>{alert.datapoint}</td>
                <td>{alert.value}</td>
                <td>{alert.threshold}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="pagination">
        <span>1-25 of 153</span>
        <div className="pagination-controls">
          <button disabled>←</button>
          <button className="active">1</button>
          <button>2</button>
          <button>3</button>
          <span>...</span>
          <button>7</button>
          <button>→</button>
        </div>
      </div>
    </div>
  );
};

export default AlertPage; 