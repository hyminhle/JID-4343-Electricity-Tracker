import React, { useState, useRef } from 'react';
import axios from 'axios';

const FileUploadWidget = () => {
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
      files.forEach((file) => {
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

  const clearSelection = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setFiles([]);
    setError('');
    setUploadSuccess('');
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 w-full max-w-xl">
      <div className="flex items-center justify-between mb-4">
        {files.length > 0 && (
          <span className="text-sm font-medium text-blue-600">
            {files.length} file{files.length !== 1 ? 's' : ''} selected
          </span>
        )}
      </div>
      
      <div className="mb-6">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-500 transition-colors">
          <input
            type="file"
            onChange={handleFileChange}
            ref={fileInputRef}
            accept=".csv"
            multiple
            disabled={loading}
            className="hidden"
            id="fileInput"
          />
          <label 
            htmlFor="fileInput"
            className="cursor-pointer flex flex-col items-center justify-center py-3"
          >
            <span className="text-sm font-medium text-gray-700">
              {files.length > 0 ? 'Change selection' : 'Drop CSV files here or click to browse'}
            </span>
            <span className="text-xs text-gray-500 mt-1">
              Only CSV files are supported
            </span>
          </label>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm">
          <p>{error}</p>
        </div>
      )}

      {uploadSuccess && (
        <div className="mb-4 p-3 bg-green-50 border-l-4 border-green-500 text-green-700 text-sm">
          <p>{uploadSuccess}</p>
        </div>
      )}

      <div className="flex justify-between">
        {files.length > 0 && (
          <button
            onClick={clearSelection}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
          >
            Clear
          </button>
        )}
        
        <button 
          onClick={handleFileUpload} 
          disabled={loading || files.length === 0}
          className={`ml-auto px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${
            loading || files.length === 0 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
          }`}
        >
          {loading ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Uploading...
            </span>
          ) : 'Upload Files'}
        </button>
      </div>
    </div>
  );
};

export default FileUploadWidget;