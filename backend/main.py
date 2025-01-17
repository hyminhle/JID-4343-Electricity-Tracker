from flask import Flask, jsonify, request
import numpy as np
from flask_cors import CORS
import pandas as pd
import re
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import mysql.connector


app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "http://localhost:3000"}})
# Add database
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://root:ElectricitySLB15#@localhost/electricitydata'
db = SQLAlchemy(app)

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

if __name__ == '__main__':
    app.run(debug=True)