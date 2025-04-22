# Installation Guide for Electricity Tracker

This guide provides step-by-step instructions to set up and run the Electricity Tracker project.

## Pre-requisites

Ensure the following software and hardware configurations are met before installation:

### Software Requirements
1. **Python** (version 3.8 or higher) - [Download Python](https://www.python.org/)
2. **Node.js** (version 16.x or higher) - [Download Node.js](https://nodejs.org/)
3. **npm** (comes with Node.js) or **yarn** (optional) - [Install Yarn](https://yarnpkg.com/)
4. **MySQL** (version 8.x or higher) - [Download MySQL](https://dev.mysql.com/downloads/)
5. **Git** - [Download Git](https://git-scm.com/)


## Dependent Libraries

### Backend Dependencies
Install the following Python libraries:
```bash
pip install flask flask-cors matplotlib pandas mysql-connector mysql-connector-python pymysql flask-sqlalchemy Flask-Caching apscheduler prophet plotly scikit-learn redis flask-mail
```

### Frontend Dependencies
Install the following Node.js libraries:
```bash
npm install chart.js axios chartjs-plugin-annotation react-router-dom react-leaflet@4 leaflet leaflet.heat react-datepicker dotenv
```

## Download Instructions

1. **Clone the Repository**
   ```bash
   git clone https://github.com/your-repo/JID-4343-Electricity-Tracker-main.git
   ```

2. **Navigate to the Project Directory**
   ```bash
   cd JID-4343-Electricity-Tracker-main
   ```

## Build Instructions

### Backend
1. **Navigate to the Backend Directory**
   ```bash
   cd backend
   ```

2. **Create a Virtual Environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install Required Python Packages**
   ```bash
   pip install -r requirements.txt
   ```

4. **Initialize the Database**
   ```bash
   flask db init
   flask db migrate
   flask db upgrade
   ```

### Frontend
1. **Navigate to the Frontend Directory**
   ```bash
   cd frontend
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

## Installation of Actual Application

### Backend
1. **Set Up Environment Variables**
   - Create a `.env` file in the `backend` directory.
   - Add the following variables:
     ```
     SQLALCHEMY_DATABASE_URI=mysql+pymysql://<username>:<password>@<host>/<database>
     MAIL_SERVER=smtp.gmail.com
     MAIL_PORT=587
     MAIL_USERNAME=<your-email>
     MAIL_PASSWORD=<your-email-password>
     MAIL_USE_TLS=True
     MAIL_USE_SSL=False
     ```

2. **Run the Backend Server**
   ```bash
   flask run
   ```

### Frontend Setup
1. **Set Up Environment Variables**
   - Create a `.env` file in the `frontend` directory.
   - Add the following variable:
     ```
     REACT_APP_MAPTILER_KEY=<your-maptiler-key>
     ```

2. **Run the Frontend Development Server**
   ```bash
   npm start
   ```

## Database Setup
1. **Create a MySQL Database**
   - Log in to your MySQL server:
     ```bash
     mysql -u <username> -p
     ```
   - Create a new database:
     ```sql
     CREATE DATABASE electricitydata;
     ```

2. **Configure Remote Access (if applicable)**
   - Ensure your MySQL server allows remote connections if hosting on a cloud provider.

## Required Packages

### Backend
- **Flask**: Web framework
- **Flask-SQLAlchemy**: ORM for database interactions
- **Flask-Caching**: Caching support
- **Flask-Mail**: Email support
- **pandas**: Data manipulation
- **numpy**: Numerical computations
- **scipy**: Scientific computations
- **prophet**: Time series forecasting
- **scikit-learn**: Machine learning utilities
- **apscheduler**: Background job scheduling
- **mysql-connector-python**: MySQL database connector

Install missing packages using:
```bash
pip install <package-name>
```

### Frontend
- **React**: Frontend framework
- **axios**: HTTP client
- **react-leaflet**: Map rendering
- **chart.js**: Graph rendering
- **react-datepicker**: Date picker component
- **dotenv**: Environment variable management 

Install missing packages using:
```bash
npm install <package-name>
```

## LLaMa Installation Instructions

### macOS
1. Clone the LLaMa repository:
   ```bash
   git clone https://github.com/ggerganov/llama.cpp
   cd llama.cpp
   ```

2. Clear any previous build (optional):
   ```bash
   rm -rf build
   ```

3. Create a new build directory and navigate into it:
   ```bash
   mkdir build && cd build
   ```

4. Configure the build with CMake:
   ```bash
   cmake .. -DLLAMA_CURL=ON -DLLAMA_BUILD_SERVER=ON
   ```

5. Build the project:
   ```bash
   make -j
   ```

6. Run the LLaMa server:
   ```bash
   ./bin/llama-server --hf-repo hugging-quants/Llama-3.2-3B-Instruct-Q4_K_M-GGUF --hf-file llama-3.2-3b-instruct-q4_k_m.gguf -c 2048
   ```

### Windows
1. Clone the LLaMa repository:
   ```bash
   git clone https://github.com/ggerganov/llama.cpp
   cd llama.cpp
   ```

2. Create a new build directory and navigate into it:
   ```bash
   mkdir build && cd build
   ```

3. Configure the build with CMake:
   ```bash
   cmake .. -DLLAMA_CURL=ON -DCURL_LIBRARY=/path/to/libcurl.lib -DCURL_INCLUDE_DIR=/path/to/curl/include
   ```

4. Build the project in Release mode:
   ```bash
   cmake --build . --config Release
   ```

5. Run the LLaMa server:
   ```bash
   ./bin/llama-server --hf-repo hugging-quants/Llama-3.2-3B-Instruct-Q4_K_M-GGUF --hf-file llama-3.2-3b-instruct-q4_k_m.gguf -c 2048
   ```

## Running the Application

1. **Start the Backend Server**
   ```bash
   cd backend
   flask run
   ```

2. **Start the Frontend Server**
   ```bash
   cd frontend
   npm start
   ```

3. **Access the Application**
   Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Troubleshooting

### Common Errors and Solutions

1. **Error: `ModuleNotFoundError`**
   - **Cause**: Missing Python or Node.js dependencies.
   - **Solution**: Run the following commands:
     ```bash
     pip install -r requirements.txt
     npm install
     ```

2. **Error: `Database Connection Failed`**
   - **Cause**: Incorrect MySQL credentials or database not running.
   - **Solution**: Verify the `SQLALCHEMY_DATABASE_URI` in the `.env` file and ensure the MySQL server is running.

3. **Error: `Port Already in Use`**
   - **Cause**: Another application is using the default port.
   - **Solution**: Specify a different port when starting the server:
     ```bash
     flask run --port=5001
     ```

4. **Frontend Not Loading**
   - **Cause**: Missing environment variable for MapTiler key.
   - **Solution**: Ensure `REACT_APP_MAPTILER_KEY` is set in the `.env` file.

5. **Cache Issues**
   - **Cause**: Stale or missing cache data.
   - **Solution**: Restart the backend server to refresh the cache.

6. **Email Sending Fails**
   - **Cause**: Incorrect email credentials.
   - **Solution**: Verify the `MAIL_USERNAME` and `MAIL_PASSWORD` in the `.env` file.

For additional support, refer to the project documentation or contact the development team.
