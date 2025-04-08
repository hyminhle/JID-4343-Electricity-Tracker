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


app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)
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


#ANOMALY ALERTS API ENDPOINTS
class AnomalyAlert(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False)
    building = db.Column(db.String(50), nullable=False)
    consumption = db.Column(db.Float, nullable=False)
    z_score = db.Column(db.Float, nullable=False)
    severity = db.Column(db.String(20), nullable=False)
    detection_method = db.Column(db.String(30), nullable=False)
    is_acknowledged = db.Column(db.Boolean, default=False)
    is_sdt = db.Column(db.Boolean, default=False)  # Scheduled downtime
    is_cleared = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __init__(self, date, building, consumption, z_score, severity, detection_method):
        self.date = date
        self.building = building
        self.consumption = consumption
        self.z_score = z_score
        self.severity = severity
        self.detection_method = detection_method
        self.is_acknowledged = False
        self.is_sdt = False
        self.is_cleared = False

# Create tables if they don't exist
with app.app_context():
    db.create_all()

def detect_anomalies(data, method="z_score", threshold=3.0):
    """
    Detect anomalies in electricity consumption data
    
    Args:
        data: List of dictionaries with 'date' and 'consumption' keys
        method: Detection method ('z_score', 'iqr', or 'rolling_mean')
        threshold: Threshold for anomaly detection
        
    Returns:
        List of anomalies with severity classification
    """
    if not data or len(data) < 3:
        return []
    
    # Extract consumption values
    consumption_values = np.array([float(item['consumption']) for item in data])
    
    anomalies = []
    
    if method == "z_score":
        # Z-score method (how many standard deviations from the mean)
        mean = np.mean(consumption_values)
        std = np.std(consumption_values)
        
        if std == 0:  # Avoid division by zero
            return []
            
        z_scores = abs((consumption_values - mean) / std)
        
        for i, (z_score, item) in enumerate(zip(z_scores, data)):
            if z_score > threshold:
                # Classify severity based on z-score
                if z_score > threshold * 2:
                    severity = "Critical"
                elif z_score > threshold * 1.5:
                    severity = "Error"
                else:
                    severity = "Warning"
                    
                anomalies.append({
                    'date': item['date'],
                    'consumption': item['consumption'],
                    'z_score': float(z_score),
                    'severity': severity,
                    'building': item['building'],
                    'detection_method': 'Z-Score'
                })
                
    elif method == "iqr":
        # Interquartile Range method
        q1 = np.percentile(consumption_values, 25)
        q3 = np.percentile(consumption_values, 75)
        iqr = q3 - q1
        lower_bound = q1 - threshold * iqr
        upper_bound = q3 + threshold * iqr
        
        for i, item in enumerate(data):
            consumption = float(item['consumption'])
            if consumption < lower_bound or consumption > upper_bound:
                # Calculate equivalent z-score for consistent severity classification
                mean = np.mean(consumption_values)
                std = np.std(consumption_values)
                z_score = abs((consumption - mean) / std) if std > 0 else 0
                
                # Classify severity
                if z_score > threshold * 2:
                    severity = "Critical"
                elif z_score > threshold * 1.5:
                    severity = "Error"
                else:
                    severity = "Warning"
                    
                anomalies.append({
                    'date': item['date'],
                    'consumption': consumption,
                    'z_score': float(z_score),
                    'severity': severity,
                    'building': item['building'],
                    'detection_method': 'IQR'
                })
                
    elif method == "rolling_mean":
        # Rolling mean method (moving average)
        window_size = max(3, len(consumption_values) // 10)  # Dynamic window size
        
        for i in range(window_size, len(consumption_values)):
            window = consumption_values[i-window_size:i]
            window_mean = np.mean(window)
            window_std = np.std(window)
            
            if window_std == 0:  # Avoid division by zero
                continue
                
            current_value = consumption_values[i]
            z_score = abs((current_value - window_mean) / window_std)
            
            if z_score > threshold:
                # Classify severity
                if z_score > threshold * 2:
                    severity = "Critical"
                elif z_score > threshold * 1.5:
                    severity = "Error"
                else:
                    severity = "Warning"
                    
                anomalies.append({
                    'date': data[i]['date'],
                    'consumption': current_value,
                    'z_score': float(z_score),
                    'severity': severity,
                    'building': data[i]['building'],
                    'detection_method': 'Rolling Mean'
                })
    
    return anomalies

@app.route('/analyze-anomalies', methods=['POST'])
def analyze_anomalies():
    """
    Analyze building data for anomalies and store results
    """
    try:
        data = request.get_json()
        building = data.get('building')
        year = data.get('year')
        month = data.get('month', 0)
        method = data.get('method', 'z_score')
        threshold = float(data.get('threshold', 3.0))
        
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
        
        # Detect anomalies
        anomalies = detect_anomalies(formatted_data, method, threshold)
        
        # Store anomalies in database
        for anomaly in anomalies:
            # Check if this anomaly already exists
            existing = AnomalyAlert.query.filter_by(
                date=anomaly['date'],
                building=anomaly['building'],
                detection_method=anomaly['detection_method']
            ).first()
            
            if existing:
                # Update existing anomaly
                existing.consumption = anomaly['consumption']
                existing.z_score = anomaly['z_score']
                existing.severity = anomaly['severity']
            else:
                # Create new anomaly alert
                new_alert = AnomalyAlert(
                    date=anomaly['date'],
                    building=anomaly['building'],
                    consumption=anomaly['consumption'],
                    z_score=anomaly['z_score'],
                    severity=anomaly['severity'],
                    detection_method=anomaly['detection_method']
                )
                db.session.add(new_alert)
        
        db.session.commit()
        
        # Return results with formatted dates for display
        for anomaly in anomalies:
            anomaly['date'] = anomaly['date'].isoformat()
        
        return jsonify({
            'anomalies': anomalies,
            'count': len(anomalies),
            'critical': sum(1 for a in anomalies if a['severity'] == 'Critical'),
            'error': sum(1 for a in anomalies if a['severity'] == 'Error'),
            'warning': sum(1 for a in anomalies if a['severity'] == 'Warning')
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/get-anomalies', methods=['GET'])
def get_anomalies():
    """
    Get all anomalies with optional filtering
    """
    try:
        # Get filter parameters
        building = request.args.get('building', '')
        severity = request.args.get('severity', '')
        method = request.args.get('method', '')
        acknowledged = request.args.get('acknowledged')
        cleared = request.args.get('cleared')
        sdt = request.args.get('sdt')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        # Decode building name if it's URL encoded
        if building:
            building = unquote(building)
        
        # Build query
        query = AnomalyAlert.query
        
        if building:
            query = query.filter(AnomalyAlert.building == building)
        if severity:
            query = query.filter(AnomalyAlert.severity == severity)
        if method:
            query = query.filter(AnomalyAlert.detection_method == method)
        if acknowledged is not None:
            query = query.filter(AnomalyAlert.is_acknowledged == (acknowledged.lower() == 'true'))
        if cleared is not None:
            query = query.filter(AnomalyAlert.is_cleared == (cleared.lower() == 'true'))
        if sdt is not None:
            query = query.filter(AnomalyAlert.is_sdt == (sdt.lower() == 'true'))
        
        # Date filters
        if start_date:
            query = query.filter(AnomalyAlert.date >= datetime.strptime(start_date, '%Y-%m-%d').date())
        if end_date:
            query = query.filter(AnomalyAlert.date <= datetime.strptime(end_date, '%Y-%m-%d').date())
        
        # Execute query
        alerts = query.order_by(AnomalyAlert.date.desc()).all()
        
        # Format results
        results = []
        for alert in alerts:
            results.append({
                'id': alert.id,
                'date': alert.date.isoformat(),
                'building': alert.building,
                'consumption': alert.consumption,
                'z_score': alert.z_score,
                'severity': alert.severity,
                'detection_method': alert.detection_method,
                'is_acknowledged': alert.is_acknowledged,
                'is_sdt': alert.is_sdt,
                'is_cleared': alert.is_cleared,
                'created_at': alert.created_at.isoformat() if alert.created_at else None
            })
        
        # Get statistics
        stats = {
            'total': len(results),
            'critical': sum(1 for r in results if r['severity'] == 'Critical'),
            'error': sum(1 for r in results if r['severity'] == 'Error'),
            'warning': sum(1 for r in results if r['severity'] == 'Warning'),
            'acknowledged': sum(1 for r in results if r['is_acknowledged']),
            'sdt': sum(1 for r in results if r['is_sdt'])
        }
        
        return jsonify({
            'alerts': results,
            'stats': stats
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/update-anomaly-status', methods=['POST'])
def update_anomaly_status():
    """
    Update the status of an anomaly alert (acknowledge, clear, or schedule downtime)
    """
    try:
        data = request.get_json()
        alert_id = data.get('id')
        status_type = data.get('type')  # 'acknowledge', 'clear', or 'sdt'
        status_value = data.get('value', True)  # Boolean
        
        alert = AnomalyAlert.query.get(alert_id)
        if not alert:
            return jsonify({'error': 'Alert not found'}), 404
        
        if status_type == 'acknowledge':
            alert.is_acknowledged = status_value
        elif status_type == 'clear':
            alert.is_cleared = status_value
        elif status_type == 'sdt':
            alert.is_sdt = status_value
        else:
            return jsonify({'error': 'Invalid status type'}), 400
        
        db.session.commit()
        
        return jsonify({'success': True})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500