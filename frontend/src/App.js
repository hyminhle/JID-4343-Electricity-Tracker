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
import Report from './components/Report'; 
import ThemeInitializer from './ThemeInitializer';
import Chatbot from './components/Chatbot';
import { AppDateProvider } from './components/DateContext';
import AlertPage from './components/AlertPage';

// Lazy load the Map component
const Map = React.lazy(() => import('./components/Heatmap/MapVisual'));

function App() {
  return (
    <Router>
      {/* Theme initializer will set up theme as soon as app loads */}
      <ThemeInitializer />
      {/* Wrap the app with the date provider */}
      <AppDateProvider>
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
                <Route path="/reports" element={<Report />} />
                <Route path="/alerts" element={<AlertPage />} />
              </Routes>
            </Suspense>
          </div>
          {/* Chatbot is outside the Routes since it should be available on all pages */}
          <Chatbot />
        </div>
      </AppDateProvider>
    </Router>
  );
}

export default App;