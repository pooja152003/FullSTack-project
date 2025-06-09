from django.shortcuts import render
from django.http import JsonResponse
from . import chatbot_logic

def chatbot_response(request):
    if request.method == "POST":
        user_input = request.POST.get('symptoms')  # example input from user
        days = int(request.POST.get('days', 1))    # default to 1 if not provided
        
        # Call your chatbot logic here, e.g. a function that takes symptoms + days and returns diagnosis
        diagnosis = chatbot_logic.get_diagnosis(user_input, days)  # You’ll create this
        
        return JsonResponse({'diagnosis': diagnosis})
    else:
        return render(request, 'chatbot/chat.html')  # your chat UI page
