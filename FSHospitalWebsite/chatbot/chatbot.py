from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import pandas as pd
from sklearn import preprocessing
from sklearn.tree import DecisionTreeClassifier
from sklearn.model_selection import train_test_split
import numpy as np
import csv
import warnings
import os

warnings.filterwarnings("ignore", category=DeprecationWarning)

# Set the path to the frontend folder, which is one level up
app = Flask(__name__, static_folder='../frontend', template_folder='../frontend')
CORS(app)  # Enable CORS to allow cross-origin requests

# Load training and testing data
training = pd.read_csv('data/Training.csv')
cols = training.columns[:-1]  # symptom columns
x = training[cols]
y = training['prognosis']

# Encode target labels
le = preprocessing.LabelEncoder()
le.fit(y)
y_encoded = le.transform(y)

# Train Decision Tree model
x_train, x_test, y_train, y_test = train_test_split(x, y_encoded, test_size=0.33, random_state=42)
clf = DecisionTreeClassifier().fit(x_train, y_train)

# Load symptom description, severity, and precaution dictionaries
description_list = {}
severityDictionary = {}
precautionDictionary = {}

def getDescription():
    with open('masterdata/symptom_Description.csv') as csv_file:
        csv_reader = csv.reader(csv_file, delimiter=',')
        for row in csv_reader:
            description_list[row[0].lower()] = row[1]

def getSeverityDict():
    with open('masterdata/symptom_severity.csv') as csv_file:
        csv_reader = csv.reader(csv_file, delimiter=',')
        for row in csv_reader:
            try:
                severityDictionary[row[0].lower()] = int(row[1])
            except:
                pass

def getprecautionDict():
    with open('masterdata/symptom_precaution.csv') as csv_file:
        csv_reader = csv.reader(csv_file, delimiter=',')
        for row in csv_reader:
            precautionDictionary[row[0].lower()] = [row[1], row[2], row[3], row[4]]

# Initialize dictionaries
getSeverityDict()
getDescription()
getprecautionDict()

# Lowercase symptom columns for matching
cols_lower = [c.lower() for c in cols]

@app.route('/chat', methods=['POST'])
def chat():
    data = request.get_json()
    user_message = data.get('message', '')

    # Process multiple symptoms separated by commas
    symptoms = [s.strip().lower().replace(' ', '_') for s in user_message.split(',')]
    
    input_vector = np.zeros(len(cols))
    unknown_symptoms = []

    for symptom in symptoms:
        if symptom in cols_lower:
            idx = cols_lower.index(symptom)
            input_vector[idx] = 1
        else:
            unknown_symptoms.append(symptom)

    if unknown_symptoms:
        return jsonify({'reply': f"Sorry, I didn't recognize these symptoms: {', '.join(unknown_symptoms)}. Please check the spelling and try again."})

    # Predict disease
    prediction = clf.predict([input_vector])
    disease = le.inverse_transform(prediction)[0]

    # Prepare response
    desc = description_list.get(disease.lower(), "No description available.")
    precautions = precautionDictionary.get(disease.lower(), [])

    precautions_text = ', '.join([p for p in precautions if p]) if precautions else "No specific precautions available."

    response = (
        f"You may have: {disease}\n\n"
        f"Description: {desc}\n\n"
        f"Precautions: {precautions_text}"
    )

    return jsonify({'reply': response})

# Serve the HTML files
@app.route('/')
def serve_html():
    return send_from_directory('../frontend', 'chatbot.html')

@app.route('/index')
def serve_index():
    return send_from_directory('../frontend', 'index.html')

@app.route('/about')
def serve_about():
    return send_from_directory('../frontend', 'about.html')

@app.route('/contact')
def serve_contact():
    return send_from_directory('../frontend', 'contact.html')

@app.route('/medreport')
def serve_medreport():
    return send_from_directory('../frontend', 'medreport.html')

@app.route('/notification')
def serve_notification():
    return send_from_directory('../frontend', 'notification.html')

@app.route('/patientdashboard')
def serve_patientdashboard():
    return send_from_directory('../frontend', 'patientdashboard.html')

@app.route('/prescription')
def serve_prescription():
    return send_from_directory('../frontend', 'prescription.html')

@app.route('/profile')
def serve_profile():
    return send_from_directory('../frontend', 'profile.html')

@app.route('/register')
def serve_register():
    return send_from_directory('../frontend', 'register.html')

@app.route('/total-login')
def serve_total_login():
    return send_from_directory('../frontend', 'total-login.html')

# Serve static files (CSS, images, etc.)
@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('../frontend', path)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)