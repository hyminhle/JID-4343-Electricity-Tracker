import React, { useState, useEffect, useRef } from 'react';
import { useAppDate } from './DateContext';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import './Report.css';
import { Chart, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';

Chart.register(ArcElement, Tooltip, Legend);

const Report = () => {
const { appDate } = useAppDate();
const [buildings, setBuildings] = useState([]);
const [selectedBuilding, setSelectedBuilding] = useState('All Buildings');
const [reportData, setReportData] = useState({
    todayConsumption: 0,
    dailyAverage: 0,
    monthlyAverage: 0,
    yearlyAverage: 0,
    highestMonth: { month: '', value: 0 },
    lowestMonth: { month: '', value: 0 },
    buildingStats: {}
});
const [isLoading, setIsLoading] = useState(true);
const reportRef = useRef(null);
const [showPieChart, setShowPieChart] = useState(false);

useEffect(() => {
    // Fetch available buildings
    fetchAvailableBuildings();
}, []);

useEffect(() => {
    // Fetch report data based on selected date and building
    if (buildings.length > 0) {
    fetchReportData();
    }
}, [appDate, selectedBuilding, buildings]);

const fetchAvailableBuildings = async () => {
    try {
    const response = await fetch('http://localhost:5000/get-available-data');
    const data = await response.json();
    
    // Extract unique building names from the response
    const buildingList = Object.keys(data).sort();
    setBuildings(buildingList);
    } catch (error) {
    console.error('Error fetching buildings:', error);
    }
};

const fetchBuilding = async (building, year, month, day) => {
    try {
        const encodedBuilding = encodeURIComponent(building);
        let dailyDataResponse, yearlyDataResponse;

        // Fetch daily or monthly data
        if (day) {
            dailyDataResponse = await fetch(`http://localhost:5000/fetch-data/${year}/${month}/${day}/${encodedBuilding}`);
        } else {
            dailyDataResponse = await fetch(`http://localhost:5000/fetch-data/${year}/${month}/0/${encodedBuilding}`);
        }

        if (!dailyDataResponse.ok) {
            throw new Error(`Failed to fetch daily/monthly data for ${building}`);
        }

        const dailyData = await dailyDataResponse.json();

        // Fetch yearly statistics
        yearlyDataResponse = await fetch(`http://localhost:5000/stats/${year}/0/${encodedBuilding}`);
        if (!yearlyDataResponse.ok) {
            throw new Error(`Failed to fetch yearly stats for ${building}`);
        }

        const yearlyStats = await yearlyDataResponse.json();

        // Calculate highest and lowest month by summing daily data for each month
        const monthlyTotals = yearlyStats.monthlyData.reduce((acc, entry) => {
            acc[entry.month] = (acc[entry.month] || 0) + entry.consumption;
            return acc;
        }, {});

        const highestMonth = Object.entries(monthlyTotals).reduce((max, [month, value]) => {
            return value > max.value ? { month, value } : max;
        }, { month: '', value: 0 });

        const lowestMonth = Object.entries(monthlyTotals).reduce((min, [month, value]) => {
            return value < min.value ? { month, value } : min;
        }, { month: '', value: Number.MAX_VALUE });

        return {
            todayConsumption: day ? dailyData.consumption || 0 : (Array.isArray(dailyData) ? dailyData[day - 1]?.consumption || 0 : 0),
            dailyAverage: yearlyStats.mean || 0,
            monthlyAverage: yearlyStats.mean || 0,
            yearlyAverage: yearlyStats.mean || 0,
            totalConsumption: Array.isArray(dailyData) ?
                dailyData.reduce((sum, entry) => sum + (entry.consumption || 0), 0) :
                (dailyData.consumption || 0),
            highestMonth,
            lowestMonth,
            monthlyData: yearlyStats.monthlyData
        };
    } catch (error) {
        console.error(`Error fetching data for ${building}:`, error);
        return {
            todayConsumption: 0,
            dailyAverage: 0,
            monthlyAverage: 0,
            yearlyAverage: 0,
            totalConsumption: 0,
            highestMonth: { month: '', value: 0 },
            lowestMonth: { month: '', value: 0 },
            monthlyData: []
        };
    }
};

const fetchReportData = async () => {
    setIsLoading(true);
    try {
        const year = appDate.getFullYear();
        const month = appDate.getMonth() + 1;
        const day = appDate.getDate();

        if (selectedBuilding === 'All Buildings') {
            let allBuildingsData = {
                todayConsumption: 0,
                dailyAverage: 0,
                monthlyAverage: 0,
                yearlyAverage: 0,
                highestMonth: { month: '', value: 0 },
                lowestMonth: { month: '', value: Number.MAX_VALUE },
                buildingStats: {}
            };

            for (const building of buildings) {
                if (building === 'All Buildings') continue;

                const buildingData = await fetchBuilding(building, year, month, day);

                allBuildingsData.todayConsumption += buildingData.todayConsumption;
                allBuildingsData.dailyAverage += buildingData.dailyAverage;
                allBuildingsData.monthlyAverage += buildingData.monthlyAverage;
                allBuildingsData.yearlyAverage += buildingData.yearlyAverage;

                if (buildingData.highestMonth.value > allBuildingsData.highestMonth.value) {
                    allBuildingsData.highestMonth = {
                        month: buildingData.highestMonth.month,
                        value: buildingData.highestMonth.value,
                        building: building
                    };
                }

                if (buildingData.lowestMonth.value < allBuildingsData.lowestMonth.value && buildingData.lowestMonth.value > 0) {
                    allBuildingsData.lowestMonth = {
                        month: buildingData.lowestMonth.month,
                        value: buildingData.lowestMonth.value,
                        building: building
                    };
                }

                allBuildingsData.buildingStats[building] = buildingData;
            }

            if (allBuildingsData.lowestMonth.value === Number.MAX_VALUE) {
                allBuildingsData.lowestMonth.value = 0;
            }

            setReportData(allBuildingsData);
        } else {
            const buildingData = await fetchBuilding(selectedBuilding, year, month, day);
            setReportData({
                todayConsumption: buildingData.todayConsumption,
                dailyAverage: buildingData.dailyAverage,
                monthlyAverage: buildingData.monthlyAverage,
                yearlyAverage: buildingData.yearlyAverage,
                highestMonth: buildingData.highestMonth,
                lowestMonth: buildingData.lowestMonth,
                buildingStats: { [selectedBuilding]: buildingData }
            });
        }
    } catch (error) {
        console.error('Error fetching report data:', error);
    } finally {
        setIsLoading(false);
    }
};

const handleBuildingChange = (e) => {
    setSelectedBuilding(e.target.value);
};

const exportToPDF = async () => {
    if (!reportRef.current) return;
    
    try {
    // Show a loading or processing message
    const loadingMessage = document.createElement('div');
    loadingMessage.className = 'export-loading';
    loadingMessage.textContent = 'Generating PDF...';
    document.body.appendChild(loadingMessage);
    
    // Allow the loading message to render
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true
    });
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });
    
    const imgWidth = 210; // A4 width in mm
    const imgHeight = canvas.height * imgWidth / canvas.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    
    // Generate filename with date information
    const dateStr = appDate.toISOString().split('T')[0];
    const filename = `Electricity_Report_${selectedBuilding.replace(/\s+/g, '_')}_${dateStr}.pdf`;
    
    pdf.save(filename);
    
    // Remove the loading message
    document.body.removeChild(loadingMessage);
    } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Failed to generate PDF. Please try again.');
    }
};

// Format numbers with commas for thousands
const formatNumber = (num) => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

// Convert large kWh values to appropriate units (kWh, MWh, GWh, TWh)
const formatEnergyValue = (value) => {
    if (value === undefined || value === null) {
    return { value: 0, unit: 'kWh' };
    }
    
    if (value >= 1_000_000_000) {
    // Convert to TWh for values >= 1 billion kWh
    return { 
        value: (value / 1_000_000_000).toFixed(2), 
        unit: 'TWh' 
    };
    } else if (value >= 1_000_000) {
    // Convert to GWh for values >= 1 million kWh
    return { 
        value: (value / 1_000_000).toFixed(2), 
        unit: 'GWh' 
    };
    } else if (value >= 1_000) {
    // Convert to MWh for values >= 1000 kWh
    return { 
        value: (value / 1_000).toFixed(2), 
        unit: 'MWh' 
    };
    } else {
    // Keep as kWh for smaller values
    return { 
        value: value.toFixed(2), 
        unit: 'kWh' 
    };
    }
};

// Display energy value with appropriate unit
const displayEnergyValue = (value) => {
    const { value: formattedValue, unit } = formatEnergyValue(value);
    return `${formatNumber(formattedValue)} ${unit}`;
};

const togglePieChart = () => {
    setShowPieChart(!showPieChart);
};

const getPieChartData = () => {
    const labels = [];
    const data = [];
    const colors = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#E7E9ED'
    ]; // Predefined bright colors

    Object.entries(reportData.buildingStats).forEach(([building, stats], index) => {
        labels.push(building);
        data.push(stats.totalConsumption || 0);
    });

    return {
        labels,
        datasets: [
            {
                data,
                backgroundColor: colors,
                borderWidth: 1,
            },
        ],
    };
};

return (
    <div className="report-container">
    <div className="report-header">
        <h1>Report</h1>
        <div className="report-date">
        {appDate.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        })}
        </div>
        
        <div className="report-controls">
        <div className="building-selector">
            <label htmlFor="building-select">Building:</label>
            <select 
            id="building-select" 
            value={selectedBuilding} 
            onChange={handleBuildingChange}
            >
            <option value="All Buildings">All Buildings</option>
            {buildings.map(building => (
                <option key={building} value={building}>
                {building}
                </option>
            ))}
            </select>
        </div>
        
        <button className="export-button" onClick={exportToPDF}>
            Export to PDF
        </button>
        </div>
    </div>
    
    {isLoading ? (
        <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading report data...</p>
        </div>
    ) : (
        <div className="report-content" ref={reportRef}>
        <div className="metrics-grid">
            <div className="metric-card">
            <h2>Today's Consumption</h2>
            <div className="metric-value">{displayEnergyValue(reportData.todayConsumption)}</div>
            <div className="metric-comparison">
                {reportData.todayConsumption > reportData.dailyAverage ? (
                <span className="negative">+{((reportData.todayConsumption / reportData.dailyAverage - 1) * 100).toFixed(1)}% above daily average</span>
                ) : (
                <span className="positive">-{((1 - reportData.todayConsumption / reportData.dailyAverage) * 100).toFixed(1)}% below daily average</span>
                )}
            </div>
            </div>
            
            <div className="metric-card">
            <h2>Daily Average</h2>
            <div className="metric-value">{displayEnergyValue(reportData.dailyAverage)}</div>
            <div className="metric-detail">Based on the last 30 days</div>
            </div>
            
            <div className="metric-card">
            <h2>Monthly Average</h2>
            <div className="metric-value">{displayEnergyValue(reportData.monthlyAverage)}</div>
            <div className="metric-detail">Based on the last 12 months</div>
            </div>
        </div>
        
        {selectedBuilding === 'All Buildings' && (
            <div className="buildings-breakdown">
                <h2>Buildings Breakdown</h2>
                <button className="toggle-pie-chart-button" onClick={togglePieChart}>
                    {showPieChart ? 'Show List View' : 'Show Pie Chart'}
                </button>
                {showPieChart ? (
                    <div className="pie-chart-container">
                        <Pie data={getPieChartData()} />
                    </div>
                ) : (
                    <div className="breakdown-table-container">
                        <table className="breakdown-table">
                            <thead>
                                <tr>
                                    <th>Building</th>
                                    <th>Today</th>
                                    <th>Daily Avg</th>
                                    <th>Monthly Avg</th>
                                    <th>Highest Month</th>
                                    <th>Lowest Month</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(reportData.buildingStats).map(([building, stats]) => (
                                    <tr key={building}>
                                        <td>{building}</td>
                                        <td>{displayEnergyValue(stats.todayConsumption)}</td>
                                        <td>{displayEnergyValue(stats.dailyAverage)}</td>
                                        <td>{displayEnergyValue(stats.monthlyAverage)}</td>
                                        <td>
                                            {stats.highestMonth && stats.highestMonth.month}
                                            <span className="month-value"> ({displayEnergyValue(stats.highestMonth.value)})</span>
                                        </td>
                                        <td>
                                            {stats.lowestMonth && stats.lowestMonth.month}
                                            <span className="month-value"> ({displayEnergyValue(stats.lowestMonth.value)})</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        )}
        
        {selectedBuilding !== 'All Buildings' && reportData.buildingStats[selectedBuilding] && (
            <div className="building-details">
            <h2>{selectedBuilding} Details</h2>
            
            <div className="consumption-highlights">
                <div className="highlight-card highest-month">
                <h2>Highest Consumption Month</h2>
                <div className="highlight-value">{reportData.highestMonth.month}</div>
                <div className="highlight-detail">
                    {displayEnergyValue(reportData.highestMonth.value)}
                </div>
                </div>
                
                <div className="highlight-card lowest-month">
                <h2>Lowest Consumption Month</h2>
                <div className="highlight-value">{reportData.lowestMonth.month}</div>
                <div className="highlight-detail">
                    {displayEnergyValue(reportData.lowestMonth.value)}
                </div>
                </div>
            </div>
            
            <div className="detail-section">
                <h2>Total Monthly Consumption</h2>
                <div className="total-consumption">
                {displayEnergyValue(reportData.buildingStats[selectedBuilding].totalConsumption)}
                </div>
            </div>
            </div>
        )}
        
        <div className="report-footer">
            <p>This report was generated on {new Date().toLocaleString()}.</p>
            <p>For more detailed analytics, please visit the Dashboard.</p>
        </div>
        </div>
    )}
    </div>
);

};

export default Report;