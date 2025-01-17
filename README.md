
# Electricity Consumption Tracker

**Brief Summary**:  
The Electricity Consumption Tracker is a web application designed to help users monitor and visualize their electricity consumption. The application displays data through a line graph and provides relevant statistics about energy usage, including the average daily consumption, total cost, and more. The data can be uploaded via CSV files for different months, and the system generates real-time visualizations to help users make informed decisions about energy usage.

**Required Installations**
Running the code will require users to install these applications first into their virtual environment:
- pip install flask flask-cors matplotlib panda
- npm install chart.js axios chartjs-plugin-annotation

# Release Notes

## Release 0.0.0

This is the initial release of the Electricity Consumption Tracker application.

### Features

- **CSV File Upload**: Users can upload CSV files containing monthly energy consumption data for visualization.
- **Line Graph Display**: The uploaded data is displayed on a dynamic line graph, comparing energy consumption over time.
- **Real-time Data Fetching**: The app fetches data from the backend to display the latest energy statistics.
- **Stats Display**: Includes detailed energy consumption stats such as average usage, total cost, max usage, and more for each month (e.g., June, July).

### Bug Fixes

- N/A: As this is the first release, no bug fixes were necessary.

### Known Issues

- **Graph not displaying on initial load**: Sometimes, the graph may fail to render if the data is not available immediately. This issue will be addressed in the next release.
- **Stats Box Updates**: The stats box may not reflect updates correctly after new data is uploaded. This will be fixed in future versions to ensure proper reactivity.
- **Uploaded Data Not Syncing with Graph and Stats box**: The data in the CSV files, while can be uploaded, are not synced with the line graph and stats box. 
