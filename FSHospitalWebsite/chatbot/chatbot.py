from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import pandas as pd
from sklearn import preprocessing
from sklearn.tree import DecisionTreeClassifier
from sklearn.model_selection import train_test_split
from sklearn.svm import SVC
import numpy as np
import csv
import warnings
import os
import argparse

warnings.filterwarnings("ignore", category=DeprecationWarning)

# Argument parser to decide between web and console mode
parser = argparse.ArgumentParser(description="HealthCare ChatBot")
parser.add_argument('--console', action='store_true', help="Run in console mode instead of web mode")
args = parser.parse_args()

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

# Train SVM model (for comparison)
svm = SVC(probability=True)
svm.fit(x_train, y_train)
print("for svm: ")
print(svm.score(x_test, y_test))

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

# Function to find symptoms associated with a disease
def get_associated_symptoms(disease, training_data, symptom_cols):
    # Filter training data for rows where the prognosis matches the disease
    disease_rows = training_data[training_data['prognosis'] == disease]
    if disease_rows.empty:
        return []

    # Calculate the frequency of each symptom for the disease
    symptom_frequencies = disease_rows[symptom_cols].sum() / len(disease_rows)
    
    # Get symptoms that are present in at least 50% of cases for the disease
    associated_symptoms = symptom_frequencies[symptom_frequencies > 0.5].index.tolist()
    
    # Sort by severity (if available in severityDictionary)
    associated_symptoms = sorted(
        associated_symptoms,
        key=lambda x: severityDictionary.get(x.lower(), 0),
        reverse=True
    )
    
    return associated_symptoms[:3]  # Limit to top 3 most relevant symptoms

# Shared logic for predicting disease (used by both web and console modes)
def predict_disease(symptoms, days):
    input_vector = np.zeros(len(cols))
    unknown_symptoms = []

    # Process initial symptom
    for symptom in symptoms:
        symptom = symptom.strip().lower().replace(' ', '_')
        if symptom in cols_lower:
            idx = cols_lower.index(symptom)
            input_vector[idx] = 1
        else:
            unknown_symptoms.append(symptom)

    if unknown_symptoms:
        return f"Sorry, I didn't recognize these symptoms: {', '.join(unknown_symptoms)}. Please check the spelling and try again."

    # Preliminary prediction to determine associated symptoms
    input_df = pd.DataFrame([input_vector], columns=cols)
    preliminary_prediction = clf.predict(input_df)[0]
    preliminary_disease = le.inverse_transform([preliminary_prediction])[0]

    # Get associated symptoms for the preliminary predicted disease
    follow_up_symptoms = get_associated_symptoms(preliminary_disease, training, cols)
    
    # Remove symptoms already provided by the user
    follow_up_symptoms = [s for s in follow_up_symptoms if s.lower() not in [sym.lower() for sym in symptoms]]

    # Ask follow-up questions only for relevant symptoms
    for symptom in follow_up_symptoms:
        response = yield f"Are you experiencing {symptom.replace('_', ' ')} ? : "
        if response.lower() in ['yes', 'y']:
            idx = cols_lower.index(symptom.lower())
            input_vector[idx] = 1

    # Final prediction with updated symptoms
    input_df = pd.DataFrame([input_vector], columns=cols)
    prediction = clf.predict(input_df)[0]
    disease = le.inverse_transform([prediction])[0]

    # Prepare response
    desc = description_list.get(disease.lower(), "No description available.")
    precautions = precautionDictionary.get(disease.lower(), [])
    precautions_text = '\n'.join([f"{i+1} ) {p}" for i, p in enumerate(precautions) if p]) if precautions else "No specific precautions available."

    response = (
        f"It might not be that bad but you should take precautions.\n"
        f"You may have {disease}\n\n"
        f"{desc}\n\n"
        f"Take following measures :\n{precautions_text}"
    )
    return response

# Console-based chatbot mode
def console_chatbot():
    print("-----------------------------------HealthCare ChatBot-----------------------------------\n")
    name = input("Your Name?                              ->")
    print(f"Hello, {name}\n")

    while True:
        # Get initial symptom
        symptom_input = input("Enter the symptom you are experiencing                  ->")
        symptom = symptom_input.strip().lower().replace(' ', '_')

        # Search for related symptoms
        related_symptoms = [col for col in cols_lower if symptom in col]
        if not related_symptoms:
            print("Enter valid symptom.")
            continue
        elif len(related_symptoms) > 1:
            print("searches related to input: ")
            for idx, rel_symptom in enumerate(related_symptoms):
                print(f"{idx} ) {rel_symptom}")
            choice = int(input(f"Select the one you meant (0 - {len(related_symptoms)-1}):  "))
            symptom = related_symptoms[choice]
        else:
            symptom = related_symptoms[0]
            print("searches related to input: ")
            print(f"0 ) {symptom}")

        days = int(input("Okay. From how many days ? : "))

        # Run prediction with follow-up questions
        prediction_gen = predict_disease([symptom], days)
        response = next(prediction_gen)  # Get first prompt or result
        while True:
            try:
                print(response, end="")
                user_response = input()
                response = prediction_gen.send(user_response)
            except StopIteration as e:
                print(response)
                break

        print("----------------------------------------------------------------------------------------")
        break

# Flask-based web mode
if not args.console:
    app = Flask(__name__, static_folder='../frontend', template_folder='../frontend')
    CORS(app)

    # Store conversation state for each user session
    conversation_state = {}

    @app.route('/chat', methods=['POST'])
    def chat():
        data = request.get_json()
        user_message = data.get('message', '').strip().lower()
        session_id = request.remote_addr  # Use IP as a simple session identifier

        # Initialize conversation state if not exists
        if session_id not in conversation_state:
            conversation_state[session_id] = {
                'stage': 'greeting',  # Stages: greeting, name, symptom, days, follow_up, result
                'name': None,
                'symptoms': [],
                'days': None,
                'follow_up_index': 0,
                'prediction_gen': None
            }

        state = conversation_state[session_id]

        # Define common greetings
        greetings = ['hi', 'hello', 'hey', 'greetings']

        # Stage: Greeting
        if state['stage'] == 'greeting':
            if user_message in greetings:
                state['stage'] = 'name'
                return jsonify({'reply': "Hello! What is your name?"})
            else:
                return jsonify({'reply': "Please start by saying 'Hi' or 'Hello'."})

        # Stage: Name
        elif state['stage'] == 'name':
            state['name'] = user_message.capitalize()
            state['stage'] = 'symptom'
            return jsonify({'reply': f"Hello, {state['name']}! Please enter the symptom you are experiencing."})

        # Stage: Symptom
        elif state['stage'] == 'symptom':
            symptoms = [s.strip().lower().replace(' ', '_') for s in user_message.split(',')]
            related_symptoms = []
            for symptom in symptoms:
                matches = [col for col in cols_lower if symptom in col]
                if matches:
                    related_symptoms.extend(matches)
                else:
                    return jsonify({'reply': f"Sorry, I didn't recognize the symptom: {symptom}. Please check the spelling and try again."})

            if len(related_symptoms) > 1:
                response = "I found multiple related symptoms. Please select the one you meant:\n"
                for idx, sym in enumerate(related_symptoms):
                    response += f"{idx}) {sym.replace('_', ' ')}\n"
                state['stage'] = 'symptom_select'
                state['related_symptoms'] = related_symptoms
                return jsonify({'reply': response})
            else:
                state['symptoms'] = related_symptoms
                state['stage'] = 'days'
                return jsonify({'reply': "Okay. From how many days have you been experiencing this symptom?"})

        # Stage: Symptom Selection
        elif state['stage'] == 'symptom_select':
            try:
                choice = int(user_message)
                if 0 <= choice < len(state['related_symptoms']):
                    state['symptoms'] = [state['related_symptoms'][choice]]
                    state['stage'] = 'days'
                    return jsonify({'reply': "Okay. From how many days have you been experiencing this symptom?"})
                else:
                    return jsonify({'reply': "Invalid selection. Please choose a number between 0 and " + str(len(state['related_symptoms'])-1) + "."})
            except ValueError:
                return jsonify({'reply': "Please enter a valid number."})

        # Stage: Days
        elif state['stage'] == 'days':
            try:
                days = int(user_message)
                state['days'] = days
                state['stage'] = 'follow_up'
                state['prediction_gen'] = predict_disease(state['symptoms'], days)
                response = next(state['prediction_gen'])
                return jsonify({'reply': response})
            except ValueError:
                return jsonify({'reply': "Please enter a valid number of days."})

        # Stage: Follow-Up Questions
        elif state['stage'] == 'follow_up':
            try:
                response = state['prediction_gen'].send(user_message)
                if "It might not be that bad" in response:
                    state['stage'] = 'result'
                    # Format the response for web display (replace newlines with <br>)
                    response = response.replace('\n', '<br>')
                    return jsonify({'reply': response})
                return jsonify({'reply': response})
            except StopIteration as e:
                state['stage'] = 'result'
                response = str(e.value).replace('\n', '<br>')
                return jsonify({'reply': response})

        # Stage: Result (reset for next interaction)
        elif state['stage'] == 'result':
            state['stage'] = 'symptom'
            return jsonify({'reply': "If you have more symptoms, please enter them now."})

        return jsonify({'reply': "Something went wrong. Please try again."})

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

    @app.route('/<path:path>')
    def serve_static(path):
        return send_from_directory('../frontend', path)

    if __name__ == '__main__':
        app.run(debug=True, host='0.0.0.0', port=5000)

else:
    # Run console mode
    if __name__ == '__main__':
        console_chatbot()