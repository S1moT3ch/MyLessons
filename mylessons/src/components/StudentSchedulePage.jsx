import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, CircularProgress, IconButton,
    Card, Stack, FormControl, InputLabel,
    Select, MenuItem, Paper, useMediaQuery, useTheme,
    ToggleButton, ToggleButtonGroup
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import TouchAppIcon from '@mui/icons-material/TouchApp';
import { useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';
import { APPS_SCRIPT_URL } from "./config/config";

// Funzione per generare colori coerenti basati sul nome dell'insegnante
const getTeacherColor = (name) => {
    if (!name) return '#757575';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    // Usiamo saturazione e luminosità fisse per garantire la leggibilità
    return `hsl(${Math.abs(hash % 360)}, 70%, 40%)`;
};

export default function StudentSchedulePage() {
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const [loadingAnagrafica, setLoadingAnagrafica] = useState(true);
    const [loadingSchedule, setLoadingSchedule] = useState(false);
    const [viewMode, setViewMode] = useState('single');
    const [myTeachers, setMyTeachers] = useState([]);
    const [selectedTeacherName, setSelectedTeacherName] = useState('');
    const [schedule, setSchedule] = useState([]);

    const giorni = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

    const getAuthToken = useCallback(() => {
        const sessionStr = Cookies.get('user_session');
        if (!sessionStr) return null;
        try { return JSON.parse(sessionStr).id_token; } catch (e) { return null; }
    }, []);

    useEffect(() => {
        const loadInitialData = async () => {
            const token = getAuthToken();
            if (!token) return navigate('/login');
            try {
                const res = await fetch(`${APPS_SCRIPT_URL}?action=getMySubscriptions&token=${token}`);
                const data = await res.json();
                if (data.status === "success") {
                    setMyTeachers(data.data);
                    if (data.data.length === 1) {
                        setSelectedTeacherName(data.data[0].teacherName);
                    }
                }
            } catch (e) { console.error(e); }
            finally { setLoadingAnagrafica(false); }
        };
        loadInitialData();
    }, [navigate, getAuthToken]);

    const loadScheduleData = useCallback(async () => {
        const token = getAuthToken();
        if (!token) return;

        if (viewMode === 'single' && !selectedTeacherName) {
            setSchedule([]);
            return;
        }

        setLoadingSchedule(true);
        try {
            const res = await fetch(`${APPS_SCRIPT_URL}?action=getStudentPersonalSchedule&token=${token}`);
            const data = await res.json();

            if (data.status === "success") {
                let rawData = data.data;
                if (viewMode === 'single' && selectedTeacherName) {
                    rawData = rawData.filter(slot => slot.teacherName === selectedTeacherName);
                }
                setSchedule(rawData);
            }
        } catch (e) { console.error(e); }
        finally { setLoadingSchedule(false); }
    }, [viewMode, selectedTeacherName, getAuthToken]);

    useEffect(() => {
        if (!loadingAnagrafica) loadScheduleData();
    }, [viewMode, selectedTeacherName, loadScheduleData, loadingAnagrafica]);

    return (
        <Box sx={{ p: isMobile ? 2 : 3, pb: 10, maxWidth: 650, mx: 'auto', bgcolor: '#f8f9fa', minHeight: '100vh' }}>

            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                    <IconButton onClick={() => navigate(-1)}><ArrowBackIcon /></IconButton>
                    <Typography variant="h5" fontWeight="bold">Il Mio Orario</Typography>
                </Stack>

                {myTeachers.length > 1 && (
                    <ToggleButtonGroup
                        value={viewMode}
                        exclusive
                        onChange={(e, val) => val && setViewMode(val)}
                        size="small"
                        color="primary"
                        sx={{ bgcolor: 'white' }}
                    >
                        <ToggleButton value="single" sx={{ px: 2 }}>Singolo</ToggleButton>
                        <ToggleButton value="all" sx={{ px: 2 }}>Totale</ToggleButton>
                    </ToggleButtonGroup>
                )}
            </Stack>

            {viewMode === 'single' && myTeachers.length > 1 && (
                <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 4, border: '1px solid #e0e0e0' }}>
                    <FormControl fullWidth>
                        <InputLabel>Seleziona Insegnante</InputLabel>
                        <Select
                            value={selectedTeacherName}
                            label="Seleziona Insegnante"
                            onChange={(e) => setSelectedTeacherName(e.target.value)}
                        >
                            {myTeachers.map((t, idx) => (
                                <MenuItem key={idx} value={t.teacherName}>Prof. {t.teacherName}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Paper>
            )}

            {(loadingAnagrafica || loadingSchedule) ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 10, gap: 2 }}>
                    <CircularProgress size={40} />
                    <Typography color="text.secondary" variant="body2">Aggiornamento agenda...</Typography>
                </Box>
            ) : (
                <Box>
                    {viewMode === 'single' && !selectedTeacherName ? (
                        <Box sx={{ mt: 8, textAlign: 'center', p: 4 }}>
                            <TouchAppIcon sx={{ fontSize: 60, color: 'primary.light', mb: 2, opacity: 0.5 }} />
                            <Typography variant="body1" color="text.secondary">
                                Seleziona un insegnante per vedere il tuo programma.
                            </Typography>
                        </Box>
                    ) : (
                        <Box>
                            {giorni.map((giorno) => {
                                const daySlots = schedule
                                    .filter(s => s.giorno === giorno)
                                    .sort((a, b) => a.ora.localeCompare(b.ora));

                                if (daySlots.length === 0) return null;

                                return (
                                    <Box key={giorno} sx={{ mb: 4 }}>
                                        <Typography variant="subtitle2" color="primary" fontWeight="900" sx={{ mb: 1.5, ml: 1, textTransform: 'uppercase' }}>
                                            {giorno}
                                        </Typography>
                                        <Stack spacing={1.5}>
                                            {daySlots.map((slot, idx) => {
                                                const teacherCol = getTeacherColor(slot.teacherName);
                                                return (
                                                    <Card key={idx} elevation={0} sx={{
                                                        borderRadius: 4, display: 'flex', alignItems: 'center',
                                                        border: '1px solid #e0e0e0', bgcolor: 'white',
                                                        overflow: 'hidden', // Per contenere la barra laterale
                                                        position: 'relative'
                                                    }}>
                                                        {/* Barra laterale colorata (sempre visibile per design coerente) */}
                                                        <Box sx={{ width: 6, height: '100%', bgcolor: teacherCol, position: 'absolute', left: 0 }} />

                                                        <Box sx={{ p: 2, pl: 3, display: 'flex', alignItems: 'center', width: '100%' }}>
                                                            <Typography sx={{ minWidth: 70, fontWeight: '800', borderRight: '2px solid #f0f0f0', mr: 2 }}>
                                                                {slot.ora}
                                                            </Typography>

                                                            <Box sx={{ flexGrow: 1 }}>
                                                                {/* Nome Insegnante: Sempre visibile in Vista Totale, nascosto in Vista Singola */}
                                                                {viewMode === 'all' && (
                                                                    <Typography variant="body2" fontWeight="bold" sx={{ color: teacherCol, mb: 0.3 }}>
                                                                        Prof. {slot.teacherName}
                                                                    </Typography>
                                                                )}
                                                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                                                    Lezione confermata
                                                                </Typography>
                                                            </Box>

                                                            {/* Pallino decorativo a destra */}
                                                            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: teacherCol }} />
                                                        </Box>
                                                    </Card>
                                                );
                                            })}
                                        </Stack>
                                    </Box>
                                );
                            })}
                        </Box>
                    )}
                </Box>
            )}
        </Box>
    );
}