import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, CircularProgress, IconButton,
    Card, Stack, Chip, FormControl, InputLabel,
    Select, MenuItem, Paper, useMediaQuery, useTheme
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie'; // Importante per recuperare il token
import { APPS_SCRIPT_URL } from "./config/config";

export default function StudentSchedulePage() {
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const [loading, setLoading] = useState(false);
    const [myTeachers, setMyTeachers] = useState([]);
    const [selectedTeacherId, setSelectedTeacherId] = useState('');
    const [schedule, setSchedule] = useState([]);

    const giorni = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

    // Funzione helper per recuperare il token dai cookie
    const getAuthToken = () => {
        const sessionStr = Cookies.get('user_session');
        if (!sessionStr) return null;
        const session = JSON.parse(sessionStr);
        return session.id_token; // Assicurati che LoginPage salvi l'id_token qui
    };

    // 1. Carica gli insegnanti (protetto da token)
    const loadMyTeachers = useCallback(async () => {
        const token = getAuthToken();
        if (!token) return navigate('/login');

        setLoading(true);
        try {
            // Inviamo il token come parametro
            const res = await fetch(`${APPS_SCRIPT_URL}?action=getMySubscriptions&token=${token}`);
            const data = await res.json();

            if (data.status === "success") {
                setMyTeachers(data.data);
                if (data.data.length === 1) {
                    setSelectedTeacherId(data.data[0].teacherId || data.data[0].teacherName);
                }
            } else if (data.message?.includes("autorizzato")) {
                navigate('/login'); // Sessione scaduta lato Google
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [navigate]);

    // 2. Carica l'agenda personale (protetto da token)
    const loadTeacherSchedule = useCallback(async () => {
        if (!selectedTeacherId) return;
        const token = getAuthToken();

        setLoading(true);
        try {
            // Notare che non inviamo più l'email dello studente!
            // Il backend la scoprirà dal token.
            const url = `${APPS_SCRIPT_URL}?action=getStudentPersonalSchedule` +
                `&teacherId=${selectedTeacherId}` +
                `&token=${token}`;

            const res = await fetch(url);
            const data = await res.json();

            if (data.status === "success") {
                setSchedule(data.data);
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [selectedTeacherId]);

    useEffect(() => { loadMyTeachers(); }, [loadMyTeachers]);
    useEffect(() => { loadTeacherSchedule(); }, [loadTeacherSchedule]);

    return (
        <Box sx={{ p: isMobile ? 2 : 3, maxWidth: 650, mx: 'auto', bgcolor: '#f8f9fa', minHeight: '100vh' }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
                <IconButton onClick={() => navigate(-1)}><ArrowBackIcon /></IconButton>
                <Typography variant="h5" fontWeight="bold">Il Mio Orario</Typography>
            </Stack>

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

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 5 }}><CircularProgress /></Box>
            ) : (
                <Box>
                    {giorni.map(giorno => {
                        const daySlots = schedule.filter(s => s.giorno === giorno);
                        if (daySlots.length === 0) return null;

                        return (
                            <Box key={giorno} sx={{ mb: 4 }}>
                                <Typography variant="h6" color="primary" fontWeight="bold" sx={{ mb: 2, ml: 1 }}>{giorno}</Typography>
                                <Stack spacing={1.5}>
                                    {daySlots.map((slot, idx) => (
                                        <Card key={idx} elevation={0} sx={{ p: 2, borderRadius: 4, display: 'flex', alignItems: 'center', border: '1px solid #e0e0e0' }}>
                                            <Typography sx={{ minWidth: 80, fontWeight: '800' }}>{slot.ora}</Typography>
                                            <Box sx={{ flexGrow: 1, textAlign: 'right' }}>
                                                <Chip label="Lezione Confermata" color="success" size="small" variant="outlined" />
                                            </Box>
                                        </Card>
                                    ))}
                                </Stack>
                            </Box>
                        );
                    })}
                    {selectedTeacherId && schedule.length === 0 && !loading && (
                        <Typography textAlign="center" color="text.secondary" sx={{ mt: 5 }}>Nessuna lezione trovata.</Typography>
                    )}
                </Box>
            )}
        </Box>
    );
}