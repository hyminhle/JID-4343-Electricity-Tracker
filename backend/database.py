import mysql.connector


mydb = mysql.connector.connect(
    host="localhost",
    user="root",
    passwd = "ElectricitySLB15#",
    database = "electricitydata"
    )

mycursor = mydb.cursor()

mycursor.execute("SELECT month,date,consumption,building FROM electricity_data")

myresult = mycursor.fetchall()

for x in myresult:
    print(x)

mydb.close()