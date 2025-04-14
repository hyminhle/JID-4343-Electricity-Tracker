import React from 'react';
import LineGraph from './LineGraph';
import './Graph.css';

function Graph() {
  return (
    <div className="graph-page">
      <h1 className="page-header">Graph</h1>
      <div className="graph-container">
        <LineGraph />
      </div>
    </div>
  );
}

export default Graph; 