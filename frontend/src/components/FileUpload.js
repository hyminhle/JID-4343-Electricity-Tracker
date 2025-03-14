import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

const FileUpload = () => {
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previouslyUploadedFiles, setPreviouslyUploadedFiles] = useState([]);
  const fileInputRef = useRef(null);
  const dropAreaRef = useRef(null);

  // Fetch previously uploaded files on component mount
  useEffect(() => {
    fetchPreviouslyUploadedFiles();
  }, []);

  const fetchPreviouslyUploadedFiles = async () => {
    try {
      // In a real application, you would fetch this data from your server
      // This is mock data for demonstration purposes
      const mockData = [
        { 
          id: 1, 
          filename: 'january_2025.csv', 
          uploadDate: 'Mar 12, 2025', 
          size: '145 KB', 
          status: 'Processed' 
        },
        { 
          id: 2, 
          filename: 'february_2025.csv', 
          uploadDate: 'Mar 10, 2025', 
          size: '132 KB', 
          status: 'Processed' 
        },
        { 
          id: 3, 
          filename: 'december_2024.csv', 
          uploadDate: 'Mar 5, 2025', 
          size: '128 KB', 
          status: 'Processed' 
        }
      ];
      
      // Simulate API call delay
      setTimeout(() => {
        setPreviouslyUploadedFiles(mockData);
      }, 500);
      
    } catch (error) {
      console.error("Error fetching previously uploaded files:", error);
    }
  };

  // Handle drag events
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only set dragging to false if we're leaving the drop area
    if (e.currentTarget === dropAreaRef.current) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    // Filter for CSV files only
    const csvFiles = droppedFiles.filter(file => file.name.endsWith('.csv'));
    
    if (csvFiles.length < droppedFiles.length) {
      setError("Only CSV files are allowed. Some files were not added.");
    } else if (csvFiles.length === 0) {
      setError("Please select CSV files only.");
      return;
    }
    
    setFiles(prev => [...prev, ...csvFiles]);
    setUploadSuccess('');
  };

  const handleFileChange = (event) => {
    const selectedFiles = Array.from(event.target.files);
    // Filter for CSV files only
    const csvFiles = selectedFiles.filter(file => file.name.endsWith('.csv'));
    
    if (csvFiles.length < selectedFiles.length) {
      setError("Only CSV files are allowed. Some files were not added.");
    } else if (csvFiles.length === 0) {
      setError("Please select CSV files only.");
      return;
    }
    
    setFiles(prev => [...prev, ...csvFiles]);
    setUploadSuccess('');
    
    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = async () => {
    if (files.length === 0) {
      setError("Please select at least one file to upload");
      return;
    }

    setLoading(true);
    setError('');
    setUploadSuccess('');

    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file);
      });

      const response = await axios.post('http://localhost:5000/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setUploadSuccess('Files uploaded successfully!');
      setFiles([]);
      
      // After successful upload, refresh the previously uploaded files list
      fetchPreviouslyUploadedFiles();
    } catch (error) {
      setError(error.response?.data?.error || 'Error uploading files');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFile = (index) => {
    setFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleClearAll = () => {
    setFiles([]);
    setError('');
    setUploadSuccess('');
  };

  const handleDownloadFile = (filename) => {
    // In a real application, this would initiate a download from your server
    alert(`Downloading ${filename}...`);
  };

  return (
    <div className="file-upload-container">
      <div className="file-upload-header">
        <h2 className="upload-title">Data Upload</h2>
        <div className="file-count">
          <svg xmlns="http://www.w3.org/2000/svg" className="file-count-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          {files.length} file{files.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div 
        ref={dropAreaRef}
        className={`upload-area ${isDragging ? 'drag-active' : ''}`}
        onClick={() => fileInputRef.current.click()}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="file-input-hidden"
          accept=".csv"
          multiple
          disabled={loading}
        />
        <div className="upload-content">
          <svg xmlns="http://www.w3.org/2000/svg" className="upload-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          <div className="upload-instructions">
            <p className="upload-text">
              {isDragging ? 'Drop files here' : 'Drag & drop files or click to browse'}
            </p>
            <span className="upload-hint">CSV files only</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <svg xmlns="http://www.w3.org/2000/svg" className="error-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          {error}
        </div>
      )}

      {uploadSuccess && (
        <div className="success-message">
          <svg xmlns="http://www.w3.org/2000/svg" className="success-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          {uploadSuccess}
        </div>
      )}

      {files.length > 0 ? (
        <div className="file-preview">
          <div className="file-list-header">
            <span>File Name</span>
            <span>Size</span>
            <span></span>
          </div>
          {files.map((file, index) => (
            <div key={index} className="file-item">
              <div className="file-info">
                <svg xmlns="http://www.w3.org/2000/svg" className="file-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                <span className="file-name" title={file.name}>{file.name}</span>
              </div>
              <span className="file-size">{formatFileSize(file.size)}</span>
              <button 
                className="remove-file-btn" 
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveFile(index);
                }}
                title="Remove file"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="no-files-message">
          No files selected yet
        </div>
      )}

      <div className="action-buttons">
        <button 
          className="clear-button"
          onClick={handleClearAll}
          disabled={loading || files.length === 0}
        >
          Clear All
        </button>
        <button 
          className="upload-button" 
          onClick={handleFileUpload} 
          disabled={loading || files.length === 0}
        >
          {loading ? (
            <>
              <svg className="spinner" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray="60" strokeDashoffset="20" />
              </svg>
              Uploading...
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="upload-button-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              Upload Files
            </>
          )}
        </button>
      </div>

      {/* Previously Uploaded Files Section */}
      {/* <div className="previously-uploaded-section">
        <h3 className="section-title">Previously Uploaded Files</h3>
        <div className="previously-uploaded-table">
          <table>
            <thead>
              <tr>
                <th>Filename</th>
                <th>Upload Date</th>
                <th>Size</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {previouslyUploadedFiles.length > 0 ? (
                previouslyUploadedFiles.map((file) => (
                  <tr key={file.id}>
                    <td className="filename-cell">
                      <div className="file-info">
                        <svg xmlns="http://www.w3.org/2000/svg" className="file-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                          <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                        <span className="file-name">{file.filename}</span>
                      </div>
                    </td>
                    <td>{file.uploadDate}</td>
                    <td>{file.size}</td>
                    <td>
                      <span className={`status-badge ${file.status.toLowerCase()}`}>
                        {file.status}
                      </span>
                    </td>
                    <td>
                      <div className="action-icons">
                        <button 
                          className="action-button download"
                          onClick={() => handleDownloadFile(file.filename)}
                          title="Download"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="no-files">
                    No files have been uploaded yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div> */}
    </div>
  );
};

export default FileUpload;