import mysql.connector

mydb = mysql.connector.connect(
    host="localhost",
    user="root",
    passwd = "ElectricitySLB15#",
    )

mycursor = mydb.cursor()

#mycursor.execute("CREATE DATABASE electricitydata")
mycursor.execute("SHOW DATABASES")
for db in mycursor:
    print(db)