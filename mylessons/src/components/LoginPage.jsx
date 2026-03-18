import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GoogleLogin, googleLogout } from '@react-oauth/google';
import { jwtDecode } from "jwt-decode";
import Cookies from 'js-cookie';
import {
    Container, Box, Card, Typography, Avatar, Button,
    Paper, CircularProgress, Stack, TextField, InputAdornment
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
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

    const completeLogin = async (userData, token, selectedRole) => {
        const sessionData = { ...userData, id_token: token, role: selectedRole };

        // Salviamo la sessione nei cookie
        Cookies.set('user_session', JSON.stringify(sessionData), {
            expires: 1, secure: true, sameSite: 'strict'
        });
        setUser(sessionData);

        try {
            // Registrazione fisica nel database
            // USIAMO text/plain per evitare il pre-flight OPTIONS che causa il 401/CORS
            await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors', // Manteniamo no-cors ma curiamo il body
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                },
                body: JSON.stringify({
                    id_token: token,
                    role: selectedRole
                    // NOTA: NON mettiamo 'action', così scatta il blocco (requestData.id_token && !action)
                }),
            });

            console.log("Richiesta di registrazione inviata al backend");
            navigate('/dashboard');
        } catch (err) {
            console.error("Errore nell'invio al backend:", err);
            navigate('/dashboard'); // Navighiamo comunque, ma logghiamo l'errore
        }
    };

    const handleLoginSuccess = async (response) => {
        const id_token = response.credential;
        const decoded = jwtDecode(id_token);
        setLoading(true);
        setErrorMsg('');

        try {
            // Verifica se l'utente esiste già
            const checkRes = await fetch(`${APPS_SCRIPT_URL}?action=checkUser&email=${decoded.email}&t=${Date.now()}`);
            const checkData = await checkRes.json();

            if (checkData.exists) {
                // Login diretto
                completeLogin(decoded, id_token, checkData.role);
            } else if (isTeacherSignup) {
                // Richiesta attivazione docente
                setTempToken(id_token);
                setUser(decoded);
                setShowSecretField(true);
                setLoading(false);
            } else {
                // Registrazione studente automatica
                completeLogin(decoded, id_token, "Studente");
            }
        } catch (error) {
            console.error("Errore login:", error);
            setLoading(false);
        }
    };

    const handleTeacherActivation = async () => {
        if (!inputCode) return;
        setLoading(true);
        setErrorMsg('');

        try {
            // 1. Normalizziamo l'input (opzionale, ma consigliato per evitare errori di battitura)
            const normalizedInput = inputCode.trim().toUpperCase();

            // 2. Trasformiamo l'input in Hash
            const hashedCode = await sha256(normalizedInput);

            // 3. Inviamo l'HASH al server, non la password in chiaro
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
        setUser(null);
        setShowSecretField(false);
        setInputCode('');
    };

    // Funzione helper per generare l'hash SHA-256
    async function sha256(message) {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    return (
        <Container maxWidth="sm">
            <Box sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {loading ? (
                    <Box sx={{ textAlign: 'center', mt: 4 }}>
                        <CircularProgress size={60} thickness={4} />
                        <Typography sx={{ mt: 2 }} color="text.secondary">Elaborazione in corso...</Typography>
                    </Box>
                ) : user && !showSecretField ? (
                    <Card sx={{ p: 4, width: '100%', textAlign: 'center', borderRadius: 4, boxShadow: 3 }}>
                        <Avatar src={user.picture} sx={{ width: 80, height: 80, mx: 'auto', mb: 2, border: '2px solid #1976d2' }} />
                        <Typography variant="h6" fontWeight="bold">Ciao, {user.given_name}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Hai effettuato l'accesso come {user.role}</Typography>
                        <Stack spacing={2}>
                            <Button variant="contained" fullWidth size="large" onClick={() => navigate('/dashboard')}>Vai alla Dashboard</Button>
                            <Button variant="outlined" color="error" onClick={handleLogout}>Cambia account</Button>
                        </Stack>
                    </Card>
                ) : showSecretField ? (
                    <Paper sx={{ p: 4, width: '100%', borderRadius: 4, textAlign: 'center', boxShadow: 3 }}>
                        <Avatar sx={{ bgcolor: 'secondary.main', mx: 'auto', mb: 2 }}><LockIcon /></Avatar>
                        <Typography variant="h5" fontWeight="bold">Attivazione Docente</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                            Inserisci il codice segreto per attivare il tuo profilo insegnante.
                        </Typography>

                        <TextField
                            fullWidth
                            label="Codice di attivazione"
                            type="password"
                            variant="outlined"
                            value={inputCode}
                            error={!!errorMsg}
                            helperText={errorMsg}
                            onChange={(e) => setInputCode(e.target.value)}
                            sx={{ mb: 3 }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <LockIcon fontSize="small" />
                                    </InputAdornment>
                                ),
                            }}
                        />

                        <Stack spacing={2}>
                            <Button
                                variant="contained"
                                fullWidth
                                size="large"
                                onClick={handleTeacherActivation}
                                disabled={!inputCode || loading}
                            >
                                Conferma e Attiva
                            </Button>
                            <Button variant="text" color="inherit" onClick={handleLogout}>
                                Annulla
                            </Button>
                        </Stack>
                    </Paper>
                ) : (
                    <Paper sx={{ p: 5, textAlign: 'center', borderRadius: 5, width: '100%', boxShadow: 4 }}>
                        <Typography variant="h4" fontWeight="bold" sx={{ mb: 2 }}>
                            {isTeacherSignup ? "Registrazione Docente" : "Login"}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
                            {isTeacherSignup
                                ? "Accedi con Google per attivare il tuo pannello docente"
                                : "Accedi con il tuo account Google per gestire le tue lezioni"}
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                            <GoogleLogin
                                onSuccess={handleLoginSuccess}
                                onError={() => setErrorMsg("Login fallito. Riprova.")}
                            />
                        </Box>
                    </Paper>
                )}
            </Box>
        </Container>
    );
}

export default LoginPage;