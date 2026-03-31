import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { googleLogout } from '@react-oauth/google';
import Cookies from 'js-cookie';
import {
    Grid, Paper, Typography, Box, CircularProgress,
    List, ListItem, ListItemText, ListItemIcon, Card,
    Avatar, Badge, Button, IconButton, Stack, Divider
} from '@mui/material';
import {
    CalendarMonth as CalendarMonthIcon,
    ChevronRight as ChevronRightIcon,
    Logout as LogoutIcon,
    AccountBalanceWallet as WalletIcon,
    People as PeopleIcon,
    TrendingUp as TrendingUpIcon,
    NotificationsNone as NotificationsIcon
} from '@mui/icons-material';
import { APPS_SCRIPT_URL } from "./config/config";

export default function DashboardInsegnante() {
    const navigate = useNavigate();

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

    const fetchSubscribers = useCallback(async () => {
        // Se non c'è sessione nei cookie, inutile procedere
        if (!userData?.id_token) {
            navigate('/login');
            return;
        }
        setLoading(true);
        try {
            const url = `${APPS_SCRIPT_URL}?action=getTeacherSubscribers&teacherId=${userData.sub}&token=${userData.id_token}`;
            const res = await fetch(url);
            const result = await res.json();
            if (result.status === "success") setSubscribers(result.data);
            else if (result.message?.includes("autorizzato")) handleLogout();
        } catch (error) {
            console.error("Errore recupero iscritti:", error);
        } finally {
            setLoading(false);
        }
    }, [userData, handleLogout, navigate]);

    useEffect(() => { fetchSubscribers(); }, [fetchSubscribers]);

    if (!userData) return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <CircularProgress />
        </Box>
    );

    // Componente Bottone Ottimizzato per il Touch
    const MenuButton = ({ title, icon, color, onClick, subtitle }) => (
        <Paper
            component={Button}
            onClick={onClick}
            elevation={0}
            sx={{
                p: 2.5,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start', // Allineamento a sinistra più moderno
                textAlign: 'left',
                borderRadius: 5,
                bgcolor: 'white',
                border: '1px solid #f0f0f0',
                textTransform: 'none',
                width: '100%',
                minHeight: 120,
                color: 'text.primary',
                boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                transition: 'all 0.2s ease',
                '&:active': { transform: 'scale(0.96)', bgcolor: '#fcfcfc' },
                position: 'relative',
                overflow: 'hidden'
            }}
        >
            <Avatar
                variant="rounded"
                sx={{
                    bgcolor: `${color}.light`,
                    color: `${color}.main`,
                    mb: 1.5,
                    width: 42,
                    height: 42,
                    borderRadius: 3
                }}
            >
                {icon}
            </Avatar>
            <Box>
                <Typography variant="body1" fontWeight="800" sx={{ mb: 0.2 }}>{title}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', opacity: 0.8 }}>
                    {subtitle}
                </Typography>
            </Box>
            <ChevronRightIcon sx={{ position: 'absolute', right: 12, bottom: 12, color: '#ddd', fontSize: 20 }} />
        </Paper>
    );

    return (
        <Box sx={{
            p: 2,
            maxWidth: 500, // Più stretto per simulare un'app mobile su desktop
            mx: 'auto',
            bgcolor: '#fdfdfd',
            minHeight: '100vh',
            pb: 6
        }}>

            {/* Top Bar */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4, pt: 1 }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                    <Badge
                        overlap="circular"
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                        variant="dot"
                        color="success"
                        sx={{ '& .MuiBadge-badge': { border: '2px solid white', height: 12, width: 12, borderRadius: '50%' } }}
                    >
                        <Avatar
                            src={userData.picture}
                            sx={{ width: 48, height: 48, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                        />
                    </Badge>
                    <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: -0.5 }}>
                            Bentornato,
                        </Typography>
                        <Typography variant="h6" fontWeight="900">
                            {userData.given_name} {userData.family_name}
                        </Typography>
                    </Box>
                </Stack>
                <Stack direction="row" spacing={1}>
                    <IconButton sx={{ bgcolor: 'white', border: '1px solid #f0f0f0', borderRadius: 3 }}>
                        <NotificationsIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                    </IconButton>
                    <IconButton
                        onClick={handleLogout}
                        sx={{ bgcolor: '#fff5f5', border: '1px solid #ffebeb', borderRadius: 3 }}
                        color="error"
                    >
                        <LogoutIcon fontSize="small" />
                    </IconButton>
                </Stack>
            </Stack>

            {/* Grid delle Azioni */}
            <Grid container spacing={2} sx={{ mb: 4 }}>
                <Grid item xs={6}>
                    <MenuButton
                        title="Agenda"
                        subtitle="Pianifica lezioni"
                        icon={<CalendarMonthIcon />}
                        color="secondary"
                        onClick={() => navigate('/dashboard/schedule')}
                    />
                </Grid>
                <Grid item xs={6}>
                    <MenuButton
                        title="Studenti"
                        subtitle={`${subscribers.length} attivi`}
                        icon={<PeopleIcon />}
                        color="info"
                        onClick={() => navigate('/dashboard/students')}
                    />
                </Grid>
                <Grid item xs={6}>
                    <MenuButton
                        title="Bilancio"
                        subtitle="Vedi incassi"
                        icon={<WalletIcon />}
                        color="success"
                        onClick={() => navigate('/dashboard/revenue')}
                    />
                </Grid>
                <Grid item xs={6}>
                    <Paper
                        elevation={0}
                        sx={{
                            p: 2.5, borderRadius: 5,
                            bgcolor: 'primary.main',
                            color: 'white',
                            alignItems: 'flex-start', justifyContent: 'center',
                            boxShadow: '0 8px 20px rgba(25, 118, 210, 0.2)'
                        }}
                    >
                        <Avatar variant="rounded" sx={{ bgcolor: 'rgba(255,255,255,0.2)', mb: 1.5, width: 42, height: 42 }}>
                            <TrendingUpIcon sx={{ color: 'white' }} />
                        </Avatar>
                        <Typography variant="h4" fontWeight="900" sx={{ mb: -0.5 }}>{subscribers.length}</Typography>
                        <Typography variant="caption" sx={{ opacity: 0.9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Studenti Totali
                        </Typography>
                    </Paper>
                </Grid>
            </Grid>

            {/* Sezione Recenti */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, px: 0.5 }}>
                <Typography variant="subtitle1" fontWeight="900">Ultimi Iscritti</Typography>
                <Button
                    size="small"
                    onClick={() => navigate('/dashboard/students')}
                    sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                    Vedi tutti
                </Button>
            </Stack>

            <Card elevation={0} sx={{ borderRadius: 5, border: '1px solid #f0f0f0', bgcolor: 'white', overflow: 'hidden' }}>
                {loading ? (
                    <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress size={28} /></Box>
                ) : subscribers.length > 0 ? (
                    <List disablePadding>
                        {subscribers.slice(0, 4).map((student, index) => (
                            <React.Fragment key={index}>
                                <ListItem
                                    secondaryAction={
                                        <IconButton size="small">
                                            <ChevronRightIcon fontSize="small" sx={{ color: '#bbb' }} />
                                        </IconButton>
                                    }
                                    onClick={() => navigate('/dashboard/students')}
                                    sx={{
                                        py: 1.8,
                                        '&:active': { bgcolor: '#f9f9f9' }
                                    }}
                                >
                                    <ListItemIcon sx={{ minWidth: 50 }}>
                                        <Avatar sx={{
                                            width: 40,
                                            height: 40,
                                            bgcolor: '#e3f2fd',
                                            color: 'primary.main',
                                            fontWeight: 800,
                                            fontSize: '1rem',
                                            borderRadius: 2.5
                                        }}>
                                            {student.studentName?.charAt(0)}
                                        </Avatar>
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={<Typography variant="body2" fontWeight="800" sx={{ color: '#2c3e50' }}>{student.studentName}</Typography>}
                                        secondary={
                                            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                Iscritto il {new Date(student.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                                            </Typography>
                                        }
                                    />
                                </ListItem>
                                {index < Math.min(subscribers.length, 4) - 1 && (
                                    <Divider variant="inset" component="li" sx={{ opacity: 0.5, mr: 2 }} />
                                )}
                            </React.Fragment>
                        ))}
                    </List>
                ) : (
                    <Box sx={{ p: 6, textAlign: 'center' }}>
                        <PeopleIcon sx={{ fontSize: 40, color: '#eee', mb: 1 }} />
                        <Typography variant="body2" color="text.secondary">Nessuno studente iscritto.</Typography>
                    </Box>
                )}
            </Card>

            {/* Footer Informativo */}
            <Box sx={{ mt: 4, textAlign: 'center', opacity: 0.5 }}>
                <Typography variant="caption" fontWeight="600">
                    MyLessons v1.0 • Sincronizzazione Attiva
                </Typography>
            </Box>
        </Box>
    );
}