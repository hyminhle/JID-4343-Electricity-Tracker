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

  // Fetch available buildings, years, and months
  useEffect(() => {
    const fetchAvailableData = async () => {
      try {
        const response = await fetch('http://localhost:5000/get-available-data');
        const data = await response.json();
        console.log('Available Data:', data);
        setAvailableData(data);
        setSelectedBuilding(Object.keys(data)[0] || '');
      } catch (error) {
        console.log('Error fetching available data:', error);
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
      setStats(data.data);
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
    const labels = stats.map((entry, index) => entry.day || `Data ${index + 1}`);
    const dataPoints = stats.map((entry) => entry.value);

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
            title: {
              display: true,
              text: 'Consumption (kWh)',
              font: {
                size: 14,
                weight: 'bold',
              },
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

    // Cleanup to avoid memory leaks
    return () => {
      newChart.destroy();
    };
  }, [stats, loading, error, selectedBuilding]); // Remove chartInstance from dependencies

  return (
    <div>
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <select
          value={selectedBuilding}
          onChange={(e) => {
            setSelectedBuilding('');
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
            Array.isArray(availableData[selectedBuilding][selectedYear]) &&
            (availableData[selectedBuilding][selectedYear] || []).map((month) => (
              <option key={month} value={month}>
                {month}
              </option>
            ))}
        </select>

      </div>

      <button
        onClick={fetchData}
        style={{
          padding: '10px 20px',
          backgroundColor: 'rgb(75, 192, 192)',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
        }}
      >
        Display
      </button>

      {loading && <div>Loading...</div>}
      {error && <div style={{ color: 'red' }}>Error: {error}</div>}
      {!loading && !error && stats && (
        <div style={{ height: '500px', width: '100%' }}>
          <canvas ref={chartRef}></canvas>
        </div>
      )}
    </div>
  );
};

export default LineGraph;
