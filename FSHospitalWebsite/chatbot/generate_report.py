import os
from fpdf import FPDF

def create_pdf_report(name, symptoms, days, diagnosis, description, precautions):
    output_dir = os.path.join(os.path.dirname(__file__), "static", "reports")
    os.makedirs(output_dir, exist_ok=True)

    filename = f"report_{name.lower()}_{days}.pdf"
    save_path = os.path.join(output_dir, filename)

    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=12)
    pdf.cell(200, 10, txt=f"Medical Report for {name}", ln=True, align='C')
    pdf.cell(200, 10, txt=f"Diagnosis: {diagnosis}", ln=True)
    # Add more fields as needed...
    pdf.output(save_path)

    return filename
