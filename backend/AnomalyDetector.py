import numpy as np
from datetime import datetime
from models import AnomalyAlert, db

class AnomalyDetector:
    def __init__(self):
        self.methods = {
            "z_score": self._z_score_method,
            "iqr": self._iqr_method,
            "rolling_mean": self._rolling_mean_method
        }
    
    def detect_anomalies(self, data, method="z_score", threshold=3.0):
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
        
        # Call the appropriate method based on the requested detection algorithm
        if method in self.methods:
            return self.methods[method](data, threshold)
        else:
            # Default to z-score if method not found
            return self._z_score_method(data, threshold)
    
    def _z_score_method(self, data, threshold):
        """Z-score anomaly detection method"""
        # Extract consumption values
        consumption_values = np.array([float(item['consumption']) for item in data])
        
        mean = np.mean(consumption_values)
        std = np.std(consumption_values)
        
        if std == 0:  # Avoid division by zero
            return []
            
        z_scores = abs((consumption_values - mean) / std)
        
        anomalies = []
        for i, (z_score, item) in enumerate(zip(z_scores, data)):
            if z_score > threshold:
                # Classify severity based on z-score
                severity = self._classify_severity(z_score, threshold)
                    
                anomalies.append({
                    'date': item['date'],
                    'consumption': item['consumption'],
                    'z_score': float(z_score),
                    'severity': severity,
                    'building': item['building'],
                    'detection_method': 'Z-Score'
                })
        
        return anomalies
    
    def _iqr_method(self, data, threshold):
        """Interquartile Range anomaly detection method"""
        # Extract consumption values
        consumption_values = np.array([float(item['consumption']) for item in data])
        
        q1 = np.percentile(consumption_values, 25)
        q3 = np.percentile(consumption_values, 75)
        iqr = q3 - q1
        lower_bound = q1 - threshold * iqr
        upper_bound = q3 + threshold * iqr
        
        anomalies = []
        for i, item in enumerate(data):
            consumption = float(item['consumption'])
            if consumption < lower_bound or consumption > upper_bound:
                # Calculate equivalent z-score for consistent severity classification
                mean = np.mean(consumption_values)
                std = np.std(consumption_values)
                z_score = abs((consumption - mean) / std) if std > 0 else 0
                
                # Classify severity
                severity = self._classify_severity(z_score, threshold)
                    
                anomalies.append({
                    'date': item['date'],
                    'consumption': consumption,
                    'z_score': float(z_score),
                    'severity': severity,
                    'building': item['building'],
                    'detection_method': 'IQR'
                })
        
        return anomalies
    
    def _rolling_mean_method(self, data, threshold):
        """Rolling mean anomaly detection method"""
        # Extract consumption values
        consumption_values = np.array([float(item['consumption']) for item in data])
        
        # Dynamic window size
        window_size = max(3, len(consumption_values) // 10)
        
        anomalies = []
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
                severity = self._classify_severity(z_score, threshold)
                    
                anomalies.append({
                    'date': data[i]['date'],
                    'consumption': current_value,
                    'z_score': float(z_score),
                    'severity': severity,
                    'building': data[i]['building'],
                    'detection_method': 'Rolling Mean'
                })
        
        return anomalies
    
    def _classify_severity(self, z_score, threshold):
        """Classify the severity of an anomaly based on its z-score"""
        if z_score > threshold * 2:
            return "Critical"
        elif z_score > threshold * 1.5:
            return "Error"
        else:
            return "Warning"
    
    def store_anomalies(self, anomalies):
        """
        Store detected anomalies in the database
        
        Args:
            anomalies: List of anomaly dictionaries
            
        Returns:
            Number of new anomalies stored
        """
        new_count = 0
        
        for anomaly in anomalies:
            # Check if this anomaly already exists using the unique constraint
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
                new_count += 1
        
        db.session.commit()
        return new_count