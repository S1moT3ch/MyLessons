import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { googleLogout } from '@react-oauth/google';
import Cookies from 'js-cookie';
import {
    Grid, Paper, Typography, Box, CircularProgress,
    List, ListItem, ListItemText, ListItemIcon, Card,
    Avatar, useTheme, useMediaQuery, Badge, Button, IconButton, Tooltip
} from '@mui/material';
import GroupIcon from '@mui/icons-material/Group';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import SyncIcon from '@mui/icons-material/Sync';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import LogoutIcon from '@mui/icons-material/Logout';
import { APPS_SCRIPT_URL } from "./config/config";

export default function DashboardInsegnante({ user }) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const navigate = useNavigate();

    const [subscribers, setSubscribers] = useState([]);
    const [loading, setLoading] = useState(true);

    // Funzione di Logout
    const handleLogout = () => {
        googleLogout();
        Cookies.remove('user_session');
        navigate('/login', { replace: true });
    };

    useEffect(() => {
        const fetchSubscribers = async () => {
            try {
                const res = await fetch(`${APPS_SCRIPT_URL}?action=getTeacherSubscribers&teacherId=${user.sub}`);
                const result = await res.json();
                if (result.status === "success") {
                    setSubscribers(result.data);
                }
            } catch (error) {
                console.error("Errore recupero iscritti:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchSubscribers();
    }, [user.sub]);

    return (
        <Box sx={{ p: isMobile ? 1 : 3, pb: 5 }}>

            {/* Header Profilo con Logout Integrato */}
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 4,
                mt: isMobile ? 2 : 0
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Badge
                        overlap="circular"
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                        badgeContent={<Box sx={{ width: 14, height: 14, bgcolor: 'success.main', borderRadius: '50%', border: '2px solid white' }} />}
                    >
                        <Avatar
                            src={user.picture}
                            sx={{ width: isMobile ? 60 : 70, height: isMobile ? 60 : 70, boxShadow: 3 }}
                        />
                    </Badge>
                    <Box sx={{ ml: 2 }}>
                        <Typography variant={isMobile ? "h6" : "h5"} fontWeight="bold">
                            Prof. {user.family_name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            Insegnante
                        </Typography>
                    </Box>
                </Box>

                {/* Tasto Logout */}
                {isMobile ? (
                    <IconButton color="error" onClick={handleLogout} sx={{ bgcolor: 'error.lighter' }}>
                        <LogoutIcon />
                    </IconButton>
                ) : (
                    <Button
                        variant="outlined"
                        color="error"
                        startIcon={<LogoutIcon />}
                        onClick={handleLogout}
                        sx={{ borderRadius: 2, textTransform: 'none' }}
                    >
                        Esci
                    </Button>
                )}
            </Box>

            <Grid container spacing={isMobile ? 2 : 3}>

                {/* CARD STATISTICA */}
                <Grid item xs={12} md={4}>
                    <Paper
                        elevation={0}
                        sx={{
                            p: 3,
                            borderRadius: 4,
                            bgcolor: 'primary.main',
                            color: 'white',
                            minHeight: 110,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center'
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
                            height: '100%',
                            minHeight: 80,
                            borderRadius: 4,
                            fontSize: '1.1rem',
                            fontWeight: 'bold',
                            textTransform: 'none',
                            boxShadow: '0 8px 20px rgba(156, 39, 176, 0.2)',
                        }}
                    >
                        Aggiorna Orari Studenti
                    </Button>
                </Grid>

                {/* REGISTRO STUDENTI */}
                <Grid item xs={12}>
                    <Card elevation={0} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
                        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <GroupIcon sx={{ mr: 1, color: 'primary.main' }} />
                                <Typography variant="h6" fontWeight="bold">Registro Studenti</Typography>
                            </Box>
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
                                            <Avatar sx={{ bgcolor: theme.palette.primary.main, fontWeight: 'bold' }}>
                                                {student.studentName ? student.studentName.charAt(0).toUpperCase() : 'S'}
                                            </Avatar>
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={<Typography fontWeight="bold">{student.studentName}</Typography>}
                                            secondary={
                                                <Box component="span">
                                                    <Typography variant="caption" display="block" color="text.secondary">
                                                        {student.studentEmail}
                                                    </Typography>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                                                        <SyncIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                                                        <Typography variant="caption" color="text.disabled">
                                                            Iscritto: {new Date(student.date).toLocaleDateString()}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            }
                                        />
                                    </ListItem>
                                ))}
                            </List>
                        ) : (
                            <Box sx={{ p: 5, textAlign: 'center' }}>
                                <Typography color="text.secondary">Nessuno studente iscritto.</Typography>
                            </Box>
                        )}
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );
}