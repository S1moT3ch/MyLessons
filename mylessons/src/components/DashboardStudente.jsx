import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { googleLogout } from '@react-oauth/google';
import Cookies from 'js-cookie';
import {
    Grid, Paper, Typography, Box, Button, FormControl,
    InputLabel, Select, MenuItem, Alert, CircularProgress,
    List, ListItem, ListItemText, ListItemIcon, Card, Avatar,
    useTheme, useMediaQuery, IconButton, Stack, Divider
} from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import SchoolIcon from '@mui/icons-material/School';
import GroupIcon from '@mui/icons-material/Group';
import LogoutIcon from '@mui/icons-material/Logout';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { APPS_SCRIPT_URL } from "./config/config";

export default function DashboardStudente() {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const navigate = useNavigate();

    // 1. Recupero immediato dei dati utente dal cookie per evitare il crash "undefined"
    const [userData, setUserData] = useState(() => {
        const session = Cookies.get('user_session');
        return session ? JSON.parse(session) : null;
    });

    const [teachers, setTeachers] = useState([]);
    const [mySubscriptions, setMySubscriptions] = useState([]);
    const [selectedTeacher, setSelectedTeacher] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [status, setStatus] = useState({ type: '', msg: '' });

    // Funzione di Logout
    const handleLogout = useCallback(() => {
        googleLogout();
        Cookies.remove('user_session');
        navigate('/login', { replace: true });
    }, [navigate]);

    // 2. Caricamento dati protetto da Token
    const loadDashboardData = useCallback(async () => {
        const sessionStr = Cookies.get('user_session');
        if (!sessionStr) {
            handleLogout();
            return;
        }
        const session = JSON.parse(sessionStr);

        setLoading(true);
        try {
            // Passiamo il token certificato per le iscrizioni
            const [resT, resS] = await Promise.all([
                fetch(`${APPS_SCRIPT_URL}?action=getTeachers`),
                fetch(`${APPS_SCRIPT_URL}?action=getMySubscriptions&token=${session.id_token}`)
            ]);

            const dataT = await resT.json();
            const dataS = await resS.json();

            if (dataT.status === "success") setTeachers(dataT.data);
            if (dataS.status === "success") setMySubscriptions(dataS.data);

            // Se il token è scaduto (errore dal backend)
            if (dataS.status === "error" && dataS.message?.includes("autorizzato")) {
                handleLogout();
            }
        } catch (error) {
            console.error("Errore caricamento dashboard:", error);
        } finally {
            setLoading(false);
        }
    }, [handleLogout]);

    useEffect(() => {
        loadDashboardData();
    }, [loadDashboardData]);

    // 3. Funzione per iscriversi a un corso (Protetta)
    const handleSubscribe = async () => {
        if (!selectedTeacher || !userData?.id_token) return;
        setSubmitting(true);
        setStatus({ type: '', msg: '' });

        try {
            // Nota: Usiamo POST con il token nel body
            await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: JSON.stringify({
                    action: "subscribe",
                    id_token: userData.id_token,
                    studentId: userData.sub,
                    studentEmail: userData.email,
                    teacherId: selectedTeacher.id,
                    teacherName: selectedTeacher.name
                }),
            });

            setStatus({ type: 'success', msg: `Richiesta inviata al Prof. ${selectedTeacher.name}!` });
            setSelectedTeacher('');
            // Refresh dei dati
            setTimeout(() => loadDashboardData(), 1500);
        } catch (error) {
            setStatus({ type: 'error', msg: 'Errore durante l\'iscrizione.' });
        } finally {
            setSubmitting(false);
        }
    };

    // Protezione Rendering: se il cookie è assente o in fase di lettura
    if (!userData) {
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
                <CircularProgress size={60} />
                <Typography sx={{ mt: 2 }}>Verifica sessione...</Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ p: isMobile ? 1.5 : 3, pb: 10, maxWidth: 1000, mx: 'auto' }}>

            {/* Header con Saluto e Logout */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Avatar src={userData.picture} sx={{ width: 60, height: 60, mr: 2, boxShadow: 3, border: '2px solid white' }} />
                    <Box>
                        <Typography variant={isMobile ? "h5" : "h4"} fontWeight="bold">
                            Ciao, {userData.given_name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" fontWeight="medium">Account Studente</Typography>
                    </Box>
                </Box>
                <IconButton color="error" onClick={handleLogout} sx={{ bgcolor: 'rgba(211, 47, 47, 0.1)', '&:hover': { bgcolor: 'rgba(211, 47, 47, 0.2)' } }}>
                    <LogoutIcon />
                </IconButton>
            </Box>

            <Grid container spacing={3}>

                {/* SEZIONE AGENDA: Accesso rapido agli orari */}
                <Grid item xs={12}>
                    <Card
                        onClick={() => navigate('/dashboard/schedule')}
                        sx={{
                            p: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            cursor: 'pointer', bgcolor: 'secondary.main', color: 'white', borderRadius: 5,
                            transition: '0.3s', '&:hover': { transform: 'translateY(-5px)', boxShadow: 8 }
                        }}
                    >
                        <Stack direction="row" alignItems="center" spacing={2}>
                            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 50, height: 50 }}>
                                <CalendarMonthIcon fontSize="large" />
                            </Avatar>
                            <Box>
                                <Typography variant="h6" fontWeight="bold">Il Mio Orario Personale</Typography>
                                <Typography variant="body2" sx={{ opacity: 0.9 }}>Visualizza le tue lezioni confermate e la tua agenda</Typography>
                            </Box>
                        </Stack>
                        {!isMobile && <Button variant="contained" color="inherit" sx={{ color: 'secondary.main', fontWeight: 'bold' }}>Apri Agenda</Button>}
                    </Card>
                </Grid>

                {/* I MIEI INSEGNANTI */}
                <Grid item xs={12} md={6}>
                    <Card elevation={0} sx={{ borderRadius: 5, border: '1px solid', borderColor: 'divider', minHeight: 350 }}>
                        <Box sx={{ p: 2.5, bgcolor: 'primary.main', color: 'white' }}>
                            <Typography variant="subtitle1" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center' }}>
                                <GroupIcon sx={{ mr: 1 }} /> Corsi Attivi ({mySubscriptions.length})
                            </Typography>
                        </Box>
                        <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                            {loading ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress size={30} /></Box>
                            ) : mySubscriptions.length > 0 ? (
                                <List disablePadding>
                                    {mySubscriptions.map((sub, index) => (
                                        <React.Fragment key={index}>
                                            <ListItem sx={{ py: 2 }}>
                                                <ListItemIcon>
                                                    <Avatar sx={{ bgcolor: 'primary.light', color: 'primary.main' }}><SchoolIcon /></Avatar>
                                                </ListItemIcon>
                                                <ListItemText
                                                    primary={<Typography fontWeight="bold">Prof. {sub.teacherName}</Typography>}
                                                    secondary={`Iscritto il: ${new Date(sub.date).toLocaleDateString()}`}
                                                />
                                            </ListItem>
                                            {index !== mySubscriptions.length - 1 && <Divider variant="inset" component="li" />}
                                        </React.Fragment>
                                    ))}
                                </List>
                            ) : (
                                <Box sx={{ p: 6, textAlign: 'center' }}>
                                    <Typography color="text.secondary" variant="body2">Nessun insegnante associato.</Typography>
                                </Box>
                            )}
                        </Box>
                    </Card>
                </Grid>

                {/* MODULO ISCRIZIONE */}
                <Grid item xs={12} md={6}>
                    <Paper elevation={0} sx={{ p: 4, borderRadius: 5, border: '1px solid', borderColor: 'divider', bgcolor: 'grey.50', height: '100%', boxSizing: 'border-box' }}>
                        <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                            <PersonAddIcon sx={{ mr: 1, color: 'primary.main' }} /> Iscriviti a un nuovo corso
                        </Typography>

                        {status.msg && (
                            <Alert severity={status.type} sx={{ mb: 3, borderRadius: 3 }}>{status.msg}</Alert>
                        )}

                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Seleziona il docente per richiedere l'inserimento nel corso e visualizzare il suo calendario.
                        </Typography>

                        <FormControl fullWidth sx={{ mb: 3, bgcolor: 'white' }}>
                            <InputLabel>Lista Insegnanti Disponibili</InputLabel>
                            <Select
                                value={selectedTeacher}
                                label="Lista Insegnanti Disponibili"
                                onChange={(e) => setSelectedTeacher(e.target.value)}
                                disabled={submitting}
                                sx={{ borderRadius: 3 }}
                            >
                                {teachers.map((t) => (
                                    <MenuItem key={t.id} value={t}>Prof. {t.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <Button
                            variant="contained"
                            fullWidth
                            size="large"
                            onClick={handleSubscribe}
                            disabled={!selectedTeacher || submitting}
                            sx={{ borderRadius: 4, py: 1.8, textTransform: 'none', fontWeight: 'bold', boxShadow: 3 }}
                        >
                            {submitting ? <CircularProgress size={24} color="inherit" /> : "Invia Richiesta Iscrizione"}
                        </Button>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
}