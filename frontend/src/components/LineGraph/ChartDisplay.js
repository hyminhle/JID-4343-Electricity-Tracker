import React, { useEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import annotationPlugin from 'chartjs-plugin-annotation';

Chart.register(annotationPlugin);

const ChartDisplay = ({ datasets, height = '600px' }) => {
  const chartRef = useRef(null);
  const [chartInstance, setChartInstance] = useState(null);

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

    // Create datasets array for the chart
    const chartDatasets = datasets.map((ds) => ({
      label: ds.label || `${ds.building} - ${ds.month}/${ds.year}`,
      data: ds.data.map((entry) => entry.consumption),
      borderColor: ds.borderColor || ds.color,
      backgroundColor: ds.backgroundColor || 'transparent',
      tension: 0.1,
      fill: ds.fill || false,
      borderDash: (ds.building === 'Prediction' || ds.label === 'Average Aggregate') ? [] : [5, 5],
      borderWidth: ds.borderWidth || 1.5,
      pointBackgroundColor: ds.pointBackgroundColor || ds.color,
      pointRadius: ds.pointRadius || 1,
      pointStyle: ds.pointStyle || 'circle',
    }));

    const newChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: datasets[0].data.map((entry) => new Date(entry.date).getDate()),
        datasets: chartDatasets,
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

    // Cleanup function
    return () => {
      if (newChart) {
        newChart.destroy();
      }
    };
  }, [datasets]);

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

  // Return the chart instance if needed elsewhere
  const getChartInstance = () => chartInstance;

  return (
    <div style={{ height }}>
      <canvas ref={chartRef}></canvas>
    </div>
  );
};

export default ChartDisplay;