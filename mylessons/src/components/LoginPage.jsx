import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GoogleLogin, googleLogout } from '@react-oauth/google';
import { jwtDecode } from "jwt-decode";
import Cookies from 'js-cookie';
import {
    Container, Box, Typography, Avatar, Button,
    Paper, CircularProgress, Stack, TextField, InputAdornment,
    Fade, Grow, GlobalStyles
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import SchoolIcon from '@mui/icons-material/School';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { APPS_SCRIPT_URL } from "./config/config";

function LoginPage() {
    const navigate = useNavigate();
    const location = useLocation();

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showSecretField, setShowSecretField] = useState(false);
    const [inputCode, setInputCode] = useState('');
    const [tempToken, setTempToken] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');

    const isTeacherSignup = new URLSearchParams(location.search).get('type') === 'teacher';

    useEffect(() => {
        const savedUser = Cookies.get('user_session');
        if (savedUser) {
            try { setUser(JSON.parse(savedUser)); }
            catch (e) { Cookies.remove('user_session'); }
        }
    }, []);

    // --- NUOVA LOGICA DI PREFETCHING ---
    const prefetchDashboardData = async (userData, token) => {
        // Il prefetch ha senso solo per gli insegnanti
        if (userData.role !== "Insegnante") return;

        try {
            const teacherFullName = `${userData.given_name} ${userData.family_name}`;

            // Avviamo le richieste in parallelo per non perdere tempo
            const [resFb, resSubs] = await Promise.all([
                fetch(`${APPS_SCRIPT_URL}?action=getTeacherFeedbackSummary&teacherName=${encodeURIComponent(teacherFullName)}&token=${token}`),
                fetch(`${APPS_SCRIPT_URL}?action=getTeacherSubscribers&teacherId=${userData.sub}&token=${token}`)
            ]);

            const dataFb = await resFb.json();
            const dataSubs = await resSubs.json();

            if (dataFb.status === "success") {
                const absences = dataFb.data.filter(f => f.status === "Assente");
                localStorage.setItem('cache_absences', JSON.stringify(absences));
            }

            if (dataSubs.status === "success") {
                localStorage.setItem('cache_subscribers', JSON.stringify(dataSubs.data));
            }
            console.log("Prefetch completato con successo");
        } catch (e) {
            console.error("Prefetch fallito:", e);
        }
    };

    const completeLogin = async (userData, token, selectedRole) => {
        setLoading(true); // Attiviamo il loading visivo durante il prefetch
        const sessionData = { ...userData, id_token: token, role: selectedRole };

        Cookies.set('user_session', JSON.stringify(sessionData), {
            expires: 1/24, secure: true, sameSite: 'strict'
        });

        setUser(sessionData);

        // Se è un insegnante, scarichiamo i dati PRIMA di cambiare pagina
        if (selectedRole === "Insegnante") {
            await prefetchDashboardData(sessionData, token);
        }

        try {
            await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ id_token: token, role: selectedRole }),
            });
            navigate('/dashboard');
        } catch (err) {
            navigate('/dashboard');
        }
    };

    const handleLoginSuccess = async (response) => {
        const id_token = response.credential;
        const decoded = jwtDecode(id_token);
        setLoading(true);
        setErrorMsg('');
        try {
            const checkRes = await fetch(`${APPS_SCRIPT_URL}?action=checkUser&email=${decoded.email}&t=${Date.now()}`);
            const checkData = await checkRes.json();
            if (checkData.exists) {
                completeLogin(decoded, id_token, checkData.role);
            } else if (isTeacherSignup) {
                setTempToken(id_token);
                setUser(decoded);
                setShowSecretField(true);
                setLoading(false);
            } else {
                completeLogin(decoded, id_token, "Studente");
            }
        } catch (error) {
            setLoading(false);
            setErrorMsg("Errore di connessione.");
        }
    };

    const handleTeacherActivation = async () => {
        if (!inputCode) return;
        setLoading(true);
        setErrorMsg('');
        try {
            const normalizedInput = inputCode.trim().toUpperCase();
            const hashedCode = await sha256(normalizedInput);
            const res = await fetch(`${APPS_SCRIPT_URL}?action=verifyTeacherCode&code=${hashedCode}`);
            const data = await res.json();
            if (data.status === "success" && data.isValid) {
                completeLogin(user, tempToken, "Insegnante");
            } else {
                setErrorMsg("Codice non valido.");
                setLoading(false);
            }
        } catch (error) {
            setErrorMsg("Errore di sicurezza.");
            setLoading(false);
        }
    };

    const handleLogout = () => {
        googleLogout();
        Cookies.remove('user_session');
        localStorage.removeItem('cache_subscribers');
        localStorage.removeItem('cache_absences');
        setUser(null);
        setShowSecretField(false);
        setInputCode('');
    };

    async function sha256(message) {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    return (
        <>
            <GlobalStyles styles={{
                body: {
                    margin: 0,
                    background: 'linear-gradient(-45deg, #1976d2, #9c27b0, #00bcd4, #3f51b5)',
                    backgroundSize: '400% 400%',
                    animation: 'gradientBG 15s ease infinite',
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: '"Poppins", "Roboto", sans-serif'
                },
                '@keyframes gradientBG': {
                    '0%': { backgroundPosition: '0% 50%' },
                    '50%': { backgroundPosition: '100% 50%' },
                    '100%': { backgroundPosition: '0% 50%' },
                }
            }} />

            <Container maxWidth="xs">
                <Grow in timeout={800}>
                    <Box sx={{ py: 4 }}>
                        <Box sx={{ textAlign: 'center', mb: 4 }}>
                            <Avatar sx={{
                                bgcolor: 'rgba(255,255,255,0.2)',
                                backdropFilter: 'blur(10px)',
                                width: 70, height: 70, mx: 'auto', mb: 2,
                                border: '1px solid rgba(255,255,255,0.3)'
                            }}>
                                <SchoolIcon sx={{ fontSize: 40, color: 'white' }} />
                            </Avatar>
                            <Typography variant="h4" sx={{ fontWeight: 900, color: 'white', letterSpacing: -1, textShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>
                                MyLessons
                            </Typography>
                        </Box>

                        <Paper elevation={0} sx={{
                            p: { xs: 4, sm: 5 },
                            borderRadius: 6,
                            bgcolor: 'rgba(255, 255, 255, 0.92)',
                            backdropFilter: 'blur(20px)',
                            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                            textAlign: 'center'
                        }}>
                            {loading ? (
                                <Fade in>
                                    <Box sx={{ py: 4 }}>
                                        <CircularProgress size={50} thickness={5} sx={{ color: '#1976d2' }} />
                                        <Typography sx={{ mt: 3, fontWeight: 600, color: 'text.secondary' }}>Sincronizzazione dati...</Typography>
                                    </Box>
                                </Fade>
                            ) : user && !showSecretField ? (
                                <Box>
                                    <Avatar src={user.picture} sx={{ width: 100, height: 100, mx: 'auto', mb: 3, border: '4px solid white', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }} />
                                    <Typography variant="h5" sx={{ fontWeight: 800 }}>Ciao, {user.given_name}</Typography>
                                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4 }}>Profilo {user.role}</Typography>
                                    <Stack spacing={2}>
                                        <Button
                                            variant="contained"
                                            fullWidth
                                            size="large"
                                            endIcon={<ArrowForwardIcon />}
                                            onClick={() => completeLogin(user, user.id_token, user.role)}
                                            sx={{ borderRadius: 3, py: 1.8, fontWeight: 700, textTransform: 'none', boxShadow: '0 10px 20px rgba(25, 118, 210, 0.3)' }}
                                        >
                                            Entra nel portale
                                        </Button>
                                        <Button variant="text" color="inherit" onClick={handleLogout} sx={{ opacity: 0.7 }}>Cambia account</Button>
                                    </Stack>
                                </Box>
                            ) : showSecretField ? (
                                <Box>
                                    <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>Attivazione Docente</Typography>
                                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4 }}>Inserisci il codice segreto per procedere</Typography>
                                    <TextField
                                        fullWidth
                                        type="password"
                                        placeholder="Codice Attivazione"
                                        value={inputCode}
                                        error={!!errorMsg}
                                        helperText={errorMsg}
                                        onChange={(e) => setInputCode(e.target.value)}
                                        sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: 4, bgcolor: '#f8f9fa' } }}
                                        InputProps={{
                                            startAdornment: <InputAdornment position="start"><LockIcon color="action" /></InputAdornment>,
                                        }}
                                    />
                                    <Stack spacing={2}>
                                        <Button
                                            variant="contained"
                                            fullWidth
                                            size="large"
                                            onClick={handleTeacherActivation}
                                            sx={{ borderRadius: 3, py: 1.8, fontWeight: 700, bgcolor: '#9c27b0', '&:hover': { bgcolor: '#7b1fa2' } }}
                                        >
                                            Conferma Docente
                                        </Button>
                                        <Button variant="text" color="inherit" onClick={handleLogout}>Annulla</Button>
                                    </Stack>
                                </Box>
                            ) : (
                                <Box>
                                    <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
                                        {isTeacherSignup ? "Registrazione Docente" : "Accedi"}
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 5 }}>
                                        Benvenuto! Usa il tuo account Google per iniziare.
                                    </Typography>
                                    <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
                                        <GoogleLogin
                                            onSuccess={handleLoginSuccess}
                                            onError={() => setErrorMsg("Login fallito. Riprova.")}
                                            shape="pill"
                                            theme="filled_blue"
                                            size="large"
                                            text={isTeacherSignup ? "signup_with" : "signin_with"}
                                        />
                                    </Box>
                                </Box>
                            )}
                        </Paper>
                        <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mt: 4, color: 'rgba(255,255,255,0.7)' }}>
                            © 2026 DigitalCreation • Sistema di Gestione Didattica
                        </Typography>
                    </Box>
                </Grow>
            </Container>
        </>
    );
}

export default LoginPage;