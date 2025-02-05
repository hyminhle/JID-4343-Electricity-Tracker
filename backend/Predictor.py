import pandas as pd
import numpy as np
from prophet import Prophet
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error, mean_absolute_error
from sklearn.model_selection import train_test_split


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
               print(f"Processing dataset: year={year}, month={month}, building={building}, data_length={len(data)}")  # Print dataset info
    
               if data:
                   predict_data.extend(data)


           if not predict_data:
               return {'error': 'No data available for the selected datasets'}, 404


           # Convert the data into a DataFrame
           df = pd.DataFrame(predict_data)


           # Debug: Print the raw DataFrame
           print("Raw DataFrame:", df)


           # Parse the date column with the correct format
           df['ds'] = pd.to_datetime(df['date'], format='%a, %d %b %Y %H:%M:%S %Z', errors='coerce')


           # Remove timezone information from the 'ds' column
           df['ds'] = df['ds'].dt.tz_localize(None)


           df['y'] = df['consumption']


           # Drop rows with invalid dates or missing values
           df = df.dropna(subset=['ds', 'y'])


           # Debug: Print the DataFrame after cleaning
           print("DataFrame after cleaning:", df)


           if df.empty:
               return {'error': 'No valid data available after cleaning'}, 404


           # Fit the Prophet model
           prophet = Prophet()
           prophet.fit(df[['ds', 'y']])


           # Create future dates for prediction
           future = prophet.make_future_dataframe(periods=31, freq='D')
           future = future[future['ds'].dt.month == int(month)]  # Filter by the selected month


           # Debug: Print the future DataFrame
           print("Future DataFrame for prediction:", future)


           # Generate Prophet forecasts
           prophet_forecast = prophet.predict(future)


           # Debug: Print the Prophet forecast DataFrame
           print("Prophet Forecast DataFrame:", prophet_forecast)


           # Check if 'yhat' column exists in the forecast
           if 'yhat' not in prophet_forecast.columns:
               return {'error': 'Prophet forecast does not contain the expected yhat column'}, 500


           # Merge Prophet predictions with the original data
           prophet_results = prophet_forecast[['ds', 'yhat']]
           df = pd.merge(df, prophet_results, on='ds', how='left')


           # Debug: Print the DataFrame after merging with Prophet results
           print("DataFrame after merging with Prophet results:", df)


           # Feature engineering for Random Forest
           df['day_of_week'] = df['ds'].dt.dayofweek
           df['month'] = df['ds'].dt.month
           df['lag_1'] = df['y'].shift(1)
           df['lag_2'] = df['y'].shift(2)
           df = df.dropna()


           # Debug: Print the DataFrame after feature engineering
           print("DataFrame after feature engineering:", df)


           if df.empty:
               return {'error': 'No valid data available after feature engineering'}, 404


           # Prepare features and target for Random Forest
           X = df[['yhat', 'day_of_week', 'month', 'lag_1', 'lag_2']]
           y = df['y']


           # Split the data into training and testing sets
           X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)


           # Train the Random Forest model
           rf_model = RandomForestRegressor(random_state=42)
           rf_model.fit(X_train, y_train)


           # Evaluate the model
           y_pred = rf_model.predict(X_test)
           mse = mean_squared_error(y_test, y_pred)
           mae = mean_absolute_error(y_test, y_pred)


           # Prepare future data for prediction
           future['day_of_week'] = future['ds'].dt.dayofweek
           future['month'] = future['ds'].dt.month
           future['lag_1'] = df['y'].iloc[-1]
           future['lag_2'] = df['y'].iloc[-2]


           # Ensure 'yhat' is included in the future DataFrame
           future = pd.merge(future, prophet_forecast[['ds', 'yhat']], on='ds', how='left')


           # Debug: Print the future DataFrame after merging with 'yhat'
           print("Future DataFrame after merging with yhat:", future)


           # Prepare features for future predictions
           future_X = future[['yhat', 'day_of_week', 'month', 'lag_1', 'lag_2']]


           # Debug: Print the future_X DataFrame
           print("Future_X DataFrame:", future_X)


           # Generate predictions for future data
           future_predictions = rf_model.predict(future_X)


           # Add predictions to the future DataFrame
           future['Final_Prediction'] = future_predictions


           # Debug: Print the final predictions
           print("Final Predictions:", future[['ds', 'Final_Prediction']])


           # Return the results
           return {
               'predictions': future[['ds', 'Final_Prediction']].to_dict(orient='records'),
               'evaluation': {
                   'mean_squared_error': mse,
                   'mean_absolute_error': mae
               }
           }
       except Exception as e:
           return {'error': str(e)}, 500
