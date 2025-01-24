import React, { useEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import annotationPlugin from 'chartjs-plugin-annotation';

Chart.register(annotationPlugin);

const API_URL = "http://127.0.0.1:5000/stats";

const LineGraph = () => {
  const chartRef = useRef(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartInstance, setChartInstance] = useState(null);
  const [threshold, setThreshold] = useState(10);
  const [showDifferenceLines, setShowDifferenceLines] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch(API_URL);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch data');
      }
      const data = await response.json();
      setStats(data);
      setError(null);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    return () => {}; // cleanup function
  }, []); // Only fetch once when component mounts

  useEffect(() => {
    if (loading || error || !stats) return;

    if (chartInstance) {
      chartInstance.destroy();
    }

    const ctx = chartRef.current.getContext('2d');
    
    const maxDays = Math.max(
      stats.currentMonthData?.length || 0,
      stats.previousMonthData?.length || 0
    );
    
    const labels = Array.from({ length: maxDays }, (_, i) => i + 1);

    // Calculate differences for annotations
    const currentMonthData = stats.currentMonthData || [];
    const previousMonthData = stats.previousMonthData || [];
    
    const differences = currentMonthData.map((curr, idx) => {
      const prev = previousMonthData[idx];
      return prev ? Math.abs(curr - prev) : 0;
    });

    const maxDiffIndex = differences.indexOf(Math.max(...differences));
    const minDiffIndex = differences.indexOf(Math.min(...differences));

    // Prepare annotations object
    const annotations = {
      thresholdLine: {
        type: 'line',
        yMin: threshold,
        yMax: threshold,
        borderColor: 'rgb(255, 0, 0)',
        borderWidth: 2,
        borderDash: [5, 5],
        label: {
          display: true,
          content: `Threshold: ${threshold} kWh`,
          position: 'end'
        }
      }
    };

    // Add difference lines if enabled and we have data for both months
    if (showDifferenceLines && currentMonthData.length && previousMonthData.length) {
      annotations.maxDiffLine = {
        type: 'line',
        yMin: 0,
        yMax: Math.max(...currentMonthData, ...previousMonthData),
        xMin: maxDiffIndex,
        xMax: maxDiffIndex,
        borderColor: 'rgba(0, 255, 0, 0.7)',
        borderWidth: 2,
        label: {
          display: true,
          content: `Max Diff: ${differences[maxDiffIndex].toFixed(2)} kWh`,
          position: 'start'
        }
      };

      annotations.minDiffLine = {
        type: 'line',
        yMin: 0,
        yMax: Math.max(...currentMonthData, ...previousMonthData),
        xMin: minDiffIndex,
        xMax: minDiffIndex,
        borderColor: 'rgba(0, 0, 255, 0.7)',
        borderWidth: 2,
        label: {
          display: true,
          content: `Min Diff: ${differences[minDiffIndex].toFixed(2)} kWh`,
          position: 'start'
        }
      };
    }

    const newChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: `Current Month (${stats.currentMonth || 'No Data'})`,
            data: stats.currentMonthData || [],
            borderColor: 'rgb(75, 192, 192)',
            tension: 0.1,
            fill: false
          },
          {
            label: `Previous Month (${stats.previousMonth || 'No Data'})`,
            data: stats.previousMonthData || [],
            borderColor: 'rgb(255, 99, 132)',
            tension: 0.1,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Daily Electricity Consumption Comparison',
            font: {
              size: 16,
              weight: 'bold'
            }
          },
          tooltip: {
            mode: 'index',
            intersect: false,
          },
          annotation: {
            annotations: annotations
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Consumption (kWh)',
              font: {
                size: 14,
                weight: 'bold'
              }
            }
          },
          x: {
            title: {
              display: true,
              text: 'Day of Month',
              font: {
                size: 14,
                weight: 'bold'
              }
            }
          }
        },
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false
        }
      }
    });

    setChartInstance(newChart);
  }, [stats, loading, error, threshold, showDifferenceLines]);

  

  const handleThresholdChange = (event) => {
    const value = parseFloat(event.target.value);
    if (!isNaN(value) && value >= 0) {
      setThreshold(value);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!stats) return <div>No data available</div>;

  return (
    <div>
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

        {stats.stats && (
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
            
            {stats.stats.currentMonth && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ 
                  color: 'rgb(75, 192, 192)',
                  margin: '0 0 10px 0',
                  fontSize: '16px'  
                }}>{stats.currentMonth}</h4>
                <div style={{ fontSize: '15px', lineHeight: '1.6' }}>
                  <p style={{ margin: '5px 0' }}>
                    <strong>Average:</strong> {stats.stats.currentMonth.average.toFixed(2)} kWh
                  </p>
                  <p style={{ margin: '5px 0' }}>
                    <strong>Maximum:</strong> {stats.stats.currentMonth.max.toFixed(2)} kWh
                  </p>
                  <p style={{ margin: '5px 0' }}>
                    <strong>Minimum:</strong> {stats.stats.currentMonth.min.toFixed(2)} kWh
                  </p>
                  <p style={{ margin: '5px 0' }}>
                    <strong>Total:</strong> {stats.stats.currentMonth.total.toFixed(2)} kWh
                  </p>
                </div>
              </div>
            )}
            
            {stats.stats.previousMonth && (
              <div>
                <h4 style={{ 
                  color: 'rgb(255, 99, 132)',
                  margin: '0 0 10px 0',
                  fontSize: '16px'  
                }}>{stats.previousMonth}</h4>
                <div style={{ fontSize: '15px', lineHeight: '1.6' }}>
                  <p style={{ margin: '5px 0' }}>
                    <strong>Average:</strong> {stats.stats.previousMonth.average.toFixed(2)} kWh
                  </p>
                  <p style={{ margin: '5px 0' }}>
                    <strong>Maximum:</strong> {stats.stats.previousMonth.max.toFixed(2)} kWh
                  </p>
                  <p style={{ margin: '5px 0' }}>
                    <strong>Minimum:</strong> {stats.stats.previousMonth.min.toFixed(2)} kWh
                  </p>
                  <p style={{ margin: '5px 0' }}>
                    <strong>Total:</strong> {stats.stats.previousMonth.total.toFixed(2)} kWh
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