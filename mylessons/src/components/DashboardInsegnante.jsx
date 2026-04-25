import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { googleLogout } from '@react-oauth/google';
import Cookies from 'js-cookie';
import {
    Grid, Paper, Typography, Box, CircularProgress,
    List, ListItem, ListItemText, ListItemIcon, Card,
    Avatar, Badge, Button, IconButton, Stack, Divider, Fade
} from '@mui/material';
import {
    CalendarMonth as CalendarMonthIcon,
    ChevronRight as ChevronRightIcon,
    Logout as LogoutIcon,
    AccountBalanceWallet as WalletIcon,
    People as PeopleIcon,
    TrendingUp as TrendingUpIcon,
    NotificationsNone as NotificationsIcon,
    Feedback as FeedbackIcon
} from '@mui/icons-material';
import { APPS_SCRIPT_URL } from "./config/config";

const pulseStyles = {
    '@keyframes pulse-bg': {
        '0%': { boxShadow: '0 0 0 0px rgba(245, 101, 101, 0.2)' },
        '70%': { boxShadow: '0 0 0 10px rgba(245, 101, 101, 0)' },
        '100%': { boxShadow: '0 0 0 0px rgba(245, 101, 101, 0)' },
    }
};

export default function DashboardInsegnante() {
    const navigate = useNavigate();

    const [userData] = useState(() => {
        const session = Cookies.get('user_session');
        return session ? JSON.parse(session) : null;
    });

    // --- RECUPERO DATI DALLA CACHE LOCALE ---
    const [subscribers, setSubscribers] = useState(() => {
        const saved = localStorage.getItem('cache_subscribers');
        return saved ? JSON.parse(saved) : [];
    });

    const [pendingAbsences, setPendingAbsences] = useState(() => {
        const saved = localStorage.getItem('cache_absences');
        return saved ? JSON.parse(saved) : [];
    });

    // Se abbiamo già dati in cache, partiamo con loading = false per mostrarli subito
    const [loading, setLoading] = useState(subscribers.length === 0);

    const handleLogout = useCallback(() => {
        googleLogout();
        Cookies.remove('user_session');
        // --- PULIZIA CACHE AL LOGOUT ---
        localStorage.removeItem('cache_subscribers');
        localStorage.removeItem('cache_feedbacks')
        localStorage.removeItem('cache_absences');
        localStorage.removeItem('cache_schedules');
        navigate('/login', { replace: true });
    }, [navigate]);

    const fetchDashboardData = useCallback(async (isSilent = false) => {
        if (!userData?.id_token) return;
        if (!isSilent) setLoading(true);

        try {
            const teacherFullName = `${userData.given_name} ${userData.family_name}`;

            // Carichiamo tutto in parallelo: Feedback, Studenti e Agenda
            const [resFb, resSubs, resSched] = await Promise.all([
                fetch(`${APPS_SCRIPT_URL}?action=getTeacherFeedbackSummary&teacherName=${encodeURIComponent(teacherFullName)}&token=${userData.id_token}`),
                fetch(`${APPS_SCRIPT_URL}?action=getTeacherSubscribers&teacherId=${userData.sub}&token=${userData.id_token}`),
                fetch(`${APPS_SCRIPT_URL}?action=getStudentSchedules&teacherName=${encodeURIComponent(teacherFullName)}&token=${userData.id_token}`)
            ]);

            const resultFb = await resFb.json();
            const resultSubs = await resSubs.json();
            const resultSched = await resSched.json();

            // 1. Gestione Feedback & Assenze
            if (resultFb.status === "success") {
                const absences = resultFb.data.filter(f => f.status === "Assente");
                setPendingAbsences(absences);

                // Salviamo le assenze per il badge notifiche
                localStorage.setItem('cache_absences', JSON.stringify(absences));

                // --- AGGIUNTA: Salviamo TUTTI i feedback per la pagina dedicata ---
                localStorage.setItem('cache_feedbacks', JSON.stringify(resultFb.data));
            }

            // 2. Cache Studenti (usata da Anagrafica e Bilancio)
            if (resultSubs.status === "success") {
                setSubscribers(resultSubs.data);
                localStorage.setItem('cache_subscribers', JSON.stringify(resultSubs.data));
            }

            // 3. Cache Agenda
            if (resultSched.status === "success") {
                localStorage.setItem('cache_schedules', JSON.stringify(resultSched.data));
            }

        } catch (error) {
            console.error("Errore sincronizzazione dashboard:", error);
        } finally {
            setLoading(false);
        }
    }, [userData]);

    useEffect(() => {
        if (!userData) {
            navigate('/login');
        } else {
            // Caricamento silenzioso se abbiamo già dati, altrimenti normale
            const hasCache = subscribers.length > 0;
            fetchDashboardData(hasCache);
        }
    }, [userData, navigate, fetchDashboardData, subscribers.length]);

    if (!userData) return null;

    const MenuButton = ({ title, icon, color, onClick, subtitle }) => (
        <Paper
            component={Button}
            onClick={onClick}
            elevation={0}
            sx={{
                p: 2.5, display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                textAlign: 'left', borderRadius: 5, bgcolor: 'white', border: '1px solid #f0f0f0',
                textTransform: 'none', width: '100%', minHeight: 120, color: 'text.primary',
                boxShadow: '0 4px 12px rgba(0,0,0,0.03)', position: 'relative', overflow: 'hidden',
                '&:active': { transform: 'scale(0.96)', bgcolor: '#fcfcfc' }
            }}
        >
            <Avatar variant="rounded" sx={{ bgcolor: `${color}.light`, color: `${color}.main`, mb: 1.5, width: 42, height: 42, borderRadius: 3 }}>
                {icon}
            </Avatar>
            <Box>
                <Typography variant="body1" fontWeight="800" sx={{ mb: 0.2 }}>{title}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', opacity: 0.8 }}>{subtitle}</Typography>
            </Box>
            <ChevronRightIcon sx={{ position: 'absolute', right: 12, bottom: 12, color: '#ddd', fontSize: 20 }} />
        </Paper>
    );

    return (
        <Box sx={{ p: 2, maxWidth: 500, mx: 'auto', bgcolor: '#fdfdfd', minHeight: '100vh', pb: 6, ...pulseStyles }}>

            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4, pt: 1 }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                    <Badge overlap="circular" anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} variant="dot" color="success">
                        <Avatar src={userData.picture} sx={{ width: 48, height: 48, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
                    </Badge>
                    <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: -0.5 }}>Bentornato,</Typography>
                        <Typography variant="h6" fontWeight="900">{userData.given_name} {userData.family_name}</Typography>
                    </Box>
                </Stack>
                <Stack direction="row" spacing={1}>
                    <IconButton sx={{ bgcolor: 'white', border: '1px solid #f0f0f0', borderRadius: 3 }} onClick={() => navigate('/dashboard/feedbacks')}>
                        <Badge badgeContent={pendingAbsences.length} color="error">
                            <NotificationsIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                        </Badge>
                    </IconButton>
                    <IconButton onClick={handleLogout} sx={{ bgcolor: '#fff5f5', border: '1px solid #ffebeb', borderRadius: 3 }} color="error">
                        <LogoutIcon fontSize="small" />
                    </IconButton>
                </Stack>
            </Stack>

            {pendingAbsences.length > 0 && (
                <Fade in={true}>
                    <Paper
                        onClick={() => navigate('/dashboard/feedbacks')}
                        elevation={0}
                        sx={{
                            mb: 3, p: 2, borderRadius: 4, bgcolor: '#fff5f5', border: '1px solid #feb2b2',
                            display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer',
                            animation: 'pulse-bg 2s infinite'
                        }}
                    >
                        <Avatar sx={{ bgcolor: '#f56565', width: 40, height: 40 }}>
                            <FeedbackIcon sx={{ color: 'white' }} />
                        </Avatar>
                        <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="body2" fontWeight="900" color="#c53030">
                                {pendingAbsences.length} lezioni da riprogrammare
                            </Typography>
                            <Typography variant="caption" color="#e53e3e" sx={{ display: 'block', mt: -0.5 }}>
                                Alcuni studenti hanno segnalato indisponibilità
                            </Typography>
                        </Box>
                        <ChevronRightIcon sx={{ color: '#f56565' }} />
                    </Paper>
                </Fade>
            )}

            <Grid container spacing={2} sx={{ mb: 4 }}>
                <Grid item xs={6}>
                    <MenuButton title="Agenda" subtitle="Pianifica lezioni" icon={<CalendarMonthIcon />} color="secondary" onClick={() => navigate('/dashboard/schedule')} />
                </Grid>
                <Grid item xs={6}>
                    <MenuButton title="Studenti" subtitle={`${subscribers.length} attivi`} icon={<PeopleIcon />} color="info" onClick={() => navigate('/dashboard/students')} />
                </Grid>
                <Grid item xs={6}>
                    <MenuButton title="Bilancio" subtitle="Vedi incassi" icon={<WalletIcon />} color="success" onClick={() => navigate('/dashboard/revenue')} />
                </Grid>
                <Grid item xs={6}>
                    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 5, bgcolor: 'primary.main', color: 'white', boxShadow: '0 8px 20px rgba(25, 118, 210, 0.2)' }}>
                        <Avatar variant="rounded" sx={{ bgcolor: 'rgba(255,255,255,0.2)', mb: 1.5, width: 42, height: 42 }}>
                            <TrendingUpIcon sx={{ color: 'white' }} />
                        </Avatar>
                        <Typography variant="h4" fontWeight="900" sx={{ mb: -0.5 }}>{subscribers.length}</Typography>
                        <Typography variant="caption" sx={{ opacity: 0.9, fontWeight: 700, textTransform: 'uppercase' }}>Studenti Totali</Typography>
                    </Paper>
                </Grid>
            </Grid>

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
                {loading && subscribers.length === 0 ? (
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

            <Box sx={{ mt: 4, textAlign: 'center', opacity: 0.5 }}>
                <Typography variant="caption" fontWeight="600">
                    MyLessons v1.0 • Sincronizzazione Attiva
                </Typography>
            </Box>
        </Box>
    );
}