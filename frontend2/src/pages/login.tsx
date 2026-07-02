import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {  Mail, Lock, Eye, EyeOff, AlertTriangle, Check, Wifi } from "lucide-react";
import logoImage from '../assets/logo.png';
import { login as loginUser } from "../api/auth";

// ── MATRIX CANVAS ─────────────────────────────────────────────────────────────

function MatrixCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const chars = "01101001011100101001110010100111001011010100110";
    let drops: number[] = [];
    let cols = 0;

    const init = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const fontSize = 13;
      cols = Math.floor(canvas.width / fontSize);
      drops = Array.from({ length: cols }, () => Math.random() * (canvas.height / fontSize));
    };

    init();
    window.addEventListener("resize", init);

    let raf: number;
    let last = 0;

    const draw = (ts: number) => {
      raf = requestAnimationFrame(draw);
      if (ts - last < 90) return;
      last = ts;

      ctx.fillStyle = "rgba(5,7,15,0.07)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = "12px 'Courier New', monospace";

      drops.forEach((y, i) => {
        const ch = chars[Math.floor(Math.random() * chars.length)];
        const alpha = Math.random() * 0.09 + 0.03;
        ctx.fillStyle = `rgba(0,242,254,${alpha})`;
        ctx.fillText(ch, i * 13, y * 13);
        if (y * 13 > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i] += 0.5;
      });
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", init);
    };
  }, []);

  return <canvas ref={ref} className="absolute inset-0" style={{ opacity: 0.55 }} />;
}

// ── WAVEFORM SVG ──────────────────────────────────────────────────────────────

function Waveform() {
  const d = "M0,30 L10,30 L13,8 L18,52 L23,30 L33,30 L36,16 L41,44 L46,30 L56,30 L59,5 L64,55 L69,30 L79,30 L82,21 L87,39 L92,30 L102,30 L105,12 L110,48 L115,30 L125,30 L128,22 L133,38 L138,30 L148,30 L151,7 L156,53 L161,30 L171,30 L174,18 L179,42 L184,30 L194,30 L197,25 L202,35 L207,30 L217,30 L220,10 L225,50 L230,30 L240,30 L243,20 L248,40 L253,30 L263,30 L266,14 L271,46 L276,30 L286,30 L289,23 L294,37 L299,30 L300,30";

  return (
    <div
      className="relative mb-6 overflow-hidden"
      style={{
        height: 52,
        borderRadius: 10,
        background: "var(--color-cyan-50)",
        border: "1px solid var(--border-cyan-light)",
      }}
    >
      <svg viewBox="0 0 300 60" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
        <defs>
          <linearGradient id="wg" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(0,242,254,0)" />
            <stop offset="25%" stopColor="var(--color-cyan-800)" />
            <stop offset="55%" stopColor="rgba(155,81,224,0.9)" />
            <stop offset="80%" stopColor="var(--color-cyan-800)" />
            <stop offset="100%" stopColor="rgba(0,242,254,0)" />
          </linearGradient>
          <filter id="wf" x="-5%" y="-40%" width="110%" height="180%">
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="sg" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(0,242,254,0)" />
            <stop offset="40%" stopColor="var(--color-cyan-700)" />
            <stop offset="60%" stopColor="var(--color-cyan-900)" />
            <stop offset="100%" stopColor="rgba(0,242,254,0)" />
          </linearGradient>
        </defs>
        <path d={d} stroke="var(--color-cyan-200)" strokeWidth="7" fill="none" />
        <path d={d} stroke="url(#wg)" strokeWidth="1.5" fill="none" filter="url(#wf)" />
        <rect y="0" width="40" height="60" fill="url(#sg)" opacity="0.45">
          <animateTransform
            attributeName="transform"
            type="translate"
            values="-40,0;340,0"
            dur="2.8s"
            repeatCount="indefinite"
          />
        </rect>
      </svg>
      <div className="absolute top-1.5 right-2.5 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
        <span
          className="text-[8.5px] font-mono tracking-widest"
          style={{ color: "var(--color-cyan-500)" }}
        >
          LIVE THREAT ANALYSIS
        </span>
      </div>
    </div>
  );
}

// ── MAIN LOGIN PAGE ────────────────────────────────────────────────────────────

export default function Login() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [usernameFocus, setUsernameFocus] = useState(false);
  const [pwdFocus, setPwdFocus] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [btnHover, setBtnHover] = useState(false);
  const [errors, setErrors] = useState<{ username?: string; password?: string; form?: string }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!username.trim()) errs.username = "Nom d'utilisateur requis";
    if (!password.trim()) errs.password = "Mot de passe requis";
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});

    setLoading(true);
    try {
      const session = await loginUser(username, password);
      setLoading(false);
      setSuccess(true);

      setTimeout(() => {
        navigate(session.redirect_to, { replace: true });
      }, 700);
    } catch (error) {
      setLoading(false);
      setSuccess(false);
      setErrors({
        form: error instanceof Error ? error.message : "Connexion impossible",
      });
    }
  };

  const inputCls = (focus: boolean, err: boolean) => ({
    background: "var(--bg-input)",
    border: `1px solid ${
      err
        ? "var(--border-red-dark)"
        : focus
          ? "var(--border-cyan-dark)"
          : "var(--border-light)"
    }`,
    boxShadow: err
      ? `0 0 0 2px var(--color-red-50), 0 0 18px var(--color-red-100)`
      : focus
        ? `0 0 0 2px var(--color-cyan-100), 0 0 20px var(--color-cyan-100)`
        : "none",
    outline: "none",
    color: "#fff",
    transition: "all var(--duration-fast) var(--timing-ease)",
  });

  const iconColor = (focus: boolean) => ({
    color: focus ? "var(--color-cyan-900)" : "var(--color-slate-400)",
    filter: focus ? "var(--filter-cyan-glow)" : "none",
    transition: "all var(--duration-fast) var(--timing-ease)",
  });

  const btnStyle: React.CSSProperties = {
    background: success
      ? "var(--gradient-btn-success)"
      : loading
        ? "var(--gradient-btn-loading)"
        : "var(--gradient-btn-primary)",
    boxShadow: success
      ? "var(--glow-green-md)"
      : btnHover && !loading
        ? "var(--glow-cyan-lg)"
        : "var(--glow-cyan-md)",
    cursor: loading || success ? "not-allowed" : "pointer",
    transition: "all var(--duration-normal) var(--timing-ease)",
    border: "none",
  };

  return (
    <div
      className="relative min-h-screen flex items-center justify-center overflow-hidden select-none"
      style={{ background: "var(--gradient-bg-main)" }}
    >
      {/* ── Grid overlay ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(var(--border-cyan-light) 1px, transparent 1px), linear-gradient(90deg, var(--border-cyan-light) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse 85% 85% at 50% 50%, black 30%, transparent 100%)",
        }}
      />

      {/* ── Matrix canvas ── */}
      <MatrixCanvas />

      {/* ── Radial glow — cyan left ── */}
      <div
        className="absolute pointer-events-none glow-pulse-left"
        style={{
          left: 0,
          top: "50%",
          width: 720,
          height: 720,
          background: "radial-gradient(circle, var(--color-cyan-200) 0%, transparent 62%)",
          filter: "blur(48px)",
          transform: "translate(-42%,-50%)",
        }}
      />

      {/* ── Radial glow — purple right ── */}
      <div
        className="absolute pointer-events-none glow-pulse-right"
        style={{
          right: 0,
          top: "50%",
          width: 720,
          height: 720,
          background: "radial-gradient(circle, var(--color-purple-300) 0%, transparent 62%)",
          filter: "blur(48px)",
          transform: "translate(42%,-50%)",
        }}
      />

      {/* ── Horizontal scan line ── */}
      <div
        className="absolute inset-x-0 h-px pointer-events-none scan-line"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, var(--border-cyan-light) 20%, var(--color-cyan-300) 50%, var(--border-cyan-light) 80%, transparent 100%)",
        }}
      />

      {/* ── Top-left system label ── */}
      <div className="absolute top-5 left-6 flex items-center gap-2 opacity-30 pointer-events-none">
        <Wifi className="w-3 h-3 text-cyan-400" />
        <span className="text-[9px] font-mono text-cyan-400 tracking-widest">
          SECURE CHANNEL ESTABLISHED
        </span>
      </div>

      {/* ── Top-right system label ── */}
      <div className="absolute top-5 right-6 flex items-center gap-2 opacity-25 pointer-events-none">
        <span className="text-[9px] font-mono text-slate-500 tracking-widest">EU-WEST-1 · TLS 1.3</span>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      </div>

      {/* ── Main card ── */}
      <div className="relative z-10 w-full max-w-110 mx-5 card-in">
        {/* Corner bracket decorations */}
        <div
          className="absolute -top-px -left-px w-6 h-6 border-t-2 border-l-2 rounded-tl-xs"
          style={{
            borderColor: "var(--color-cyan-800)",
            boxShadow: "var(--glow-cyan-sm)",
          }}
        />
        <div
          className="absolute -top-px -right-px w-6 h-6 border-t-2 border-r-2 rounded-tr-xs"
          style={{
            borderColor: "var(--color-cyan-600)",
            boxShadow: "var(--glow-cyan-sm)",
          }}
        />
        <div
          className="absolute -bottom-px -left-px w-6 h-6 border-b-2 border-l-2 rounded-bl-xs"
          style={{
            borderColor: "var(--color-purple-700)",
            boxShadow: "var(--glow-purple-sm)",
          }}
        />
        <div
          className="absolute -bottom-px -right-px w-6 h-6 border-b-2 border-r-2 rounded-br-xs"
          style={{
            borderColor: "var(--color-purple-600)",
            boxShadow: "var(--glow-purple-sm)",
          }}
        />

        {/* Gradient border shell */}
        <div
          className="border-breath"
          style={{
            padding: "1px",
            borderRadius: 16,
            background: "var(--gradient-border-primary)",
            boxShadow: "var(--glow-cyan-xl)",
          }}
        >
          {/* Glass card */}
          <div
            style={{
              borderRadius: 15,
              padding: "2rem",
              background: "var(--gradient-bg-glass)",
              backdropFilter: "var(--backdrop-blur)",
            }}
          >
            {/* ── Logo row ── */}
            <div className="flex items-center gap-3 mb-6">
              <div
                className="relative w-11 h-11 flex items-center justify-center shrink-0"
              >
                <img src={logoImage} alt="Smart SIEM Logo" className="w-full h-full object-cover"/>
                <div
                  className="absolute inset-0 rounded-xl animate-ping opacity-10"
                  style={{ border: "1px solid var(--color-cyan-800)" }}
                />
              </div>

              <div className="min-w-0">
                <p
                  className="text-[17px] font-bold text-white tracking-tight leading-none"
                  style={{ textShadow: "var(--text-shadow-cyan)" }}
                >
                  Smart SIEM
                </p>
                <p
                  className="text-[9px] font-mono tracking-[0.2em] uppercase mt-0.5"
                  style={{ color: "var(--color-cyan-500)" }}
                >
                  Security Intelligence Platform
                </p>
              </div>

              <div className="ml-auto flex items-center gap-1.5 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span
                  className="text-[9px] font-mono tracking-widest"
                  style={{ color: "rgba(52,211,153,0.7)" }}
                >
                  ONLINE
                </span>
              </div>
            </div>

            <Waveform />

            {/* ── Title ── */}
            <div className="mb-6">
              <h1 className="text-[1.2rem] font-bold text-white leading-tight">
                Authentification Sécurisée
              </h1>
              <p className="text-[11px] font-mono mt-0.5" style={{ color: "var(--color-slate-400)" }}>
                Accès réservé au personnel accrédité SOC
              </p>
            </div>

            {/* ── Form ── */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {errors.form && (
                <div
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-[10px] font-mono"
                  style={{
                    color: "var(--color-red-800)",
                    background: "var(--color-red-50)",
                    border: "1px solid var(--border-red-medium)",
                  }}
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errors.form}</span>
                </div>
              )}

              {/* Email */}
              <div>
                <label
                  className="block text-[10px] font-mono mb-1.5 tracking-wider"
                  style={{ color: "var(--color-cyan-500)" }}
                >
                  NOM D'UTILISATEUR
                </label>
                <div className="relative">
                  <Mail
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                    style={iconColor(usernameFocus)}
                  />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setErrors((p) => ({ ...p, username: undefined, form: undefined }));
                    }}
                    onFocus={() => setUsernameFocus(true)}
                    onBlur={() => setUsernameFocus(false)}
                    placeholder="j.martin"
                    className="w-full pl-10 pr-4 py-3 rounded-xl text-sm font-mono placeholder:text-slate-700"
                    style={inputCls(usernameFocus, !!errors.username)}
                  />
                </div>
                {errors.username && (
                  <p
                    className="text-[10px] font-mono mt-1.5 ml-1"
                    style={{ color: "var(--color-red-800)" }}
                  >
                    ⚠ {errors.username}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <label
                  className="block text-[10px] font-mono mb-1.5 tracking-wider"
                  style={{ color: "var(--color-cyan-500)" }}
                >
                  MOT DE PASSE
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                    style={iconColor(pwdFocus)}
                  />
                  <input
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrors((p) => ({ ...p, password: undefined, form: undefined }));
                    }}
                    onFocus={() => setPwdFocus(true)}
                    onBlur={() => setPwdFocus(false)}
                    placeholder="••••••••••••••••"
                    className="w-full pl-10 pr-11 py-3 rounded-xl text-sm font-mono placeholder:text-slate-700"
                    style={inputCls(pwdFocus, !!errors.password)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-all"
                    style={{ color: "var(--color-slate-400)" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "var(--color-cyan-800)";
                      e.currentTarget.style.filter = "var(--filter-cyan-light)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "var(--color-slate-400)";
                      e.currentTarget.style.filter = "none";
                    }}
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p
                    className="text-[10px] font-mono mt-1.5 ml-1"
                    style={{ color: "var(--color-red-800)" }}
                  >
                    ⚠ {errors.password}
                  </p>
                )}
              </div>

              {/* Forgot password */}
              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-[11px] font-mono transition-all"
                  style={{ color: "var(--color-cyan-500)" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "var(--color-cyan-pure)";
                    e.currentTarget.style.textShadow = "var(--text-shadow-cyan-glow)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--color-cyan-500)";
                    e.currentTarget.style.textShadow = "none";
                  }}
                >
                  Mot de passe oublié ?
                </button>
              </div>

              {/* ── Submit button ── */}
              <button
                type="submit"
                disabled={loading || success}
                onMouseEnter={() => setBtnHover(true)}
                onMouseLeave={() => setBtnHover(false)}
                className="w-full py-3.5 rounded-xl text-sm font-bold text-white tracking-widest relative overflow-hidden"
                style={btnStyle}
              >
                {/* Shimmer on hover */}
                {btnHover && !loading && !success && (
                  <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        width: "55%",
                        height: "100%",
                        background:
                          "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)",
                        animation: "shimmerBtn 0.85s ease-in-out infinite",
                      }}
                    />
                  </div>
                )}

                {/* Pulsing border ring on hover */}
                {btnHover && !loading && !success && (
                  <div
                    className="absolute inset-0 rounded-xl pointer-events-none animate-ping opacity-20"
                    style={{ border: "1px solid var(--color-cyan-800)" }}
                  />
                )}

                <span className={`relative flex items-center justify-center gap-2.5 ${success ? "success-pop" : ""}`}>
                  {loading ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-white/25 border-t-white animate-spin shrink-0" />
                      <span>Authentification en cours...</span>
                    </>
                  ) : success ? (
                    <>
                      <Check className="w-4 h-4 shrink-0" />
                      <span>Accès Autorisé — Redirection...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 shrink-0" />
                      <span>Se connecter</span>
                    </>
                  )}
                </span>
              </button>

              {/* SSL badge */}
              <div className="flex items-center justify-center gap-2 pt-0.5">
                <Lock className="w-3 h-3 shrink-0" style={{ color: "var(--color-slate-300)" }} />
                <span className="text-[10px] font-mono" style={{ color: "var(--color-slate-300)" }}>
                  Connexion SSL 256-bit chiffrée · TLS 1.3 · Certificat vérifié
                </span>
              </div>
            </form>

            {/* ── Footer metadata ── */}
            <div
              className="mt-6 pt-5 flex items-center justify-between text-[9px] font-mono"
              style={{
                color: "var(--color-slate-200)",
                borderTop: "1px solid var(--border-light)",
              }}
            >
              <span>Smart SIEM v4.2.1</span>
              <span>Production · EU-WEST-1</span>
              <span>22 jun 2026</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Warning banner ── */}
      <div
        className="fixed bottom-0 inset-x-0 z-20 pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--color-red-50) 25%, var(--color-red-50) 75%, transparent)",
          borderTop: "1px solid var(--border-red-medium)",
        }}
      >
        <div className="flex items-center justify-center gap-3 px-6 py-2.5">
          <AlertTriangle
            className="w-3.5 h-3.5 shrink-0 animate-pulse"
            style={{
              color: "var(--color-red-pure)",
              filter: "var(--filter-red-glow)",
            }}
          />
          <p
            className="text-[10px] font-mono text-center warn-pulse"
            style={{ color: "var(--color-red-700)" }}
          >
            <span
              className="font-bold tracking-wider"
              style={{ color: "var(--color-red-900)" }}
            >
              AVERTISSEMENT
            </span>
            {" "}· Cet accès est réservé au personnel autorisé du SOC. Toutes les tentatives
            de connexion sont journalisées et surveillées en temps réel.
          </p>
          <AlertTriangle
            className="w-3.5 h-3.5 shrink-0 animate-pulse"
            style={{
              color: "var(--color-red-pure)",
              filter: "var(--filter-red-glow)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
