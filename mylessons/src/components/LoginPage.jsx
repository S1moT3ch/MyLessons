import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin, googleLogout } from '@react-oauth/google';
import { jwtDecode } from "jwt-decode";
import Cookies from 'js-cookie';
import {
    Container, Box, Card, Typography, Avatar, Button,
    Paper, Radio, RadioGroup, FormControlLabel, FormControl, Divider,
    CircularProgress, Stack
} from '@mui/material';
import { APPS_SCRIPT_URL } from "./config/config";

function LoginPage() {
    const navigate = useNavigate();

    const [user, setUser] = useState(null);
    const [role, setRole] = useState('');
    const [showRoleSelection, setShowRoleSelection] = useState(false);
    const [tempToken, setTempToken] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const savedUser = Cookies.get('user_session');
        if (savedUser) {
            try {
                setUser(JSON.parse(savedUser));
            } catch (e) {
                Cookies.remove('user_session');
            }
        }
    }, []);

    // FUNZIONE CENTRALIZZATA PER IL SALVATAGGIO SESSIONE
    const completeLogin = (userData, token, selectedRole) => {
        // Costruiamo l'oggetto sessione definitivo
        const sessionData = {
            ...userData,
            id_token: token, // Fondamentale per le chiamate API sicure
            role: selectedRole
        };

        // Salvataggio fisico nel Browser
        Cookies.set('user_session', JSON.stringify(sessionData), {
            expires: 1,
            secure: true,
            sameSite: 'strict'
        });

        setUser(sessionData);
        setShowRoleSelection(false);

        // Notifica il backend (Registrazione/Aggiornamento)
        fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ id_token: token, role: selectedRole }),
        });

        // Vai alla Dashboard
        navigate('/dashboard');
    };

    const handleLoginSuccess = async (response) => {
        const id_token = response.credential;
        const decoded = jwtDecode(id_token);
        const email = decoded.email;

        setLoading(true);

        try {
            // Verifica se l'utente è già presente nel database
            const checkRes = await fetch(`${APPS_SCRIPT_URL}?action=checkUser&email=${email}&t=${Date.now()}`, {
                method: 'GET',
                redirect: 'follow'
            });

            const checkData = await checkRes.json();

            if (checkData.exists) {
                // UTENTE ESISTENTE: effettua il login diretto
                completeLogin(decoded, id_token, checkData.role);
            } else {
                // NUOVO UTENTE: deve scegliere il ruolo
                setTempToken(id_token);
                setUser(decoded);
                setShowRoleSelection(true);
            }
        } catch (error) {
            console.error("Errore verifica utente:", error);
            // Fallback: in caso di errore permettiamo comunque la scelta ruolo
            setTempToken(id_token);
            setUser(decoded);
            setShowRoleSelection(true);
        } finally {
            setLoading(false);
        }
    };

    const confirmRegistration = () => {
        if (!role) return alert("Per favore, seleziona un ruolo!");
        // Usiamo tempToken che è stato salvato al momento del handleLoginSuccess
        completeLogin(user, tempToken, role);
    };

    const handleLogout = () => {
        googleLogout();
        Cookies.remove('user_session');
        setUser(null);
        setRole('');
        setTempToken(null);
    };

    return (
        <Container maxWidth="sm">
            <Box sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {loading ? (
                    <Box sx={{ textAlign: 'center', mt: 4 }}>
                        <CircularProgress size={60} />
                        <Typography sx={{ mt: 2 }}>Verifica profilo in corso...</Typography>
                    </Box>
                ) : user && !showRoleSelection ? (
                    <Card sx={{ width: '100%', textAlign: 'center', p: 4, borderRadius: 4, boxShadow: 3 }}>
                        <Avatar src={user.picture} sx={{ width: 90, height: 90, mx: 'auto', mb: 2, border: '3px solid', borderColor: 'primary.main' }} />
                        <Typography variant="h5" fontWeight="bold">Bentornato, {user.given_name}</Typography>
                        <Typography color="text.secondary" sx={{ mb: 3 }}>Sei loggato come <b>{user.role}</b></Typography>
                        <Stack spacing={2}>
                            <Button variant="contained" fullWidth onClick={() => navigate('/dashboard')} size="large">
                                Vai alla Dashboard
                            </Button>
                            <Button onClick={handleLogout} color="error" variant="outlined">
                                Esci dall'account
                            </Button>
                        </Stack>
                    </Card>
                ) : showRoleSelection ? (
                    <Paper sx={{ p: 4, width: '100%', borderRadius: 4, boxShadow: 3 }}>
                        <Typography variant="h5" gutterBottom textAlign="center" fontWeight="bold">Benvenuto!</Typography>
                        <Typography variant="body2" textAlign="center" color="text.secondary" sx={{ mb: 3 }}>
                            Per completare la registrazione, indica il tuo profilo:
                        </Typography>
                        <Divider sx={{ mb: 3 }} />
                        <FormControl component="fieldset" sx={{ width: '100%' }}>
                            <RadioGroup value={role} onChange={(e) => setRole(e.target.value)}>
                                <Paper variant="outlined" sx={{ p: 1, mb: 1, borderRadius: 2 }}>
                                    <FormControlLabel value="Insegnante" control={<Radio />} label="Insegnante" sx={{ width: '100%', m: 0 }} />
                                </Paper>
                                <Paper variant="outlined" sx={{ p: 1, mb: 1, borderRadius: 2 }}>
                                    <FormControlLabel value="Studente" control={<Radio />} label="Studente" sx={{ width: '100%', m: 0 }} />
                                </Paper>
                            </RadioGroup>
                        </FormControl>
                        <Button
                            variant="contained"
                            fullWidth
                            size="large"
                            sx={{ mt: 3, py: 1.5, borderRadius: 3 }}
                            onClick={confirmRegistration}
                            disabled={!role}
                        >
                            Conferma e Inizia
                        </Button>
                    </Paper>
                ) : (
                    <Paper sx={{ p: 5, textAlign: 'center', borderRadius: 5, boxShadow: 4 }}>
                        <Typography variant="h4" fontWeight="bold" sx={{ mb: 1 }}>Login</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
                            Accedi con il tuo account Google istituzionale
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                            <GoogleLogin
                                onSuccess={handleLoginSuccess}
                                onError={() => alert("Login fallito. Riprova.")}
                                useOneTap
                                shape="pill"
                            />
                        </Box>
                    </Paper>
                )}
            </Box>
        </Container>
    );
}

export default LoginPage;