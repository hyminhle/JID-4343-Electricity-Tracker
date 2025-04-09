import numpy as np
from datetime import datetime
from models import AnomalyAlert, db
from sklearn.neighbors import LocalOutlierFactor

class AnomalyDetector:
    def __init__(self):
        # No need for methods dictionary anymore since we're only using LOF
        pass
    
    def detect_anomalies(self, data, n_neighbors=20, contamination=0.2):
        """
        Detect anomalies in electricity consumption data using Local Outlier Factor (LOF)
        
        Args:
            data: List of dictionaries with 'date', 'consumption', and 'building' keys
            n_neighbors: Number of neighbors to consider for LOF (default=20)
            contamination: Expected proportion of outliers in the data (default=0.2)
            
        Returns:
            List of anomalies with severity classification
        """
        if not data or len(data) < 3:
            return []
        
        # Extract consumption values and reshape for sklearn
        consumption_values = np.array([float(item['consumption']) for item in data]).reshape(-1, 1)
        
        # Apply LOF algorithm with higher contamination value
        clf = LocalOutlierFactor(n_neighbors=n_neighbors, contamination=contamination)
        y_pred = clf.fit_predict(consumption_values)
        outlier_scores = clf.negative_outlier_factor_
        
        # Find outliers (LOF returns -1 for outliers, 1 for inliers)
        anomalies = []
        for i, (pred, score, item) in enumerate(zip(y_pred, outlier_scores, data)):
            if pred == -1:  # This is an outlier
                # Convert LOF score to positive severity measure (more negative = more anomalous)
                # Normalize it to make classification consistent
                normalized_score = abs(score)
                
                # Classify severity based on normalized LOF score
                severity = self._classify_severity(normalized_score)
                
                anomalies.append({
                    'date': item['date'],
                    'consumption': float(item['consumption']),
                    'lof_score': float(normalized_score),
                    'severity': severity,
                    'building': item['building'],
                    'detection_method': 'LOF'
                })
        
        return anomalies
    
    def _classify_severity(self, lof_score):
        """Classify the severity of an anomaly based on its LOF score"""
        # LOF scores are typically negative, with more negative values indicating stronger outliers
        # We've already converted to absolute value in the calling function
        
        # Adjusted thresholds to make more points classified as higher severity
        if lof_score > 1.35:
            return "Critical"
        elif lof_score > 1.1:
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