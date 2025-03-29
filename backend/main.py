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
from urllib.parse import unquote

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "http://localhost:3000"}})
# Add database
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://SLB_admin:ElectricitySLB15#@electricitydata-db.cve2k4qgkm75.us-east-2.rds.amazonaws.com/electricitydata'
db = SQLAlchemy(app)

# Add cache
app.config['CACHE_TYPE'] = 'SimpleCache'
app.config['CACHE_THRESHOLD'] = 1000
app.config['CACHE_DEFAULT_TIMEOUT'] = 3600  # Cache timeout in seconds (5 minutes)
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

class ElectricityStatistics(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    month = db.Column(db.String(20), nullable=False)
    date = db.Column(db.Date, nullable=False)
    mean = db.Column(db.Float, nullable=False)
    highest = db.Column(db.Float, nullable=False)
    lowest = db.Column(db.Float, nullable=False)
    median = db.Column(db.Float, nullable=False)
    building = db.Column(db.String(50), nullable=False)
    def __init__(self, month, date, mean, highest, lowest, median, building):
        self.month = month
        self.date = date
        self.mean = mean
        self.highest = highest
        self.lowest = lowest    
        self.median = median    
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
def is_duplicate_stats(year, month, building):
    formatted_date = datetime(year, month, 1).date()
    return db.session.query(ElectricityStatistics.id).filter_by(date=formatted_date, building=building).first() is not None


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

        # Check for empty consumption data
        if not any(consumption_data):  # Check if the list has valid non-zero data
            return None, "No valid consumption data found in the file."
        
        monthly_consumption_data = {}

        # Input data into database
        for date, consumption in zip(date_columns, consumption_data):
            parsed_date = datetime.strptime(date, '%m/%d/%Y %H:%M')  # Parse the date and time
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

            # Check for duplicate data
            if is_duplicate_data(year_number, int(month_number), int(day_number), f"Building {building_number}"):
                continue  # Skip duplicate data

            formatted_date = parsed_date.date()
            new_entry = ElectricityData(
                month=month_name,
                date=formatted_date,
                consumption=consumption,
                building=f"Building {building_number}"
            )
            db.session.add(new_entry)

            # Collect monthly consumption data
            if month_name not in monthly_consumption_data:
                monthly_consumption_data[month_name] = []
            monthly_consumption_data[month_name].append(consumption)

        db.session.commit()

        for month_name, consumption_data in monthly_consumption_data.items():
            mean_value = float(np.mean(consumption_data))
            highest_value = float(np.max(consumption_data))
            lowest_value = float(np.min(consumption_data))
            median_value = float(np.median(consumption_data))

            if is_duplicate_stats(year_number, list(months.keys())[list(months.values()).index(month_name)], f"Building {building_number}"):
                continue  # Skip duplicate statistics data

            # Insert statistics data into ElectricityStatistics table
            stat_entry = ElectricityStatistics(
                month=month_name,
                date=datetime(year_number, list(months.keys())[list(months.values()).index(month_name)], 1).date(), 
                mean=mean_value,
                highest=highest_value,
                lowest=lowest_value,
                median=median_value,
                building=f"Building {building_number}"
            )
            db.session.add(stat_entry)
            db.session.commit()
            
            # Store the data for the month
            monthly_data[month_name] = consumption_data

        # Convert consumption data to a list to ensure it is serializable
        serializable_data = {month: data for month, data in monthly_consumption_data.items()}

        return month_name, serializable_data

    except Exception as e:
        db.session.rollback()
        return None, f"Error processing file: {str(e)}"
    

@app.route('/upload', methods=['POST'])
def upload_files():
    try:
        files = request.files.getlist('files')
        
        if not files:
            return jsonify({'error': 'No files uploaded'}), 400

        results = []
        for file in files:
            print(f"Processing file: {file.filename}")  # Debug statement
            month, data = parse_csv(file)
            if not month:
                return jsonify({'error': data}), 400
            results.append({'month': month, 'data': data})

        refresh_cache()
        return jsonify({
            'message': 'Files uploaded successfully',
            'results': results
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

def generate_cache_key(year, month, day, building, data_type="data"):
    """Generate a consistent cache key for given parameters"""
    building_clean = building.replace(" ", "_")
    if day == 0:
        return f"electricity_{data_type}_{year}_{month}_all_{building_clean}"
    return f"electricity_{data_type}_{year}_{month}_{day}_{building_clean}"

def cache_data(key, data):
    """Cache data with the given key, ensuring we don't exceed cache limits"""
    cache.set(key, data)
    
def get_cached_data(key):
    """Retrieve data from cache if it exists"""
    return cache.get(key)

def get_from_db_or_cache(year, month, day, building, data_type="data"):
    """Helper function to implement cache-first pattern"""
    cache_key = generate_cache_key(year, month, day, building, data_type)
    
    # Try to get from cache first
    cached_data = get_cached_data(cache_key)
    if cached_data is not None:
        return cached_data
    
    # If not in cache, fetch from database
    if data_type == "data":
        if day == 0:  # Monthly data
            start_date = datetime(year, month, 1).date()
            if month == 12:
                end_date = datetime(year + 1, 1, 1).date()
            else:
                end_date = datetime(year, month + 1, 1).date()
            
            db_data = ElectricityData.query.filter(
                ElectricityData.date >= start_date,
                ElectricityData.date < end_date,
                ElectricityData.building == building
            ).all()
            
            if not db_data:
                return None
                
            result = [{
                'month': entry.month,
                'date': entry.date.isoformat(),
                'consumption': entry.consumption,
                'building': entry.building
            } for entry in db_data]
            
        else:  # Daily data
            date = datetime(year, month, day).date()
            db_data = ElectricityData.query.filter_by(
                date=date,
                building=building
            ).first()
            
            if not db_data:
                return None
                
            result = {
                'month': db_data.month,
                'date': db_data.date.isoformat(),
                'consumption': db_data.consumption,
                'building': db_data.building
            }
            
    elif data_type == "stats":
        if day == 0:  # Yearly stats
            db_data = ElectricityStatistics.query.filter(
                ElectricityStatistics.date.between(datetime(year, 1, 1), datetime(year, 12, 31)),
                ElectricityStatistics.building == building
            ).all()
            
            if not db_data:
                return None
                
            # Calculate monthly totals
            monthly_totals = {}
            for stat in db_data:
                monthly_totals[stat.month] = monthly_totals.get(stat.month, 0) + stat.mean

            # Determine highest and lowest month
            highest_month = max(monthly_totals.items(), key=lambda x: x[1], default=('', 0))
            lowest_month = min(monthly_totals.items(), key=lambda x: x[1], default=('', 0))

            result = {
                'mean': float(np.mean([stat.mean for stat in db_data])),
                'highest': highest_month[1],
                'lowest': lowest_month[1],
                'highestMonth': highest_month[0],
                'lowestMonth': lowest_month[0],
                'monthlyData': [{'month': month, 'consumption': total} for month, total in monthly_totals.items()]
            }
            
        else:  # Monthly stats
            db_data = ElectricityStatistics.query.filter_by(
                date=datetime(year, month, 1).date(),
                building=building
            ).first()
            
            if not db_data:
                return None
                
            result = {
                'month': db_data.month,
                'date': db_data.date.isoformat(),
                'mean': db_data.mean,
                'highest': db_data.highest,
                'lowest': db_data.lowest,
                'median': db_data.median,
                'building': db_data.building,
                'highestMonth': db_data.month,
                'lowestMonth': db_data.month,
            }
    
    # Cache the result before returning
    if result is not None:
        cache_data(cache_key, result)
    
    return result

# Routes
@app.route('/stats/<int:year>/<int:month>/<building>', methods=['GET'])
def get_stats_by_params(year, month, building):
    building = unquote(building)
    try:
        data = get_from_db_or_cache(year, month, 0, building, "stats")
        if data is None:
            return jsonify({'error': 'No statistics found for the specified parameters'}), 404
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/fetch-data/<int:year>/<int:month>/<int:day>/<building>', methods=['GET'])
def fetch_data_by_params(year, month, day, building):
    building = unquote(building)
    try:
        data = get_from_db_or_cache(year, month, day, building, "data")
        if data is None:
            return jsonify({'error': 'No data found for the specified parameters'}), 404
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Other routes remain unchanged (upload, stats, predict, get-available-data)

# Cache maintenance
def refresh_cache():
    """Periodically refresh popular cache items"""
    try:
        # Get most frequently accessed data and refresh those
        popular_buildings = db.session.query(
            ElectricityData.building,
            db.func.count(ElectricityData.building)
        ).group_by(ElectricityData.building).order_by(db.func.count(ElectricityData.building).desc()).limit(5).all()
        
        for building, _ in popular_buildings:
            # Refresh last 3 months of data for popular buildings
            current_date = datetime.now()
            for i in range(3):
                month = current_date.month - i
                year = current_date.year
                if month < 1:
                    month += 12
                    year -= 1
                get_from_db_or_cache(year, month, 0, building, "data")
                get_from_db_or_cache(year, month, 0, building, "stats")
                
        print(f"Cache refreshed at {datetime.now()}")
    except Exception as e:
        print(f"Error refreshing cache: {e}")


# Function to start the scheduler in a separate thread
def start_scheduler():
    scheduler.add_job(refresh_cache, 'interval', minutes=5)  # Adjust interval as needed
    scheduler.start()

# Ensure scheduler runs with app context in a separate thread
def start_scheduler_with_context():
    with app.app_context():
        start_scheduler()

def print_cache_keys():
    try:
        cache_keys = list(cache.cache._cache.keys())  # Retrieve all cache keys
        print("Current Cache Keys:")
        for key in cache_keys:
            print(key)
    except Exception as e:
        print(f"Error retrieving cache keys: {e}")


@app.route('/predict', methods=['POST'])
def predict_future():
    try:
        data = request.get_json()
        datasets = data.get('datasets')
        #print(datasets)

        predictor = Predictor()
        future_predictions = predictor.predict(datasets)
        return jsonify(future_predictions)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/get-available-data', methods=['GET'])
def get_available_data():
    """Endpoint to list all available data in the system (from cache and database)"""
    try:
        with app.app_context():
            # First try to get from cache if available
            cache_key = "available_data_summary"
            cached_data = get_cached_data(cache_key)
            if cached_data:
                return jsonify(cached_data)

            # If not in cache, build the data structure from database
            available_data = {}

            # Get all unique buildings
            buildings = db.session.query(
                ElectricityData.building.distinct()
            ).all()

            for (building,) in buildings:
                building_clean = building.replace(" ", "_")
                available_data[building] = {}

                # Get all years with data for this building
                years = db.session.query(
                    db.func.extract('year', ElectricityData.date).distinct()
                ).filter(
                    ElectricityData.building == building
                ).order_by(
                    db.func.extract('year', ElectricityData.date).desc()
                ).all()

                for (year,) in years:
                    year = int(year)
                    available_data[building][year] = {}

                    # Get all months with data for this building/year
                    months = db.session.query(
                        db.func.extract('month', ElectricityData.date).distinct()
                    ).filter(
                        db.func.extract('year', ElectricityData.date) == year,
                        ElectricityData.building == building
                    ).order_by(
                        db.func.extract('month', ElectricityData.date)
                    ).all()

                    for (month,) in months:
                        month = int(month)
                        available_data[building][year][month] = []

                        # Check if we have full month data cached
                        month_cache_key = generate_cache_key(year, month, 0, building)
                        if get_cached_data(month_cache_key):
                            available_data[building][year][month].append('all')

                        # Get individual days with data
                        days = db.session.query(
                            db.func.extract('day', ElectricityData.date).distinct()
                        ).filter(
                            db.func.extract('year', ElectricityData.date) == year,
                            db.func.extract('month', ElectricityData.date) == month,
                            ElectricityData.building == building
                        ).order_by(
                            db.func.extract('day', ElectricityData.date)
                        ).all()

                        for (day,) in days:
                            day = int(day)
                            # Check if this specific day is cached
                            day_cache_key = generate_cache_key(year, month, day, building)
                            if get_cached_data(day_cache_key):
                                available_data[building][year][month].append(day)

                        # If no specific days but we have month data, add 'all'
                        if not available_data[building][year][month] and days:
                            available_data[building][year][month].append('all')

            # Cache this summary for 1 hour
            cache_data(cache_key, available_data)

            return jsonify(available_data)

    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    
# Run scheduler in a separate thread with app context
    threading.Thread(target=start_scheduler_with_context).start()
    app.run(debug=True)