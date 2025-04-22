# Electricity Consumption Tracker - OFFICIAL RELEASE VERSION 1.0

**Brief Summary**:  
The Electricity Consumption Tracker is a web application designed to help users monitor and visualize their electricity consumption. The application displays data through a line graph and provides relevant statistics about energy usage, including the average daily consumption, total cost, and more. The data can be uploaded via CSV files for different months, and the system generates real-time visualizations to help users make informed decisions about energy usage.

**Required Installations**  
Running the code will require users to install these applications first into their virtual environment:
- pip install flask flask-cors matplotlib panda mysql-connector mysql-connector-python mysql-connector-python-rf pymysql flask-sqlalchemy Flask-Caching apscheduler prophet plotly scikit-learn redis flask-cachin
- npm install chart.js axios chartjs-plugin-annotation react-router-dom prophet plotly scikit-learn react-leaflet@4 leaflet leaflet.heat react-datepicker 

---

# Features

### Line Graph
- **CSV File Upload**: Users can upload CSV files containing monthly energy consumption data for visualization.
- **Dynamic Line Graph**: Displays uploaded data dynamically, comparing energy consumption over time.
- **Prediction ML Functionality**: Integrated Machine Learning (Prophet and Random Tree) to predict future consumption.
- **Enhanced Statistics Box**: Displays detailed consumption data, including estimated cost, average, max, min, and median values.
- **Improved Comparison Feature**: Highlights now correctly follow and fit inside the line graph.
- **UI Improvements**: Enhanced the overall UI for better usability.

### Heat Map
- **Interactive Campus Map**: Displays an interactive map of the facility campus with interactable buildings.
- **Heatmap Visualization**: Visualizes electricity consumption intensity across buildings.
- **Dynamic Building Colors**: Updates building colors dynamically based on consumption data.
- **Building Filters**: Filters buildings based on their number series (e.g., 100s, 200s, 500s).
- **Building Names Toggle**: Allows toggling building names on the map.
- **Dynamic Time Selector and Drag Bar**: Enables real-time updates to the heat map for specific months/years.

### Calendar
- **Calendar Integration**: Visualizes electricity consumption on a daily basis.
- **Date Selection**: Allows users to select specific dates for detailed consumption data.
- **Color Visuals**: Highlights under/over-consumption days with green/red colors.
- **Consumption/Cost View**: Switches between Consumption (kWh) and Cost ($) views.
- **Monthly Net**: Displays the net output of the month compared to the yearly average.

### Chatbot
- **UI**: Designed a chatbot button and conversation dialog with light/dark mode styling.
- **Enhanced Chatbot Functionality**: Provides insights into electricity consumption, building comparisons, and energy metrics.
- **Conversation History**: Saves chat history in local storage across sessions.
- **Error Handling**: Enhanced error handling for chatbot API calls.

### Report Feature
- **Pie Chart View**: Visualizes building energy consumption breakdown.
- **Monthly and Yearly Averages**: Displays averages for selected buildings.
- **PDF Export**: Allows exporting reports as PDF files.
- **Dynamic Building Stats**: Provides building-specific statistics, including highest and lowest consumption months.
- **Enhanced Metrics**: Includes CO₂ emissions and estimated cost calculations.

### Anomaly Detection
- **Detection Methods**: Supports multiple methods (`Z-Score` and `Local Outlier Factor`) with configurable sensitivity.
- **Severity Classification**: Classifies anomalies into `Critical` and `Warning` levels.
- **Anomaly Statistics**: Displays detailed statistics, including the percentage of anomalies and highest/lowest consumption days.

### Alert System
- **Alert Filters**: Filters alerts by building, year, month, severity, and time range.
- **Email Notifications**: Sends daily reports and alerts via email.
- **Pagination**: Implements pagination for the alert table.


### Dashboard
- **Customizable Layout**: Users can customize the dashboard layout by dragging and dropping widgets.
- **Widget Visibility**: Toggle the visibility of widgets to personalize the dashboard.
- **Theme Toggle**: Switch between light and dark modes for the dashboard.
- **Quick Upload**: Provides a quick upload widget for CSV files.
- **Daily Metrics Sidebar**: Displays daily metrics in a compact sidebar widget.
- **Alert Widget**: Includes an alert widget for real-time notifications and updates.
- **Persistent Preferences**: Saves user preferences (e.g., layout, theme) in local storage for a personalized experience.


### Overall System
- **Theme Toggle**: Adds a light/dark mode toggle for the entire application.
- **Built-in System Clock**: Displays today's date for real-time data updates.

---

# Known Issues
- **Heatmap Performance**: May experience performance issues with a large number of data points/buildings.
- **Chatbot Context Limitations**: The chatbot may lose context during long conversations.

---

# Bug Fixes
- **Graph Rendering**: Fixed issues with graph rendering on initial load and after new data uploads.
- **Data Syncing**: Ensured uploaded data syncs correctly with the line graph and statistics box.
- **Calendar Rendering**: Resolved issues with calendar rendering and date selection syncing.
- **Building Coordinates**: Fixed inaccuracies in building placement on the map.
- **Error Handling**: Improved error handling across all components.
- **Cache Validation**: Ensured cached data is always up-to-date.
- **Email Notifications**: Addressed formatting and delivery errors in email notifications.
- **UI Responsiveness**: Improved layout and responsiveness for smaller screens.




