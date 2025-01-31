import React, { Suspense } from 'react';
import './App.css';
import 'leaflet/dist/leaflet.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import Submit from './components/Submit';
import Graph from './components/Graph';
import Sidebar from './components/Sidebar';

// Lazy load the Map component
const Map = React.lazy(() => import('./components/Map'));

function App() {
  return (
    <Router>
      <div className="App">
        <Sidebar />
        <div className="main-content">
          <Suspense fallback={<div>Loading map...</div>}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/submit" element={<Submit />} />
              <Route path="/graph" element={<Graph />} />
              <Route path="/map" element={<Map />} />
            </Routes>
          </Suspense>
        </div>
      </div>
    </Router>
  );
}

export default App;