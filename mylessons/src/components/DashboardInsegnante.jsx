import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { googleLogout } from '@react-oauth/google';
import Cookies from 'js-cookie';
import {
    Grid, Paper, Typography, Box, CircularProgress,
    List, ListItem, ListItemText, ListItemIcon, Card,
    Avatar, useTheme, useMediaQuery, Badge, Button, IconButton, Stack
} from '@mui/material';
import GroupIcon from '@mui/icons-material/Group';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import SyncIcon from '@mui/icons-material/Sync';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import LogoutIcon from '@mui/icons-material/Logout';
import { APPS_SCRIPT_URL } from "./config/config";
import {AccountBalanceWallet as WalletIcon} from "@mui/icons-material";

export default function DashboardInsegnante() {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const navigate = useNavigate();

    // 1. Inizializziamo l'utente leggendo direttamente il cookie (più sicuro delle prop)
    const [userData] = useState(() => {
        const session = Cookies.get('user_session');
        return session ? JSON.parse(session) : null;
    });

    const [subscribers, setSubscribers] = useState([]);
    const [loading, setLoading] = useState(true);

    const handleLogout = useCallback(() => {
        googleLogout();
        Cookies.remove('user_session');
        navigate('/login', { replace: true });
    }, [navigate]);

    // 2. Fetch iscritti con Token di autenticazione
    const fetchSubscribers = useCallback(async () => {
        if (!userData?.id_token) return;

        setLoading(true);
        try {
            // Inviamo teacherId (che è userData.sub) e il token per la verifica backend
            const url = `${APPS_SCRIPT_URL}?action=getTeacherSubscribers` +
                `&teacherId=${userData.sub}` +
                `&token=${userData.id_token}`;

            const res = await fetch(url);
            const result = await res.json();

            if (result.status === "success") {
                setSubscribers(result.data);
            } else if (result.message?.includes("autorizzato")) {
                handleLogout(); // Sessione scaduta
            }
        } catch (error) {
            console.error("Errore recupero iscritti:", error);
        } finally {
            setLoading(false);
        }
    }, [userData, handleLogout]);

    useEffect(() => {
        fetchSubscribers();
    }, [fetchSubscribers]);

    // 3. Protezione Rendering
    if (!userData) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ p: isMobile ? 2 : 3, pb: 5, maxWidth: 1200, mx: 'auto' }}>

            {/* Header Profilo */}
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 4
            }}>
                <Stack direction="row" spacing={2} alignItems="center">
                    <Badge
                        overlap="circular"
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                        badgeContent={<Box sx={{ width: 14, height: 14, bgcolor: 'success.main', borderRadius: '50%', border: '2px solid white' }} />}
                    >
                        <Avatar
                            src={userData.picture}
                            sx={{ width: isMobile ? 60 : 70, height: isMobile ? 60 : 70, boxShadow: 3 }}
                        />
                    </Badge>
                    <Box>
                        <Typography variant={isMobile ? "h6" : "h5"} fontWeight="bold">
                            Prof. {userData.family_name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            Insegnante • {userData.email}
                        </Typography>
                    </Box>
                </Stack>

                <IconButton color="error" onClick={handleLogout} sx={{ bgcolor: 'rgba(211, 47, 47, 0.05)' }}>
                    <LogoutIcon />
                </IconButton>
            </Box>

            <Grid container spacing={3} alignItems="stretch">
                {/* CARD STUDENTI TOTALI */}
                <Grid item xs={12} md={4}>
                    <Paper
                        elevation={0}
                        sx={{
                            p: 3,
                            borderRadius: 4,
                            bgcolor: 'primary.main',
                            color: 'white',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                        }}
                    >
                        <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>Studenti Iscritti</Typography>
                        <Typography variant="h3" fontWeight="bold">{subscribers.length}</Typography>
                    </Paper>
                </Grid>

                {/* PULSANTE GESTIONE ORARI */}
                <Grid item xs={12} md={8}>
                    <Button
                        variant="contained"
                        color="secondary"
                        fullWidth
                        onClick={() => navigate('/dashboard/schedule')}
                        startIcon={<CalendarMonthIcon />}
                        endIcon={<ChevronRightIcon />}
                        sx={{
                            py: 3,
                            borderRadius: 4,
                            fontSize: '1.1rem',
                            fontWeight: 'bold',
                            textTransform: 'none',
                            boxShadow: 4,
                        }}
                    >
                        Gestisci e Aggiorna Orari
                    </Button>
                </Grid>

                {/* 3. NUOVO PULSANTE GESTIONE STUDENTI */}
                <Grid item xs={12} sm={6} md={4}>
                    <Button
                        variant="contained"
                        color="info" // Colore azzurro per differenziarlo
                        fullWidth
                        onClick={() => navigate('/dashboard/students')}
                        startIcon={<GroupIcon />}
                        sx={{
                            minHeight: 120,
                            borderRadius: 4,
                            fontSize: '1rem',
                            fontWeight: 'bold',
                            textTransform: 'none',
                            boxShadow: 4,
                            bgcolor: '#0288d1', // Tonalità di blu specifica
                            '&:hover': { bgcolor: '#01579b' },
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1
                        }}
                    >
                        Gestisci Studenti
                        <ChevronRightIcon sx={{ opacity: 0.5 }} />
                    </Button>
                    <Button
                        onClick={() => navigate('/revenue')}
                        variant="outlined"
                        startIcon={<WalletIcon />}
                    >
                        Visualizza Guadagni
                    </Button>
                </Grid>

                {/* REGISTRO STUDENTI */}
                <Grid item xs={12}>
                    <Card elevation={0} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
                        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center' }}>
                            <GroupIcon sx={{ mr: 1, color: 'primary.main' }} />
                            <Typography variant="h6" fontWeight="bold">Registro Studenti</Typography>
                        </Box>

                        {loading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
                                <CircularProgress />
                            </Box>
                        ) : subscribers.length > 0 ? (
                            <List disablePadding>
                                {subscribers.map((student, index) => (
                                    <ListItem
                                        key={index}
                                        divider={index !== subscribers.length - 1}
                                        sx={{ py: 2 }}
                                    >
                                        <ListItemIcon>
                                            <Avatar sx={{ bgcolor: 'primary.light', color: 'primary.main', fontWeight: 'bold' }}>
                                                {student.studentName ? student.studentName.charAt(0).toUpperCase() : 'S'}
                                            </Avatar>
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={<Typography fontWeight="bold">{student.studentName}</Typography>}
                                            secondary={
                                                <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {student.studentEmail}
                                                    </Typography>
                                                    <Stack direction="row" spacing={0.5} alignItems="center">
                                                        <SyncIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                                                        <Typography variant="caption" color="text.disabled">
                                                            Iscritto: {new Date(student.date).toLocaleDateString()}
                                                        </Typography>
                                                    </Stack>
                                                </Stack>
                                            }
                                        />
                                    </ListItem>
                                ))}
                            </List>
                        ) : (
                            <Box sx={{ p: 5, textAlign: 'center' }}>
                                <Typography color="text.secondary">Nessuno studente iscritto ai tuoi corsi.</Typography>
                            </Box>
                        )}
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );
}