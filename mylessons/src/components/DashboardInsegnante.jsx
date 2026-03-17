import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { googleLogout } from '@react-oauth/google';
import Cookies from 'js-cookie';
import {
    Grid, Paper, Typography, Box, CircularProgress,
    List, ListItem, ListItemText, ListItemIcon, Card,
    Avatar, Badge, Button, IconButton, Stack
} from '@mui/material';
import {
    CalendarMonth as CalendarMonthIcon,
    ChevronRight as ChevronRightIcon,
    Logout as LogoutIcon,
    AccountBalanceWallet as WalletIcon,
    People as PeopleIcon,
    TrendingUp as TrendingUpIcon
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
        if (!userData?.id_token) return;
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
    }, [userData, handleLogout]);

    useEffect(() => { fetchSubscribers(); }, [fetchSubscribers]);

    if (!userData) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>;

    // Componente per i pulsanti della griglia
    const MenuButton = ({ title, icon, color, onClick, subtitle }) => (
        <Paper
            component={Button}
            onClick={onClick}
            elevation={0}
            sx={{
                p: 2,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                borderRadius: 4,
                bgcolor: 'white',
                border: '1px solid #eee',
                textTransform: 'none',
                width: '100%',
                minHeight: 110,
                color: 'text.primary',
                transition: '0.2s',
                '&:active': { transform: 'scale(0.95)', bgcolor: '#f5f5f5' }
            }}
        >
            <Avatar sx={{ bgcolor: `${color}.light`, color: `${color}.main`, mb: 1 }}>{icon}</Avatar>
            <Typography variant="subtitle2" fontWeight="800">{title}</Typography>
            {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
        </Paper>
    );

    return (
        <Box sx={{ p: 2, maxWidth: 800, mx: 'auto', bgcolor: '#f8f9fa', minHeight: '100vh', pb: 5 }}>

            {/* Header Profilo */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4, mt: 1 }}>
                <Stack direction="row" spacing={2} alignItems="center">
                    <Badge overlap="circular" anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} variant="dot" color="success">
                        <Avatar src={userData.picture} sx={{ width: 50, height: 50, boxShadow: 1 }} />
                    </Badge>
                    <Box>
                        <Typography variant="h6" fontWeight="900" sx={{ lineHeight: 1.2 }}>
                            Prof. {userData.family_name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">Area Docente</Typography>
                    </Box>
                </Stack>
                <IconButton onClick={handleLogout} sx={{ bgcolor: 'white', border: '1px solid #eee' }} color="error">
                    <LogoutIcon fontSize="small" />
                </IconButton>
            </Stack>

            {/* Quick Stats & Actions Grid */}
            <Grid container spacing={2} sx={{ mb: 4 }}>
                <Grid item xs={6}>
                    <MenuButton
                        title="Agenda"
                        subtitle="Orari lezioni"
                        icon={<CalendarMonthIcon />}
                        color="secondary"
                        onClick={() => navigate('/dashboard/schedule')}
                    />
                </Grid>
                <Grid item xs={6}>
                    <MenuButton
                        title="Studenti"
                        subtitle={`${subscribers.length} iscritti`}
                        icon={<PeopleIcon />}
                        color="info"
                        onClick={() => navigate('/dashboard/students')}
                    />
                </Grid>
                <Grid item xs={6}>
                    <MenuButton
                        title="Guadagni"
                        subtitle="Bilancio"
                        icon={<WalletIcon />}
                        color="success"
                        onClick={() => navigate('/dashboard/revenue')}
                    />
                </Grid>
                <Grid item xs={6}>
                    <Paper
                        elevation={0}
                        sx={{
                            p: 2, borderRadius: 4, bgcolor: 'primary.main', color: 'white',
                            height: '100%', display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center', textAlign: 'center'
                        }}
                    >
                        <TrendingUpIcon sx={{ mb: 1, opacity: 0.8 }} />
                        <Typography variant="h5" fontWeight="900">{subscribers.length}</Typography>
                        <Typography variant="caption" sx={{ opacity: 0.8, fontWeight: 'bold' }}>TOTAL STUDENTS</Typography>
                    </Paper>
                </Grid>
            </Grid>

            {/* Registro Studenti Rapido */}
            <Typography variant="subtitle1" fontWeight="800" sx={{ mb: 2, ml: 1 }}>Ultimi Iscritti</Typography>
            <Card elevation={0} sx={{ borderRadius: 4, border: '1px solid #eee' }}>
                {loading ? (
                    <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress size={25} /></Box>
                ) : subscribers.length > 0 ? (
                    <List disablePadding>
                        {subscribers.slice(0, 5).map((student, index) => (
                            <ListItem
                                key={index}
                                divider={index !== Math.min(subscribers.length, 5) - 1}
                                secondaryAction={<ChevronRightIcon sx={{ color: '#ccc' }} />}
                                onClick={() => navigate('/dashboard/students')}
                                sx={{ cursor: 'pointer' }}
                            >
                                <ListItemIcon>
                                    <Avatar sx={{ width: 35, height: 35, fontSize: '0.9rem', bgcolor: 'primary.light', color: 'primary.main', fontWeight: 'bold' }}>
                                        {student.studentName?.charAt(0)}
                                    </Avatar>
                                </ListItemIcon>
                                <ListItemText
                                    primary={<Typography variant="body2" fontWeight="700">{student.studentName}</Typography>}
                                    secondary={<Typography variant="caption" color="text.secondary">{new Date(student.date).toLocaleDateString()}</Typography>}
                                />
                            </ListItem>
                        ))}
                    </List>
                ) : (
                    <Box sx={{ p: 3, textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary">Nessuno studente iscritto.</Typography>
                    </Box>
                )}
            </Card>
        </Box>
    );
}