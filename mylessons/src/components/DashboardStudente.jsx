import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { googleLogout } from '@react-oauth/google';
import Cookies from 'js-cookie';
import {
    Grid, Paper, Typography, Box, Button, FormControl,
    InputLabel, Select, MenuItem, Alert, CircularProgress,
    List, ListItem, ListItemText, ListItemIcon, Card, Avatar,
    useTheme, useMediaQuery, IconButton
} from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import SchoolIcon from '@mui/icons-material/School';
import GroupIcon from '@mui/icons-material/Group';
import LogoutIcon from '@mui/icons-material/Logout';
import { APPS_SCRIPT_URL } from "./config/config";

export default function DashboardStudente({ user }) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const navigate = useNavigate();

    const [teachers, setTeachers] = useState([]);
    const [mySubscriptions, setMySubscriptions] = useState([]);
    const [selectedTeacher, setSelectedTeacher] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [status, setStatus] = useState({ type: '', msg: '' });

    // Funzione di Logout
    const handleLogout = () => {
        googleLogout();
        Cookies.remove('user_session');
        navigate('/login', { replace: true });
    };

    // Caricamento dati iniziali
    const loadDashboardData = useCallback(async () => {
        setLoading(true);
        try {
            const [resT, resS] = await Promise.all([
                fetch(`${APPS_SCRIPT_URL}?action=getTeachers`),
                fetch(`${APPS_SCRIPT_URL}?action=getMySubscriptions&email=${user.email}`)
            ]);
            const dataT = await resT.json();
            const dataS = await resS.json();

            if (dataT.status === "success") setTeachers(dataT.data);
            if (dataS.status === "success") setMySubscriptions(dataS.data);
        } catch (error) {
            console.error("Errore caricamento:", error);
        } finally {
            setLoading(false);
        }
    }, [user.email]);

    // Correzione Line 56
    useEffect(() => {
        loadDashboardData();
    }, [loadDashboardData]);

    // Funzione per iscriversi a un corso
    const handleSubscribe = async () => {
        if (!selectedTeacher) return;
        setSubmitting(true);
        setStatus({ type: '', msg: '' });

        try {
            await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors', // Importante per Google Apps Script
                body: JSON.stringify({
                    action: "subscribe",
                    studentId: user.sub,
                    studentEmail: user.email,
                    teacherId: selectedTeacher.id,
                    teacherName: selectedTeacher.name
                }),
            });

            setStatus({ type: 'success', msg: `Iscrizione completata con il Prof. ${selectedTeacher.name}!` });
            setSelectedTeacher('');
            // Refresh dei dati dopo un piccolo delay per dare tempo allo script di processare
            setTimeout(() => loadDashboardData(), 1500);
        } catch (error) {
            setStatus({ type: 'error', msg: 'Errore durante l\'iscrizione.' });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Box sx={{ p: isMobile ? 1 : 3, pb: 10 }}>

            {/* Header con Saluto e Logout */}
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 3,
                mt: isMobile ? 2 : 0
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Avatar src={user.picture} sx={{ width: 56, height: 56, mr: 2, boxShadow: 2 }} />
                    <Box>
                        <Typography variant={isMobile ? "h5" : "h4"} fontWeight="bold">
                            Ciao, {user.given_name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">Studente</Typography>
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

                {/* 1. I MIEI INSEGNANTI */}
                <Grid item xs={12} md={6}>
                    <Card elevation={0} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
                        <Box sx={{ p: 2, bgcolor: 'primary.main', color: 'white' }}>
                            <Typography variant="subtitle1" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center' }}>
                                <GroupIcon sx={{ mr: 1 }} /> I miei Insegnanti ({mySubscriptions.length})
                            </Typography>
                        </Box>
                        <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                            {loading ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress size={24} /></Box>
                            ) : mySubscriptions.length > 0 ? (
                                <List disablePadding>
                                    {mySubscriptions.map((sub, index) => (
                                        <ListItem key={index} divider={index !== mySubscriptions.length - 1}>
                                            <ListItemIcon><SchoolIcon color="primary" /></ListItemIcon>
                                            <ListItemText
                                                primary={`Prof. ${sub.teacherName}`}
                                                secondary={`Iscritto il: ${new Date(sub.date).toLocaleDateString()}`}
                                            />
                                        </ListItem>
                                    ))}
                                </List>
                            ) : (
                                <Typography sx={{ p: 4, textAlign: 'center', color: 'text.secondary', fontStyle: 'italic' }}>
                                    Non sei ancora iscritto a nessun corso.
                                </Typography>
                            )}
                        </Box>
                    </Card>
                </Grid>

                {/* 2. MODULO ISCRIZIONE */}
                <Grid item xs={12} md={6}>
                    <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: '1px solid', borderColor: 'divider', bgcolor: 'grey.50' }}>
                        <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ display: 'flex', alignItems: 'center' }}>
                            <PersonAddIcon sx={{ mr: 1 }} /> Nuova Iscrizione
                        </Typography>

                        {status.msg && (
                            <Alert severity={status.type} sx={{ mb: 2, borderRadius: 2 }}>
                                {status.msg}
                            </Alert>
                        )}

                        <FormControl fullWidth sx={{ mb: 2, bgcolor: 'white' }}>
                            <InputLabel>Seleziona Insegnante</InputLabel>
                            <Select
                                value={selectedTeacher}
                                label="Seleziona Insegnante"
                                onChange={(e) => setSelectedTeacher(e.target.value)}
                                disabled={submitting}
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
                            sx={{ borderRadius: 3, py: 1.5, textTransform: 'none', fontWeight: 'bold' }}
                        >
                            {submitting ? <CircularProgress size={24} color="inherit" /> : "Iscriviti al corso"}
                        </Button>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
}