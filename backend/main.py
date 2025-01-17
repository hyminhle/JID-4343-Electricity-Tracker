from flask import Flask, jsonify, request
import numpy as np
from flask_cors import CORS
import pandas as pd
import re

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "http://localhost:3000"}})

# Define global variable for data
monthly_data = {}

def parse_csv(file):
    try:
        # Read the CSV file
        df = pd.read_csv(file)

        # Extract the date columns (assumes the first two columns are not part of the date-based data)
        dates = df.columns[2:]

        # Extract the consumption data and ensure it's converted to a list of floats
        consumption_data = df.iloc[0, 2:].astype(float)

        # Extract the month from the first date
        first_date = dates[0]
        month_number = first_date.split('/')[0]  # Extract the first part (month) from the date string

        # Map numeric month to month name
        months = {
            '1': 'January', '2': 'February', '3': 'March', '4': 'April',
            '5': 'May', '6': 'June', '7': 'July', '8': 'August',
            '9': 'September', '10': 'October', '11': 'November', '12': 'December'
        }

        month_name = months.get(month_number, 'Unknown')

        # Check for empty consumption data
        if not any(consumption_data):  # Check if the list has valid non-zero data
            return None, "No valid consumption data found in the file."

        # Store the data for the month
        monthly_data[month_name] = consumption_data

        return month_name, consumption_data

    except Exception as e:
        return None, f"Error processing file: {str(e)}"

@app.route('/upload', methods=['POST'])
def upload_files():
    try:
        files = request.files
        
        if 'file1' not in files and 'file2' not in files:
            return jsonify({'error': 'No files uploaded'}), 400

        # Process first file if present
        if 'file1' in files:
            file1 = files['file1']
            month1, data1 = parse_csv(file1)
            if not month1:
                return jsonify({'error': data1}), 400

        # Process second file if present
        if 'file2' in files:
            file2 = files['file2']
            month2, data2 = parse_csv(file2)
            if not month2:
                return jsonify({'error': data2}), 400

        return jsonify({
            'message': 'Files uploaded successfully',
            'data': {
                'month1': month1 if 'file1' in files else None,
                'month2': month2 if 'file2' in files else None
            }
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/stats', methods=['GET'])
def get_stats():
    try:
        if not monthly_data:
            return jsonify({'error': 'No data available'}), 404

        months = list(monthly_data.keys())
        if len(months) == 0:
            return jsonify({'error': 'No monthly data available'}), 404

        # Get data for the latest two months
        current_month = months[-1] if months else None
        previous_month = months[-2] if len(months) > 1 else None

        response_data = {
            'currentMonth': current_month,
            'previousMonth': previous_month,
            'currentMonthData': monthly_data[current_month].tolist() if current_month else [],
            'previousMonthData': monthly_data[previous_month].tolist() if previous_month else [],
            'stats': {}
        }

        # Calculate statistics for current month
        if current_month:
            current_data = monthly_data[current_month]
            response_data['stats']['currentMonth'] = {
                'average': float(np.mean(current_data)),
                'max': float(np.max(current_data)),
                'min': float(np.min(current_data)),
                'total': float(np.sum(current_data))
            }

        # Calculate statistics for previous month
        if previous_month:
            previous_data = monthly_data[previous_month]
            response_data['stats']['previousMonth'] = {
                'average': float(np.mean(previous_data)),
                'max': float(np.max(previous_data)),
                'min': float(np.min(previous_data)),
                'total': float(np.sum(previous_data))
            }

        return jsonify(response_data)

    except Exception as e:
        return jsonify({'error': str(e)}), 500


####
import pandas as pd
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error
from sklearn.preprocessing import OneHotEncoder
import glob
import os

# Function to load and preprocess data
def load_and_prepare_data(file_paths):
    data_frames = []
    
    for file in file_paths:
        df = pd.read_csv(file)
        df_melted = df.melt(id_vars=["Group", "Resource"], var_name="Date", value_name="Consumption")
        df_melted["Date"] = pd.to_datetime(df_melted["Date"], format="%m/%d/%Y %H:%M")
        data_frames.append(df_melted[["Date", "Consumption"]])

    # Combine all data
    combined_data = pd.concat(data_frames, ignore_index=True)
    combined_data = combined_data.sort_values(by="Date")
    return combined_data

# Function to create features
def create_features(data):
    data["Day"] = data["Date"].dt.day
    data["Year"] = data["Date"].dt.year
    data["Month"] = data["Date"].dt.month
    data["DayOfWeek"] = data["Date"].dt.dayofweek

    # Lag features (previous day consumption)
    data["Lag_1"] = data["Consumption"].shift(1)
    data["Lag_7"] = data["Consumption"].shift(7)

    # Drop rows with NaN values (caused by lagging)
    data = data.dropna()
    return data

# Function to train the model and make predictions
def train_and_predict(data, target_month, target_year):
    # Filter data for the target month
    train_data = data[data["Month"] == target_month]

    # Features and target
    X = train_data[["Day", "Year", "DayOfWeek", "Lag_1", "Lag_7"]]
    y = train_data["Consumption"]

    # Train-test split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # Train the model
    model = GradientBoostingRegressor(random_state=42)
    model.fit(X_train, y_train)

    # Evaluate the model
    y_pred = model.predict(X_test)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    print(f"Model RMSE: {rmse}")

    # Generate predictions for the target year
    future_days = pd.DataFrame({
        "Day": range(1, 32),  # Days in the month
        "Year": [target_year] * 31,
        "DayOfWeek": [(pd.Timestamp(year=target_year, month=target_month, day=d).dayofweek) for d in range(1, 32)],
        "Lag_1": [np.nan] * 31,  # Placeholder, should be filled with the last known consumption value
        "Lag_7": [np.nan] * 31,  # Placeholder, should be filled with appropriate lag values
    })

    # Fill lag features with the most recent data
    last_week_data = train_data.iloc[-7:]
    future_days.loc[:6, "Lag_1"] = last_week_data["Consumption"].values[-7:]
    future_days.loc[:6, "Lag_7"] = last_week_data["Consumption"].values[:-1]

    # Predict
    predictions = model.predict(future_days.dropna())
    future_days["Prediction"] = predictions

    return future_days[["Day", "Prediction"]]

# Main script
if __name__ == "__main__":
    # Path to CSV files
    csv_files = glob.glob(os.path.join("data", "*.csv"))  # Adjust path to your files

    # Load and prepare data
    data = load_and_prepare_data(csv_files)
    data = create_features(data)

    # Train the model and predict for August 2025
    target_month = 8  # August
    target_year = 2025

    predictions = train_and_predict(data, target_month, target_year)

    # Display predictions
    print(predictions)

    # Save predictions to CSV
    predictions.to_csv("august_2025_predictions.csv", index=False)


####
if __name__ == '__main__':
    app.run(debug=True)