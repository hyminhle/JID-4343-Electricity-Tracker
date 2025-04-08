from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

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
    
    # Add a unique constraint to prevent duplicates
    __table_args__ = (
        db.UniqueConstraint('date', 'building', 'detection_method', name='uix_anomaly_building_date_method'),
    )

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