import React, { useEffect, useRef, useState } from 'react';
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

  // Fetch available buildings, years, and months
  useEffect(() => {
    const fetchAvailableData = async () => {
      try {
        const response = await fetch('http://localhost:5000/get-available-data');
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

  // Fetch data for the selected parameters
  const fetchData = async () => {
    if (!selectedBuilding || !selectedYear || !selectedMonth) {
      setError('Please select building, year, and month before displaying the graph.');
      return;
    }

    setLoading(true);
    const API_URL = `http://localhost:5000/fetch-data/${selectedYear}/${selectedMonth}/0/${selectedBuilding}`;

    try {
      const response = await fetch(API_URL);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch data');
      }
      const data = await response.json();
      console.log('Fetched Data:', data);
      setStats(data);
      setError(null);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Update the chart
  useEffect(() => {
    if (loading || error || !stats) return;

    if (chartInstance) {
      chartInstance.destroy(); // Destroy old chart if it exists
    }

    const ctx = chartRef.current.getContext('2d');
    const labels = stats.map((entry) => new Date(entry.date).getDate());
    const dataPoints = stats.map((entry) => entry.consumption);

    console.log('Creating chart with labels:', labels);
    console.log('Creating chart with dataPoints:', dataPoints);

    const newChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: `Electricity Data for ${selectedBuilding}`,
            data: dataPoints,
            borderColor: 'rgb(75, 192, 192)',
            tension: 0.1,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: `Electricity Data for ${selectedBuilding}`,
            font: {
              size: 16,
              weight: 'bold',
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
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
  }, [stats, loading, error, selectedBuilding]);

  const handleThresholdChange = (event) => {
    const value = parseFloat(event.target.value);
    if (!isNaN(value) && value >= 0) {
      setThreshold(value);
    }
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

        <button onClick={fetchData} disabled={loading}>
          {loading ? 'Loading...' : 'Fetch Data'}
        </button>
      </div>

      <button style={{ marginBottom: '10px' }}>Predict</button>
      <div style={{
        marginBottom: '20px',
        display: 'flex',
        gap: '20px',
        alignItems: 'center'
      }}>
        <div>
          <label htmlFor="threshold" style={{ marginRight: '10px' }}>
            Threshold Value (kWh):
          </label>
          <input
            id="threshold"
            type="number"
            min="0"
            step="0.1"
            value={threshold}
            onChange={handleThresholdChange}
            style={{
              padding: '5px',
              borderRadius: '4px',
              border: '1px solid #ccc'
            }}
          />
        </div>
       
        <div>
          <label style={{ marginRight: '10px' }}>
            <input
              type="checkbox"
              checked={showDifferenceLines}
              onChange={(e) => setShowDifferenceLines(e.target.checked)}
              style={{ marginRight: '5px' }}
            />
            Show Difference Lines
          </label>
        </div>
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