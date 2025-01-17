import React from 'react';
import FileUpload from './components/FileUpload';
import LineGraph from './components/LineGraph';
import './App.css';

function App() {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f0f2f5',
      padding: '40px 20px',
      fontFamily: "'Roboto', 'Segoe UI', sans-serif"
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
      }}>
        <header style={{
          marginBottom: '30px',
          textAlign: 'center'
        }}>
          <h1 style={{
            color: '#2c3e50',
            fontSize: '32px',
            fontWeight: '500',
            margin: '0 0 10px 0'
          }}>
            Electricity Consumption Tracker
          </h1>
          <p style={{
            color: '#6c757d',
            fontSize: '16px',
            margin: 0
          }}>
          </p>
        </header>

        <main>
          <FileUpload />
          <LineGraph />
        </main>

        <footer style={{
          marginTop: '40px',
          textAlign: 'center',
          color: '#6c757d',
          fontSize: '14px',
          borderTop: '1px solid #dee2e6',
          paddingTop: '20px'
        }}>
          <p style={{ margin: 0 }}>
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;