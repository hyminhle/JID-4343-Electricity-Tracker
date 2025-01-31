import pandas as pd
import numpy as np
from prophet import Prophet
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error, mean_absolute_error
from sklearn.model_selection import train_test_split
from flask import Flask, request, jsonify

app = Flask(__name__)

class Predictor:
    def __init__(self):
        pass

    def predict(self, datasets):
        try:
            predict_data = []
            for dataset in datasets:
                year = dataset['year']
                month = dataset['month']
                building = dataset['building']
                data = dataset['data']
                if data:
                    predict_data.extend(data)

            if not predict_data:
                return jsonify({'error': 'No data available for the selected datasets'}), 404


            df = pd.DataFrame(predict_data)
            df['ds'] = pd.to_datetime(df['date'], errors='coerce')  
            df['y'] = df['consumption']
            df = df.dropna()


            prophet = Prophet()
            prophet.fit(df[['ds', 'y']])


            future = prophet.make_future_dataframe(periods=31, freq='D')
            future = future[future['ds'].dt.month == month]
            prophet_forecast = prophet.predict(future)


            prophet_results = prophet_forecast[['ds', 'yhat']]
            df = pd.merge(df, prophet_results, on='ds', how='left')


            df['day_of_week'] = df['ds'].dt.dayofweek
            df['month'] = df['ds'].dt.month
            df['lag_1'] = df['y'].shift(1)
            df['lag_2'] = df['y'].shift(2)
            df = df.dropna()


            X = df[['yhat', 'day_of_week', 'month', 'lag_1', 'lag_2']]
            y = df['y']
            
            X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

            rf_model = RandomForestRegressor(random_state=42)
            rf_model.fit(X_train, y_train)

            y_pred = rf_model.predict(X_test)
            mse = mean_squared_error(y_test, y_pred)
            mae = mean_absolute_error(y_test, y_pred)


            future['day_of_week'] = future['ds'].dt.dayofweek
            future['month'] = future['ds'].dt.month
            future['lag_1'] = df['y'].iloc[-1]
            future['lag_2'] = df['y'].iloc[-2]
            future_X = future[['yhat', 'day_of_week', 'month', 'lag_1', 'lag_2']]
            future_predictions = rf_model.predict(future_X)

            future['Final_Prediction'] = future_predictions

            return jsonify({
                'predictions': future[['ds', 'Final_Prediction']].to_dict(orient='records'),
                'evaluation': {
                    'mean_squared_error': mse,
                    'mean_absolute_error': mae
                }
            })
        except Exception as e:
            return jsonify({'error': str(e)}), 500

