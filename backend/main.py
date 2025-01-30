from flask import Flask, jsonify, request
import numpy as np
from flask_cors import CORS
import pandas as pd
import re
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import mysql.connector
from flask_caching import Cache
from apscheduler.schedulers.background import BackgroundScheduler
import threading
from Predictor import Predictor

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "http://localhost:3000"}})
# Add database
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://SLB_admin:ElectricitySLB15#@electricitydata-db.cve2k4qgkm75.us-east-2.rds.amazonaws.com/electricitydata'
db = SQLAlchemy(app)

# Add cache
app.config['CACHE_TYPE'] = 'SimpleCache'
app.config['CACHE_DEFAULT_TIMEOUT'] = 300  # Cache timeout in seconds (5 minutes)
cache = Cache(app)

# Create scheduler
scheduler = BackgroundScheduler()

class ElectricityData(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    month = db.Column(db.String(20), nullable=False)
    date = db.Column(db.Date, nullable=False)
    consumption = db.Column(db.Float, nullable=False)
    building = db.Column(db.String(50), nullable=False)

    def __init__(self, month, date, consumption, building):
        self.month = month
        self.date = date
        self.consumption = consumption
        self.building = building
# Create tables 
with app.app_context():
    db.create_all()

# Define global variable for data
monthly_data = {}

# Function to check if data is already in the database
def is_duplicate_data(year, month, day, building):
    formatted_date = datetime(year, month, day).date()
    return db.session.query(ElectricityData.id).filter_by(date=formatted_date, building=building).first() is not None

def parse_csv(file):
    try:
        # Read the CSV file
        df = pd.read_csv(file)

        building_info = df.loc[0, 'Group']
        building_number = re.search(r'Building\s(\d+)', building_info).group(1)

        # Extract the date columns (assumes the first two columns are not part of the date-based data)
        date_columns = df.columns[2:]

        # Extract the consumption data and ensure it's converted to a list of floats
        consumption_data = df.iloc[0, 2:].astype(float)

        # Extract the month from the first date
        first_date = date_columns[0]
        parsed_date = datetime.strptime(first_date, '%m/%d/%Y %H:%M')  # Parse the date and time
        month_number = parsed_date.month
        year_number = parsed_date.year
        day_number = parsed_date.day

        # Map numeric month to month name
        months = {
            1: 'January', 2: 'February', 3: 'March', 4: 'April',
            5: 'May', 6: 'June', 7: 'July', 8: 'August',
            9: 'September', 10: 'October', 11: 'November', 12: 'December'
        }

        month_name = months.get(month_number, 'Unknown')

        # Check for empty consumption data
        if not any(consumption_data):  # Check if the list has valid non-zero data
            return None, "No valid consumption data found in the file."
        
        # Check for duplicate data
        if is_duplicate_data(year_number, int(month_number), int(day_number), f"Building {building_number}"):
            return None, "Duplicate data detected."

        # Input data into database
        for date, consumption in zip(date_columns, consumption_data):
            formatted_date = datetime.strptime(date, '%m/%d/%Y %H:%M').date()
            new_entry = ElectricityData(
                month=month_name,
                date=formatted_date,
                consumption=consumption,
                building=f"Building {building_number}"
            )
            db.session.add(new_entry)
        db.session.commit()

        # Store the data for the month
        monthly_data[month_name] = consumption_data

        return month_name, consumption_data

    except Exception as e:
        db.session.rollback()
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
    

# Function to refresh cache for a specific month, day, and building
def refresh_cache():
    try:
        with app.app_context():  # Ensure the application context is set up
            # Fetch all data from the database
            data = ElectricityData.query.all()

            # Group data by year, month, and building
            grouped_data = {}
            for entry in data:
                formatted_date = entry.date
                year = formatted_date.year
                month = formatted_date.month
                day = formatted_date.day
                building = entry.building

                # Create a cache key for the specific day
                cache_key = f"electricity_data_{year}_{month}_{day}_{building}"
                formatted_data = {
                    'month': entry.month,
                    'date': entry.date,
                    'consumption': entry.consumption,
                    'building': entry.building
                }
                # Store the fetched data in the cache for the specific day
                cache.set(cache_key, formatted_data)


                # Group data for all days in the month
                month_key = (year, month, building)
                if month_key not in grouped_data:
                    grouped_data[month_key] = []
                grouped_data[month_key].append(formatted_data)

            # Cache the grouped data for each month
            for (year, month, building), monthly_data in grouped_data.items():
                monthly_cache_key = f"electricity_data_{year}_{month}_all_{building}"
                cache.set(monthly_cache_key, monthly_data)

            print(f"Cache refreshed at {datetime.now()}")  # Log when cache is refreshed

    except Exception as e:
        print(f"Error refreshing cache: {e}")


refresh_cache()  # Initial cache refresh

# Function to start the scheduler in a separate thread
def start_scheduler():
    scheduler.add_job(refresh_cache, 'interval', minutes=5)  # Adjust interval as needed
    scheduler.start()

# Ensure scheduler runs with app context in a separate thread
def start_scheduler_with_context():
    with app.app_context():
        start_scheduler()



@app.route('/fetch-data/<int:year>/<int:month>/<int:day>/<building>', methods=['GET'])
def fetch_data_by_params(year, month, day, building):
    with app.app_context(): 

        if day == 0:
            cache_key = f"electricity_data_{year}_{month}_all_{building}"
        else:
            cache_key = f"electricity_data_{year}_{month}_{day}_{building}"
    
        cached_data = cache.get(cache_key)
    
        if cached_data:
        #    print("Cache contents:")
        #    if isinstance(cached_data, list):
        #        for entry in cached_data:
        #            print(entry)
        #    else:
        #        for key in cached_data:
        #            print(f"{key}: {cached_data[key]}")
            return jsonify(cached_data)
    
    
        query = ElectricityData.query.filter(
            db.extract('year', ElectricityData.date) == year,
            db.extract('month', ElectricityData.date) == month,
            ElectricityData.building == building
        )

        if day != 0:
            query = query.filter(db.extract('day', ElectricityData.date) == day)

        result = query.all()

        if not result:
            return None  # No data found

        # Convert database results to list of dictionaries
        data_list = [
            {
                'month': entry.month,
                'date': entry.date.strftime('%Y-%m-%d'),
                'consumption': entry.consumption,
                'building': entry.building
            }
            for entry in result
        ]

        # Cache the result
        cache.set(cache_key, data_list)
        return data_list
@app.route('/predict', methods=['POST'])
def predict_future():
    data = request.get_json()
    datasets = data.get("datasets", [])

    if not datasets:
        return jsonify({'error': 'No datasets provided'}), 400

    predictor = Predictor()
    
    predictions = []
    for dataset in datasets:
        building = dataset["building"]
        year = dataset["year"]
        month = dataset["month"]
        consumption_data = dataset["data"]

        predicted_values = predictor.predict(consumption_data)  # Use fetched data

        predictions.append({
            "building": building,
            "year": year,
            "month": month,
            "predicted_data": predicted_values
        })

    return jsonify(predictions)


@app.route('/get-available-data', methods=['GET'])
def get_available_data():
    with app.app_context():
        cache_keys = cache.cache._cache.keys()  # Get all the cache keys
        available_data = {}

        for key in cache_keys:
            # Split key based on underscores
            parts = key.split('_')  # Example key: electricity_data_2023_2_1_Building110
            if len(parts) == 6 and parts[0] == "electricity" and parts[1] == "data":
                year, month_int, day_str, building = int(parts[2]), int(parts[3]), parts[4], parts[5]

                # If the month is in datetime.date format, we can directly access the month
                if isinstance(month_int, int):
                    month = month_int
                else:
                    # If it's a string or not in int format, we handle it accordingly (in case of other formats)
                    date_obj = datetime.strptime(month_int, '%B')  # 'August' -> datetime object
                    month = date_obj.month

                # If day is 'all', we skip this part and consider the month as a whole
                if day_str == 'all':
                    day = 'all'
                else:
                    day = int(day_str)

                # Add to available_data in nested structure: {building: {year: {month: [days]}}}
                if building not in available_data:
                    available_data[building] = {}

                if year not in available_data[building]:
                    available_data[building][year] = {}

                if month not in available_data[building][year]:
                    available_data[building][year][month] = []

                # Add the day (or 'all' if it's a monthly cache) to the list of days for the given building, year, and month
                available_data[building][year][month].append(day)


        print("Available Data:", available_data)
        
        # Convert days to a sorted list, excluding 'all', and prepare the final data
        for building in available_data:
            for year in available_data[building]:
                for month in available_data[building][year]:
                    # Filter out 'all' before sorting
                    days = [day for day in available_data[building][year][month] if day != 'all']
                    available_data[building][year][month] = sorted(days)

                    # If 'all' is present, add it back to the list
                    if 'all' in available_data[building][year][month]:
                        available_data[building][year][month].append('all')

        return jsonify(available_data)




if __name__ == '__main__':
    
# Run scheduler in a separate thread with app context
    threading.Thread(target=start_scheduler_with_context).start()
    app.run(debug=True)