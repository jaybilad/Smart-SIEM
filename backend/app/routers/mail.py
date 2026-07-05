from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.mail_service import send_alert, send_otp

router = APIRouter(prefix="/api/mail", tags=["mail"])


class EmailRequest(BaseModel):
    email: str
    username: str
    otp: str | None = None
    alert_message: str | None = None


@router.post("/send-otp", summary="Envoyer un OTP par email")
def send_otp_email(req: EmailRequest):
    if not req.otp:
        raise HTTPException(status_code=400, detail="Le champ otp est requis pour /send-otp")

    try:
        send_otp(req.email, req.username, req.otp)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Échec d'envoi de l'OTP: {exc}") from exc

    return {"message": "OTP envoyé avec succès"}


@router.post("/send-alert", summary="Envoyer un message d'alerte par email")
def send_alert_email(req: EmailRequest):
    message = req.alert_message or req.otp
    if not message:
        raise HTTPException(status_code=400, detail="Le champ alert_message ou otp est requis pour /send-alert")

    try:
        send_alert(req.email, req.username, message)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Échec d'envoi de l'alerte: {exc}") from exc

    return {"message": "Alerte envoyée avec succès"}