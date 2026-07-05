
import random

def generate_otp(length: int = 6) -> str:
    """Génère un code OTP aléatoire de la longueur spécifiée."""
    if length <= 0:
        raise ValueError("La longueur de l'OTP doit être un entier positif.")
    
    otp = ''.join(random.choices('0123456789', k=length))
    return otp
