import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { googleLogout } from '@react-oauth/google';
import Cookies from 'js-cookie';
import {
    Grid, Paper, Typography, Box, Button, FormControl,
    InputLabel, Select, MenuItem, Alert, CircularProgress,
    List, ListItem, ListItemText, ListItemIcon, Card, Avatar,
    IconButton, Stack, Container,
    GlobalStyles, Grow, Fade
} from '@mui/material';
import SchoolIcon from '@mui/icons-material/School';
import GroupIcon from '@mui/icons-material/Group';
import LogoutIcon from '@mui/icons-material/Logout';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { APPS_SCRIPT_URL } from "./config/config";

export default function DashboardStudente() {
    const navigate = useNavigate();

    const [userData] = useState(() => {
        const session = Cookies.get('user_session');
        return session ? JSON.parse(session) : null;
    });

    const [teachers, setTeachers] = useState([]);
    const [mySubscriptions, setMySubscriptions] = useState([]);
    const [selectedTeacher, setSelectedTeacher] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [status, setStatus] = useState({ type: '', msg: '' });

    const availableTeachers = teachers.filter(t =>
        !mySubscriptions.some(sub => sub.teacherId === t.id)
    );

    const handleLogout = useCallback(() => {
        googleLogout();
        Cookies.remove('user_session');
        navigate('/login', { replace: true });
    }, [navigate]);

    const loadDashboardData = useCallback(async () => {
        const sessionStr = Cookies.get('user_session');
        if (!sessionStr) {
            handleLogout();
            navigate('/login');
            return;
        }

        const session = JSON.parse(sessionStr);
        setLoading(true);
        try {
            const [resT, resS] = await Promise.all([
                fetch(`${APPS_SCRIPT_URL}?action=getTeachers`),
                fetch(`${APPS_SCRIPT_URL}?action=getMySubscriptions&token=${session.id_token}`)
            ]);
            const dataT = await resT.json();
            const dataS = await resS.json();
            if (dataT.status === "success") setTeachers(dataT.data);
            if (dataS.status === "success") setMySubscriptions(dataS.data);
            if (dataS.status === "error" && dataS.message?.includes("autorizzato")) handleLogout();
        } catch (error) {
            console.error("Errore:", error);
        } finally {
            setLoading(false);
        }
    }, [handleLogout, navigate]);

    useEffect(() => { loadDashboardData(); }, [loadDashboardData]);

    const handleSubscribe = async () => {
        if (!selectedTeacher || !userData?.id_token) return;
        setSubmitting(true);
        setStatus({ type: '', msg: '' });
        try {
            await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: "subscribe",
                    id_token: userData.id_token,
                    studentId: userData.sub,
                    studentEmail: userData.email,
                    teacherId: selectedTeacher.id,
                    teacherName: selectedTeacher.name
                }),
            });
            setStatus({ type: 'success', msg: `Perfetto! Iscrizione completata.` });
            setSelectedTeacher('');
            setTimeout(() => loadDashboardData(), 1500);
        } catch (error) {
            setStatus({ type: 'error', msg: 'Errore durante l\'invio.' });
        } finally { setSubmitting(false); }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', bgcolor: '#f8fafc' }}>
                <CircularProgress size={50} thickness={4} sx={{ color: '#1976d2' }} />
            </Box>
        );
    }

    // --- LOGICA DI CONTINUITÀ VISIVA ---
    const hasNoSubscriptions = mySubscriptions.length === 0;

    return (
        <Box sx={{
            minHeight: '100vh',
            width: '100%',
            // Se non ha iscrizioni, forziamo il gradiente animato qui invece che nel body
            background: hasNoSubscriptions
                ? 'linear-gradient(-45deg, #1976d2, #9c27b0, #00bcd4, #3f51b5)'
                : '#f8fafc',
            backgroundSize: '400% 400%',
            animation: hasNoSubscriptions ? 'gradientBG 15s ease infinite' : 'none',
            display: 'flex',
            flexDirection: 'column',
            transition: 'background 0.5s ease',
            '@keyframes gradientBG': {
                '0%': { backgroundPosition: '0% 50%' },
                '50%': { backgroundPosition: '100% 50%' },
                '100%': { backgroundPosition: '0% 50%' },
            }
        }}>
            <GlobalStyles styles={{
                // Reset totale per evitare il grigio di sistema
                'html, body, #root': {
                    margin: 0,
                    padding: 0,
                    height: '100%',
                    width: '100%',
                    backgroundColor: 'transparent !important'
                }
            }} />

            {hasNoSubscriptions ? (
                /* --- VIEW 1: ASSISTENTE DIGITALE (MOBILE OPTIMIZED) --- */
                <Container maxWidth="xs" sx={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    px: 3
                }}>
                    <Grow in timeout={800}>
                        <Paper elevation={0} sx={{
                            p: { xs: 4, sm: 5 },
                            borderRadius: 8,
                            bgcolor: 'rgba(255, 255, 255, 0.94)',
                            backdropFilter: 'blur(20px)',
                            textAlign: 'center',
                            boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
                            width: '100%'
                        }}>
                            <Avatar sx={{
                                bgcolor: '#1976d2', width: 64, height: 64, mx: 'auto', mb: 3,
                                boxShadow: '0 8px 16px rgba(25, 118, 210, 0.3)'
                            }}>
                                <AutoAwesomeIcon sx={{ fontSize: 32, color: 'white' }} />
                            </Avatar>

                            <Typography variant="h5" fontWeight={900} sx={{ color: '#0f172a', mb: 1 }}>
                                Ciao, {userData.given_name}
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4 }}>
                                Non risulti iscritto a nessun corso. Scegli una persona per attivare la tua dashboard.
                            </Typography>

                            {status.msg && <Alert severity={status.type} sx={{ mb: 3, borderRadius: 3, textAlign: 'left' }}>{status.msg}</Alert>}

                            <FormControl fullWidth sx={{ mb: 3 }}>
                                <InputLabel>Seleziona</InputLabel>
                                <Select
                                    value={selectedTeacher}
                                    label="Seleziona"
                                    onChange={(e) => setSelectedTeacher(e.target.value)}
                                    sx={{ borderRadius: 4, bgcolor: '#fff' }}
                                >
                                    {availableTeachers.map((t) => (
                                        <MenuItem key={t.id} value={t}>{t.name}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            <Button
                                variant="contained"
                                fullWidth
                                onClick={handleSubscribe}
                                disabled={!selectedTeacher || submitting}
                                sx={{
                                    borderRadius: 4, py: 1.8, fontWeight: 800, textTransform: 'none',
                                    bgcolor: '#1976d2',
                                    '&:hover': { bgcolor: '#1565c0' }
                                }}
                            >
                                {submitting ? <CircularProgress size={24} color="inherit" /> : "Attiva il mio corso"}
                            </Button>

                            <Button onClick={handleLogout} sx={{ mt: 3, color: 'text.disabled', textTransform: 'none', fontSize: '0.85rem' }}>
                                Esci dall'account
                            </Button>
                        </Paper>
                    </Grow>
                </Container>
            ) : (
                /* --- VIEW 2: DASHBOARD OPERATIVA --- */
                <Container maxWidth="lg" sx={{ pt: { xs: 2, sm: 6 }, pb: 6 }}>
                    <Fade in timeout={600}>
                        <Box>
                            {/* Header */}
                            <Box sx={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                mb: 5, p: 2, borderRadius: 4, bgcolor: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                            }}>
                                <Stack direction="row" spacing={2} alignItems="center">
                                    <Avatar src={userData.picture} sx={{ width: 45, height: 45, border: '2px solid #f8fafc' }} />
                                    <Box>
                                        <Typography variant="h6" sx={{ fontWeight: 800 }}>Benvenuto, {userData.given_name}</Typography>
                                    </Box>
                                </Stack>
                                <IconButton onClick={handleLogout} sx={{ color: 'error.main' }}><LogoutIcon /></IconButton>
                            </Box>

                            <Grid container spacing={3}>
                                {/* Card Agenda */}
                                <Grid item xs={12} sm={6}>
                                    <Card onClick={() => navigate('/dashboard/schedule')} sx={{
                                        p: 3, borderRadius: 6, cursor: 'pointer', bgcolor: '#1976d2', color: 'white',
                                        transition: '0.3s', '&:hover': { transform: 'translateY(-5px)', boxShadow: '0 10px 20px rgba(25, 118, 210, 0.2)' }
                                    }}>
                                        <Stack direction="row" spacing={2} alignItems="center">
                                            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}><CalendarMonthIcon /></Avatar>
                                            <Typography variant="h6" fontWeight="800">Agenda</Typography>
                                        </Stack>
                                    </Card>
                                </Grid>

                                {/* Card Bilancio */}
                                <Grid item xs={12} sm={6}>
                                    <Card onClick={() => navigate('/dashboard/payments')} sx={{
                                        p: 3, borderRadius: 6, cursor: 'pointer', bgcolor: '#10b981', color: 'white',
                                        transition: '0.3s', '&:hover': { transform: 'translateY(-5px)', boxShadow: '0 10px 20px rgba(16, 185, 129, 0.2)' }
                                    }}>
                                        <Stack direction="row" spacing={2} alignItems="center">
                                            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}><AccountBalanceWalletIcon /></Avatar>
                                            <Typography variant="h6" fontWeight="800">Bilancio</Typography>
                                        </Stack>
                                    </Card>
                                </Grid>

                                {/* Lista Corsi */}
                                <Grid item xs={12} md={8}>
                                    <Paper elevation={0} sx={{ borderRadius: 6, border: '1px solid #e2e8f0', p: 3 }}>
                                        <Typography variant="subtitle1" fontWeight="800" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <GroupIcon color="primary" /> Iscrizioni Attive
                                        </Typography>
                                        <List disablePadding>
                                            {mySubscriptions.map((sub, index) => (
                                                <ListItem key={index} sx={{ mb: 1, bgcolor: '#f8fafc', borderRadius: 4 }}>
                                                    <ListItemIcon><Avatar sx={{ bgcolor: 'white', color: '#1976d2' }}><SchoolIcon /></Avatar></ListItemIcon>
                                                    <ListItemText primary={<Typography fontWeight={700}>{sub.teacherName}</Typography>} secondary={`Iscritto: ${new Date(sub.date).toLocaleDateString()}`} />
                                                </ListItem>
                                            ))}
                                        </List>
                                    </Paper>
                                </Grid>

                                {/* Iscrizione rapida */}
                                <Grid item xs={12} md={4}>
                                    <Paper
                                        elevation={0}
                                        sx={{
                                            p: 3,
                                            borderRadius: 6,
                                            bgcolor: '#f1f5f9',
                                            border: '1px solid',
                                            borderColor: '#e2e8f0',
                                            height: '100%',
                                            display: 'flex',
                                            flexDirection: 'column'
                                        }}
                                    >
                                        <Typography variant="subtitle2" fontWeight="800" sx={{ mb: 2 }}>
                                            Nuovo Corso
                                        </Typography>

                                        {availableTeachers.length > 0 ? (
                                            <>
                                                <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                                                    Seleziona un docente per iniziare un nuovo percorso.
                                                </Typography>
                                                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                                                    <InputLabel>Docenti disponibili</InputLabel>
                                                    <Select
                                                        value={selectedTeacher}
                                                        label="Docenti disponibili"
                                                        onChange={(e) => setSelectedTeacher(e.target.value)}
                                                        sx={{ borderRadius: 3, bgcolor: 'white' }}
                                                    >
                                                        {availableTeachers.map((t) => (
                                                            <MenuItem key={t.id} value={t}>
                                                                {t.name}
                                                            </MenuItem>
                                                        ))}
                                                    </Select>
                                                </FormControl>
                                                <Button
                                                    variant="contained"
                                                    fullWidth
                                                    disableElevation
                                                    onClick={handleSubscribe}
                                                    disabled={submitting}
                                                    sx={{ borderRadius: 3, fontWeight: 700, py: 1 }}
                                                >
                                                    {submitting ? <CircularProgress size={20} color="inherit" /> : "Iscriviti ora"}
                                                </Button>
                                            </>
                                        ) : (
                                            /* --- STATO: NESSUN INSEGNANTE DISPONIBILE --- */
                                            <Box sx={{
                                                textAlign: 'center',
                                                py: 2,
                                                flex: 1,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justifyContent: 'center',
                                                alignItems: 'center'
                                            }}>
                                                <Avatar sx={{ bgcolor: 'white', mb: 1.5, width: 40, height: 40 }}>
                                                    <GroupIcon sx={{ color: '#cbd5e1' }} />
                                                </Avatar>
                                                <Typography variant="body2" fontWeight="700" color="text.primary">
                                                    Sei già iscritto a tutto!
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, px: 2 }}>
                                                    Non ci sono altre persone disponibili per nuove iscrizioni al momento.
                                                </Typography>
                                            </Box>
                                        )}
                                    </Paper>
                                </Grid>
                            </Grid>
                        </Box>
                    </Fade>
                </Container>
            )}
        </Box>
    );
}