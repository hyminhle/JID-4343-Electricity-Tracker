import React, { useState, useRef } from 'react';
import axios from 'axios';

const FileUpload = () => {
  const [files, setFiles] = useState({
    month1: null,
    month2: null
  });
  const [error, setError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRefs = {
    month1: useRef(null),
    month2: useRef(null)
  };

  const validateFile = (file) => {
    if (!file.name.endsWith('.csv')) {
      throw new Error('Please select a CSV file');
    }
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error('File size must be less than 5MB');
    }
  };

  const handleFileChange = (month) => (event) => {
    try {
      const selectedFile = event.target.files[0];
      if (!selectedFile) return;

      validateFile(selectedFile);
      setFiles(prev => ({
        ...prev,
        [month]: selectedFile
      }));
      setError('');
      setUploadSuccess('');
    } catch (err) {
      setError(err.message);
      if (fileInputRefs[month].current) {
        fileInputRefs[month].current.value = '';
      }
      setFiles(prev => ({
        ...prev,
        [month]: null
      }));
    }
  };

  const handleFileUpload = async () => {
    if (!files.month1 && !files.month2) {
      setError("Please select at least one file to upload");
      return;
    }

    setLoading(true);
    setError('');
    setUploadSuccess('');

    try {
      const formData = new FormData();
      if (files.month1) {
        formData.append('file1', files.month1);
      }
      if (files.month2) {
        formData.append('file2', files.month2);
      }

      const response = await axios.post('http://localhost:5000/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setUploadSuccess('Files uploaded successfully!');
      Object.values(fileInputRefs).forEach(ref => {
        if (ref.current) {
          ref.current.value = '';
        }
      });
      setFiles({ month1: null, month2: null });
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
          }}>Month 1</h3>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <input
              type="file"
              onChange={handleFileChange('month1')}
              ref={fileInputRefs.month1}
              accept=".csv"
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
              color: files.month1 ? '#28a745' : '#6c757d',
              fontSize: '14px'
            }}>
              {files.month1 ? '✓ Selected' : 'No file'}
            </div>
          </div>
        </div>

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
          }}>Month 2</h3>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <input
              type="file"
              onChange={handleFileChange('month2')}
              ref={fileInputRefs.month2}
              accept=".csv"
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
              color: files.month2 ? '#28a745' : '#6c757d',
              fontSize: '14px'
            }}>
              {files.month2 ? '✓ Selected' : 'No file'}
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
          disabled={loading || (!files.month1 && !files.month2)}
          style={{
            padding: '10px 20px',
            backgroundColor: loading || (!files.month1 && !files.month2) ? '#6c757d' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading || (!files.month1 && !files.month2) ? 'not-allowed' : 'pointer',
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
