import React, { useEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import annotationPlugin from 'chartjs-plugin-annotation';

Chart.register(annotationPlugin);

const ChartDisplay = ({ datasets, height = '600px', showGrid = true, darkMode = true }) => {
  const chartRef = useRef(null);
  const [chartInstance, setChartInstance] = useState(null);

  // Helper function to get days in month
  const getDaysInMonth = (year, month) => {
    // For 1-indexed months (January = 1)
    return new Date(parseInt(year), parseInt(month), 0).getDate();
  };

  // Generate an array of days from 1 to maxDays
  const generateDayLabels = (maxDays) => {
    return Array.from({ length: maxDays }, (_, i) => i + 1);
  };

  // Find the maximum number of days in all datasets
  const findMaxDays = (datasets) => {
    if (!datasets || datasets.length === 0) return 31; // Default to 31 if no datasets
    
    const maxDaysByDataType = datasets.map(ds => {
      // For real month datasets (not prediction or average)
      if (ds.year && ds.month && !isNaN(ds.year) && !isNaN(ds.month) && 
          ds.building !== 'Prediction' && ds.label !== 'Average Aggregate') {
        // Get the actual number of days in this month/year
        return getDaysInMonth(ds.year, ds.month);
      } else if (ds.data && ds.data.length > 0) {
        // For other datasets, find the highest day number
        return Math.max(...ds.data.map(entry => {
          const date = new Date(entry.date);
          return date.getDate();
        }));
      }
      return 31; // Default fallback
    });
    
    return Math.max(...maxDaysByDataType);
  };

  // Create and update chart when datasets change
  useEffect(() => {
    if (!datasets || datasets.length === 0) {
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
    
    // Find the maximum number of days across all datasets
    const maxDays = findMaxDays(datasets);
    
    // Generate labels from 1 to maxDays
    const dayLabels = generateDayLabels(maxDays);

    // Colors based on theme
    const gridColor = 'rgba(0, 0, 0, 0.22)';
    const textColor = 'rgb(72, 68, 68)';
    const backgroundColor = 'white'; // Always use white regardless of mode

    // Create datasets array for the chart
    const chartDatasets = datasets.map((ds) => {
      // Create an array filled with nulls for all days
      const formattedData = Array(maxDays).fill(null);
      
      // Fill in actual data points where they exist
      ds.data.forEach(entry => {
        const entryDate = new Date(entry.date);
        const dayIndex = entryDate.getDate() - 1; // Convert to 0-based index
        
        // Only add data points that exist in the dataset
        if (dayIndex >= 0 && dayIndex < maxDays) {
          formattedData[dayIndex] = entry.consumption;
        }
      });
      
      // For months with fewer days, ensure we don't display null values beyond the month end
      if (ds.year && ds.month && !isNaN(ds.year) && !isNaN(ds.month) && 
          ds.building !== 'Prediction' && ds.label !== 'Average Aggregate') {
        const daysInThisMonth = getDaysInMonth(ds.year, ds.month);
        // Ensure data points beyond the actual month length are null
        for (let i = daysInThisMonth; i < maxDays; i++) {
          formattedData[i] = null;
        }
      }
      
      return {
        label: ds.building === 'Prediction' ? 'Future Prediction' : 
               (ds.label || `${ds.building} - ${ds.month}/${ds.year}`),
        data: formattedData,
        borderColor: ds.borderColor || ds.color,
        backgroundColor: ds.backgroundColor || 'transparent',
        tension: 0.2, // Increased slightly for smoother curves
        fill: ds.fill || false,
        borderDash: (ds.building === 'Prediction' || ds.label === 'Average Aggregate') ? [] : [5, 5],
        borderWidth: ds.borderWidth || 2, // Increased line weight
        pointBackgroundColor: ds.pointBackgroundColor || ds.color,
        pointRadius: ds.pointRadius || 1, // Increased point size
        pointHoverRadius: 4, // Increased hover point size
        pointStyle: ds.pointStyle || 'circle',
        spanGaps: true, // Allow drawing lines between points with null values
      };
    });

    const newChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: dayLabels,
        datasets: chartDatasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          title: {
            display: true,
            text: 'Electricity Consumption Comparison',
            color: textColor,
            font: {
              size: 16,
              weight: 'bold',
              family: "'Segoe UI', 'Roboto', sans-serif" // Modern font
            },
            padding: {
              top: 10,
              bottom: 20
            }
          },
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: textColor,
              boxWidth: 12,
              padding: 15,
              font: {
                family: "'Segoe UI', 'Roboto', sans-serif"
              }
            }
          },
          tooltip: {
            backgroundColor: darkMode ? 'rgba(40, 44, 52, 0.9)' : 'rgba(255, 255, 255, 0.9)',
            titleColor: darkMode ? 'rgba(255, 255, 255, 0.9)' : '#333',
            bodyColor: darkMode ? 'rgba(255, 255, 255, 0.8)' : '#666',
            borderColor: darkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
            borderWidth: 1,
            cornerRadius: 6,
            padding: 10,
            titleFont: {
              family: "'Segoe UI', 'Roboto', sans-serif"
            },
            bodyFont: {
              family: "'Segoe UI', 'Roboto', sans-serif"
            }
          },
          // Set canvas background to white
          beforeDraw: (chart) => {
            const ctx = chart.canvas.getContext('2d');
            ctx.save();
            ctx.globalCompositeOperation = 'destination-over';
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, chart.width, chart.height);
            ctx.restore();
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Consumption (kWh)',
              color: textColor,
              font: {
                size: 12,
                family: "'Segoe UI', 'Roboto', sans-serif"
              }
            },
            grid: {
              display: showGrid,
              color: gridColor,
              drawBorder: false,
              lineWidth: 0.5
            },
            ticks: {
              color: textColor,
              font: {
                family: "'Segoe UI', 'Roboto', sans-serif"
              },
              padding: 8
            }
          },
          x: {
            title: {
              display: true,
              text: 'Days',
              color: textColor,
              font: {
                size: 12,
                family: "'Segoe UI', 'Roboto', sans-serif"
              }
            },
            grid: {
              display: showGrid,
              color: gridColor,
              drawBorder: false,
              lineWidth: 0.5
            },
            ticks: {
              color: textColor,
              font: {
                family: "'Segoe UI', 'Roboto', sans-serif"
              },
              padding: 8
            }
          },
        },
        layout: {
          padding: {
            left: 10,
            right: 10,
            top: 0,
            bottom: 10
          }
        }
      },
    });

    setChartInstance(newChart);

    // Cleanup function
    return () => {
      if (newChart) {
        newChart.destroy();
      }
    };
  }, [datasets, showGrid, darkMode]);

  // Public method to update fill between datasets
  const updateFillBetween = (primaryIndex, secondaryIndex) => {
    if (!chartInstance || primaryIndex === null || secondaryIndex === null) return;

    chartInstance.data.datasets.forEach((dataset, index) => {
      if (index === primaryIndex) {
        dataset.fill = {
          target: secondaryIndex,
          above: 'rgba(20, 255, 0, 0.3)',
          below: 'rgba(255, 0, 0, 0.3)',
        };
      } else if (index === secondaryIndex) {
        dataset.fill = false;
      }
    });

    chartInstance.update();
  };

  // Public method to toggle grid visibility
  const toggleGrid = (showGridLines) => {
    if (!chartInstance) return;
    
    chartInstance.options.scales.x.grid.display = showGridLines;
    chartInstance.options.scales.y.grid.display = showGridLines;
    chartInstance.update();
  };

  // Export chart as PNG with white background regardless of current theme
  const exportChart = (filename = 'chart-export.png') => {
    if (!chartInstance) return null;
    
    // Get the chart's data URL (PNG format with white background)
    const dataUrl = chartInstance.toBase64Image();
    
    // Create a download link
    const downloadLink = document.createElement('a');
    downloadLink.href = dataUrl;
    downloadLink.download = filename;
    
    // Trigger the download
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    return dataUrl;
  };

  // Return an object with methods that can be called from parent components
  const getChartAPI = () => ({
    getChartInstance: () => chartInstance,
    updateFillBetween,
    toggleGrid,
    exportChart
  });

  // Apply container styles with white background regardless of theme
  const containerStyle = {
    height: height || '100%', // Use provided height or default to 100%
    width: '100%',            // Ensure full width
    backgroundColor: 'white', // Always white regardless of dark mode
    borderRadius: '4px',
    padding: '10px',
    boxSizing: 'border-box',
    display: 'flex',          // Add flex display
    flexDirection: 'column'   // Stack children vertically
  };
  
  return (
    <div style={containerStyle}>
      <canvas ref={chartRef} style={{ flex: 1 }}></canvas> {/* Make canvas fill available space */}
    </div>
  );
};

export default ChartDisplay;