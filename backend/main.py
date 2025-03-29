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
app.config['CACHE_THRESHOLD'] = 10000 
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
            stats = ElectricityStatistics.query.all()
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
                
                if cache.get(cache_key) is None:
                    formatted_data = {
                        'month': entry.month,
                        'date': entry.date,
                        'consumption': entry.consumption,
                        'building': entry.building
                    }
                    #print("cachekey:", cache_key)
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

            # Cache the statistics data
            for stat in stats:
                stat_cache_key = f"electricity_stats_{stat.date.year}_{stat.date.month}_{stat.building}"
                if cache.get(stat_cache_key) is None:
                    stat_data = {
                        'month': stat.month,
                        'date': stat.date,
                        'mean': stat.mean,
                        'highest': stat.highest,
                        'lowest': stat.lowest,
                        'median': stat.median,
                        'building': stat.building
                    }
                    cache.set(stat_cache_key, stat_data)

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

def print_cache_keys():
    try:
        cache_keys = list(cache.cache._cache.keys())  # Retrieve all cache keys
        print("Current Cache Keys:")
        for key in cache_keys:
            print(key)
    except Exception as e:
        print(f"Error retrieving cache keys: {e}")

    
@app.route('/stats/<int:year>/<int:month>/<building>', methods=['GET'])
def get_stats_by_params(year, month, building):
    building = unquote(building)
    try:
        with app.app_context():
            # Create a cache key for the statistics
            stat_cache_key = f"electricity_stats_{year}_{month}_{building}"
            
            # Check if the statistics data is already in the cache
            cached_stats = cache.get(stat_cache_key)
            if cached_stats:
                return jsonify(cached_stats)
            
            # If not in cache, query the database
            stats = ElectricityStatistics.query.filter_by(
                date=datetime(year, month, 1).date(),
                building=building
            ).first()
            
            if not stats:
                return jsonify({'error': 'No statistics found for the specified parameters'}), 404
            
            # Prepare the statistics data
            stat_data = {
                'month': stats.month,
                'date': stats.date,
                'mean': stats.mean,
                'highest': stats.highest,
                'lowest': stats.lowest,
                'median': stats.median,
                'building': stats.building
            }
            
            # Store the statistics data in the cache
            cache.set(stat_cache_key, stat_data)
            
            return jsonify(stat_data)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    

@app.route('/fetch-data/<int:year>/<int:month>/<int:day>/<building>', methods=['GET'])
def fetch_data_by_params(year, month, day, building):
    building = unquote(building)
    with app.app_context(): 

        if day == 0:
            cache_key = f"electricity_data_{year}_{month}_all_{building}"
        else:
            cache_key = f"electricity_data_{year}_{month}_{day}_{building}"
    
        cached_data = cache.get(cache_key)
    
        if cached_data:
            # print("Cache contents:")
            # if isinstance(cached_data, list):
            #     for entry in cached_data:
            #         print(entry)
            # else:
            #     for key in cached_data:
            #         print(f"{key}: {cached_data[key]}")
            return jsonify(cached_data)
    
    
        print(f"No cache data found for key: {cache_key}")
        return jsonify({'error': 'No data found for the specified parameters'}), 404

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


        #print("Available Data:", available_data)
        
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
    
@app.route('/api/chatbot/consumption', methods=['GET'])
def chatbot_consumption():
    """Enhanced endpoint specifically for chatbot queries"""
    building = request.args.get('building')
    date_str = request.args.get('date')  # YYYY-MM-DD format
    
    try:
        # Parse and validate date
        query_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        year, month, day = query_date.year, query_date.month, query_date.day
        
        # Get daily consumption
        daily_data = ElectricityData.query.filter_by(
            building=building,
            date=query_date
        ).first()
        
        if not daily_data:
            return jsonify({'error': f'No data found for {building} on {date_str}'}), 404
        
        # Get monthly stats
        monthly_stats = ElectricityStatistics.query.filter_by(
            building=building,
            date=datetime(year, month, 1).date()
        ).first()
        
        # Get 30-day comparison
        thirty_days_ago = query_date - timedelta(days=30)
        comparison_data = db.session.query(
            func.avg(ElectricityData.consumption).label('avg'),
            func.max(ElectricityData.consumption).label('max'),
            func.min(ElectricityData.consumption).label('min')
        ).filter(
            ElectricityData.building == building,
            ElectricityData.date.between(thirty_days_ago, query_date)
        ).first()
        
        # Calculate cost (example rate)
        cost = daily_data.consumption * 0.15
        
        # Prepare intelligent insights
        insights = []
        if monthly_stats:
            if daily_data.consumption > monthly_stats.highest * 0.9:
                insights.append("⚠️ Near monthly peak consumption")
            elif daily_data.consumption < monthly_stats.lowest * 1.1:
                insights.append("✅ Significantly lower than typical usage")
                
            if comparison_data:
                percentage = ((daily_data.consumption - comparison_data.avg) / comparison_data.avg) * 100
                if percentage > 15:
                    insights.append(f"📈 {abs(percentage):.1f}% higher than 30-day average")
                elif percentage < -15:
                    insights.append(f"📉 {abs(percentage):.1f}% lower than 30-day average")
        
        return jsonify({
            'building': building,
            'date': date_str,
            'consumption': daily_data.consumption,
            'cost': round(cost, 2),
            'monthly_stats': {
                'average': monthly_stats.mean if monthly_stats else None,
                'peak': monthly_stats.highest if monthly_stats else None,
                'low': monthly_stats.lowest if monthly_stats else None
            },
            'comparison': {
                '30_day_avg': comparison_data.avg if comparison_data else None,
                '30_day_max': comparison_data.max if comparison_data else None,
                '30_day_min': comparison_data.min if comparison_data else None
            },
            'insights': insights,
            'suggestions': generate_suggestions(daily_data.consumption, monthly_stats)
        })
        
    except ValueError:
        return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def generate_suggestions(current_usage, monthly_stats):
    """Generate energy saving suggestions based on usage patterns"""
    suggestions = []
    
    if not monthly_stats:
        return suggestions
    
    # Peak usage suggestion
    if current_usage > monthly_stats.mean * 1.2:
        suggestions.append("Consider reducing HVAC usage during peak hours (10AM-4PM)")
    
    # Weekend detection
    weekday = datetime.strptime(request.args.get('date'), '%Y-%m-%d').weekday()
    if weekday >= 5 and current_usage > monthly_stats.mean * 0.8:
        suggestions.append("Weekend usage seems high - check for equipment left running")
    
    # Comparative suggestion
    if current_usage > monthly_stats.highest * 0.85:
        suggestions.append("You're approaching monthly peak - consider energy audit")
    elif current_usage < monthly_stats.lowest * 1.15:
        suggestions.append("Great efficiency! Maintain these conservation practices")
    
    return suggestions

@app.route('/api/buildings', methods=['GET'])
def get_buildings():
    """Get list of all available buildings with metadata"""
    buildings = db.session.query(
        ElectricityData.building,
        func.min(ElectricityData.date).label('first_date'),
        func.max(ElectricityData.date).label('last_date')
    ).group_by(ElectricityData.building).all()
    
    return jsonify([{
        'name': b.building,
        'data_start': b.first_date.isoformat(),
        'data_end': b.last_date.isoformat()
    } for b in buildings])
if __name__ == '__main__':
    
# Run scheduler in a separate thread with app context
    threading.Thread(target=start_scheduler_with_context).start()
    app.run(debug=True)