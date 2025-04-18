import pandas as pd
import numpy as np
from prophet import Prophet
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error, mean_absolute_error
from sklearn.model_selection import TimeSeriesSplit, GridSearchCV
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline


class Predictor:
    def __init__(self):
        pass

    def predict(self, datasets):
        try:
            datasets.sort(key=lambda x: (x['year'], x['month']), reverse=True)
            print("Sorted datasets:", datasets)

            predict_data = []
            for dataset in datasets:
                year = dataset['year']
                month = dataset['month']
                building = dataset['building']
                data = dataset['data']
                print(f"Processing dataset: year={year}, month={month}, building={building}, data_length={len(data)}")
                if data:
                    predict_data.extend(data)

            if not predict_data:
                return {'error': 'No data available for the selected datasets'}, 404

            df = pd.DataFrame(predict_data)

           
            df['ds'] = pd.to_datetime(df['date'], format='%Y-%m-%d', errors='coerce')
            df['ds'] = df['ds'].dt.tz_localize(None)
            df['y'] = df['consumption']

            df = df.dropna(subset=['ds', 'y'])
            if df.empty:
                return {'error': 'No valid data available after cleaning'}, 404

            lower_bound = df['y'].quantile(0.05)
            upper_bound = df['y'].quantile(0.95)
            df = df[(df['y'] >= lower_bound) & (df['y'] <= upper_bound)]
            print("Data after outlier removal:", df.shape)

            prophet = Prophet()
            prophet.fit(df[['ds', 'y']])
            future = prophet.make_future_dataframe(periods=30, freq='D')
            future = future[future['ds'] <= (df['ds'].max() + pd.Timedelta(days=30))]
            prophet_forecast = prophet.predict(future)
            if 'yhat' not in prophet_forecast.columns:
                return {'error': 'Prophet forecast does not contain the expected yhat column'}, 500
            prophet_results = prophet_forecast[['ds', 'yhat']]
            df = pd.merge(df, prophet_results, on='ds', how='left')

            df['day_of_week'] = df['ds'].dt.dayofweek
            df['month'] = df['ds'].dt.month
            df['lag_1'] = df['y'].shift(1)
            df['lag_2'] = df['y'].shift(2)
            df['lag_3'] = df['y'].shift(3)
            df['rolling_mean_3'] = df['y'].rolling(window=3).mean()
            df['diff_1'] = df['y'] - df['lag_1']
            df = df.dropna()
            if df.empty:
                return {'error': 'No valid data available after feature engineering'}, 404

            feature_columns = ['yhat', 'day_of_week', 'month', 'lag_1', 'lag_2', 'lag_3', 'rolling_mean_3', 'diff_1']
            X = df[feature_columns]
            y = df['y']

            split_index = int(len(df) * 0.8)
            X_train, X_test = X.iloc[:split_index], X.iloc[split_index:]
            y_train, y_test = y.iloc[:split_index], y.iloc[split_index:]

            pipeline = Pipeline([
                ('scaler', StandardScaler()),
                ('rf', RandomForestRegressor(random_state=42))
            ])

            tscv = TimeSeriesSplit(n_splits=5)
            param_grid = {
                'rf__n_estimators': [50, 100, 200],
                'rf__max_depth': [None, 10, 20],
                'rf__min_samples_split': [2, 5, 10]
            }
            grid_search = GridSearchCV(pipeline, param_grid, cv=tscv,scoring='neg_mean_squared_error', n_jobs=-1)
            grid_search.fit(X_train, y_train)
            best_model = grid_search.best_estimator_
            print("Best RF Parameters:", grid_search.best_params_)


            y_pred = best_model.predict(X_test)
            rmse = np.sqrt(mean_squared_error(y_test, y_pred))  
            mae = mean_absolute_error(y_test, y_pred)

            mean_y_test = np.mean(y_test)
            rmse_percentage = (rmse / mean_y_test) * 100  #
            mae_percentage = (mae / mean_y_test) * 100

            print(f"Root Mean Squared Error on test set: {rmse}")
            print(f"Mean Absolute Error on test set: {mae}")
            print(f"Percentage RMSE: {rmse_percentage:.2f}%")
            print(f"Percentage MAE: {mae_percentage:.2f}%")

            future = future.merge(prophet_results, on='ds', how='left')
            future['day_of_week'] = future['ds'].dt.dayofweek
            future['month'] = future['ds'].dt.month
            future = future.sort_values(by='ds').reset_index(drop=True)

            last_three = list(df['y'].iloc[-3:])
            future_predictions = []

            for i, row in future.iterrows():
                lag_1 = last_three[-1]
                lag_2 = last_three[-2]
                lag_3 = last_three[-3]
                rolling_mean_3 = np.mean(last_three)
                diff_1 = lag_1 - lag_2

                feature_data = pd.DataFrame([[
                    row['yhat'],
                    row['day_of_week'],
                    row['month'],
                    lag_1,
                    lag_2,
                    lag_3,
                    rolling_mean_3,
                    diff_1
                ]], columns=feature_columns)

                pred = best_model.predict(feature_data)[0]
                future_predictions.append(pred)

                last_three.append(pred)
                last_three.pop(0)

            future['Final_Prediction'] = future_predictions
            future = future.sort_values(by='ds')
            print("Final Predictions:", future[['ds', 'Final_Prediction']])

            return {
                'predictions': future[['ds', 'Final_Prediction']].to_dict(orient='records'),
                'evaluation': {
                    'root_mean_squared_error': rmse,
                    'mean_absolute_error': mae,
                    'percentage_rmse': rmse_percentage,
                    'percentage_mae': mae_percentage
                }
            }
        except Exception as e:
            return {'error': str(e)}, 500