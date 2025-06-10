from django.shortcuts import render
from django.http import HttpResponse
import os

def upload_report(request):
    if request.method == "POST":
        uploaded_file = request.FILES["report_file"]
        save_path = os.path.join("reports/uploads", uploaded_file.name)
        with open(save_path, 'wb+') as dest:
            for chunk in uploaded_file.chunks():
                dest.write(chunk)
        return HttpResponse("Report uploaded successfully!")

    return render(request, "report_upload.html")
