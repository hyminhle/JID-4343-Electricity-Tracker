import React from 'react';
import FileUpload from './FileUpload';
import './Submit.css';

function Submit() {
  return (
    <div className="submit-page">
      <h1>Submit Energy Data</h1>
      <div className="submit-container">
        <div className="upload-section">
          <FileUpload />
        </div>
      </div>
    </div>
  );
}

export default Submit; 