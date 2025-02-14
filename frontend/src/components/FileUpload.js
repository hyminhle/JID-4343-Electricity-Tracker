import React, { useState, useRef } from 'react';
import axios from 'axios';

const FileUpload = () => {
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (event) => {
    const selectedFiles = Array.from(event.target.files);
    setFiles(selectedFiles);
    setError('');
    setUploadSuccess('');
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
      files.forEach((file, index) => {
        formData.append('files', file);
      });

      const response = await axios.post('http://localhost:5000/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setUploadSuccess('Files uploaded successfully!');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setFiles([]);
    } catch (error) {
      setError(error.response?.data?.error || 'Error uploading files');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      backgroundColor: '#f8f9fa',
      padding: '20px',
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      fontFamily: "'Roboto', 'Segoe UI', sans-serif",
      marginBottom: '20px'
    }}>
      <h2 style={{
        margin: '0 0 20px 0',
        color: '#2c3e50',
        fontSize: '24px',
        fontWeight: '500',
        borderBottom: '2px solid #dee2e6',
        paddingBottom: '10px'
      }}>Data Upload</h2>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        marginBottom: '20px'
      }}>
        <div style={{
          flex: 1,
          backgroundColor: '#ffffff',
          padding: '15px',
          borderRadius: '6px',
          border: '1px solid #dee2e6'
        }}>
          <h3 style={{
            margin: '0 0 10px 0',
            color: '#2c3e50',
            fontSize: '18px',
            fontWeight: '500'
          }}>Select Files</h3>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <input
              type="file"
              onChange={handleFileChange}
              ref={fileInputRef}
              accept=".csv"
              multiple
              disabled={loading}
              style={{
                flex: '1',
                padding: '8px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                backgroundColor: '#fff',
                color: '#495057',
                fontSize: '14px'
              }}
            />
            <div style={{
              color: files.length > 0 ? '#28a745' : '#6c757d',
              fontSize: '14px'
            }}>
              {files.length > 0 ? `${files.length} file(s) selected` : 'No files'}
            </div>
          </div>
        </div>
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <button 
          onClick={handleFileUpload} 
          disabled={loading || files.length === 0}
          style={{
            padding: '10px 20px',
            backgroundColor: loading || files.length === 0 ? '#6c757d' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading || files.length === 0 ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: '500',
            transition: 'background-color 0.2s'
          }}
        >
          {loading ? 'Uploading...' : 'Upload Files'}
        </button>

        <div style={{ flex: '1', marginLeft: '20px' }}>
          {error && (
            <div style={{
              color: '#dc3545',
              padding: '10px',
              backgroundColor: '#f8d7da',
              borderRadius: '4px',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}
          {uploadSuccess && (
            <div style={{
              color: '#28a745',
              padding: '10px',
              backgroundColor: '#d4edda',
              borderRadius: '4px',
              fontSize: '14px'
            }}>
              {uploadSuccess}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileUpload;