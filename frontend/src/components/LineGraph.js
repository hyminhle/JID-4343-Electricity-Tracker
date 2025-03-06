import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import Chart from 'chart.js/auto';
import annotationPlugin from 'chartjs-plugin-annotation';

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

  }, []);

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
      
      // Generate a random color for the new dataset
      const randomColor = `rgba(${Math.floor(Math.random() * 200)}, ${Math.floor(Math.random() * 200)}, ${Math.floor(Math.random() * 200)}, 0.22)`;

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
  
    // Create datasets array for the chart
    const datasets = selectedDatasets.map((ds) => ({
      label: ds.label || `${ds.building} - ${ds.month}/${ds.year}`,
      data: ds.data.map((entry) => entry.consumption),
      borderColor: ds.borderColor || ds.color,
      backgroundColor: ds.backgroundColor || 'transparent',
      tension: 0.1,
      fill: ds.fill || false,
      borderDash: (ds.building === 'Prediction' || ds.label === 'Average Aggregate') ? [] : [5, 5],
      borderWidth: ds.borderWidth || 1.5,
      pointBackgroundColor: ds.pointBackgroundColor || ds.color,
      pointRadius: ds.pointRadius || 0.5,
      pointStyle: ds.pointStyle || 'circle',
    }));
  
    const newChart = new Chart(ctx, {
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
          },
        },
      },
    });
  
    setChartInstance(newChart);
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
      setError('No datasets available to calculate an average aggregate.');
      return;
    }
  
    // Determine the number of days from the first dataset
    const numDays = Math.max(...selectedDatasets.map((dataset) => dataset?.data?.length || 0));
  
    if (numDays === 0) {
      setError('Selected datasets do not have valid data.');
      return;
    }
  
    const aggregateData = Array(numDays).fill(0);
    const counts = Array(numDays).fill(0);
  
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
    console.log('Average Data:', averageData);
  
    // Create the average dataset
    const averageDataset = {
      label: 'Average Aggregate',
      data: averageData.map((y, i) => ({ day: i + 1, consumption: y })), // Ensure proper format
      building: 'Data',
      year: selectedDatasets.length + ' Months',
      month: 'Aggregate Average',
      color: 'rgba(8, 252, 57, 0.82)',
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
      setError('No data available for prediction.');
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
            label: 'Prediction - Future',
            ...predictionStats
          }
        };
        saveStatsToLocalStorage(updatedStats); // Save updated stats to localStorage
        return updatedStats;
      });
      
      setError(null);
    } catch (error) {
      console.error('Error fetching prediction:', error);
      setError(`Prediction failed: ${error.message}`);
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
        label: dataset.label || `${dataset.building} - ${dataset.month}/${dataset.year}`,
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
      setError('Please select both primary and secondary datasets for comparison.');
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
        <button onClick={addDataset} disabled={loading}
          style={{
            marginBottom: '5px',
            padding: '8px 12px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Add to Graph
        </button>
        {addError && <p style={{ color: 'red' }}>{addError}</p>}
      </div>
      {/* Display active datasets */}
      <div style={{ marginBottom: '20px' }}>
        {selectedDatasets.map((dataset, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '5px',
              padding: '5px',
              backgroundColor: '#f5f5f5',
              borderRadius: '4px',
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
            <span>{dataset.label || `${dataset.building} - ${dataset.month}/${dataset.year}`}</span>
            <button
              onClick={() => togglePrimaryDataset(index)}
              style={{
                marginLeft: 'auto',
                padding: '2px 8px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                backgroundColor: primaryDataset === index ? '#007bff' : '#fff',
                color: primaryDataset === index ? '#fff' : '#000',
              }}
            >
              Primary
            </button>
            <button
              onClick={() => toggleSecondaryDataset(index)}
              style={{
                marginLeft: '10px',
                padding: '2px 8px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                backgroundColor: secondaryDataset === index ? '#007bff' : '#fff',
                color: secondaryDataset === index ? '#fff' : '#000',
              }}
            >
              Secondary
            </button>
            
            <button
              onClick={() => removeDataset(index)}
              style={{
                marginLeft: '10px',
                padding: '2px 8px',
                borderRadius: '4px',
                border: '1px solid #ddd',
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
          style={{
            marginBottom: '5px',
            padding: '8px 12px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          {loading ? 'Predicting...' : 'Predict'}
        </button>
        
        <button
          onClick={() => calculateAverageAggregate()}
          disabled={selectedDatasets.length === 0}
          style={{
            marginBottom: '5px',
            padding: '8px 12px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Display Average Aggregate
        </button>

        <button 
          onClick={compareDatasets}
          style={{
            marginBottom: '5px',
            padding: '8px 12px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
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
          height: '600px'  
        }}>
          <canvas ref={chartRef}></canvas>
        </div>
        {Object.keys(stats).length >  0 && (
        <div style={{
            width: '320px',  
            padding: '20px',  
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            maxHeight: '600px',
            overflowY: 'auto'
        }}>
            <h3>Statistics</h3>
            {Object.entries(stats).map(([key, statData], index) => (
            <div key={index} style={{ 
                marginBottom: '15px', 
                padding: '10px', 
                backgroundColor: 'white', 
                borderRadius: '4px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
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

export default LineGraph;