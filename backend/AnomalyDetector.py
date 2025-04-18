import numpy as np
from datetime import datetime
from models import AnomalyAlert, db
from sklearn.neighbors import LocalOutlierFactor

class AnomalyDetector:
    def __init__(self):
    
        pass
    
    def detect_anomalies(self, data, method='z_score', threshold=3.0, n_neighbors=100, contamination=0.1, system_clock=None):
        """
        Detect anomalies in electricity consumption data using the specified method.

        Args:
            data: List of dictionaries with 'date', 'consumption', and 'building' keys
            method: Anomaly detection method ('z_score' or 'LOF')
            threshold: Threshold for anomaly detection (Z-Score or LOF sensitivity)
            n_neighbors: Number of neighbors for LOF (default=100)
            contamination: Expected proportion of outliers for LOF (default=1)
            system_clock: Optional datetime object to use as the detection time

        Returns:
            List of anomalies with severity classification
        """
        if not data or len(data) < 3:
            return []

        detection_time = system_clock or datetime.now()  # Use system clock if provided, fallback to current time

        if method == 'LOF':
            # Extract consumption values and reshape for sklearn
            consumption_values = np.array([float(item['consumption']) for item in data]).reshape(-1, 1)

            # Apply LOF algorithm
            clf = LocalOutlierFactor(n_neighbors=n_neighbors, contamination=contamination)
            y_pred = clf.fit_predict(consumption_values)
            outlier_scores = clf.negative_outlier_factor_

            # Find outliers
            anomalies = []
            for i, (pred, score, item) in enumerate(zip(y_pred, outlier_scores, data)):
                if pred == -1:  # Outlier
                    normalized_score = abs(score)
                    severity = self._classify_severity(normalized_score)
                    anomalies.append({
                        'date': item['date'],
                        'consumption': float(item['consumption']),
                        'lof_score': float(normalized_score),
                        'severity': severity,
                        'building': item['building'],
                        'detection_method': 'LOF',
                        'detection_time': detection_time  # Use system clock
                    })
            return anomalies

        elif method == 'z_score':
            # Calculate Z-Score
            consumption_values = np.array([float(item['consumption']) for item in data])
            mean = np.mean(consumption_values)
            std_dev = np.std(consumption_values)
            anomalies = []

            for item in data:
                z_score = (item['consumption'] - mean) / std_dev if std_dev > 0 else 0
                if abs(z_score) > threshold:
                    severity = "Critical" if abs(z_score) > threshold + 1 else "Warning"
                    anomalies.append({
                        'date': item['date'],
                        'consumption': float(item['consumption']),
                        'z_score': z_score,
                        'severity': severity,
                        'building': item['building'],
                        'detection_method': 'z_score',
                        'detection_time': detection_time  # Use system clock
                    })
            return anomalies

        else:
            raise ValueError(f"Unsupported detection method: {method}")

    def _classify_severity(self, lof_score):
        """Classify the severity of an anomaly based on its LOF score - only Critical or Warning"""
        if lof_score > 1.1:  # Previously the threshold for "Error"
            return "Critical"
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
                existing.z_score = anomaly.get('lof_score', 0)  # Store LOF score in z_score field
                existing.severity = anomaly['severity']
            else:
                # Create new anomaly alert
                new_alert = AnomalyAlert(
                    date=anomaly['date'],
                    building=anomaly['building'],
                    consumption=anomaly['consumption'],
                    z_score=anomaly.get('lof_score', 0),  # Store LOF score in z_score field
                    severity=anomaly['severity'],
                    detection_method=anomaly['detection_method']
                )
                db.session.add(new_alert)
                new_count += 1
        
        db.session.commit()
        return new_count