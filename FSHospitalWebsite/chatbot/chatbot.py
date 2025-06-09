from flask import Flask, request, jsonify, send_from_directory, session
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
from datetime import timedelta

warnings.filterwarnings("ignore", category=DeprecationWarning)

# Argument parser to decide between web and console mode
parser = argparse.ArgumentParser(description="HealthCare ChatBot")
parser.add_argument('--console', action='store_true', help="Run in console mode instead of web mode")
args = parser.parse_args()

# Load training and testing data
training = pd.read_csv('data/Training.csv')
cols = training.columns[:-1]
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

getSeverityDict()
getDescription()
getprecautionDict()

cols_lower = [c.lower() for c in cols]

def get_associated_symptoms(disease, training_data, symptom_cols):
    disease_rows = training_data[training_data['prognosis'] == disease]
    if disease_rows.empty:
        return []
    symptom_frequencies = disease_rows[symptom_cols].sum() / len(disease_rows)
    associated_symptoms = symptom_frequencies[symptom_frequencies > 0.5].index.tolist()
    associated_symptoms = sorted(associated_symptoms, key=lambda x: severityDictionary.get(x.lower(), 0), reverse=True)
    return associated_symptoms[:3]

def predict_disease(symptoms, days):
    input_vector = np.zeros(len(cols))
    unknown_symptoms = []
    for symptom in symptoms:
        symptom = symptom.strip().lower().replace(' ', '_')
        if symptom in cols_lower:
            idx = cols_lower.index(symptom)
            input_vector[idx] = 1
        else:
            unknown_symptoms.append(symptom)
    if unknown_symptoms:
        return f"Sorry, I didn't recognize these symptoms: {', '.join(unknown_symptoms)}. Please check the spelling and try again."

    input_df = pd.DataFrame([input_vector], columns=cols)
    preliminary_prediction = clf.predict(input_df)[0]
    preliminary_disease = le.inverse_transform([preliminary_prediction])[0]
    follow_up_symptoms = get_associated_symptoms(preliminary_disease, training, cols)
    follow_up_symptoms = [s for s in follow_up_symptoms if s.lower() not in [sym.lower() for sym in symptoms]]

    for symptom in follow_up_symptoms:
        response = yield f"Are you experiencing {symptom.replace('_', ' ')} ? : "
        if response.lower() in ['yes', 'y']:
            idx = cols_lower.index(symptom.lower())
            input_vector[idx] = 1

    input_df = pd.DataFrame([input_vector], columns=cols)
    prediction = clf.predict(input_df)[0]
    disease = le.inverse_transform([prediction])[0]
    desc = description_list.get(disease.lower(), "No description available.")
    precautions = precautionDictionary.get(disease.lower(), [])
    precautions_text = '\n'.join([f"{i+1} ) {p}" for i, p in enumerate(precautions) if p]) if precautions else "No specific precautions available."
    response = f"It might not be that bad but you should take precautions.\nYou may have {disease}\n\n{desc}\n\nTake following measures :\n{precautions_text}"
    return response

# Console Chatbot
if args.console:
    def console_chatbot():
        print("-----------------------------------HealthCare ChatBot-----------------------------------\n")
        name = input("Your Name?                              ->")
        print(f"Hello, {name}\n")
        while True:
            symptom_input = input("Enter the symptom you are experiencing                  ->")
            symptom = symptom_input.strip().lower().replace(' ', '_')
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
            prediction_gen = predict_disease([symptom], days)
            response = next(prediction_gen)
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

    if __name__ == '__main__':
        console_chatbot()

# Flask Web Chatbot
else:
    app = Flask(__name__, static_folder='../frontend', template_folder='../frontend')
    CORS(app)
    app.secret_key = 'your_secret_key'
    app.permanent_session_lifetime = timedelta(minutes=30)
    conversation_state = {}

    @app.route('/chat', methods=['POST'])
    def chat():
        data = request.get_json()
        user_message = data.get('message', '').strip().lower()
        session_id = request.remote_addr

        if session_id not in conversation_state:
            conversation_state[session_id] = {
                'stage': 'greeting',
                'name': None,
                'symptoms': [],
                'days': None,
                'follow_up_index': 0,
                'prediction_gen': None
            }

        state = conversation_state[session_id]
        greetings = ['hi', 'hello', 'hey', 'greetings']

        if state['stage'] == 'greeting':
            if user_message in greetings:
                state['stage'] = 'name'
                return jsonify({'reply': "Hello! What is your name?"})
            else:
                return jsonify({'reply': "Please start by saying 'Hi' or 'Hello'."})

        elif state['stage'] == 'name':
            state['name'] = user_message.capitalize()
            state['stage'] = 'symptom'
            return jsonify({'reply': f"Hello, {state['name']}! Please enter the symptom you are experiencing."})

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

        elif state['stage'] == 'symptom_select':
            try:
                choice = int(user_message)
                if 0 <= choice < len(state['related_symptoms']):
                    state['symptoms'] = [state['related_symptoms'][choice]]
                    state['stage'] = 'days'
                    return jsonify({'reply': "Okay. From how many days have you been experiencing this symptom?"})
                else:
                    return jsonify({'reply': "Invalid selection. Please choose a valid number."})
            except ValueError:
                return jsonify({'reply': "Please enter a valid number."})

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

        elif state['stage'] == 'follow_up':
            try:
                response = state['prediction_gen'].send(user_message)
                if "It might not be that bad" in response:
                    state['stage'] = 'result'
                    return jsonify({'reply': response})
                return jsonify({'reply': response})
            except StopIteration as e:
                state['stage'] = 'result'
                response = str(e.value)
                return jsonify({'reply': response})

        elif state['stage'] == 'result':
            state['stage'] = 'symptom'
            return jsonify({'reply': "If you have more symptoms, please enter them now."})

        return jsonify({'reply': "Something went wrong. Please try again."})

    @app.route('/')
    def serve_html():
        return send_from_directory('../frontend', 'chatbot.html')

    @app.route('/<path:path>')
    def serve_static(path):
        return send_from_directory('../frontend', path)

    if __name__ == '__main__':
        app.run(debug=True, host='0.0.0.0', port=5000)
