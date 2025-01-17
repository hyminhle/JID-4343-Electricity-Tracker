from flask import Flask
from flask_sqlalchemy import SQLAlchemy 
from flask_cors import CORS 
import matplotlib.pyplot as plt
import io


app = Flask(__name__)
CORS(app)

