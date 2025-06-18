import google.generativeai as genai
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# ✅ Configure Gemini API key
genai.configure(api_key="AIzaSyBkYKtf2_pG48lmL4PdPRB1d_g0r7bJ9ls")

# ✅ Load the Gemini model
model = genai.GenerativeModel(model_name="models/gemini-1.5-flash")

# ✅ Start a new chat session
chat = model.start_chat()

# ✅ Define the /chat API route
@app.route('/chat', methods=['POST'])
def chat_endpoint():
    user_msg = request.json.get("message", "")
    try:
        response = chat.send_message(user_msg)
        return jsonify({"reply": response.text})
    except Exception as e:
        return jsonify({"reply": f"❌ Error: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=3000)
