
# Electricity Consumption Tracker

**Brief Summary**:  
The Electricity Consumption Tracker is a web application designed to help users monitor and visualize their electricity consumption. The application displays data through a line graph and provides relevant statistics about energy usage, including the average daily consumption, total cost, and more. The data can be uploaded via CSV files for different months, and the system generates real-time visualizations to help users make informed decisions about energy usage.

**Required Installations**
Running the code will require users to install these applications first into their virtual environment:
- pip install flask flask-cors matplotlib panda mysql-connector mysql-connector-python mysql-connector-python-rf pymysql flask-sqlalchemy Flask-Caching apscheduler
- npm install chart.js axios chartjs-plugin-annotation react-router-dom
react-leaflet@4.2.1 leaflet@1.9.4 @types/leaflet --legacy-peer-deps leaflet.heat
# Release Notes

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

