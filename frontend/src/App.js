import React, { Suspense } from 'react';
import './App.css';
import 'leaflet/dist/leaflet.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import Submit from './components/Submit';
import Graph from './components/LineGraph/Graph';
import Sidebar from './components/Sidebar';
import Calendar from './components/Calendar';
import Settings from './components/Settings';
import ThemeInitializer from './ThemeInitializer';
import Chatbot from './components/Chatbot';

// Lazy load the Map component
const Map = React.lazy(() => import('./components/Heatmap/MapVisual'));

// Simple Reports component (placeholder)
const Reports = () => (
  <div className="reports-container">
    <h1>Reports</h1>
    <p>This is the reports page. Content will be added soon.</p>
  </div>
);

function App() {
  return (
    <Router>
      {/* Theme initializer will set up theme as soon as app loads */}
      <ThemeInitializer />
      <div className="App">
        <Sidebar />
        <div className="main-content">
          <Suspense fallback={<div>Loading...</div>}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/submit" element={<Submit />} />
              <Route path="/graph" element={<Graph />} />
              <Route path="/map" element={<Map />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/reports" element={<Reports />} />
            </Routes>
          </Suspense>
        </div>
        {/* Chatbot is outside the Routes since it should be available on all pages */}
        <Chatbot />
      </div>
    </Router>
  );
}

export default App;