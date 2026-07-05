import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

from dotenv import load_dotenv
from jinja2 import Environment, FileSystemLoader

load_dotenv()

SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_EMAIL = os.getenv("SMTP_EMAIL")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
FROM_EMAIL = os.getenv("FROM_EMAIL")

env = Environment(loader=FileSystemLoader(Path(__file__).resolve().parent / "templates"))


def send_otp(to_email: str, username: str, otp: str):
    if not all([SMTP_SERVER, SMTP_EMAIL, SMTP_PASSWORD, FROM_EMAIL]):
        raise ValueError("Configuration SMTP incomplète. Vérifiez SMTP_SERVER, SMTP_PORT, SMTP_EMAIL, SMTP_PASSWORD et FROM_EMAIL.")

    template = env.get_template("welcome.html")
    html_content = template.render(username=username, otp=otp)

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Bienvenue"
    msg["From"] = FROM_EMAIL
    msg["To"] = to_email

    msg.attach(MIMEText(html_content, "html"))

    with smtplib.SMTP(SMTP_SERVER, SMTP_PORT, timeout=10) as server:
        server.starttls()
        server.login(SMTP_EMAIL, SMTP_PASSWORD)
        server.sendmail(FROM_EMAIL, to_email, msg.as_string())

def send_alert(to_email: str, username: str, alert_message: str):
    if not all([SMTP_SERVER, SMTP_EMAIL, SMTP_PASSWORD, FROM_EMAIL]):
        raise ValueError("Configuration SMTP incomplète. Vérifiez SMTP_SERVER, SMTP_PORT, SMTP_EMAIL, SMTP_PASSWORD et FROM_EMAIL.")

    template = env.get_template("alert.html")
    html_content = template.render(username=username, alert_message=alert_message)

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Alerte de sécurité"
    msg["From"] = FROM_EMAIL
    msg["To"] = to_email

    msg.attach(MIMEText(html_content, "html"))

    with smtplib.SMTP(SMTP_SERVER, SMTP_PORT, timeout=10) as server:
        server.starttls()
        server.login(SMTP_EMAIL, SMTP_PASSWORD)
        server.sendmail(FROM_EMAIL, to_email, msg.as_string())