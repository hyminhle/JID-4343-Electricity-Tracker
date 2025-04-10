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
from scipy import stats
import numpy as np
from collections import defaultdict
from models import db, ElectricityData, ElectricityStatistics
from AnomalyDetector import AnomalyDetector
from anomaly_routes import anomaly_bp

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)
# Add database
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://SLB_admin:ElectricitySLB15#@electricitydata-db.cve2k4qgkm75.us-east-2.rds.amazonaws.com/electricitydata'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

# Add cache
app.config['CACHE_TYPE'] = 'SimpleCache'
app.config['CACHE_THRESHOLD'] = 1000
app.config['CACHE_DEFAULT_TIMEOUT'] = 3600  # Cache timeout in seconds (5 minutes)
cache = Cache(app)

# Create scheduler
scheduler = BackgroundScheduler()

app.register_blueprint(anomaly_bp, url_prefix='/api/anomalies')

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
    print(f"Setting cache for key: {key}")
    cache.set(key, data)
    print(f"Cache set operation completed for key: {key}")
    
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
        if day == 0:  # Yearly stats request
            # Get all monthly stats for the requested year and building
            db_data = ElectricityStatistics.query.filter(
                db.func.extract('year', ElectricityStatistics.date) == year,
                ElectricityStatistics.building == building
            ).order_by(ElectricityStatistics.date).all()
            
            if not db_data:
                return None
                
            # Prepare monthly data using stored statistics
            monthly_data = []
            for stat in db_data:
                monthly_data.append({
                    'month': stat.month,
                    'consumption': stat.mean,  
                    'mean': stat.mean,
                    'highest': stat.highest,
                    'lowest': stat.lowest,
                    'median': stat.median
                })
            
            # Find overall extremes across the year
            highest_month = max(db_data, key=lambda x: x.highest)
            lowest_month = min(db_data, key=lambda x: x.lowest)
            
            result = {
                'mean': float(np.mean([stat.mean for stat in db_data])),
                'highest': highest_month.highest,
                'lowest': lowest_month.lowest,
                'highestMonth': highest_month.month,
                'lowestMonth': lowest_month.month,
                'monthlyData': monthly_data  # Includes all stored stats for each month
            }
            
        else:  # Monthly stats
            db_data = ElectricityStatistics.query.filter(
                db.func.extract('year', ElectricityStatistics.date) == year,
                db.func.extract('month', ElectricityStatistics.date) == month,
                ElectricityStatistics.building == building
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
                'building': db_data.building
            }
    
    if result is not None:
        cache_data(cache_key, result)
    return result

def print_july_2024_cache():
    print("\n=== July 2024 Cache Contents ===")
    cache_keys = list(cache.cache._cache.keys())
    for key in cache_keys:
        if '2024_7' in key or 'July' in key or 'Building_555' in key:
            value = cache.get(key)
            print(f"\nKey: {key}")
            print("Value:", value)
    

@app.route('/stats/<int:year>/<int:month>/<int:day>/<building>', methods=['GET'])
def get_stats_by_params(year, month, day, building):
    building = unquote(building)
    try:
        data = get_from_db_or_cache(year, month, day, building, "stats")
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
    """Periodically refresh popular cache items with proper app context"""
    with app.app_context():
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
        finally:
            # Ensure session is closed
            db.session.remove()


def scheduler_job():
    """Wrapper function to run refresh_cache with app context"""
    with app.app_context():
        refresh_cache()

def start_scheduler():
    """Start the scheduler with proper app context handling"""
    scheduler.add_job(scheduler_job, 'interval', minutes=30)
    scheduler.start()

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
        
@app.route('/api/anomalies/analyze', methods=['POST'])
def analyze_building_anomalies():
    """
    Comprehensive endpoint for analyzing anomalies in building electricity consumption.
    This endpoint combines detection, analysis, and optional storage in one place.
    """
    try:
        data = request.get_json()
        building = data.get('building')
        year = data.get('year')
        month = data.get('month', 0)
        method = data.get('method', 'z_score')
        threshold = float(data.get('threshold', 3.0))
        store_results = data.get('store_results', True)
        include_stats = data.get('include_stats', True)
        
        # Decode building name if it's URL encoded
        building = unquote(building)
        
        # Get consumption data for the specified building and timeframe
        if month == 0:  # Full year
            start_date = datetime(year, 1, 1).date()
            end_date = datetime(year + 1, 1, 1).date()
        else:  # Specific month
            start_date = datetime(year, month, 1).date()
            if month == 12:
                end_date = datetime(year + 1, 1, 1).date()
            else:
                end_date = datetime(year, month + 1, 1).date()
        
        # Query data from database
        db_data = ElectricityData.query.filter(
            ElectricityData.date >= start_date,
            ElectricityData.date < end_date,
            ElectricityData.building == building
        ).order_by(ElectricityData.date).all()
        
        if not db_data:
            return jsonify({'error': 'No data found for the specified parameters'}), 404
        
        # Format data for anomaly detection
        formatted_data = [{
            'date': entry.date,
            'consumption': entry.consumption,
            'building': entry.building
        } for entry in db_data]
        
        # Use the AnomalyDetector class for detection
        detector = AnomalyDetector()
        anomalies = detector.detect_anomalies(formatted_data, method, threshold)
        
        # Store anomalies in database if requested
        new_anomalies_count = 0
        if store_results:
            new_anomalies_count = detector.store_anomalies(anomalies)
        
        # Calculate additional statistics if requested
        stats = {}
        if include_stats:
            # Calculate daily statistics
            daily_consumption = {}
            for entry in formatted_data:
                date_str = entry['date'].strftime('%Y-%m-%d')
                if date_str not in daily_consumption:
                    daily_consumption[date_str] = []
                daily_consumption[date_str].append(entry['consumption'])
            
            # Calculate mean consumption for each day
            daily_means = {date: np.mean(values) for date, values in daily_consumption.items()}
            
            # Find days with highest and lowest mean consumption
            if daily_means:
                highest_day = max(daily_means.items(), key=lambda x: x[1])
                lowest_day = min(daily_means.items(), key=lambda x: x[1])
                
                stats = {
                    'total_days': len(daily_means),
                    'days_with_anomalies': len(set(a['date'].strftime('%Y-%m-%d') for a in anomalies)),
                    'highest_consumption_day': highest_day[0],
                    'highest_consumption_value': highest_day[1],
                    'lowest_consumption_day': lowest_day[0],
                    'lowest_consumption_value': lowest_day[1],
                    'building_overall_consumption': sum(entry['consumption'] for entry in formatted_data),
                    'anomaly_percentage': (len(anomalies) / len(formatted_data)) * 100 if formatted_data else 0
                }
        
        # Return results with formatted dates for display
        for anomaly in anomalies:
            anomaly['date'] = anomaly['date'].isoformat()
        
        response = {
            'anomalies': anomalies,
            'count': len(anomalies),
            'new_count': new_anomalies_count,
            'critical': sum(1 for a in anomalies if a['severity'] == 'Critical'),
            'error': sum(1 for a in anomalies if a['severity'] == 'Error'),
            'warning': sum(1 for a in anomalies if a['severity'] == 'Warning'),
            'method': method,
            'threshold': threshold
        }
        
        if include_stats:
            response['statistics'] = stats
        
        return jsonify(response)
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': str(e.__traceback__)}), 500

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
    with app.app_context():
        # Initial cache refresh
        refresh_cache()
        # Start scheduler
        scheduler_thread = threading.Thread(target=start_scheduler)
        scheduler_thread.daemon = True  # Daemonize thread so it exits with main
        scheduler_thread.start()
    
    app.run(debug=True)


