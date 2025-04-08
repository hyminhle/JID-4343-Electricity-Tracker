from flask import Blueprint, jsonify, request
from models import AnomalyAlert, ElectricityData, db
from AnomalyDetector import AnomalyDetector
from datetime import datetime
from urllib.parse import unquote

anomaly_bp = Blueprint('anomalies', __name__)
anomaly_detector = AnomalyDetector()

@anomaly_bp.route('/analyze-anomalies', methods=['POST'])
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
        anomalies = anomaly_detector.detect_anomalies(formatted_data, method, threshold)
        
        # Store anomalies in database
        new_anomalies = anomaly_detector.store_anomalies(anomalies)
        
        # Return results with formatted dates for display
        for anomaly in anomalies:
            anomaly['date'] = anomaly['date'].isoformat()
        
        return jsonify({
            'anomalies': anomalies,
            'count': len(anomalies),
            'new_count': new_anomalies,
            'critical': sum(1 for a in anomalies if a['severity'] == 'Critical'),
            'error': sum(1 for a in anomalies if a['severity'] == 'Error'),
            'warning': sum(1 for a in anomalies if a['severity'] == 'Warning')
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@anomaly_bp.route('/get-anomalies', methods=['GET'])
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

@anomaly_bp.route('/update-anomaly-status', methods=['POST'])
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

@anomaly_bp.route('/detect-anomalies', methods=['POST'])
def detect_anomalies_endpoint():
    """
    Analyze data for anomalies without storing the results
    Useful for testing different detection methods and thresholds
    """
    try:
        data = request.get_json()
        consumption_data = data.get('data', [])
        method = data.get('method', 'z_score')
        threshold = float(data.get('threshold', 3.0))
        
        if not consumption_data:
            return jsonify({'error': 'No data provided'}), 400
            
        # Detect anomalies
        anomalies = anomaly_detector.detect_anomalies(consumption_data, method, threshold)
        
        # Return results
        return jsonify({
            'anomalies': anomalies,
            'count': len(anomalies),
            'method': method,
            'threshold': threshold
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500