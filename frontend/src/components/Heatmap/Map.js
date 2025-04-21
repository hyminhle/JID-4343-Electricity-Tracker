import React, { useState, useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Polygon, Tooltip, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import axios from 'axios';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import './Map.css';
import HeatmapLayer from './HeatmapLayer';

// Fix for default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png'
});

const MapComponent = () => {
  const [buildings, setBuildings] = useState({});
  const [availableBuildings, setAvailableBuildings] = useState([]);
  const [availableData, setAvailableData] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [stats, setStats] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState(null);
  const [buildingStats, setBuildingStats] = useState({});
  const [minDate, setMinDate] = useState(null);
  const [maxDate, setMaxDate] = useState(null);
  const [isHeatmap, setIsHeatmap] = useState(false);
  const [heatmapPoints, setHeatmapPoints] = useState([]);
  const [selectedDay, setSelectedDay] = useState(1);
  const [showBuildingNames, setShowBuildingNames] = useState(true);



  const LOCAL_STORAGE_LIMIT = 5 * 1024 * 1024; // 5MB limit

// Function to get current localStorage usage
  const getLocalStorageUsage = () => {
    let total = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        total += (localStorage[key].length + key.length) * 2; // Unicode uses 2 bytes per character
      }
    }
    return total;
  };

  const updateBuildingAccessTime = (buildingName) => {
    const accessTimes = JSON.parse(localStorage.getItem('buildingAccessTimes') || '{}');
    accessTimes[buildingName] = Date.now();
    localStorage.setItem('buildingAccessTimes', JSON.stringify(accessTimes));
  };
  
  // Function to get least recently accessed buildings
  const getLeastRecentlyAccessedBuildings = () => {
    const accessTimes = JSON.parse(localStorage.getItem('buildingAccessTimes') || '{}');
    return Object.entries(accessTimes)
      .sort((a, b) => a[1] - b[1]) // Sort by access time (oldest first)
      .map(entry => entry[0]);
  };
  // Inside the MapComponent function

  const deleteBuilding = (buildingName) => {
    // Remove the building from the state
    setBuildings((prevBuildings) => {
      const updatedBuildings = { ...prevBuildings };
      delete updatedBuildings[buildingName];
      saveBuildingsToLocalStorage(updatedBuildings); // Save updated buildings to localStorage
      return updatedBuildings;
    });

    // Clear the selected building if it was deleted
    if (selectedBuilding === buildingName) {
      setSelectedBuilding(null);
    }
  };

  
  const saveBuildingsToLocalStorage = (buildings) => {
  try {
    // Check current storage usage
    const currentUsage = getLocalStorageUsage();
    const buildingsStr = JSON.stringify(buildings);
    const estimatedNewSize = currentUsage + buildingsStr.length * 2;
    
    // If adding these buildings would exceed our limit, remove old buildings
    if (estimatedNewSize > LOCAL_STORAGE_LIMIT) {
      const savedBuildings = loadBuildingsFromLocalStorage();
      const leastRecentlyAccessed = getLeastRecentlyAccessedBuildings();
      
      // Remove least recently accessed buildings until we're under the limit
      let updatedBuildings = { ...buildings };
      for (const buildingName of leastRecentlyAccessed) {
        if (estimatedNewSize <= LOCAL_STORAGE_LIMIT) break;
        
        if (updatedBuildings[buildingName]) {
          delete updatedBuildings[buildingName];
          console.log(`Removed least recently accessed building: ${buildingName}`);
          
          // Update estimated size
          const newBuildingsStr = JSON.stringify(updatedBuildings);
          const newEstimatedSize = currentUsage + newBuildingsStr.length * 2;
          
          if (newEstimatedSize <= LOCAL_STORAGE_LIMIT) {
            break;
          }
        }
      }
      
      // Save the pruned list of buildings
      localStorage.setItem('savedBuildings', JSON.stringify(updatedBuildings));
      return;
    }
    
    // Otherwise, save all buildings as normal
    localStorage.setItem('savedBuildings', buildingsStr);
    console.log(`Saved buildings to localStorage. Usage: ${estimatedNewSize} bytes`);
  } catch (error) {
    console.error('Error saving buildings to localStorage:', error);
    
    // If the error is related to quota exceeded, try to clear space
    if (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      const leastRecentlyAccessed = getLeastRecentlyAccessedBuildings();
      if (leastRecentlyAccessed.length > 0) {
        const buildingToRemove = leastRecentlyAccessed[0];
        const currentBuildings = loadBuildingsFromLocalStorage();
        delete currentBuildings[buildingToRemove];
        
        try {
          localStorage.setItem('savedBuildings', JSON.stringify(currentBuildings));
          console.log(`Emergency removal of building: ${buildingToRemove}`);
        } catch (innerError) {
          console.error('Still unable to save after removing a building:', innerError);
        }
      }
    }
  }
};
  
  // Function to load buildings from localStorage
  const loadBuildingsFromLocalStorage = () => {
    const savedBuildings = localStorage.getItem('savedBuildings');
    return savedBuildings ? JSON.parse(savedBuildings) : {};
  };

 // Function to save selected building to localStorage
const saveSelectedBuildingToLocalStorage = (buildingName) => {
  try {
    localStorage.setItem('selectedBuilding', JSON.stringify(buildingName));
    console.log('Successfully saved building to localStorage:', buildingName);
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
};

// Function to load selected building from localStorage with robust error handling
const loadSelectedBuildingFromLocalStorage = () => {
  try {
    const storedValue = localStorage.getItem('selectedBuilding');
    
    // If nothing is stored, return null
    if (storedValue === null) return null;
    
    // Check if it's already a valid building name string (not properly JSON formatted)
    if (storedValue.startsWith('Building ')) {
      console.log('Found raw building string in localStorage:', storedValue);
      return storedValue; // Return it as is
    }
    
    // Try to parse as JSON
    try {
      const parsed = JSON.parse(storedValue);
      console.log('Successfully parsed building from localStorage:', parsed);
      return parsed;
    } catch (parseError) {
      console.warn('Parse error, returning raw string:', storedValue);
      return storedValue; // Return the raw string as fallback
    }
  } catch (error) {
    console.warn('Error accessing localStorage:', error);
    // Clean up
    try {
      localStorage.removeItem('selectedBuilding');
    } catch (e) {
      // Ignore errors while cleaning up
    }
    return null;
  }
};


  const saveSelectedDateToLocalStorage = (date) => {
    localStorage.setItem('selectedDate', date.toISOString());
  };
  
  // Function to load selected date from localStorage
  const loadSelectedDateFromLocalStorage = () => {
    const savedDate = localStorage.getItem('selectedDate');
    return savedDate ? new Date(savedDate) : new Date();
  };
  
  const [buildingFilter, setBuildingFilter] = useState('all'); 
  const handleFilterChange = (filter) => {
    setBuildingFilter(filter);
  };

  // Add MapTiler key from environment variable
  const MAPTILER_KEY = process.env.REACT_APP_MAPTILER_KEY;

  useEffect(() => {
    const fetchAvailableData = async () => {
      try {
        const response = await fetch('http://127.0.0.1:5000/get-available-data');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        const savedBuildings = loadBuildingsFromLocalStorage();
        const savedDate = loadSelectedDateFromLocalStorage();
        const selectedBuilding = loadSelectedBuildingFromLocalStorage();

        // Find min and max dates from available data
        let minYear = '9999', maxYear = '0';
        let minMonth = '12', maxMonth = '1';
        
        Object.entries(data).forEach(([building, years]) => {
          Object.keys(years).forEach(year => {
            if (year < minYear) minYear = year;
            if (year > maxYear) maxYear = year;
            
            Object.keys(years[year]).forEach(month => {
              if (year === minYear && month < minMonth) minMonth = month;
              if (year === maxYear && month > maxMonth) maxMonth = month;
            });
          });
        });
        
        setMinDate(new Date(minYear, parseInt(minMonth) - 1, 1));
        setMaxDate(new Date(maxYear, parseInt(maxMonth) - 1, 31));
        setSelectedDate(new Date(minYear, parseInt(minMonth) - 1, 1));
        
        if (savedBuildings && Object.keys(savedBuildings).length > 0) {
          setBuildings(savedBuildings);
          setSelectedDate(savedDate);
          setSelectedBuilding(selectedBuilding);
          fetchBuildingStats(selectedBuilding, savedDate);
        } else {
          const buildingLocations = {
            'Building 110': [29.628014, -95.610553],
            'Building 121': [29.629014, -95.611553],
            'Building 200':   [29.629514, -95.609553],
            'Building 210':   [29.626514, -95.611953],
            'Building 300':   [29.627014, -95.608953],
            'Building 525':   [29.629014, -95.612553],
            'Building 545':   [29.628514, -95.608753],
            'Building 555':   [29.626514, -95.609953],
            'Building 125':   [29.629514, -95.610353],
            'Building 145':   [29.628514, -95.612953],
            'Building 150':   [29.627014, -95.611753],
            'Building 155':   [29.629514, -95.608553],
            'Building 170':   [29.630124, -95.608653],
            'Building 180':   [29.627124, -95.608253]
          };
  
          // All building sizes increased by 1.5x
          const buildingSizes = {
            'Building 110': 0.00048,   // Was 0.00035
            'Building 121': 0.00048,   // Was 0.00030
            'Building 200':   0.00048,   // Was 0.00015
            'Building 210':   0.00048,   // Was 0.00025
            'Building 300':   0.00048,   // Was 0.00010
            'Building 525':   0.00048,   // Was 0.00032
            'Building 545':   0.00048,   // Was 0.00018
            'Building 555':   0.00048,   // Was 0.00022
            'Building 125':   0.00048,   // Was 0.00012
            'Building 145':   0.00048,   // Was 0.00028
            'Building 150':   0.00048,   // Was 0.00020
            'Building 155':   0.00048,    // Was 0.00016
            'Building 170':   0.00048,    // Was 0.00016
            'Building 180':   0.00048    // Was 0.00016
          };
  
          // Keep the same consumption-based colors
          const buildingColors = {
            'Building 110': '#ff3300', // High consumption - More red
            'Building 121': '#ff6600', // High-medium consumption
            'Building 200':   '#ff9900', // Medium-high consumption
            'Building 210':   '#ffcc00', // Medium consumption
            'Building 300':   '#cccc00', // Medium consumption
            'Building 525':   '#99cc00', // Medium-low consumption
            'Building 545':   '#66cc00', // Low-medium consumption
            'Building 555':   '#33cc00', // Low consumption
            'Building 125':   '#00cc00', // Very low consumption
            'Building 145':   '#ff8000', // High-medium consumption
            'Building 150':   '#99ff00', // Low consumption
            'Building 155':   '#66ff00',  // Very low consumption
            'Building 170':   '#66ff00',
            'Building 180':   '#66ff00'
          };
  
          // Add all buildings to the map
          const newBuildings = {};
          for (const [buildingName, coordinates] of Object.entries(buildingLocations)) {
            const buildingSize = buildingSizes[buildingName];
            newBuildings[buildingName] = {
              name: buildingName,
              coordinates: [
                [coordinates[0], coordinates[1]],
                [coordinates[0], coordinates[1] + buildingSize],
                [coordinates[0] + buildingSize, coordinates[1] + buildingSize],
                [coordinates[0] + buildingSize, coordinates[1]]
              ],
              color: buildingColors[buildingName],
              data: [] // Empty data array for now
            };
          }
          setBuildings(newBuildings);
          saveBuildingsToLocalStorage(newBuildings); 
        }
  
        setAvailableData(data);
      } catch (error) {
        console.error('Error fetching available data:', error);
        setError('Failed to fetch available data');
        setAvailableData({});
      }
    };
    fetchAvailableData();
  }, []);

  const addBuilding = async () => {
    console.log('Starting addBuilding function...');
    if (selectedBuilding) {
      try {
        // Predefined building locations - much wider spread
        const buildingLocations = {
          'Building 110': [29.628014, -95.610553],
          'Building 121': [29.629014, -95.611553],
          'Building 200':   [29.629514, -95.609553],
          'Building 210':   [29.626514, -95.611953],
          'Building 300':   [29.627014, -95.608953],
          'Building 525':   [29.629014, -95.612553],
          'Building 545':   [29.628514, -95.608753],
          'Building 555':   [29.626514, -95.609953],
          'Building 125':   [29.629514, -95.610353],
          'Building 145':   [29.628514, -95.612953],
          'Building 150':   [29.627014, -95.611753],
          'Building 155':   [29.629514, -95.608553],
          'Building 170':   [29.630124, -95.608653],
          'Building 180':   [29.627124, -95.608253]
        };

        // All building sizes increased by 1.5x
        const buildingSizes = {
          'Building 110': 0.00048,   // Was 0.00035
          'Building 121': 0.00048,   // Was 0.00030
          'Building 200':   0.00048,   // Was 0.00015
          'Building 210':   0.00048,   // Was 0.00025
          'Building 300':   0.00048,   // Was 0.00010
          'Building 525':   0.00048,   // Was 0.00032
          'Building 545':   0.00048,   // Was 0.00018
          'Building 555':   0.00048,   // Was 0.00022
          'Building 125':   0.00048,   // Was 0.00012
          'Building 145':   0.00048,   // Was 0.00028
          'Building 150':   0.00048,   // Was 0.00020
          'Building 155':   0.00048,    // Was 0.00016
          'Building 170':   0.00048,    // Was 0.00016
          'Building 180':   0.00048    // Was 0.00016
        };

        // Keep the same consumption-based colors
        const buildingColors = {
          'Building 110': '#ff3300', // High consumption - More red
          'Building 121': '#ff6600', // High-medium consumption
          'Building 200':   '#ff9900', // Medium-high consumption
          'Building 210':   '#ffcc00', // Medium consumption
          'Building 300':   '#cccc00', // Medium consumption
          'Building 525':   '#99cc00', // Medium-low consumption
          'Building 545':   '#66cc00', // Low-medium consumption
          'Building 555':   '#33cc00', // Low consumption
          'Building 125':   '#00cc00', // Very low consumption
          'Building 145':   '#ff8000', // High-medium consumption
          'Building 150':   '#99ff00', // Low consumption
          'Building 155':   '#66ff00',  // Very low consumption
          'Building 170':   '#66ff00',
          'Building 180':   '#66ff00'
        };

        // Original data fetching logic for Buildings 110 and 121
        const buildingData = [];
        const buildingInfo = availableData[selectedBuilding];
        console.log('Building info:', buildingInfo);
        const availableYears = Object.keys(buildingInfo);
        console.log('Years info:', availableYears);
        
        for (const year of availableYears) {
          const availableMonths = Object.keys(buildingInfo[year]);
          for (const month of availableMonths) {
            const url = `http://127.0.0.1:5000/fetch-data/${year}/${month}/0/${selectedBuilding}`;
            console.log('Fetching from URL:', url);
            try {
              const response = await axios.get(url);
              buildingData.push(...response.data);
            } catch (error) {
              console.error('Failed to fetch data:', error);
              throw error;
            }
          }
        }

        const baseCoordinates = buildingLocations[selectedBuilding];
        const buildingSize = buildingSizes[selectedBuilding];
        
        const newBuilding = {
          name: selectedBuilding,
          coordinates: [
            [baseCoordinates[0], baseCoordinates[1]],
            [baseCoordinates[0], baseCoordinates[1] + buildingSize],
            [baseCoordinates[0] + buildingSize, baseCoordinates[1] + buildingSize],
            [baseCoordinates[0] + buildingSize, baseCoordinates[1]]
          ],
          color: buildingColors[selectedBuilding],
          data: buildingData
        };

        setBuildings(prev => {
          const newBuildings = { ...prev, [selectedBuilding]: newBuilding };
          saveBuildingsToLocalStorage(newBuildings); // Save to localStorage
          return newBuildings;
        });

        // After adding the building, fetch its stats
        await fetchBuildingStats(selectedBuilding, selectedDate);
      } catch (error) {
        console.error('Error in addBuilding:', error);
      }
    }
  };

  const getHeatmapColor = (consumption, average) => {
    if (!consumption) return '#cccccc'; // Default gray for no data
  
    // Adjust the ranges based on the average consumption
    const low = average ;     // Green zone
    const medium = average;         // Yellow zone
    const high = average * 1.000005;    // Red zone
  
    if (consumption <= low) {
      // Green to Yellow gradient
      const ratio = consumption / low;
      return `rgb(${Math.floor(255 * ratio)}, 255, 0)`;
    } else if (consumption <= medium) {
      // Yellow to Red gradient
      const ratio = (consumption - low) / (medium - low);
      return `rgb(255, ${Math.floor(255 * (1 - ratio))}, 0)`;
    } else {
      // Deep red for high consumption
      return '#ff0000';
    }
  };
  
  // Update the fetchBuildingStats function to use the new getHeatmapColor function
  const fetchBuildingStats = async (buildingName, date) => {
    updateBuildingAccessTime(buildingName);
    try {
      // First check if we have data for this building and date
      if (!availableData[buildingName]) {
        console.log('No data available for building:', buildingName);
        return;
      }
  
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();  // Get the actual selected day
      const dateKey = '${year}-${month}-${day}';
      
      if (buildings[buildingName]?.data?.[dateKey]) {
        setStats(buildings[buildingName].data[dateKey]);
        return; // Skip fetching if data is already stored
      }

      // // Check if we have data for this year and month
      // const buildingInfo = availableData[buildingName];
      // console.log('Available data for building:', buildingInfo);
  
      // // Get available years
      // const availableYears = Object.keys(buildingInfo);
      // if (!availableYears.includes(year.toString())) {
      //   console.log('No data for year:', year);
      //   setError(`No data available for ${year}`);
      //   return;
      // }
  
      // // Get available months for this year
      // const availableMonths = Object.keys(buildingInfo[year.toString()]);
      // if (!availableMonths.includes(month.toString())) {
      //   console.log('No data for month:', month);
      //   setError(`No data available for month ${month}`);
      //   return;
      // }

      const API_URL = `http://127.0.0.1:5000/fetch-data/${year}/${month}/${day}/${buildingName}`;
      console.log('Fetching from URL:', API_URL);
  
      const response = await fetch(API_URL);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Received data:', data);
  
      const API_URL2 = `http://127.0.0.1:5000/stats/${year}/${month}/1/${buildingName}`;
      console.log('Fetching from URL:', API_URL2);
  
      const response2 = await fetch(API_URL2);
      if (!response2.ok) {
        throw new Error(`HTTP error! status: ${response2.status}`);
      }
      
      const stat_data = await response2.json();
      console.log('Received data:', stat_data);
  
      // Update stats with the processed data
      const statsData = {
      consumption: data.consumption,
      month: `${month}/${year}`,
      day: day,
      average: stat_data.mean,
      max: stat_data.highest,
      min: stat_data.lowest,
      median: stat_data.median,
      color: getHeatmapColor(parseFloat(data.consumption), parseFloat(stat_data.mean))
    };

    // Set the current stats
    setStats(statsData);

    // Update building colors based on consumption and average
    if (buildings[buildingName]) {
      setBuildings(prev => ({
        ...prev,
        [buildingName]: {
          ...prev[buildingName]
        }
      }));
    }

    // Safely update buildingStats with the newly fetched data,
    // ensuring previous data is preserved or defaulted to an empty object.
    setBuildingStats(prev => ({
      ...prev,
      [buildingName]: {
        ...(prev[buildingName] || {}),
        data: { ...(prev[buildingName]?.data || {}), [dateKey]: statsData }
      }
    }));
  } catch (error) {
    console.error('Error fetching building stats:', error);
    setError('Failed to fetch building statistics');
    setStats(null);
  }
};

  // Update the DatePicker onChange handler
  const handleDateChange = (date) => {
    setSelectedDate(date);
    saveSelectedDateToLocalStorage(date); // Save to localStorage
    if (selectedBuilding) {
      fetchBuildingStats(selectedBuilding, date);
    }
  };


  const handleBuildingClick = (buildingName) => {
    setSelectedBuilding(buildingName);
    saveSelectedBuildingToLocalStorage(buildingName); // Save to localStorage
    updateBuildingAccessTime(buildingName);
    fetchBuildingStats(buildingName, selectedDate);
  };

  const handleDragEnd = (buildingName, newLatLng) => {
    setBuildings((prevBuildings) => {
      const prevCoords = prevBuildings[buildingName].coordinates;
      if (!prevCoords || prevCoords.length === 0) return prevBuildings;

      const deltaLat = newLatLng.lat - prevCoords[0][0];
      const deltaLng = newLatLng.lng - prevCoords[0][1];

      const updatedCoords = prevCoords.map(([lat, lng]) => [lat + deltaLat, lng + deltaLng]);

      return {
        ...prevBuildings,
        [buildingName]: {
          ...prevBuildings[buildingName],
          coordinates: updatedCoords
        }
      };
    });
  };

  const handleDayChange = (event) => {
    const day = parseInt(event.target.value);
    setSelectedDay(day);
    const newDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
    setSelectedDate(newDate);
    saveSelectedDateToLocalStorage(newDate); 
    if (selectedBuilding) {
      fetchBuildingStats(selectedBuilding, newDate);
      updateAllBuildings(newDate);
    }
  };
  
  const updateAllBuildings = async (newDate) => {
    try {
      const updatedBuildings = { ...buildings };
      const year = newDate.getFullYear();
      const month = newDate.getMonth() + 1; // JavaScript months are 0-based
      const day = newDate.getDate();
      const dateKey = `${year}-${month}-${day}`;

      for (const buildingName of Object.keys(updatedBuildings)) {
        // First check if data is available for the building
        if (!availableData[buildingName]) {
          console.log('No data available for building:', buildingName);
          continue;
        }
  
        
  
        const buildingInfo = availableData[buildingName];
        console.log(`Available data for ${buildingName}:`, buildingInfo);
  
        // Validate year availability
        const availableYears = Object.keys(buildingInfo);
        if (!availableYears.includes(year.toString())) {
          console.log(`No data for year ${year} in ${buildingName}`);
          continue;
        }
  
        // Validate month availability
        const availableMonths = Object.keys(buildingInfo[year.toString()]);
        if (!availableMonths.includes(month.toString())) {
          console.log(`No data for month ${month} in ${buildingName}`);
          continue;
        }

        
        let statsData;
        // Check if data is already cached for this date
        if (updatedBuildings[buildingName]?.data?.[dateKey]) {
          statsData = updatedBuildings[buildingName].data[dateKey];
          console.log(`Using cached data for ${buildingName} on ${dateKey}`);
        } else {
          // Fetch data if not cached
          const API_URL = `http://127.0.0.1:5000/fetch-data/${year}/${month}/${day}/${buildingName}`;
          console.log(`Fetching stats for ${buildingName} from ${API_URL}`);

          const response = await fetch(API_URL);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data = await response.json();

          const API_URL2 = `http://127.0.0.1:5000/stats/${year}/${month}/${day}/${buildingName}`;
          console.log(`Fetching stats for ${buildingName} from ${API_URL2}`);

          const response2 = await fetch(API_URL2);
          if (!response2.ok) {
            throw new Error(`HTTP error! status: ${response2.status}`);
          }
          const stat_data = await response2.json();

          statsData = { 
            consumption: data.consumption,
            month: `${month}/${year}`,
            day: day,
            average: stat_data.mean,
            max: stat_data.highest,
            min: stat_data.lowest,
            median: stat_data.median,
            color: getHeatmapColor(parseFloat(data.consumption), parseFloat(stat_data.mean))
          };
          
    
          // Update building stats and colors
          updatedBuildings[buildingName] = {
            ...updatedBuildings[buildingName],
            data: { ...updatedBuildings[buildingName].data, [dateKey]: statsData }
          };
        }

        updatedBuildings[buildingName] = {
          ...updatedBuildings[buildingName],
          stats: statsData,
          color: statsData.color
        };
      }
  
      // Update the state with new building data
      setBuildings(updatedBuildings);
      saveBuildingsToLocalStorage(updatedBuildings); 
    } catch (error) {
      console.error('Error updating all buildings:', error);
      setError('Failed to update all buildings');
    }
  };
  
  

  // Add this function to check if a date has data available
  const isDateAvailable = (date) => {
    if (!selectedBuilding || !availableData[selectedBuilding]) return false;
    
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString();
    
    return availableData[selectedBuilding][year] && 
           availableData[selectedBuilding][year][month];
  };

  // Add function to toggle between point and heatmap view
  const toggleHeatmap = () => {
    setIsHeatmap(!isHeatmap);
  };

  // Update generateHeatmapData function
  const generateHeatmapData = () => {
    const points = [];
    // Create a dateKey matching the caching format: "year-month-day"
    const dateKey = `${selectedDate.getFullYear()}-${selectedDate.getMonth() + 1}-${selectedDate.getDate()}`;
  
    // Determine the maximum consumption among buildings for normalization
    let maxConsumption = 0;
    Object.values(buildings).forEach((building) => {
      // Check if the building's cached data for this date exists
      if (building.data && building.data[dateKey] && building.data[dateKey].consumption) {
        maxConsumption = Math.max(maxConsumption, parseFloat(building.data[dateKey].consumption));
      }
    });
    console.log('Max consumption:', maxConsumption);
  
    // Generate heatmap points using the cached data from each building
    Object.values(buildings).forEach((building) => {
      if (building.data && building.data[dateKey] && building.data[dateKey].consumption) {
        const consumption = parseFloat(building.data[dateKey].consumption);
        if (consumption > 0 && maxConsumption > 0) {
          const intensity = consumption / maxConsumption;
          // Assume the first coordinate is the center
          const lat = parseFloat(building.coordinates[0][0]);
          const lng = parseFloat(building.coordinates[0][1]);
          if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            // Add the center point
            points.push([lat, lng, intensity]);
            // Generate additional points for a spread effect
            const spread = Math.min(intensity * 0.0002, 0.001);
            points.push([lat + spread, lng + spread, intensity * 0.8]);
            points.push([lat - spread, lng - spread, intensity * 0.8]);
            points.push([lat + spread, lng - spread, intensity * 0.8]);
            points.push([lat - spread, lng + spread, intensity * 0.8]);
          } else {
            console.warn(`Invalid coordinates for building ${building.name}: lat=${lat}, lng=${lng}`);
          }
        }
      } else {
        console.warn(`No consumption data for building ${building.name}`);
      }
    });
    console.log('Generated heatmap points:', points);
    setHeatmapPoints(points);
  };

  
  const filteredBuildings = Object.values(buildings).filter((building) => {
    const buildingNumber = building.name.split(' ')[1]; // Extract the number from the building name
    if (buildingFilter === 'all') return true;
    if (buildingFilter === '100s') return buildingNumber.startsWith('1');
    if (buildingFilter === '200s') return buildingNumber.startsWith('2');
    if (buildingFilter === '500s') return buildingNumber.startsWith('5');
    return true;
  });

  

  // Update heatmap when buildingStats changes
  useEffect(() => {
    if (isHeatmap) {
      generateHeatmapData();
    }
  }, [buildingStats, isHeatmap]);

  return (
    <div className="map-container">
      <div className="map-section">
        <div className="map-wrapper">
          <MapContainer 
            center={[29.628014, -95.610553]}
            zoom={16}
            className="leaflet-container"
            scrollWheelZoom={true}
          >
            <div className="map-controls">
              <button 
                className="control-button toggle-view"
                onClick={toggleHeatmap}
                style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  zIndex: 1000,
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  width: 'auto',
                  minWidth: 'fit-content'
                }}
              >
                {isHeatmap ? 'Hide Heatmap' : 'Show Heatmap'}
              </button>
            </div>
            
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            
            {filteredBuildings.map((building) => (
              <Polygon
                key={building.name}
                positions={building.coordinates}
                pathOptions={{ 
                  color: selectedBuilding === building.name ? '#000' : building.color,
                  fillColor: buildingStats[building.name]?.average 
                    ? getHeatmapColor(parseFloat(buildingStats[building.name].consumption), parseFloat(buildingStats[building.name].average))
                    : building.color,
                  fillOpacity: isEditing ? 0.8 : 0.6,
                  weight: 2,
                  opacity: 1
                }}
                draggable={isEditing}
                eventHandlers={{
                  dragend: (e) => {
                    const { lat, lng } = e.target.getLatLngs()[0][0];
                    handleDragEnd(building.name, { lat, lng });
                  },
                  click: () => {
                    if (!isEditing) {
                      handleBuildingClick(building.name);
                    }
                  }
                }}
              >
                <Tooltip>
                  {building.name}
                  {buildingStats[building.name] && 
                    ` - ${buildingStats[building.name].average} kWh`}
                  {!isEditing && " (Click for stats)"}
                </Tooltip>
              </Polygon>
            ))}

            {showBuildingNames && filteredBuildings.map((building) => {
              const buildingNumber = building.name.split(' ')[1];
              const centerLat = (building.coordinates[0][0] + building.coordinates[2][0]) / 2;
              const centerLng = (building.coordinates[0][1] + building.coordinates[2][1]) / 2;

              return (
                <Marker
                  key={`label-${building.name}`}
                  position={[centerLat, centerLng]}
                  icon={L.divIcon({
                    className: 'building-label',
                    html: `<div>${buildingNumber}</div>`,
                    iconSize: [40, 40],
                    iconAnchor: [20, 20]
                  })}
                  interactive={false}
                />
              );
            })}

            {isEditing && Object.values(buildings).map((building) => (
              <Marker
                key={`marker-${building.name}`}
                position={building.coordinates[0]}
                draggable={true}
                eventHandlers={{
                  dragend: (e) => {
                    const { lat, lng } = e.target.getLatLng();
                    handleDragEnd(building.name, { lat, lng });
                  }
                }}
              >
                <Popup>Drag to move building</Popup>
              </Marker>
            ))}

            {isHeatmap && <HeatmapLayer points={heatmapPoints} />}
          </MapContainer>
        </div>
      </div>

      <div className="controls-section">
        <div className="controls-container">
          <h3 className="controls-header">Building Controls</h3>
          <select 
            className="building-select"
            value={selectedBuilding || ''}
            onChange={(e) => setSelectedBuilding(e.target.value)}
          >
            <option value="">Select a building</option>
            {Object.keys(availableData).map(building => (
              <option key={building} value={building}>{building}</option>
            ))}
          </select>
          
          <button 
            className="control-button add-button"
            onClick={addBuilding}
          >
            Add Building
          </button>

          <button 
            className={`control-button edit-button ${isEditing ? 'active' : ''}`}
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? "Exit Edit Mode" : "Edit Buildings"}
          </button>
          {isEditing && (
            <div className="edit-buildings-list">
              <h4>Edit Buildings</h4>
              <ul>
                {Object.keys(buildings).map((buildingName) => (
                  <li key={buildingName} className="edit-building-item">
                    <span>{buildingName}</span>
                    <button
                      className="delete-button"
                      onClick={() => deleteBuilding(buildingName)}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
            <div className="filter-buttons">
              <button 
                className={`filter-button ${buildingFilter === 'all' ? 'active' : ''}`}
                onClick={() => handleFilterChange('all')}
              >
                All Buildings
              </button>
              <button 
                className={`filter-button ${buildingFilter === '100s' ? 'active' : ''}`}
                onClick={() => handleFilterChange('100s')}
              >
                100s
              </button>
              <button 
                className={`filter-button ${buildingFilter === '200s' ? 'active' : ''}`}
                onClick={() => handleFilterChange('200s')}
              >
                200s
              </button>
              <button 
                className={`filter-button ${buildingFilter === '500s' ? 'active' : ''}`}
                onClick={() => handleFilterChange('500s')}
              >
                500s
              </button>
            </div>

          {selectedBuilding && buildings[selectedBuilding] && (
            <div className="stats-box">
              <div className="stats-header">
                <h4 className="building-name">{selectedBuilding}</h4>
                <button
                  onClick={() => setSelectedBuilding(null)}
                  className="close-button"
                >
                  ✕
                </button>
              </div>
              
              <div className="date-container">
                <div className="date-label">Select Date</div>
                <DatePicker
                  selected={selectedDate}
                  onChange={handleDateChange}
                  dateFormat="yyyy/MM/dd"
                  minDate={minDate}
                  maxDate={maxDate}
                  filterDate={isDateAvailable}
                  customInput={
                    <input className="date-picker" />
                  }
                />
              </div>
              <div className="slider-container">
                <label>Day: {selectedDay}</label>
                <input
                  type="range"
                  min="1"
                  max={new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate()} 
                  value={selectedDay}
                  onChange={handleDayChange}
                  className="slider"
                />
              </div>

              <div className="stats-container">
                {stats ? (
                  <div>
                    <div className="stat-item">
                      <span className="stat-label">Consumption</span>
                      <span className={`consumption-value ${stats.consumption > stats.average ? 'bad' : 'good'}`}>
                        {stats.consumption} kWh
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Estimated Cost</span>
                      <span className="stat-value">
                        ${(stats.consumption * 0.1).toFixed(2)}
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Month/Year</span>
                      <span className="stat-value">{stats.month}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Average</span>
                      <span className="stat-value">
                        {(stats.average)}
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Max</span>
                      <span className="stat-value">
                        {(stats.max)}
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Min</span>
                      <span className="stat-value">
                        {(stats.min)}
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Median</span>
                      <span className="stat-value">
                        {(stats.median)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="no-stats">
                    Select a date to view statistics
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Map = () => {
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) return null;

  return <MapComponent />;
};

export default Map;