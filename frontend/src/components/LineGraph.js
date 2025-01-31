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
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [chartInstance, setChartInstance] = useState(null);
  const [threshold, setThreshold] = useState(10);
  const [showDifferenceLines, setShowDifferenceLines] = useState(true);
  const [selectedDatasets, setSelectedDatasets] = useState([]);
  const [addError, setAddError] = useState(null); 
  const [primaryDataset, setPrimaryDataset] = useState(null);
  const [secondaryDataset, setSecondaryDataset] = useState(null);

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
      } catch (error) {
        console.error('Error fetching available data:', error);
        setError('Failed to fetch available data');
        setAvailableData({});
      }
    };

    fetchAvailableData();
  }, []);
  const fetchPrediction = async () => {
    if (!selectedDatasets.length) {
      setError('No data available for prediction.');
      return;
    }
  
    setLoading(true);
  
    // Extract relevant data for the predictor (assuming first dataset for now)
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
        body: JSON.stringify({ datasets: selectedData }), // Send the same data as graph
      });
  
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
  
      const predictionData = await response.json();
      console.log('Prediction Data:', predictionData);
  
      // Append prediction results to the graph
      const randomColor = `rgb(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)})`;
  
      setSelectedDatasets(prev => [...prev, {
        building: 'Prediction',
        year: 'Future',
        month: '',
        data: predictionData,
        color: randomColor
      }]);
  
      setError(null);
    } catch (error) {
      console.error('Error fetching prediction:', error);
      setError(`Prediction failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Add this function to handle adding new datasets
  const addDataset = async () => {
    if (!selectedBuilding || !selectedYear || !selectedMonth) {
      setAddError('Please select building, year, and month before adding to graph.');
      return;
    }

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
      const randomColor = `rgb(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)})`;
      
      setSelectedDatasets(prev => [...prev, {
        building: selectedBuilding,
        year: selectedYear,
        month: selectedMonth,
        data: data,
        color: randomColor
      }]);
      
      setAddError(null);
    } catch (error) {
      console.error('Error fetching data:', error);
      setAddError(`Failed to fetch data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Modify the chart update effect
  useEffect(() => {
    if (loading || error || selectedDatasets.length === 0) return;

    if (chartInstance) {
      chartInstance.destroy();
    }

    const ctx = chartRef.current.getContext('2d');
    
    // Create datasets array for the chart
    const datasets = selectedDatasets.map(ds => ({
      label: `${ds.building} - ${ds.month}/${ds.year}`,
      data: ds.data.map(entry => entry.consumption),
      borderColor: ds.color,
      tension: 0.1,
      fill: false,
    }));

    const newChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: selectedDatasets[0].data.map(entry => new Date(entry.date).getDate()),
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

  // Add this function to remove a dataset
  const removeDataset = (index) => {
    setSelectedDatasets(prev => prev.filter((_, i) => i !== index));
  };
  

  const handleThresholdChange = (event) => {
    const value = parseFloat(event.target.value);
    if (!isNaN(value) && value >= 0) {
      setThreshold(value);
    }
  };

  
  const calculateAverageAggregate = () => {
    if (selectedDatasets.length === 0) {
      setError('No datasets available to calculate an average aggregate.');
      return;
    }
  
    // Determine the number of days from the first dataset
    const numDays = Math.max(
      ...selectedDatasets.map(dataset => dataset?.data?.length || 0)
    );
    
  
    if (numDays === 0) {
      setError('Selected datasets do not have valid data.');
      return;
    }
  
    const aggregateData = Array(numDays).fill(0);
    const counts = Array(numDays).fill(0);

    selectedDatasets.forEach(dataset => {
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
    
  
    // Add the average dataset to the graph
    const randomColor = `rgb(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)})`;
    const averageDataset = {
      data: averageData.map((y, i) => ({ day: i + 1, consumption: y })), // Ensure proper format
      building: 'Data',
      year: selectedDatasets.length + ' Months',
      month: 'Aggregate Average',
      color: randomColor,
      tension: 0.1,
      borderDash: [5, 5], 
      fill: false,
    };
  
    // Check if an "Average Aggregate" dataset already exists, if so, replace it
    const updatedDatasets = selectedDatasets.filter(
      (ds) => ds.label !== 'Average Aggregate'
    );
  
    setSelectedDatasets([...updatedDatasets, averageDataset]);
    console.log('Selected Datasets:', selectedDatasets);
    console.log('Dataset Data:', selectedDatasets.map(ds => ds.data));

    setError(null);
  };

  const handlePredict = async () => {
    try {
      setLoading(true);
      const response = await axios.post('http://localhost:5000/predict', {
        datasets: selectedDatasets
      });
      console.log('Prediction response:', response.data);
    } catch (error) {
      console.error('Error making prediction:', error);
      setError('Error making prediction. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const compareDatasets = () => {
    if (primaryDataset === null || secondaryDataset === null) {
      setError('Please select both primary and secondary datasets for comparison.');
      return;
    }
  
    const primaryData = selectedDatasets[primaryDataset].data;
    const secondaryData = selectedDatasets[secondaryDataset].data;
  
    const comparisonData = primaryData.map((entry, index) => {
      const primaryValue = entry.consumption;
      const secondaryValue = secondaryData[index]?.consumption || 0;
      return {
        day: entry.day,
        primary: primaryValue,
        secondary: secondaryValue,
        difference: primaryValue - secondaryValue
      };
    });
  
    // Update existing datasets in the chart
    chartInstance.data.datasets.forEach((dataset, index) => {
      if (dataset.label === 'Primary Dataset') {
        dataset.data = comparisonData.map(entry => entry.primary);
      } else if (dataset.label === 'Secondary Dataset') {
        dataset.data = comparisonData.map(entry => entry.secondary);
      }
    });
  
    chartInstance.options.plugins.annotation = {
      annotations: comparisonData.map((entry, index) => ({
        type: 'box',
        xMin: index - 0.5,
        xMax: index + 0.5,
        yMin: Math.min(entry.primary, entry.secondary),
        yMax: Math.max(entry.primary, entry.secondary),
        backgroundColor: entry.difference > 0 ? 'rgba(255, 0, 0, 0.3)' : 'rgba(0, 255, 0, 0.3)'
      }))
    };
  
    chartInstance.update();
  };


  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <select
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
              borderRadius: '4px'
            }}
          >
            <div style={{ 
              width: '20px', 
              height: '20px', 
              backgroundColor: dataset.color,
              borderRadius: '50%' 
            }} />
            <span>{`${dataset.building} - ${dataset.month}/${dataset.year}`}</span>
            <button 
              onClick={() => setPrimaryDataset(index)}
              style={{ 
                marginLeft: 'auto',
                padding: '2px 8px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                backgroundColor: primaryDataset === index ? '#007bff' : '#fff',
                color: primaryDataset === index ? '#fff' : '#000'
              }}
            >
              Primary
            </button>
            <button 
              onClick={() => setSecondaryDataset(index)}
              style={{ 
                marginLeft: '10px',
                padding: '2px 8px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                backgroundColor: secondaryDataset === index ? '#007bff' : '#fff',
                color: secondaryDataset === index ? '#fff' : '#000'
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
                border: '1px solid #ddd'
              }}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
      <button  
      onClick={handlePredict} 
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

        {stats && (
          <div style={{
            width: '300px',  
            padding: '20px',  
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{
              margin: '0 0 15px 0',
              color: '#333',
              borderBottom: '2px solid #dee2e6',
              paddingBottom: '8px',
              fontSize: '18px'  
            }}>Statistics</h3>
           
            {stats.currentMonth && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{
                  color: 'rgb(75, 192, 192)',
                  margin: '0 0 10px 0',
                  fontSize: '16px'  
                }}>{stats.currentMonth}</h4>
                <div style={{ fontSize: '15px', lineHeight: '1.6' }}>
                  <p style={{ margin: '5px 0' }}>
                    <strong>Average:</strong> {stats.currentMonth.average.toFixed(2)} kWh
                  </p>
                  <p style={{ margin: '5px 0' }}>
                    <strong>Maximum:</strong> {stats.currentMonth.max.toFixed(2)} kWh
                  </p>
                  <p style={{ margin: '5px 0' }}>
                    <strong>Minimum:</strong> {stats.currentMonth.min.toFixed(2)} kWh
                  </p>
                  <p style={{ margin: '5px 0' }}>
                    <strong>Total:</strong> {stats.currentMonth.total.toFixed(2)} kWh
                  </p>
                </div>
              </div>
            )}
           
            {stats.previousMonth && (
              <div>
                <h4 style={{
                  color: 'rgb(255, 99, 132)',
                  margin: '0 0 10px 0',
                  fontSize: '16px'  
                }}>{stats.previousMonth}</h4>
                <div style={{ fontSize: '15px', lineHeight: '1.6' }}>
                  <p style={{ margin: '5px 0' }}>
                    <strong>Average:</strong> {stats.previousMonth.average.toFixed(2)} kWh
                  </p>
                  <p style={{ margin: '5px 0' }}>
                    <strong>Maximum:</strong> {stats.previousMonth.max.toFixed(2)} kWh
                  </p>
                  <p style={{ margin: '5px 0' }}>
                    <strong>Minimum:</strong> {stats.previousMonth.min.toFixed(2)} kWh
                  </p>
                  <p style={{ margin: '5px 0' }}>
                    <strong>Total:</strong> {stats.previousMonth.total.toFixed(2)} kWh
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LineGraph;