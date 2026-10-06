import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, CircularProgress, IconButton,
    Card, Stack, FormControl, InputLabel, Select, MenuItem,
    useTheme, useMediaQuery, Chip, Alert, Paper,
    ToggleButton, ToggleButtonGroup, Button, Dialog,
    DialogTitle, DialogContent, DialogActions, TextField,
    Fade, Divider
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import TouchAppIcon from '@mui/icons-material/TouchApp';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';
import { APPS_SCRIPT_URL, broadcastSync, onSync } from "./config/config";

// --- ANIMAZIONI CSS ---
const pulseAnimation = {
    '@keyframes pulse-border': {
        '0%': { boxShadow: '0 0 0 0px rgba(255, 152, 0, 0.4)' },
        '70%': { boxShadow: '0 0 0 10px rgba(255, 152, 0, 0)' },
        '100%': { boxShadow: '0 0 0 0px rgba(255, 152, 0, 0)' },
    }
};

const getTeacherColor = (name) => {
    if (!name) return '#757575';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
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

    const [feedbackDialog, setFeedbackDialog] = useState({ open: false, slot: null });
    const [choice, setChoice] = useState(null);
    const [note, setNote] = useState("");
    const [sendingFeedback, setSendingFeedback] = useState(false);

    const [prefGiorno, setPrefGiorno] = useState("");
    const [prefOra, setPrefOra] = useState("");

    const giorni = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

    const getAuthToken = useCallback(() => {
        const sessionStr = Cookies.get('user_session');
        if (!sessionStr) return null;
        try { return JSON.parse(sessionStr).id_token; } catch (e) { return null; }
    }, []);

    const getStudentEmail = useCallback(() => {
        const sessionStr = Cookies.get('user_session');
        if (!sessionStr) return null;
        try { return JSON.parse(sessionStr).email; } catch (e) { return null; }
    }, []);

    const loadScheduleData = useCallback(async (isSilent = false) => {
        const token = getAuthToken();
        if (!token) { navigate('/login'); return; }
        if (viewMode === 'single' && !selectedTeacherName) { setSchedule([]); return; }

        if (!isSilent) setLoadingSchedule(true);
        try {
            const res = await fetch(`${APPS_SCRIPT_URL}?action=getStudentPersonalSchedule&token=${token}&_t=${Date.now()}`);
            const data = await res.json();
            if (data.status === "success") {
                let rawData = data.data;
                if (viewMode === 'single' && selectedTeacherName) {
                    rawData = rawData.filter(slot => slot.teacherName === selectedTeacherName);
                }
                const uniqueSlots = [];
                const seenKeys = new Set();
                for (const item of rawData) {
                    const k = `${item.teacherName || ''}-${item.giorno}-${item.ora}`;
                    if (!seenKeys.has(k)) {
                        seenKeys.add(k);
                        uniqueSlots.push(item);
                    }
                }
                setSchedule(uniqueSlots);
            }
        } catch (e) {
            console.error("Errore caricamento orario studente:", e);
        } finally {
            if (!isSilent) setLoadingSchedule(false);
        }
    }, [viewMode, selectedTeacherName, getAuthToken, navigate]);

    useEffect(() => {
        const loadInitialData = async () => {
            const token = getAuthToken();
            if (!token) return navigate('/login');
            try {
                const res = await fetch(`${APPS_SCRIPT_URL}?action=getMySubscriptions&token=${token}&_t=${Date.now()}`);
                const data = await res.json();
                if (data.status === "success") {
                    setMyTeachers(data.data);
                    if (data.data.length === 1) setSelectedTeacherName(data.data[0].teacherName);
                }
            } catch (e) { console.error(e); }
            finally { setLoadingAnagrafica(false); }
        };
        loadInitialData();
    }, [navigate, getAuthToken]);

    useEffect(() => {
        if (!loadingAnagrafica) loadScheduleData();
    }, [viewMode, selectedTeacherName, loadScheduleData, loadingAnagrafica]);

    // --- AGGIORNAMENTO ISTANTANEO IN BACKGROUND E REAL-TIME SYNC ---
    useEffect(() => {
        // 1. Ascolto sincrono tramite BroadcastChannel tra schede del browser
        const unsub = onSync(() => {
            loadScheduleData(true);
        });

        // 2. Polling silente ogni 12 secondi quando la scheda è attiva
        const timerId = setInterval(() => {
            if (document.visibilityState === 'visible') {
                loadScheduleData(true);
            }
        }, 25000);

        // 3. Refresh automatico al ritorno sul tab (senza ricaricare la pagina)
        const handleFocus = () => {
            loadScheduleData(true);
        };
        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') handleFocus();
        });

        return () => {
            unsub();
            clearInterval(timerId);
            window.removeEventListener('focus', handleFocus);
        };
    }, [loadScheduleData]);

    const handleOpenFeedbackDialog = (slot) => {
        const currentFb = slot.feedbacks && slot.feedbacks[0];
        if (currentFb) {
            if (currentFb.status === "Confermata") {
                setChoice('SI');
            } else if (currentFb.status === "Assente") {
                setChoice('NO');
            } else {
                setChoice(null);
            }
            setNote(currentFb.note || "");
            if (currentFb.preferenza) {
                const parts = currentFb.preferenza.split(" ");
                setPrefGiorno(parts[0] || "");
                setPrefOra(parts[1] || "");
            } else {
                setPrefGiorno("");
                setPrefOra("");
            }
        } else {
            setChoice(null);
            setNote("");
            setPrefGiorno("");
            setPrefOra("");
        }
        setFeedbackDialog({ open: true, slot });
    };

    const handleSendFeedback = async () => {
        const token = getAuthToken();
        const email = getStudentEmail();
        if (!token || !feedbackDialog.slot || !choice) return;

        setSendingFeedback(true);
        const status = choice === 'SI' ? "Confermata" : "Assente";

        const preferenzaString = (prefGiorno || prefOra)
            ? `${prefGiorno} ${prefOra}`.trim()
            : "";

        const targetSlot = feedbackDialog.slot;

        // 1. Aggiornamento Ottimistico Immediato (0ms di attesa sulla UI)
        setSchedule(prev => prev.map(s => {
            if (s.giorno === targetSlot.giorno && s.ora === targetSlot.ora && s.teacherName === targetSlot.teacherName) {
                return {
                    ...s,
                    feedbacks: [{
                        status: status,
                        note: note,
                        preferenza: preferenzaString
                    }]
                };
            }
            return s;
        }));

        handleCloseDialog();
        broadcastSync('FEEDBACK_UPDATED', { email, teacher: targetSlot.teacherName });

        // 2. Chiamata server in background
        try {
            const response = await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: "updateStudentFeedback",
                    id_token: token,
                    studentEmail: email,
                    teacherName: targetSlot.teacherName,
                    giorno: targetSlot.giorno,
                    ora: targetSlot.ora,
                    status: status,
                    note: note,
                    preferenza: preferenzaString
                })
            });

            if (response.ok) {
                const result = await response.text();
                if (result.toLowerCase().includes("success")) {
                    await loadScheduleData(true);
                } else {
                    console.warn("Attenzione risposta salvataggio:", result);
                }
            }
        } catch (e) {
            console.error("Errore salvataggio feedback:", e);
        } finally {
            setSendingFeedback(false);
        }
    };

    const handleCloseDialog = () => {
        setFeedbackDialog({ open: false, slot: null });
        setChoice(null);
        setNote("");
        setPrefGiorno("");
        setPrefOra("");
        setSendingFeedback(false);
    };

    const formatTimeInput = (value) => {
        const numbers = value.replace(/[^0-9]/g, '');
        const trimmed = numbers.substring(0, 4);
        if (trimmed.length >= 3) {
            return `${trimmed.slice(0, 2)}:${trimmed.slice(2)}`;
        }
        return trimmed;
    };

    const currentSlotFb = feedbackDialog.slot?.feedbacks ? feedbackDialog.slot.feedbacks[0] : null;
    const isAlreadyConfirmed = currentSlotFb?.status === "Confermata";
    const isAlreadyAbsent = currentSlotFb?.status === "Assente";

    return (
        <Box sx={{ p: isMobile ? 2 : 3, pb: 10, maxWidth: 650, mx: 'auto', bgcolor: '#f8f9fa', minHeight: '100vh', ...pulseAnimation }}>

            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                    <IconButton onClick={() => navigate(-1)}><ArrowBackIcon /></IconButton>
                    <Typography variant="h5" fontWeight="900">Il Mio Orario</Typography>
                </Stack>
                {myTeachers.length > 1 && (
                    <ToggleButtonGroup
                        value={viewMode}
                        exclusive
                        onChange={(e, val) => val && setViewMode(val)}
                        size="small"
                        color="primary"
                    >
                        <ToggleButton value="single" sx={{ fontWeight: 'bold' }}>Singolo</ToggleButton>
                        <ToggleButton value="all" sx={{ fontWeight: 'bold' }}>Totale</ToggleButton>
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

            {loadingSchedule ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>
            ) : (
                <Box>
                    {giorni.map((giorno) => {
                        const daySlots = schedule.filter(s => s.giorno === giorno);
                        if (daySlots.length === 0) return null;

                        return (
                            <Box key={giorno} sx={{ mb: 4 }}>
                                <Typography variant="subtitle2" color="primary" fontWeight="900" sx={{ mb: 1.5, ml: 1, textTransform: 'uppercase' }}>{giorno}</Typography>
                                <Stack spacing={1.5}>
                                    {daySlots.map((slot, idx) => {
                                        const teacherCol = getTeacherColor(slot.teacherName);
                                        const fb = slot.feedbacks ? slot.feedbacks[0] : { status: "In attesa" };
                                        const isInAttesa = !fb.status || fb.status === "In attesa";
                                        const isConfermata = fb.status === "Confermata";
                                        const isAssente = fb.status === "Assente";

                                        return (
                                            <Card
                                                key={idx}
                                                elevation={isInAttesa ? 3 : 0}
                                                onClick={() => handleOpenFeedbackDialog(slot)}
                                                sx={{
                                                    borderRadius: 4, display: 'flex', alignItems: 'center',
                                                    border: '2px solid',
                                                    borderColor: isConfermata ? '#4caf50' : isAssente ? '#f44336' : '#ff9800',
                                                    bgcolor: isConfermata ? '#f8fdf8' : isAssente ? '#fff9f9' : 'white',
                                                    cursor: 'pointer', position: 'relative', overflow: 'hidden',
                                                    transition: 'all 0.25s ease',
                                                    animation: isInAttesa ? 'pulse-border 2.5s infinite' : 'none',
                                                    '&:hover': { transform: 'translateY(-2px)', boxShadow: 2 },
                                                    '&:active': { transform: 'scale(0.99)' }
                                                }}
                                            >
                                                <Box sx={{ width: 8, height: '100%', bgcolor: teacherCol, position: 'absolute', left: 0 }} />
                                                <Box sx={{ p: 2, pl: 3, display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
                                                    <Stack direction="row" alignItems="center" spacing={2}>
                                                        <Typography sx={{ minWidth: 60, fontWeight: '900', fontSize: '1.15rem', color: isConfermata ? '#2e7d32' : isAssente ? '#c62828' : 'primary.main' }}>
                                                            {slot.ora}
                                                        </Typography>
                                                        <Divider orientation="vertical" flexItem sx={{ borderRightWidth: 2 }} />
                                                        <Box>
                                                            {viewMode === 'all' && (
                                                                <Typography variant="caption" fontWeight="900" sx={{ color: teacherCol, display: 'block', mb: 0.2 }}>
                                                                    PROF. {slot.teacherName.toUpperCase()}
                                                                </Typography>
                                                            )}
                                                            <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.2 }}>
                                                                {isConfermata && (
                                                                    <Chip
                                                                        icon={<CheckCircleIcon sx={{ '&&': { color: '#2e7d32' }, fontSize: 16 }} />}
                                                                        label="CONFERMATA"
                                                                        color="success"
                                                                        size="small"
                                                                        sx={{ fontWeight: '900', fontSize: '0.75rem', height: 24, bgcolor: '#e8f5e9', color: '#1b5e20', border: '1px solid #a5d6a7' }}
                                                                    />
                                                                )}
                                                                {isAssente && (
                                                                    <Chip
                                                                        icon={<CancelIcon sx={{ '&&': { color: '#c62828' }, fontSize: 16 }} />}
                                                                        label="ASSENTE"
                                                                        color="error"
                                                                        size="small"
                                                                        sx={{ fontWeight: '900', fontSize: '0.75rem', height: 24, bgcolor: '#ffebee', color: '#b71c1c', border: '1px solid #ef9a9a' }}
                                                                    />
                                                                )}
                                                                {isInAttesa && (
                                                                    <Chip
                                                                        icon={<TouchAppIcon sx={{ '&&': { color: '#e65100' }, fontSize: 16 }} />}
                                                                        label="DA CONFERMARE"
                                                                        size="small"
                                                                        sx={{ fontWeight: '900', fontSize: '0.75rem', height: 24, bgcolor: '#fff3e0', color: '#e65100', border: '1px solid #ffcc80' }}
                                                                    />
                                                                )}
                                                            </Stack>

                                                            {/* SEZIONE DETTAGLI STATO */}
                                                            {isConfermata && (
                                                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, fontWeight: '500' }}>
                                                                    Presenza confermata per questa lezione
                                                                </Typography>
                                                            )}
                                                            {isAssente && (
                                                                <Box sx={{ mt: 0.5 }}>
                                                                    {fb.preferenza && (
                                                                        <Typography variant="caption" sx={{ display: 'block', fontWeight: '900', color: 'primary.main', lineHeight: 1.1 }}>
                                                                            RECUPERO RICHIESTO: {fb.preferenza}
                                                                        </Typography>
                                                                    )}
                                                                    {fb.note && (
                                                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontStyle: 'italic', lineHeight: 1.2 }}>
                                                                            "{fb.note}"
                                                                        </Typography>
                                                                    )}
                                                                </Box>
                                                            )}
                                                            {isInAttesa && (
                                                                <Typography variant="caption" color="warning.dark" fontWeight="700" sx={{ display: 'block', mt: 0.5 }}>
                                                                    Tocca per confermare
                                                                </Typography>
                                                            )}
                                                        </Box>
                                                    </Stack>

                                                    <Stack direction="row" alignItems="center" spacing={1}>
                                                        <TouchAppIcon color={isInAttesa ? "warning" : "disabled"} sx={{ fontSize: 26, opacity: isInAttesa ? 1 : 0.4 }} />
                                                    </Stack>
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

            <Dialog
                open={feedbackDialog.open}
                onClose={handleCloseDialog}
                fullWidth maxWidth="xs"
                PaperProps={{ sx: { borderRadius: 5, p: 1 } }}
            >
                <DialogTitle sx={{ fontWeight: '900', textAlign: 'center' }}>
                    Stato Appuntamento
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body1" textAlign="center" fontWeight="800" color="primary.main" sx={{ mb: 2 }}>
                        {feedbackDialog.slot?.giorno} ore {feedbackDialog.slot?.ora}
                    </Typography>

                    {isAlreadyConfirmed && (
                        <Alert severity="success" sx={{ mb: 2.5, borderRadius: 3, fontWeight: 'bold' }}>
                            Hai già CONFERMATO la tua presenza! Se hai avuto un imprevisto, puoi modificare qui sotto.
                        </Alert>
                    )}
                    {isAlreadyAbsent && (
                        <Alert severity="error" sx={{ mb: 2.5, borderRadius: 3, fontWeight: 'bold' }}>
                            Hai segnalato che SARAI ASSENTE. Se sei di nuovo disponibile, puoi confermare la tua presenza.
                        </Alert>
                    )}
                    {!isAlreadyConfirmed && !isAlreadyAbsent && (
                        <Alert severity="info" sx={{ mb: 2.5, borderRadius: 3 }}>
                            Conferma se sarai presente a questa lezione.
                        </Alert>
                    )}

                    <Stack direction="row" spacing={1.5} justifyContent="center" sx={{ mb: 2.5 }}>
                        <Button
                            variant={choice === 'SI' ? "contained" : "outlined"}
                            color="success"
                            onClick={() => setChoice('SI')}
                            startIcon={<CheckIcon />}
                            sx={{
                                borderRadius: 4,
                                flex: 1,
                                py: 1.5,
                                px: 1,
                                fontWeight: 'bold',
                                fontSize: '0.8rem',
                                lineHeight: 1.2,
                                whiteSpace: 'normal',
                                textAlign: 'center',
                                minHeight: 60
                            }}
                            disabled={sendingFeedback}
                        >
                            {choice === 'SI' ? "CONFERMATO (SI)" : "Confermo"}
                        </Button>

                        <Button
                            variant={choice === 'NO' ? "contained" : "outlined"}
                            color="error"
                            onClick={() => setChoice('NO')}
                            startIcon={<CloseIcon />}
                            sx={{
                                borderRadius: 4,
                                flex: 1,
                                py: 1.5,
                                px: 1,
                                fontWeight: 'bold',
                                fontSize: '0.8rem',
                                lineHeight: 1.2,
                                whiteSpace: 'normal',
                                textAlign: 'center',
                                minHeight: 60
                            }}
                            disabled={sendingFeedback}
                        >
                            {choice === 'NO' ? "ASSENTE (NO)" : "Non Posso"}
                        </Button>
                    </Stack>

                    <Fade in={choice === 'NO'} unmountOnExit>
                        <Box sx={{ mt: 2 }}>
                            <Typography variant="caption" fontWeight="900" color="primary" sx={{ mb: 1, display: 'block', textTransform: 'uppercase' }}>
                                Proponi un'alternativa di recupero
                            </Typography>

                            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Giorno</InputLabel>
                                    <Select
                                        value={prefGiorno}
                                        label="Giorno"
                                        onChange={(e) => setPrefGiorno(e.target.value)}
                                        sx={{ borderRadius: 3, bgcolor: 'white' }}
                                    >
                                        {giorni.map(g => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                                    </Select>
                                </FormControl>

                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Ora (es. 17:00)"
                                    value={prefOra}
                                    placeholder="17:00"
                                    onChange={(e) => setPrefOra(formatTimeInput(e.target.value))}
                                    inputProps={{ inputMode: 'numeric', pattern: '[0-9:]*' }}
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: 3,
                                            bgcolor: 'white'
                                        }
                                    }}
                                />
                            </Stack>

                            <TextField
                                fullWidth
                                multiline
                                rows={3}
                                placeholder="Motivo o nota (opzionale)..."
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                variant="filled"
                                sx={{ bgcolor: '#fff5f5', borderRadius: 3, overflow: 'hidden' }}
                            />
                        </Box>
                    </Fade>
                </DialogContent>
                <DialogActions sx={{ p: 2, pt: 0 }}>
                    <Button
                        fullWidth
                        variant="contained"
                        color="primary"
                        onClick={handleSendFeedback}
                        disabled={!choice || sendingFeedback}
                        sx={{ borderRadius: 4, py: 1.5, fontWeight: '900', boxShadow: 3 }}
                    >
                        {sendingFeedback ? <CircularProgress size={24} color="inherit" /> : "SALVA E CONFERMA"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
