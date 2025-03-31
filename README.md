# Electricity Consumption Tracker

**Brief Summary**:  
The Electricity Consumption Tracker is a web application designed to help users monitor and visualize their electricity consumption. The application displays data through a line graph and provides relevant statistics about energy usage, including the average daily consumption, total cost, and more. The data can be uploaded via CSV files for different months, and the system generates real-time visualizations to help users make informed decisions about energy usage.

**Required Installations**
Running the code will require users to install these applications first into their virtual environment:
- pip install flask flask-cors matplotlib panda mysql-connector mysql-connector-python mysql-connector-python-rf pymysql flask-sqlalchemy Flask-Caching apscheduler prophet plotly scikit-learn redis flask-cachin
- npm install chart.js axios chartjs-plugin-annotation react-router-dom prophet plotly scikit-learn react-leaflet@4 leaflet leaflet.heat react-datepicker 

# Release Notes
 **Dynamic Building Colors**: Updated building colors dynamically based on consumption data and average values.
## Release 0.0.0

This is the initial release of the Electricity Consumption Tracker application.

### Features

- **CSV File Upload**: Users can upload CSV files containing monthly energy consumption data for visualization.
- **Line Graph Display**: The uploaded data is displayed on a dynamic line graph, comparing energy consumption over time.

### Bug Fixes

- N/A: As this is the first release, no bug fixes were necessary.

### Known Issues

- **Graph not displaying on initial load**: Sometimes, the graph may fail to render if the data is not available immediately. This issue will be addressed in the next release.
- **Stats Box Updates**: The stats box may not reflect updates correctly after new data is uploaded. This will be fixed in future versions to ensure proper reactivity.
- **Uploaded Data Not Syncing with Graph and Stats box**: The data in the CSV files, while can be uploaded, are not synced with the line graph and stats box. 




## Release 0.1.0

### Features

- **Modal for Data Selection**: Implemented a modal window in `Graph.js` for selecting buildings, years, and months.
- **Predict Button**: Added a "Predict" button in `LineGraph.js` for future machine learning integration.
- **Backend Endpoints**: Added new API endpoints in `main.py` to fetch available months and buildings.
- **Data Fetching and Display**: Updated `Graph.js` and `LineGraph.js` to fetch and display data based on user selections.
- **Caching**: Implemented caching in the backend to improve performance and reduce database load.
- **Scheduler**: Added a scheduler to periodically refresh the cache.
- **MySQL Database**: Create and maintain a SQL database that hold electricity data pull from the uploaded CSV files. 
- **Basic Dashboard and Menu Page**: Created a basic dashboard and menu page to improve user navigation and accessibility.

### Bug Fixes

- **Graph Rendering**: Fixed an issue where the graph would not render on initial load if the data was not available immediately.
- **Select Month Update**: Fixed an issue where the user were not able to correctly choose the month data that they wanted to display
- **Data Syncing**: Ensured that uploaded data syncs correctly with the line graph and stats box.

### Known Issues

- **Prediction Functionality**: The "Predict" button is currently a placeholder and does not yet trigger any machine learning predictions. This will be implemented in future versions.





## Release 0.2.0

### Features

#### Line Graph (Updates)
- **Prediction ML Functionality**: Implemented and integrated Machine Learning tech stack of Prophet and Random Tree to predict future consumption
- **Enhanced Statistics Box**: Improved the statistics box to display detailed consumption data, including estimated cost, average, max, min, and median values.
- **Data Caching**: Increased data cache size to store and retrieve building statistics efficiently.
- **Improved Comparision Feature**: Improved the comparision feature where the highlight now correct follows and fit inside the line graph
- **UI Improvements**: Improved the overall UI and looks of various features of the Line Graph section of this project. 

#### Heat Map
- **Interactive Campus Map**: Create an interactive map of the facility campus with interactable buildings and movements of map. 
- **Heatmap Visualization**: Added a heatmap view in the map component to visualize electricity consumption intensity across buildings.
- **Dynamic Building Colors**: Updated building colors dynamically based on consumption data and average values.
- **Building Filters**: Implemented filters to display buildings based on their number series (e.g., 100s, 200s, 500s).
- **Building Names Toggle**: Added a button to show or hide building names on the map.
- **Heatmap Points Generation**: Implemented a function to generate heatmap points based on building consumption data.
- **Dynamic Time Selector and Drag Bar**: Implement a feature to view the heat map energy under a specific month/year with a drag bar to drag through all the days with real-time update to the heat map. 

### Bug Fixes

- **Graph Rendering**: Fixed an issue where the graph would not render correctly when new data was added.
- **Data Syncing**: Ensured that uploaded data syncs correctly with the line graph and statistics box.
- **Date Availability Check**: Added a function to check if a date has data available before fetching statistics.
- **Building Coordinates**: Fixed issues with building coordinates to ensure accurate placement on the map.
- **Error Handling**: Improved error handling for data fetching and building statistics retrieval.

### Known Issues
- **Heatmap Performance**: The heatmap view may experience performance issues with a large number of data points. Optimization will be addressed in future releases.
- **Shape of Building Object**: Buildings in Heat Map feature all have rectangle shape. Improvements can be made to make the overall map looks more realistic by making the buildings into different shapes and positions.  




## Release 0.3.0

### Features

#### Calendar
- **Calendar Integration**: Added a calendar feature to visualize electricity consumption on a daily basis.
- **Date Selection**: Users can select specific dates to view detailed consumption data.
- **Color Visuals**: Under/Over consumption compared to the month average days are highlighted with green/red color on the calendar.
- **Consumption/Cost View**: Users can switch between Consumption(kWh) and Cost ($) views to get a broader perspective of their energy usage.
- **Interactive UI**: Improved the user interface for better interaction with the calendar feature.
- **Monthly Net** Display the net output/ of the month in comparision to the average of the year. 

### Bug Fixes

- **Calendar Rendering**: Fixed an issue where the calendar would not render correctly when switching between views.
- **Date Selection Sync**: Ensured that the selected date on the calendar syncs correctly with the detailed consumption data view.
- **Event Highlighting**: Improved the accuracy of event highlighting on the calendar.
- **Graph Rendering**: Fixed an issue where the graph would not render correctly when new data was added.
- **Data Syncing**: Ensured that uploaded data syncs correctly with the line graph and statistics box.
- **Date Availability Check**: Added a function to check if a date has data available before fetching statistics.
- **Error Handling**: Improved error handling for data fetching and building statistics retrieval.

### Known Issues
- **Heatmap Performance**: The heatmap view may experience performance issues with a large number of data points. Optimization will be addressed in future releases.
- **Shape of Building Object**: Buildings in Heat Map feature all have rectangle shape. Improvements can be made to make the overall map looks more realistic by making the buildings into different shapes and positions.

## Release 0.4.0

### Features

#### Overall System
- **Theme Toggle**: Added a light/dark mode toggle for the entire web application. All features have implemented dark mode styling
- **Built-in System Clock**: Added a System Clock to record the date of today (can be change) so that other features can display today's data. 


#### Chatbot
- **UI**: Design Chatbot button and conversation dialog UI (textbox, messages) with dark/light mode styling
- **WIP Enhanced Chatbot Functionality**: Improved chatbot responses to provide detailed insights into electricity consumption, building comparisons, and energy metrics.
- **WIP Conversation History**: Chat history is now saved in local storage and persists across sessions.
- **WIP Error Handling**: Enhanced error handling for chatbot API calls with user-friendly messages.

#### Report Feature
- **Pie Chart View**: Added a pie chart visualization for building energy consumption breakdown.
- **Monthly and Yearly Averages**: Displayed monthly and yearly averages for selected buildings.
- **PDF Export**: Users can now export reports as PDF files.
- **Dynamic Building Stats**: Enhanced building-specific statistics, including highest and lowest consumption months.
- **Cache Validation**: Ensures cached data is valid and up-to-date, especially for "All Buildings" selection.


#### Report Widget (Dashboard)
- **Local Storage Caching**: Implemented caching for daily reports to improve performance and reduce API calls.
- **Data Cleanup**: Automatically removes cached reports older than 7 days to optimize storage usage.
- **Enhanced Metrics**: Added CO₂ emissions and estimated cost calculations to the widget.
- **Compact View**: Improved UI for better readability in compact mode.



### Bug Fixes

- **Chatbot API Endpoint**: Fixed an issue where the chatbot API endpoint could not be updated dynamically.
- **Report Data Sync**: Resolved inconsistencies in syncing report data with the selected date and building.
- **Local Storage Quota**: Improved handling of local storage quota errors by cleaning up old data.
- **UI Responsiveness**: Fixed layout issues in the report widget and report page for smaller screens.
- **Error Handling**: Enhanced error handling for API failures across all components.

### Known Issues

- **Chatbot Controls Overlap**: The theme toggle button and exit button overlaps with eachother
- **LLaMA Fetching Issue**: There is fetching issue with LLaMA where it have error communicating with the server 
- **Chatbot Context Limitations**: The chatbot may lose context for long conversations. Future updates will address this limitation.