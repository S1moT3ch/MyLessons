import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin, googleLogout } from '@react-oauth/google';
import { jwtDecode } from "jwt-decode";
import Cookies from 'js-cookie';
import {
    Container, Box, Card, Typography, Avatar, Button,
    Paper, Radio, RadioGroup, FormControlLabel, FormControl, Divider,
    CircularProgress // Aggiunto per il feedback visivo
} from '@mui/material';
import { APPS_SCRIPT_URL } from "./config/config";

function LoginPage() {
    const navigate = useNavigate();

    const [user, setUser] = useState(null);
    const [role, setRole] = useState('');
    const [showRoleSelection, setShowRoleSelection] = useState(false);
    const [tempToken, setTempToken] = useState(null);
    const [loading, setLoading] = useState(false); // MANCAVA QUESTO!

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

    const handleLoginSuccess = async (response) => {
        const id_token = response.credential;
        const decoded = jwtDecode(id_token);
        const email = decoded.email;

        setLoading(true);

        try {
            // Per Apps Script, a volte aggiungere un timestamp evita la cache del browser
            const checkRes = await fetch(`${APPS_SCRIPT_URL}?email=${email}&t=${Date.now()}`, {
                method: 'GET',
                // redirect: 'follow' è fondamentale per gestire il comportamento di GAS
                redirect: 'follow'
            });

            const checkData = await checkRes.json();

            if (checkData.exists) {
                // UTENTE GIÀ REGISTRATO
                const userData = { ...decoded, role: checkData.role };
                completeLogin(userData, id_token, checkData.role);
            } else {
                // NUOVO UTENTE
                setTempToken(id_token);
                setUser(decoded);
                setShowRoleSelection(true);
            }
        } catch (error) {
            console.error("Errore verifica utente:", error);
            // In caso di errore (es. CORS), mostriamo comunque la scelta per non bloccare l'utente
            setTempToken(id_token);
            setUser(decoded);
            setShowRoleSelection(true);
        } finally {
            setLoading(false);
        }
    };

    const completeLogin = (userData, token, selectedRole) => {
        Cookies.set('user_session', JSON.stringify(userData), { expires: 1, secure: true });
        setUser(userData);
        setShowRoleSelection(false);

        // Notifica il backend
        fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ id_token: token, role: selectedRole }),
        });

        // NAVIGAZIONE ALLA DASHBOARD DOPO IL LOGIN
        navigate('/dashboard');
    };

    const confirmRegistration = async () => {
        if (!role) return alert("Seleziona un ruolo!");
        completeLogin({ ...user, role: role }, tempToken, role);
        alert("Registrazione completata come " + role);
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
                    <CircularProgress />
                ) : user && !showRoleSelection ? (
                    <Card sx={{ width: '100%', textAlign: 'center', p: 3, borderRadius: 4 }}>
                        <Avatar src={user.picture} sx={{ width: 80, height: 80, mx: 'auto', mb: 2 }} />
                        <Typography variant="h5">Bentornato, {user.name}</Typography>
                        <Typography color="text.secondary">Accesso come: <b>{user.role}</b></Typography>
                        <Button onClick={handleLogout} color="error" sx={{ mt: 3 }} variant="outlined">Logout</Button>
                    </Card>
                ) : showRoleSelection ? (
                    <Paper sx={{ p: 4, width: '100%', borderRadius: 4 }}>
                        <Typography variant="h5" gutterBottom textAlign="center">Sei un Insegnante o uno Studente?</Typography>
                        <Divider sx={{ my: 2 }} />
                        <FormControl component="fieldset" sx={{ width: '100%', mt: 2 }}>
                            <RadioGroup value={role} onChange={(e) => setRole(e.target.value)}>
                                <FormControlLabel value="Insegnante" control={<Radio />} label="Insegnante" />
                                <FormControlLabel value="Studente" control={<Radio />} label="Studente" />
                            </RadioGroup>
                        </FormControl>
                        <Button
                            variant="contained"
                            fullWidth
                            sx={{ mt: 3 }}
                            onClick={confirmRegistration}
                            disabled={!role}
                        >
                            Conferma e Inizia
                        </Button>
                    </Paper>
                ) : (
                    <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 4, boxShadow: 3 }}>
                        <Typography variant="h5" sx={{ mb: 3 }}>Accedi alla Piattaforma</Typography>
                        <GoogleLogin
                            onSuccess={handleLoginSuccess}
                            onError={() => alert("Login fallito")}
                            useOneTap
                        />
                    </Paper>
                )}
            </Box>
        </Container>
    );
}

export default LoginPage;