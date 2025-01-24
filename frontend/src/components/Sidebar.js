import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Sidebar.css';

function Sidebar() {
  const location = useLocation();

  return (
    <div className="sidebar">
      <div className="sidebar-tabs">
        <Link to="/" className={`tab ${location.pathname === '/' ? 'active' : ''}`}>
          <svg viewBox="0 0 24 24" className="icon">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/>
          </svg>
        </Link>
        <Link to="/graph" className={`tab ${location.pathname === '/graph' ? 'active' : ''}`}>
          <svg viewBox="0 0 24 24" className="icon">
            <path d="M3.5 18.5l6-6 4 4L22 6.92 20.59 5.5l-7.09 8.5-4-4-6 6z"/>
          </svg>
        </Link>
        <Link to="/map" className={`tab ${location.pathname === '/map' ? 'active' : ''}`}>
          <svg viewBox="0 0 24 24" className="icon">
            <path d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z"/>
          </svg>
        </Link>
        <Link to="/calendar" className={`tab ${location.pathname === '/calendar' ? 'active' : ''}`}>
          <svg viewBox="0 0 24 24" className="icon">
            <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z"/>
          </svg>
        </Link>
        <Link to="/reports" className={`tab ${location.pathname === '/reports' ? 'active' : ''}`}>
          <svg viewBox="0 0 24 24" className="icon">
            <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
          </svg>
        </Link>
        <Link to="/submit" className={`tab ${location.pathname === '/submit' ? 'active' : ''}`}>
          <svg viewBox="0 0 24 24" className="icon">
            <path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/>
          </svg>
        </Link>
        <Link to="/settings" className={`tab ${location.pathname === '/settings' ? 'active' : ''}`}>
          <svg viewBox="0 0 24 24" className="icon">
            <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.03-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
          </svg>
        </Link>
      </div>
    </div>
  );
}

export default Sidebar; 