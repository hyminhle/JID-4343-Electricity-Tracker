import React, { useEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import annotationPlugin from 'chartjs-plugin-annotation';
import './LineGraph.css';

Chart.register(annotationPlugin);

const LineGraph = () => {
  const chartRef = useRef(null);
  const [availableData, setAvailableData] = useState({});
  const [selectedBuilding, setSelectedBuilding] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [stats, setStats] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [chartInstance, setChartInstance] = useState(null);
  const [selectedDatasets, setSelectedDatasets] = useState([]);
  const [addError, setAddError] = useState(null); 
  const [primaryDataset, setPrimaryDataset] = useState(null);
  const [secondaryDataset, setSecondaryDataset] = useState(null);
  const [isAverageDisplayed, setIsAverageDisplayed] = useState(false);
  const [averageDataset, setAverageDataset] = useState(null);
  const [showGrid, setShowGrid] = useState(true);
  
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

        // Load saved grid preference from localStorage
        const savedGridPreference = localStorage.getItem('showGrid');
        if (savedGridPreference !== null) {
          setShowGrid(JSON.parse(savedGridPreference));
        }

      } catch (error) {
        console.error('Error fetching available data:', error);
        setError('Failed to fetch available data');
        setAvailableData({});
      }
    };

    fetchAvailableData();

  }, []);

  const saveDatasetsToLocalStorage = (datasets) => {
    localStorage.setItem('selectedDatasets', JSON.stringify(datasets));
  };
  
  const saveStatsToLocalStorage = (statsData) => {
    localStorage.setItem('stats', JSON.stringify(statsData));
  };

  const saveGridPreferenceToLocalStorage = (showGrid) => {
    localStorage.setItem('showGrid', JSON.stringify(showGrid));
  };
  
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
      
      // Generate a random color for the new dataset
      const randomColor = `rgba(${Math.floor(Math.random() * 250)}, ${Math.floor(Math.random() * 250)}, ${Math.floor(Math.random() * 250)}, 0.4)`;

      // Sort data by date to ensure it's displayed in correct order
      const sortedData = [...data].sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateA - dateB;
      });

      const newDataset = {
        building: selectedBuilding,
        year: selectedYear,
        month: selectedMonth,
        data: sortedData,
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

  // Toggle grid visibility
  const toggleGrid = () => {
    const newGridState = !showGrid;
    setShowGrid(newGridState);
    saveGridPreferenceToLocalStorage(newGridState);
    
    // Update chart if it exists
    if (chartInstance) {
      chartInstance.options.scales.x.grid.display = newGridState;
      chartInstance.options.scales.y.grid.display = newGridState;
      chartInstance.update();
    }
  };

    // Helper function to get days in month - FIXED
  const getDaysInMonth = (year, month) => {
    // For 1-indexed months (where January = 1)
    // This works because new Date(year, month, 0) gives the last day of the previous month
    // So new Date(2023, 2, 0) gives February 28, 2023 (or 29 in leap years)
    return new Date(parseInt(year), parseInt(month), 0).getDate();
  };

  // Find the actual days in each dataset's month - IMPROVED
  const findActualDaysForDatasets = (datasets) => {
    if (!datasets || datasets.length === 0) return { maxDays: 31, daysByDataset: {} };
    
    const daysByDataset = {};
    let maxDays = 0;
    
    datasets.forEach((ds, index) => {
      let daysInThisDataset;
      
      // For real month datasets (not prediction or average)
      if (ds.year && ds.month && !isNaN(ds.year) && !isNaN(ds.month) && 
          ds.building !== 'Prediction' && ds.label !== 'Average Aggregate') {
        daysInThisDataset = getDaysInMonth(ds.year, ds.month);
      } else if (ds.building === 'Prediction' || ds.label === 'Average Aggregate') {
        // For prediction or average datasets, use the max days from their data
        daysInThisDataset = Math.max(...ds.data.map(point => 
          point.date ? new Date(point.date).getDate() : 0
        ));
      } else {
        // Default fallback
        daysInThisDataset = 31;
      }
      
      daysByDataset[index] = daysInThisDataset;
      if (daysInThisDataset > maxDays) maxDays = daysInThisDataset;
    });
    
    return { maxDays, daysByDataset };
  };

  // Modify the chart update effect
  useEffect(() => {
    if (loading || error || selectedDatasets.length === 0) {
      // If no datasets are available, destroy the chart instance
      if (chartInstance) {
        chartInstance.destroy();
        setChartInstance(null);
      }
      return;
    }
  
    if (chartInstance) {
      chartInstance.destroy();
    }
  
    const ctx = chartRef.current.getContext('2d');
    
    // Get the actual days for each dataset
    const { maxDays, daysByDataset } = findActualDaysForDatasets(selectedDatasets);
    
    // Generate labels from 1 to maxDays
    const dayLabels = Array.from({ length: maxDays }, (_, i) => i + 1);
  
    // Create datasets array for the chart
    const datasets = selectedDatasets.map((ds, dsIndex) => {
      // Get the number of days for this specific dataset
      const daysInThisDataset = daysByDataset[dsIndex] || maxDays;
      
      // Create an array with correct length for this dataset's month
      const formattedData = Array(maxDays).fill(null);
      
      // Fill in actual data points where they exist
      ds.data.forEach(entry => {
        const entryDate = new Date(entry.date);
        // Force local timezone interpretation to avoid date shifting
        const dayIndex = entryDate.getUTCDate() - 1; // Use UTC date to avoid timezone issues
        
        // Only include data points that are within this dataset's actual month length
        if (dayIndex >= 0 && dayIndex < daysInThisDataset) {
          formattedData[dayIndex] = entry.consumption;
        }
      });
      
      return {
        label: ds.building === 'Prediction' ? 'Future Prediction' : 
              (ds.label || `${ds.building} - ${ds.month}/${ds.year}`),
        data: formattedData,
        borderColor: ds.borderColor || ds.color,
        backgroundColor: ds.backgroundColor || 'transparent',
        tension: 0.1,
        fill: ds.fill || false,
        borderDash: (ds.building === 'Prediction' || ds.label === 'Average Aggregate') ? [] : [5, 5],
        borderWidth: ds.borderWidth || 1.5,
        pointBackgroundColor: ds.pointBackgroundColor || ds.color,
        pointRadius: ds.pointRadius || 1,
        pointStyle: ds.pointStyle || 'circle',
        spanGaps: true, // Allow drawing lines between points with null values
      };
    });
  
    const newChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: dayLabels,
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
          },
          legend: {
            display: true,
            position: 'top',
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Consumption (kWh)',
            },
            grid: {
              display: showGrid, // Use the grid visibility state
              color: 'rgba(0, 0, 0, 0.1)',
            },
          },
          x: {
            title: {
              display: true,
              text: 'Days',
              font: {
                size: 14,
                weight: 'bold',
              },
            },
            grid: {
              display: showGrid, // Use the grid visibility state
              color: 'rgba(0, 0, 0, 0.1)',
            },
          },
        },
      },
    });
  
    setChartInstance(newChart);
  }, [selectedDatasets, loading, error, showGrid]);

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
  
    // Get actual days for each dataset
    const { maxDays, daysByDataset } = findActualDaysForDatasets(selectedDatasets);
    
    // Initialize arrays for accumulating values and counts
    const aggregateData = Array(maxDays).fill(0);
    const counts = Array(maxDays).fill(0);
  
    selectedDatasets.forEach((dataset, index) => {
      // Get the actual number of days for this dataset
      const daysInThisDataset = daysByDataset[index] || maxDays;
      
      dataset.data.forEach((entry) => {
        const entryDate = new Date(entry.date);
        const day = entryDate.getDate() - 1; // Convert to 0-based index for array
        
        // Only include days that are actually in this dataset's month
        if (day >= 0 && day < daysInThisDataset) {
          aggregateData[day] += entry.consumption;
          counts[day] += 1;
        }
      });
    });
  
    // Calculate average for each day
    const averageData = [];
    for (let i = 0; i < maxDays; i++) {
      if (counts[i] > 0) {
        const avgValue = aggregateData[i] / counts[i];
        // Create a date object for this day (using first dataset's month/year for reference)
        const referenceDate = new Date(selectedDatasets[0].data[0].date);
        const avgDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), i + 1);
        
        averageData.push({
          date: avgDate.toISOString(),
          consumption: avgValue,
          day: i + 1
        });
      }
    }
  
    // Create the average dataset
    const averageDataset = {
      label: 'Average Aggregate',
      data: averageData,
      building: 'Data',
      year: selectedDatasets.length + ' Months',
      month: 'Aggregate Average',
      color: 'rgba(240, 8, 252, 0.82)',
      tension: 0.1,
      borderDash: [5, 5],
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
      saveStatsToLocalStorage(updatedStats); // Save updated stats to localStorage
      return updatedStats;
    });

    setIsAverageDisplayed(true); // Indicate that the average is displayed
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
      const formattedPredictions = predictionData.predictions.map((prediction, index) => ({
        date: prediction.ds, // Ensure this matches the format used in the graph
        consumption: prediction.Final_Prediction, // Ensure this matches the key used in the graph
        day: index + 1 // Add day number for consistency
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
      const validValues = consumptionValues.filter(value => value !== null && value !== undefined);
      if (validValues.length === 0) return { average: '0.00', max: '0.00', min: '0.00', total: '0.00' };
      
      const average = validValues.reduce((a, b) => a + b, 0) / validValues.length;
      const max = Math.max(...validValues);
      const min = Math.min(...validValues);
      const total = validValues.reduce((a, b) => a + b, 0);
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
      // For Average Aggregate, take only valid values
      const consumptionValues = dataset.data.map(entry => entry.consumption);
      const validValues = consumptionValues.filter(value => value !== null && value !== undefined);
      if (validValues.length === 0) return { average: '0.00', max: '0.00', min: '0.00', total: '0.00' };
      
      const average = validValues.reduce((a, b) => a + b, 0) / validValues.length;
      const max = Math.max(...validValues);
      const min = Math.min(...validValues);
      const total = validValues.reduce((a, b) => a + b, 0);
  
      return {
        label: dataset.label,
        average: average.toFixed(2),
        max: max.toFixed(2),
        min: min.toFixed(2),
        total: total.toFixed(2)
      };
    } else {
      const consumptionValues = dataset.data.map(entry => entry.consumption);
      const validValues = consumptionValues.filter(value => value !== null && value !== undefined);
      if (validValues.length === 0) return { average: '0.00', max: '0.00', min: '0.00', total: '0.00' };
      
      const average = validValues.reduce((a, b) => a + b, 0) / validValues.length;
      const max = Math.max(...validValues);
      const min = Math.min(...validValues);
      const total = validValues.reduce((a, b) => a + b, 0);
  
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
  
    // Update the datasets with fill properties
    chartInstance.data.datasets.forEach((dataset, index) => {
      if (index === primaryDataset) {
        dataset.fill = {
          target: secondaryDataset, // Fill relative to the secondary dataset
          above: 'rgba(20, 255, 0, 0.3)', // Green for areas above the secondary dataset
          below: 'rgba(255, 0, 0, 0.3)', // Red for areas below the secondary dataset
        };
      } else if (index === secondaryDataset) {
        dataset.fill = false; // Ensure the secondary dataset does not fill
      }
    });
  
    // Update the chart to reflect the changes
    chartInstance.update();
  };

  const togglePrimaryDataset = (index) => {
    setPrimaryDataset(prev => prev === index ? null : index);
  };

  const toggleSecondaryDataset = (index) => {
    setSecondaryDataset(prev => prev === index ? null : index);
  };

  if (loading) return <div className="loading-indicator">Loading data</div>;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="LineGraph">
      <div className="controls-container">
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
          className="button"
        >
          Add to Graph
        </button>
      </div>
      
      {addError && <div className="error-message">{addError}</div>}
      
      {/* Display active datasets */}
      <div className="datasets-container">
        {selectedDatasets.map((dataset, index) => (
          <div
            key={index}
            className="dataset-item"
          >
            <div
              className="color-indicator"
              style={{ backgroundColor: dataset.color }}
            />
            <span>
              {dataset.building === 'Prediction' ? 'Future Prediction' : 
               (dataset.label || `${dataset.building} - ${dataset.month}/${dataset.year}`)}
            </span>
            <div className="dataset-button-group">
              <button
                onClick={() => togglePrimaryDataset(index)}
                className={`dataset-button primary ${primaryDataset === index ? 'active' : ''}`}
              >
                Primary
              </button>
              <button
                onClick={() => toggleSecondaryDataset(index)}
                className={`dataset-button ${secondaryDataset === index ? 'active' : ''}`}
              >
                Secondary
              </button>
              <button
                onClick={() => removeDataset(index)}
                className="dataset-button remove"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
      
      <div className="controls-container">
        <button  
          onClick={fetchPrediction} 
          disabled={loading || selectedDatasets.length === 0}
          className="button"
        >
          {loading ? 'Predicting...' : 'Generate Prediction'}
        </button>
        
        <button
          onClick={() => calculateAverageAggregate()}
          disabled={selectedDatasets.length === 0}
          className="button"
        >
          Display Average
        </button>

        <button 
          onClick={compareDatasets}
          disabled={primaryDataset === null || secondaryDataset === null}
          className="button"
        >
          Compare Datasets
        </button>
        
        <button 
          onClick={toggleGrid}
          className="button"
          title="Toggle grid lines on/off"
        >
          {showGrid ? "Hide Grid" : "Show Grid"}
        </button>
      </div>
      
      <div className="flex-container">
        <div className="chart-container">
          <canvas ref={chartRef}></canvas>
        </div>
        
        {Object.keys(stats).length > 0 && (
          <div className="stats-container">
            <h3>Statistics</h3>
            {Object.entries(stats).map(([key, statData], index) => (
              <div key={index} className="stat-card">
                <div className="stat-header">
                  <div 
                    className="stat-color"
                    style={{
                      backgroundColor: selectedDatasets.find(ds => 
                        (ds.building === 'Prediction' && key === 'Prediction-Future') ||
                        (ds.label === 'Average Aggregate' && key === 'Average-Aggregate') ||
                        (`${ds.building}-${ds.year}-${ds.month}` === key))?.color || 'transparent'
                    }}
                  />
                  <h4>{statData.label}</h4>
                </div>
                <p><strong>Average:</strong> <span>{statData.average} kWh</span></p>
                <p><strong>Max:</strong> <span>{statData.max} kWh</span></p>
                <p><strong>Min:</strong> <span>{statData.min} kWh</span></p>
                <p><strong>Total:</strong> <span>{statData.total} kWh</span></p>
                {statData.meanAbsoluteError && (
                  <p><strong>Mean Absolute Error:</strong> <span>{statData.meanAbsoluteError}</span></p>
                )}
                {statData.percentageMAE && (
                  <p><strong>MAE percentage:</strong> <span>{statData.percentageMAE}%</span></p>
                )}
                {statData.rootMeanSquaredError && (
                  <p><strong>Root Mean Squared Error:</strong> <span>{statData.rootMeanSquaredError}</span></p>
                )}
                {statData.percentageRMSE && (
                  <p><strong>RMSE percentage:</strong> <span>{statData.percentageRMSE}%</span></p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LineGraph;