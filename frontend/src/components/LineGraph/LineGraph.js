import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import Chart from 'chart.js/auto';
import annotationPlugin from 'chartjs-plugin-annotation';

Chart.register(annotationPlugin);

const LineGraph = () => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const [availableData, setAvailableData] = useState({});
  const [selectedBuilding, setSelectedBuilding] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [stats, setStats] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedDatasets, setSelectedDatasets] = useState([]);
  const [addError, setAddError] = useState(null); 
  const [primaryDataset, setPrimaryDataset] = useState(null);
  const [secondaryDataset, setSecondaryDataset] = useState(null);
  const [isAverageDisplayed, setIsAverageDisplayed] = useState(false);
  const [averageDataset, setAverageDataset] = useState(null);

  // Check if dark mode is enabled
  const isDarkMode = () => document.documentElement.getAttribute('data-theme') === 'dark';
  
  // Generate appropriate color based on theme
  const generateThemeAwareColor = () => {
    if (isDarkMode()) {
      // For dark mode: brighter, more saturated colors with higher opacity
      const r = Math.floor(Math.random() * 155) + 100; // 100-255 range for brighter red
      const g = Math.floor(Math.random() * 155) + 100; // 100-255 range for brighter green
      const b = Math.floor(Math.random() * 155) + 100; // 100-255 range for brighter blue
      return `rgba(${r}, ${g}, ${b}, 0.7)`; // Higher opacity for better visibility
    } else {
      // For light mode: standard colors
      return `rgba(${Math.floor(Math.random() * 250)}, ${Math.floor(Math.random() * 250)}, ${Math.floor(Math.random() * 250)}, 0.4)`;
    }
  };
  
  // Fetch available buildings, years, and months
  useEffect(() => {
    const fetchAvailableData = async () => {
      try {
        const response = await fetch('http://127.0.0.1:5000/get-available-data');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Available Data:', data);
        setAvailableData(data);
        setSelectedBuilding(Object.keys(data)[0] || '');

        // Load saved datasets from localStorage
        const savedDatasets = localStorage.getItem('selectedDatasets');
        if (savedDatasets) {
          setSelectedDatasets(JSON.parse(savedDatasets));
        }
        
        // Load saved stats from localStorage
        const savedStats = localStorage.getItem('stats');
        if (savedStats) {
          setStats(JSON.parse(savedStats));
        }

      } catch (error) {
        console.error('Error fetching available data:', error);
        setError('Failed to fetch available data');
        setAvailableData({});
      }
    };

    fetchAvailableData();


    // Theme change handler function
  const handleThemeChange = () => {
    if (!chartInstance.current) return;
    
    const darkMode = isDarkMode();
    
    // Update all datasets with theme-appropriate styling
    chartInstance.current.data.datasets.forEach(dataset => {
      // Determine if this is a special dataset
      const isAverageDataset = dataset.label === 'Average Aggregate';
      const isPredictionDataset = dataset.label === 'Future Prediction';
      
      // Extract RGB values from current color to preserve dataset identity
      const rgbaMatch = dataset.borderColor?.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d*(?:\.\d+)?))?\)/);
      
      if (rgbaMatch) {
        const r = parseInt(rgbaMatch[1]);
        const g = parseInt(rgbaMatch[2]);
        const b = parseInt(rgbaMatch[3]);
        let a = rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1;
        
        // Adjust colors for dark mode
        const adjustedR = darkMode ? Math.min(r + 50, 255) : r;
        const adjustedG = darkMode ? Math.min(g + 50, 255) : g;
        const adjustedB = darkMode ? Math.min(b + 50, 255) : b;
        const adjustedA = darkMode ? Math.min(a + 0.2, 0.9) : a;
        
        const newColor = `rgba(${adjustedR}, ${adjustedG}, ${adjustedB}, ${adjustedA})`;
        
        // Apply updated styling
        dataset.borderColor = newColor;
        dataset.pointBackgroundColor = newColor;
        dataset.borderWidth = darkMode ? 2 : 1.5;
        dataset.pointRadius = darkMode ? 2 : 1;
        
        // Special handling for comparison fills
        if (dataset.fill && typeof dataset.fill === 'object') {
          dataset.fill = {
            ...dataset.fill,
            above: darkMode ? 'rgba(20, 255, 0, 0.5)' : 'rgba(20, 255, 0, 0.3)',
            below: darkMode ? 'rgba(255, 0, 0, 0.5)' : 'rgba(255, 0, 0, 0.3)',
          };
        }
      }
    });
    
    // Update global chart options
    updateChartTheme();
  };

    // Setup theme change observer
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme' && chartInstance.current) {
          updateChartTheme();
        }
      });
    });
    
    observer.observe(document.documentElement, { attributes: true });
    
    return () => observer.disconnect();
  }, []);

  // Function to update chart theme
  const updateChartTheme = () => {
    if (!chartInstance.current) return;
    
    const darkMode = isDarkMode();
    
    // Update chart theme settings
    chartInstance.current.options.scales.x.grid.color = darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    chartInstance.current.options.scales.x.ticks.color = darkMode ? 'var(--text-primary)' : 'var(--text-primary)';
    chartInstance.current.options.scales.y.grid.color = darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    chartInstance.current.options.scales.y.ticks.color = darkMode ? 'var(--text-primary)' : 'var(--text-primary)';
    chartInstance.current.options.plugins.legend.labels.color = darkMode ? 'var(--text-primary)' : 'var(--text-primary)';
    chartInstance.current.options.plugins.title.color = darkMode ? 'var(--text-primary)' : 'var(--text-primary)';
    
    // Update dataset colors if in dark mode to make them more visible
    if (darkMode) {
      chartInstance.current.data.datasets.forEach(dataset => {
        // Extract RGB values from current color
        const rgbaMatch = dataset.borderColor?.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d*(?:\.\d+)?))?\)/);
        if (rgbaMatch) {
          const r = parseInt(rgbaMatch[1]);
          const g = parseInt(rgbaMatch[2]);
          const b = parseInt(rgbaMatch[3]);
          let a = rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1;
          
          // Make colors brighter for dark mode
          const brightR = Math.min(r + 50, 255);
          const brightG = Math.min(g + 50, 255);
          const brightB = Math.min(b + 50, 255);
          a = Math.min(a + 0.2, 0.9); // Increase opacity for better visibility
          
          dataset.borderColor = `rgba(${brightR}, ${brightG}, ${brightB}, ${a})`;
          dataset.pointBackgroundColor = `rgba(${brightR}, ${brightG}, ${brightB}, ${a})`;
          
          // If dataset has fill property as an object (for comparison)
          if (typeof dataset.fill === 'object' && dataset.fill !== null) {
            dataset.fill = {
              ...dataset.fill,
              above: darkMode ? 'rgba(20, 255, 0, 0.5)' : 'rgba(20, 255, 0, 0.3)', // Brighter green in dark mode
              below: darkMode ? 'rgba(255, 0, 0, 0.5)' : 'rgba(255, 0, 0, 0.3)', // Brighter red in dark mode
            };
          }
        }
      });
    }
    
    chartInstance.current.update();
  };

  const saveDatasetsToLocalStorage = (datasets) => {
    localStorage.setItem('selectedDatasets', JSON.stringify(datasets));
  };
  
  // Add function to save stats to localStorage
  const saveStatsToLocalStorage = (statsData) => {
    localStorage.setItem('stats', JSON.stringify(statsData));
  };
  
  // Add this function to handle adding new datasets
  const addDataset = async () => {
    if (!selectedBuilding || !selectedYear || !selectedMonth) {
      setAddError('Please select building, year, and month before adding to graph.');
      return;
    }
    console.log('Selected Building:', selectedBuilding);
    // Check if this combination already exists
    const exists = selectedDatasets.some(
      ds => ds.building === selectedBuilding && 
            ds.year === selectedYear && 
            ds.month === selectedMonth
    );

    if (exists) {
      setAddError('This dataset is already displayed on the graph.');
      return;
    }

    setLoading(true);
    const API_URL = `http://127.0.0.1:5000/fetch-data/${selectedYear}/${selectedMonth}/0/${selectedBuilding}`;

    try {
      const response = await fetch(API_URL);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      // Generate a theme-aware color for the new dataset
      const randomColor = generateThemeAwareColor();

      const newDataset = {
        building: selectedBuilding,
        year: selectedYear,
        month: selectedMonth,
        data: data,
        color: randomColor,
        borderDash: (selectedBuilding === 'Prediction' || selectedBuilding === 'Average Aggregate') ? [] : [5, 5],
      };
      console.log("New Data Set:", newDataset);

      // Calculate and set statistics for the new dataset
      const datasetStats = calculateDatasetStatistics(newDataset);
      const updatedStats = {
        ...stats,
        [`${selectedBuilding}-${selectedYear}-${selectedMonth}`]: {
          label: `${selectedBuilding} - ${selectedMonth}/${selectedYear}`,
          ...datasetStats
        }
      };
      
      setStats(updatedStats);
      saveStatsToLocalStorage(updatedStats); // Save updated stats to localStorage
      
      console.log("Data Set Stats:", datasetStats);
      
      setAddError(null);

      setSelectedDatasets(prev => {
        const updatedDatasets = [...prev, newDataset];
        saveDatasetsToLocalStorage(updatedDatasets);
        return updatedDatasets;
      });

    } catch (error) {
      console.error('Error fetching data:', error);
      setAddError(`Failed to fetch data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Modify the chart update effect
  useEffect(() => {
    if (loading || error || selectedDatasets.length === 0) {
      // If no datasets are available, destroy the chart instance
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
      return;
    }
  
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }
  
    const ctx = chartRef.current.getContext('2d');
    const darkMode = isDarkMode();
  
    // Create datasets array for the chart
    const datasets = selectedDatasets.map((ds) => ({
      label: ds.building === 'Prediction' ? 'Future Prediction' : 
             (ds.label || `${ds.building} - ${ds.month}/${ds.year}`),
      data: ds.data.map((entry) => entry.consumption),
      borderColor: ds.borderColor || ds.color,
      backgroundColor: ds.backgroundColor || 'transparent',
      tension: 0.1,
      fill: ds.fill || false,
      borderDash: (ds.building === 'Prediction' || ds.label === 'Average Aggregate') ? [] : [5, 5],
      borderWidth: darkMode ? 2 : 1.5, // Slightly thicker lines in dark mode
      pointBackgroundColor: ds.pointBackgroundColor || ds.color,
      pointRadius: darkMode ? 2 : 1, // Larger points in dark mode
      pointStyle: ds.pointStyle || 'circle',
    }));
  
    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: selectedDatasets[0].data.map((entry) => new Date(entry.date).getDate()),
        datasets: datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Electricity Consumption Comparison',
            font: {
              size: 16,
              weight: 'bold',
            },
            color: darkMode ? 'var(--text-primary)' : 'var(--text-primary)',
          },
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: darkMode ? 'var(--text-primary)' : 'var(--text-primary)',
              font: {
                size: darkMode ? 13 : 12, // Slightly larger in dark mode
              }
            },
          },
          tooltip: {
            backgroundColor: darkMode ? 'rgba(45, 55, 72, 0.9)' : 'rgba(255, 255, 255, 0.9)',
            titleColor: darkMode ? 'var(--text-primary)' : 'var(--text-primary)',
            bodyColor: darkMode ? 'var(--text-primary)' : 'var(--text-primary)',
            borderColor: darkMode ? 'var(--border-color)' : 'var(--border-color)',
            borderWidth: 1,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Consumption (kWh)',
              color: darkMode ? 'var(--text-primary)' : 'var(--text-primary)',
              font: {
                size: 14,
                weight: 'bold',
              },
            },
            grid: {
              color: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            },
            ticks: {
              color: darkMode ? 'var(--text-primary)' : 'var(--text-primary)',
            }
          },
          x: {
            title: {
              display: true,
              text: 'Days',
              color: darkMode ? 'var(--text-primary)' : 'var(--text-primary)',
              font: {
                size: 14,
                weight: 'bold',
              },
            },
            grid: {
              color: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            },
            ticks: {
              color: darkMode ? 'var(--text-primary)' : 'var(--text-primary)',
            }
          },
        },
      },
    });
  
  }, [selectedDatasets, loading, error]);

  const removeDataset = (index) => {
    setSelectedDatasets((prev) => {
      const updatedDatasets = prev.filter((_, i) => i !== index);
      const removedDataset = prev[index];

      // Remove statistics for the removed dataset
      setStats((prevStats) => {
        const newStats = { ...prevStats };
        // If the dataset is the prediction dataset
        if (removedDataset.building === 'Prediction') {
          delete newStats['Prediction-Future'];
        } else if (removedDataset.label === 'Average Aggregate') {
          delete newStats['Average-Aggregate'];
        } else {
          delete newStats[`${removedDataset.building}-${removedDataset.year}-${removedDataset.month}`];
        }
        saveStatsToLocalStorage(newStats); // Save updated stats to localStorage
        return newStats;
      });
      
      saveDatasetsToLocalStorage(updatedDatasets);
      return updatedDatasets;
    });
  };
  
  const calculateAverageAggregate = () => {
    if (selectedDatasets.length === 0) {
      setAddError('No datasets available to calculate an average aggregate.');
      return;
    }
  
    // Determine the number of days from the first dataset
    const numDays = Math.max(...selectedDatasets.map((dataset) => dataset?.data?.length || 0));
  
    if (numDays === 0) {
      setAddError('Selected datasets do not have valid data.');
      return;
    }
  
    const aggregateData = Array(numDays).fill(0);
    const counts = Array(numDays).fill(0);
    
    // Get dates from the first dataset to ensure consistent date format
    const dateReferences = selectedDatasets[0].data.map(entry => entry.date);
  
    selectedDatasets.forEach((dataset) => {
      let lastDefinedValue = 0;
      dataset.data.forEach((entry, index) => {
        const value = entry?.consumption !== undefined ? entry.consumption : lastDefinedValue;
        if (entry?.consumption !== undefined) {
          lastDefinedValue = entry.consumption;
        }
        aggregateData[index] += value;
        counts[index] += 1;
      });
    });
  
    const averageData = aggregateData.map((total, index) => total / counts[index]);
    
    // Create formatted data with consistent date structure
    const formattedData = averageData.map((value, i) => ({
      date: dateReferences[i] || new Date().toISOString(), // Use reference dates or fallback
      consumption: value
    }));
  
    console.log('Average Data:', formattedData);
  
    // Generate appropriate color for dark/light mode
    const averageColor = isDarkMode() ? 'rgba(40, 250, 80, 0.8)' : 'rgba(8, 252, 57, 0.6)';
  
    // Create the average dataset
    const averageDataset = {
      label: 'Average Aggregate',
      data: formattedData,
      building: 'Data',
      year: selectedDatasets.length + ' Months',
      month: 'Aggregate Average',
      color: averageColor,
      borderColor: averageColor,
      pointBackgroundColor: averageColor,
      tension: 0.1,
      borderWidth: isDarkMode() ? 2 : 1.5,
      pointRadius: isDarkMode() ? 2 : 1,
      fill: false,
    };
  
    const averageStats = calculateDatasetStatistics(averageDataset);
  
    // Add the average dataset to the selectedDatasets array
    setSelectedDatasets((prev) => {
      const newDatasets = [...prev, averageDataset];
      saveDatasetsToLocalStorage(newDatasets);
      return newDatasets;
    });
  
    // Update stats with average aggregate data
    setStats((prev) => {
      const updatedStats = {
        ...prev,
        'Average-Aggregate': {
          label: 'Average Aggregate',
          ...averageStats
        }
      };
      saveStatsToLocalStorage(updatedStats);
      return updatedStats;
    });
  
    setIsAverageDisplayed(true);
    setAverageDataset(averageDataset);
    setError(null);
  };
  
  const fetchPrediction = async () => {
    if (!selectedDatasets.length) {
      setAddError('No data available for prediction.');
      return;
    }
    setLoading(true);
    // Extract relevant data for the predictor
    const selectedData = selectedDatasets.map(ds => ({
      building: ds.building,
      year: ds.year,
      month: ds.month,
      data: ds.data.map(entry => ({
        date: entry.date,
        consumption: entry.consumption
      }))
    }));
    try {
      const response = await fetch('http://127.0.0.1:5000/predict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ datasets: selectedData }),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const predictionData = await response.json();
      console.log('Prediction Data:', predictionData);
      // Format the prediction data for the graph
      const formattedPredictions = predictionData.predictions.map(prediction => ({
        date: prediction.ds, // Ensure this matches the format used in the graph
        consumption: prediction.Final_Prediction, // Ensure this matches the key used in the graph
      }));
      console.log('Formatted Predictions:', formattedPredictions);

      // Append prediction results to the graph
      const predictionDataset = {
        building: 'Prediction',
        year: 'Future',
        month: '',
        label: 'Future Prediction', // Set custom label here
        data: formattedPredictions,
        color: 'rgba(29, 67, 205, 0.82)',
        evaluation: predictionData.evaluation,
      };
      console.log('Prediction Dataset:', predictionDataset);

      setSelectedDatasets((prev) => {
        const newDatasets = [...prev, predictionDataset];
        saveDatasetsToLocalStorage(newDatasets);
        return newDatasets;
      });

      // Calculate and set statistics for the prediction dataset
      const predictionStats = calculateDatasetStatistics(predictionDataset);
      setStats(prev => {
        const updatedStats = {
          ...prev,
          'Prediction-Future': {
            label: 'Future Prediction', // Update label here too
            ...predictionStats
          }
        };
        saveStatsToLocalStorage(updatedStats); // Save updated stats to localStorage
        return updatedStats;
      });
      
      setError(null);
    } catch (error) {
      console.error('Error fetching prediction:', error);
      setAddError(`Prediction failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  //Calculate statistics for the statistics box
  const calculateDatasetStatistics = (dataset) => {
    // Check if the dataset is the prediction dataset
    if (dataset.building === 'Prediction') {
      const consumptionValues = dataset.data.slice(0,30).map(entry => entry.consumption);
      const average = consumptionValues.reduce((a, b) => a + b, 0) / consumptionValues.length;
      const max = Math.max(...consumptionValues);
      const min = Math.min(...consumptionValues);
      const total = consumptionValues.reduce((a, b) => a + b, 0);
      const meanAbsoluteError = dataset.evaluation?.mean_absolute_error || 0;
      const rootMeanSquaredError = dataset.evaluation?.root_mean_squared_error || 0;
      const percentageMAE = dataset.evaluation?.percentage_mae || 0;
      const percentageRMSE = dataset.evaluation?.percentage_rmse || 0;

      return {
        label: dataset.label || 'Future Prediction', // Changed label here
        average: average.toFixed(2),
        max: max.toFixed(2),
        min: min.toFixed(2),
        total: total.toFixed(2),
        meanAbsoluteError: meanAbsoluteError.toFixed(2),
        rootMeanSquaredError: rootMeanSquaredError.toFixed(2),
        percentageMAE: percentageMAE.toFixed(2),
        percentageRMSE: percentageRMSE.toFixed(2),
      };
    } else if (dataset.label === 'Average Aggregate') {
      // For Average Aggregate, take only the first 30 values
      const consumptionValues = dataset.data.slice(0, 30).map(entry => entry.consumption);
      const average = consumptionValues.reduce((a, b) => a + b, 0) / consumptionValues.length;
      const max = Math.max(...consumptionValues);
      const min = Math.min(...consumptionValues);
      const total = consumptionValues.reduce((a, b) => a + b, 0);
  
      return {
        label: dataset.label,
        average: average.toFixed(2),
        max: max.toFixed(2),
        min: min.toFixed(2),
        total: total.toFixed(2)
      };
    } else {
      const consumptionValues = dataset.data.map(entry => entry.consumption);
      const average = consumptionValues.reduce((a, b) => a + b, 0) / consumptionValues.length;
      const max = Math.max(...consumptionValues);
      const min = Math.min(...consumptionValues);
      const total = consumptionValues.reduce((a, b) => a + b, 0);
  
      return {
        label: dataset.label || `${dataset.building} - ${dataset.month}/${dataset.year}`,
        average: average.toFixed(2),
        max: max.toFixed(2),
        min: min.toFixed(2),
        total: total.toFixed(2)
      };
    }
  };

  const compareDatasets = () => {
    if (primaryDataset === null || secondaryDataset === null) {
      setAddError('Please select both primary and secondary datasets for comparison.');
      return;
    }
  
    if (!chartInstance.current) {
      setAddError('Chart is not initialized.');
      return;
    }
  
    // Generate appropriate colors based on theme
    const darkMode = isDarkMode();
    const aboveColor = darkMode ? 'rgba(20, 255, 0, 0.5)' : 'rgba(20, 255, 0, 0.3)'; // Brighter green in dark mode
    const belowColor = darkMode ? 'rgba(255, 0, 0, 0.5)' : 'rgba(255, 0, 0, 0.3)'; // Brighter red in dark mode
  
    // Update the datasets with fill properties
    chartInstance.current.data.datasets.forEach((dataset, index) => {
      if (index === primaryDataset) {
        dataset.fill = {
          target: secondaryDataset, // Fill relative to the secondary dataset
          above: aboveColor, // Green for areas above the secondary dataset
          below: belowColor, // Red for areas below the secondary dataset
        };
        // Make the primary dataset line slightly thicker for emphasis
        dataset.borderWidth = darkMode ? 2.5 : 2;
        dataset.pointRadius = darkMode ? 3 : 2;
      } else if (index === secondaryDataset) {
        dataset.fill = false; // Ensure the secondary dataset doesn't fill
        // Make the secondary dataset line slightly thicker too
        dataset.borderWidth = darkMode ? 2.5 : 2;
        dataset.pointRadius = darkMode ? 3 : 2;
      } else {
        // Reset other datasets to default appearance
        dataset.fill = false;
        dataset.borderWidth = darkMode ? 2 : 1.5;
        dataset.pointRadius = darkMode ? 2 : 1;
      }
    });
  
    // Update the chart to reflect the changes
    chartInstance.current.update();
  
    // Show a visual indicator of the comparison
    setAddError(null); // Clear any previous errors
  };



  const togglePrimaryDataset = (index) => {
    setPrimaryDataset(prev => prev === index ? null : index);
  };
  

  const toggleSecondaryDataset = (index) => {
    setSecondaryDataset(prev => prev === index ? null : index);
  };

  const resetComparison = () => {
    if (!chartInstance.current) return;
    
    const darkMode = isDarkMode();
    
    // Reset all datasets to their default appearance
    chartInstance.current.data.datasets.forEach((dataset) => {
      dataset.fill = false;
      dataset.borderWidth = darkMode ? 2 : 1.5;
      dataset.pointRadius = darkMode ? 2 : 1;
    });
    
    // Reset the selected datasets
    setPrimaryDataset(null);
    setSecondaryDataset(null);
    
    // Update the chart
    chartInstance.current.update();
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <select
          className="data-select"
          value={selectedBuilding}
          onChange={(e) => {
            setSelectedBuilding(e.target.value);
            setSelectedYear('');
            setSelectedMonth('');
          }}
        >
          <option value="" disabled>
            Select Building
          </option>
          {Object.keys(availableData).map((building) => (
            <option key={building} value={building}>
              {building}
            </option>
          ))}
        </select>
  
        <select
          value={selectedYear}
          className="data-select"
          onChange={(e) => {
            setSelectedYear(e.target.value);
            setSelectedMonth('');
          }}
          disabled={!selectedBuilding}
        >
          <option value="" disabled>
            Select Year
          </option>
          {selectedBuilding &&
            Object.keys(availableData[selectedBuilding] || {}).map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
        </select>
  
        <select
          value={selectedMonth}
          className="data-select"
          onChange={(e) => setSelectedMonth(e.target.value)}
          disabled={!selectedYear}
        >
          <option value="" disabled>
            Select Month
          </option>
          {selectedBuilding &&
            selectedYear &&
            Object.keys(availableData[selectedBuilding][selectedYear]).map((month) => {
              const monthNum = parseInt(month, 10); // Parsing to ensure it's an integer
              const monthNames = [
                'January', 'February', 'March', 'April', 'May', 'June', 'July',
                'August', 'September', 'October', 'November', 'December'
              ];
  
              return (
                <option key={month} value={monthNum}>
                  {monthNames[monthNum - 1]} {/* Display corresponding month name */}
                </option>
              );
            })}
        </select>
        <button 
          onClick={addDataset} 
          disabled={loading}
          className="action-button"
        >
          Add to Graph
        </button>
        {addError && <p style={{ color: 'var(--error-color, red)' }}>{addError}</p>}
      </div>
      {/* Display active datasets */}
      <div style={{ marginBottom: '20px' }}>
        {selectedDatasets.map((dataset, index) => (
          <div
            key={index}
            className="dataset-card"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '5px',
              padding: '5px',
              backgroundColor: 'var(--card-background)',
              borderRadius: '4px',
              boxShadow: 'var(--box-shadow)',
              color: 'var(--text-primary)'
            }}
          >
            <div
              style={{
                width: '20px',
                height: '20px',
                backgroundColor: dataset.color,
                borderRadius: '50%',
              }}
            />
            <span>
              {dataset.building === 'Prediction' ? 'Future Prediction' : 
               (dataset.label || `${dataset.building} - ${dataset.month}/${dataset.year}`)}
            </span>
            <button
              onClick={() => togglePrimaryDataset(index)}
              className="toggle-button"
              style={{
                marginLeft: 'auto',
                padding: '2px 8px',
                borderRadius: '4px',
                border: `1px solid var(--border-color)`,
                backgroundColor: primaryDataset === index ? 'var(--button-bg-color)' : 'var(--card-background)',
                color: primaryDataset === index ? 'var(--button-text-color)' : 'var(--text-primary)',
              }}
            >
              Primary
            </button>
            <button
              onClick={() => toggleSecondaryDataset(index)}
              className="toggle-button"
              style={{
                marginLeft: '10px',
                padding: '2px 8px',
                borderRadius: '4px',
                border: `1px solid var(--border-color)`,
                backgroundColor: secondaryDataset === index ? 'var(--button-bg-color)' : 'var(--card-background)',
                color: secondaryDataset === index ? 'var(--button-text-color)' : 'var(--text-primary)',
              }}
            >
              Secondary
            </button>
            
            <button
              onClick={() => removeDataset(index)}
              className="remove-button"
              style={{
                marginLeft: '10px',
                padding: '2px 8px',
                borderRadius: '4px',
                border: `1px solid var(--border-color)`,
                backgroundColor: 'var(--card-background)',
                color: 'var(--text-primary)',
              }}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button  
          onClick={fetchPrediction} 
          disabled={loading}
          className="action-button"
        >
          {loading ? 'Predicting...' : 'Predict'}
        </button>
        
        <button
          onClick={() => calculateAverageAggregate()}
          disabled={selectedDatasets.length === 0}
          className="action-button"
        >
          Display Average Aggregate
        </button>
  
        <button 
          onClick={compareDatasets}
          className="action-button"
        >
          Compare
        </button>
      </div>
      <div style={{
        display: 'flex',
        gap: '20px',
        alignItems: 'flex-start'
      }}>
        <div style={{
          flex: '1',
          minWidth: '0',
          height: '600px',
          backgroundColor: 'var(--card-background)',
          borderRadius: '8px',
          boxShadow: 'var(--box-shadow)',
          padding: '16px'
        }}>
          <canvas ref={chartRef}></canvas>
        </div>
        {Object.keys(stats).length > 0 && (
        <div style={{
            width: '320px',  
            padding: '20px',  
            backgroundColor: 'var(--card-background)',
            borderRadius: '8px',
            boxShadow: 'var(--box-shadow)',
            maxHeight: '600px',
            overflowY: 'auto',
            color: 'var(--text-primary)'
        }}>
            <h3>Statistics</h3>
            {Object.entries(stats).map(([key, statData], index) => (
            <div key={index} style={{ 
                marginBottom: '15px', 
                padding: '10px', 
                backgroundColor: 'var(--sidebar-bg)', 
                borderRadius: '4px',
                boxShadow: 'var(--box-shadow)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{
                        width: '15px',
                        height: '15px',
                        backgroundColor: selectedDatasets.find(ds => 
                          (ds.building === 'Prediction' && key === 'Prediction-Future') ||
                          (ds.label === 'Average Aggregate' && key === 'Average-Aggregate') ||
                          (`${ds.building}-${ds.year}-${ds.month}` === key))?.color || 'transparent',
                        borderRadius: '3px',
                        marginRight: '10px'
                    }} />
                    <h4>{statData.label}</h4>
                </div>
                <p><strong>Average:</strong> {statData.average} kWh</p>
                <p><strong>Max:</strong> {statData.max} kWh</p>
                <p><strong>Min:</strong> {statData.min} kWh</p>
                <p><strong>Total:</strong> {statData.total} kWh</p>
                {statData.meanAbsoluteError && (
                    <p><strong>Mean Absolute Error:</strong> {statData.meanAbsoluteError}</p>
                )}
                {statData.percentageMAE && (
                    <p><strong>MAE percentage:</strong> {statData.percentageMAE}%</p>
                )}
                {statData.rootMeanSquaredError && (
                    <p><strong>Root Mean Squared Error:</strong> {statData.rootMeanSquaredError}</p>
                )}
                {statData.percentageRMSE && (
                    <p><strong>RMSE percentage:</strong> {statData.percentageRMSE}%</p>
                )}
            </div>
            ))}
        </div>
        )}
      </div>
    </div>
  );
  };
  
  // Add CSS classes for buttons and inputs
  const styles = document.createElement('style');
  styles.textContent = `
    .action-button {
      margin-bottom: 5px;
      padding: 8px 12px;
      background-color: var(--button-bg-color);
      color: var(--button-text-color);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      transition: background-color 0.3s ease, color 0.3s ease;
    }
  
    .action-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  
    .action-button:not(:disabled):hover {
      background-color: var(--button-hover-bg-color);
    }
  
    .data-select {
      padding: 8px;
      border-radius: 4px;
      border: 1px solid var(--border-color);
      background-color: var(--input-bg-color);
      color: var(--text-primary);
    }
  
    .dataset-card {
      transition: background-color 0.3s ease, box-shadow 0.3s ease;
    }
  
    /* Ensure chart colors are appropriate for dark mode */
    @media (prefers-color-scheme: dark) {
      .chartjs-render-monitor {
        filter: invert(1) hue-rotate(180deg);
      }
    }
  `;
  document.head.appendChild(styles);
  
  export default LineGraph;