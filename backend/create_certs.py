from datetime import datetime, timedelta, timezone
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization

print("[🔑] Génération de la clé privée RSA (2048 bits)...")
private_key = rsa.generate_private_key(
    public_exponent=65537,
    key_size=2048,
)

print("[📜] Création du certificat auto-signé (Standard TLS)...")
subject = issuer = x509.Name([
    x509.NameAttribute(NameOID.COUNTRY_NAME, "FR"),
    x509.NameAttribute(NameOID.ORGANIZATION_NAME, "SmartSIEM"),
    x509.NameAttribute(NameOID.COMMON_NAME, "localhost"),
])

# Configuration de la validité (10 ans)
now = datetime.now(timezone.utc)
cert = (
    x509.CertificateBuilder()
    .subject_name(subject)
    .issuer_name(issuer)
    .public_key(private_key.public_key())
    .serial_number(x509.random_serial_number())
    .not_valid_before(now)
    .not_valid_after(now + timedelta(days=10*365))
    .sign(private_key, hashes.SHA256())
)

print("[💾] Écriture des fichiers key.pem et cert.pem...")
# Sauvegarde de la clé privée
with open("key.pem", "wb") as f:
    f.write(
        private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        )
    )

# Sauvegarde du certificat
with open("cert.pem", "wb") as f:
    f.write(cert.public_bytes(serialization.Encoding.PEM))

print("[✅] Certificats TLS générés proprement et sans avertissements !")