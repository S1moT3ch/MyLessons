import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, CircularProgress, IconButton,
    Card, Stack, Chip, FormControl, InputLabel,
    Select, MenuItem, Paper, useMediaQuery, useTheme, Zoom
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';
import { APPS_SCRIPT_URL } from "./config/config";

export default function StudentSchedulePage() {
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const [loading, setLoading] = useState(true); // Partiamo da true per il primo caricamento
    const [loadingSchedule, setLoadingSchedule] = useState(false);
    const [myTeachers, setMyTeachers] = useState([]);
    const [selectedTeacherId, setSelectedTeacherId] = useState('');
    const [schedule, setSchedule] = useState([]);

    const giorni = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

    const getAuthToken = useCallback(() => {
        const sessionStr = Cookies.get('user_session');
        if (!sessionStr) return null;
        try {
            const session = JSON.parse(sessionStr);
            return session.id_token;
        } catch (e) {
            return null;
        }
    }, []);

    // 1. Carica gli insegnanti e gestisce la pre-selezione
    const loadMyTeachers = useCallback(async () => {
        const token = getAuthToken();
        if (!token) return navigate('/login');

        setLoading(true);
        try {
            const res = await fetch(`${APPS_SCRIPT_URL}?action=getMySubscriptions&token=${token}`);
            const data = await res.json();

            if (data.status === "success") {
                setMyTeachers(data.data);

                // --- LOGICA AUTO-SELEZIONE ---
                if (data.data && data.data.length === 1) {
                    const onlyTeacherId = data.data[0].teacherId || data.data[0].teacherName;
                    setSelectedTeacherId(onlyTeacherId);
                    // Non settiamo setLoading(false) qui perché partirà subito loadTeacherSchedule
                }
            } else if (data.message?.includes("autorizzato")) {
                navigate('/login');
            }
        } catch (e) {
            console.error("Errore caricamento docenti:", e);
        } finally {
            setLoading(false);
        }
    }, [navigate, getAuthToken]);

    // 2. Carica l'agenda (si attiva quando cambia selectedTeacherId)
    const loadTeacherSchedule = useCallback(async () => {
        if (!selectedTeacherId) return;

        const token = getAuthToken();
        if (!token) return;

        setLoadingSchedule(true);
        try {
            const url = `${APPS_SCRIPT_URL}?action=getStudentPersonalSchedule` +
                `&teacherId=${encodeURIComponent(selectedTeacherId)}` +
                `&token=${token}`;

            const res = await fetch(url);
            const data = await res.json();

            if (data.status === "success") {
                setSchedule(data.data);
            }
        } catch (e) {
            console.error("Errore caricamento orario:", e);
        } finally {
            setLoadingSchedule(false);
        }
    }, [selectedTeacherId, getAuthToken]);

    useEffect(() => { loadMyTeachers(); }, [loadMyTeachers]);
    useEffect(() => { loadTeacherSchedule(); }, [loadTeacherSchedule]);

    return (
        <Box sx={{ p: isMobile ? 2 : 3, maxWidth: 650, mx: 'auto', bgcolor: '#f8f9fa', minHeight: '100vh' }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
                <IconButton onClick={() => navigate(-1)}><ArrowBackIcon /></IconButton>
                <Typography variant="h5" fontWeight="bold">Il Mio Orario</Typography>
            </Stack>

            {/* Mostriamo la tendina solo se c'è più di un insegnante */}
            {myTeachers.length > 1 && (
                <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 4, border: '1px solid #e0e0e0' }}>
                    <FormControl fullWidth>
                        <InputLabel>Insegnante</InputLabel>
                        <Select
                            value={selectedTeacherId}
                            label="Insegnante"
                            onChange={(e) => setSelectedTeacherId(e.target.value)}
                        >
                            {myTeachers.map((t, idx) => (
                                <MenuItem key={idx} value={t.teacherId || t.teacherName}>
                                    Prof. {t.teacherName}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Paper>
            )}

            {/* Se lo studente ha un solo docente, mostriamo un piccolo badge informativo */}
            {myTeachers.length === 1 && !loading && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, ml: 1 }}>
                    Orario lezioni con: <b>Prof. {myTeachers[0].teacherName}</b>
                </Typography>
            )}

            {/* Area di Caricamento o Risultati */}
            {(loading || loadingSchedule) ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 10, gap: 2 }}>
                    <CircularProgress size={50} thickness={4} />
                    <Typography color="text.secondary">Caricamento in corso...</Typography>
                </Box>
            ) : (
                <Box>
                    {giorni.map((giorno, dayIdx) => {
                        const daySlots = schedule.filter(s => s.giorno === giorno);
                        if (daySlots.length === 0) return null;

                        return (
                            <Box key={giorno} sx={{ mb: 4 }}>
                                <Typography variant="h6" color="primary" fontWeight="bold" sx={{ mb: 2, ml: 1 }}>
                                    {giorno}
                                </Typography>
                                <Stack spacing={1.5}>
                                    {daySlots.map((slot, idx) => (
                                        <Zoom in={true} style={{ transitionDelay: `${idx * 100}ms` }} key={idx}>
                                            <Card elevation={0} sx={{ p: 2, borderRadius: 4, display: 'flex', alignItems: 'center', border: '1px solid #e0e0e0' }}>
                                                <Typography sx={{ minWidth: 80, fontWeight: '800' }}>{slot.ora}</Typography>
                                                <Box sx={{ flexGrow: 1, textAlign: 'right' }}>
                                                    <Chip label="Lezione Confermata" color="success" size="small" variant="outlined" sx={{ fontWeight: 'bold' }} />
                                                </Box>
                                            </Card>
                                        </Zoom>
                                    ))}
                                </Stack>
                            </Box>
                        );
                    })}

                    {selectedTeacherId && schedule.length === 0 && !loadingSchedule && (
                        <Typography textAlign="center" color="text.secondary" sx={{ mt: 10 }}>
                            Nessuna lezione trovata.
                        </Typography>
                    )}
                </Box>
            )}
        </Box>
    );
}