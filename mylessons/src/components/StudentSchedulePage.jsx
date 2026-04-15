import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, CircularProgress, IconButton,
    Card, Stack, FormControl, InputLabel,
    Select, MenuItem, Paper, useMediaQuery, useTheme,
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
import { APPS_SCRIPT_URL } from "./config/config";

// --- ANIMAZIONI CSS ---
const pulseAnimation = {
    '@keyframes pulse-border': {
        '0%': { boxShadow: '0 0 0 0px rgba(25, 118, 210, 0.4)' },
        '70%': { boxShadow: '0 0 0 10px rgba(25, 118, 210, 0)' },
        '100%': { boxShadow: '0 0 0 0px rgba(25, 118, 210, 0)' },
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

    const loadScheduleData = useCallback(async () => {
        const token = getAuthToken();
        if (!token) { navigate('/login'); return; }
        if (viewMode === 'single' && !selectedTeacherName) { setSchedule([]); return; }

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
    }, [viewMode, selectedTeacherName, getAuthToken, navigate]);

    useEffect(() => {
        const loadInitialData = async () => {
            const token = getAuthToken();
            if (!token) return navigate('/login');
            try {
                const res = await fetch(`${APPS_SCRIPT_URL}?action=getMySubscriptions&token=${token}`);
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

    const handleSendFeedback = async () => {
        const token = getAuthToken();
        const email = getStudentEmail();
        if (!token || !feedbackDialog.slot || !choice) return;

        setSendingFeedback(true);
        const status = choice === 'SI' ? "Confermata" : "Assente";

        // Prepariamo la stringa di preferenza se lo studente ha indicato qualcosa
        const preferenzaString = (prefGiorno || prefOra)
            ? `${prefGiorno} ${prefOra}`.trim()
            : "";

        try {
            const response = await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: "updateStudentFeedback",
                    id_token: token,
                    studentEmail: email,
                    teacherName: feedbackDialog.slot.teacherName,
                    giorno: feedbackDialog.slot.giorno,
                    ora: feedbackDialog.slot.ora,
                    status: status,
                    note: note, // La nota ora è pulita (solo il messaggio)
                    preferenza: preferenzaString // Nuovo campo dedicato
                })
            });

            if (response.ok) {
                const result = await response.text();
                if (result.toLowerCase().includes("success")) {
                    await loadScheduleData();
                    handleCloseDialog();
                    // Reset dei campi preferenza
                    setPrefGiorno("");
                    setPrefOra("");
                } else {
                    alert("Attenzione: " + result);
                    setSendingFeedback(false);
                }
            }
        } catch (e) {
            console.error("Errore:", e);
            setSendingFeedback(false);
        }
    };

    const handleCloseDialog = () => {
        setFeedbackDialog({ open: false, slot: null });
        setChoice(null);
        setNote("");
        setPrefGiorno(""); // Reset giorno preferito
        setPrefOra("");    // Reset ora preferita
        setSendingFeedback(false);
    };

    const formatTimeInput = (value) => {
        // Rimuove tutto ciò che non è un numero
        const numbers = value.replace(/[^0-9]/g, '');

        // Se l'utente scrive più di 4 cifre, le tagliamo
        const trimmed = numbers.substring(0, 4);

        // Se abbiamo almeno 3 cifre, inseriamo la virgola
        if (trimmed.length >= 3) {
            return `${trimmed.slice(0, 2)}:${trimmed.slice(2)}`;
        }
        return trimmed;
    };

    return (
        <Box sx={{ p: isMobile ? 2 : 3, pb: 10, maxWidth: 650, mx: 'auto', bgcolor: '#f8f9fa', minHeight: '100vh', ...pulseAnimation }}>

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
                                        const isInAttesa = fb.status === "In attesa";
                                        const isConfermata = fb.status === "Confermata";
                                        const isAssente = fb.status === "Assente";

                                        return (
                                            <Card
                                                key={idx}
                                                elevation={isInAttesa ? 4 : 0}
                                                onClick={() => setFeedbackDialog({ open: true, slot })}
                                                sx={{
                                                    borderRadius: 4, display: 'flex', alignItems: 'center',
                                                    border: '2px solid',
                                                    borderColor: isConfermata ? '#4caf50' : isAssente ? '#f44336' : theme.palette.primary.main,
                                                    bgcolor: 'white', cursor: 'pointer', position: 'relative', overflow: 'hidden',
                                                    transition: 'all 0.3s ease',
                                                    animation: isInAttesa ? 'pulse-border 2s infinite' : 'none',
                                                    '&:active': { transform: 'scale(0.98)' }
                                                }}
                                            >
                                                <Box sx={{ width: 8, height: '100%', bgcolor: teacherCol, position: 'absolute', left: 0 }} />
                                                <Box sx={{ p: 2, pl: 3, display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
                                                    <Stack direction="row" alignItems="center" spacing={2}>
                                                        <Typography sx={{ minWidth: 60, fontWeight: '900', fontSize: '1.1rem', color: isInAttesa ? 'primary.main' : 'text.primary' }}>
                                                            {slot.ora}
                                                        </Typography>
                                                        <Divider orientation="vertical" flexItem sx={{ borderRightWidth: 2 }} />
                                                        <Box>
                                                            {viewMode === 'all' && (
                                                                <Typography variant="caption" fontWeight="bold" sx={{ color: teacherCol, display: 'block', mb: -0.5 }}>
                                                                    PROF. {slot.teacherName.toUpperCase()}
                                                                </Typography>
                                                            )}
                                                            <Box>
                                                                <Stack direction="row" alignItems="center" spacing={0.5}>
                                                                    {isConfermata && <CheckCircleIcon sx={{ fontSize: 14, color: '#4caf50' }} />}
                                                                    {isAssente && <CancelIcon sx={{ fontSize: 14, color: '#f44336' }} />}
                                                                    <Typography variant="body2" fontWeight="800" color={isConfermata ? "success.main" : isAssente ? "error.main" : "primary.main"}>
                                                                        {isInAttesa ? "Va bene questo appuntamento?" : isAssente ? "NON POSSO" : fb.status.toUpperCase()}
                                                                    </Typography>
                                                                </Stack>

                                                                {/* SEZIONE DETTAGLI RISPOSTA */}
                                                                {isAssente && (
                                                                    <Box sx={{ ml: 2.5, mt: 0.5 }}>
                                                                        {/* Rende la preferenza se esiste (Colonna D dell'Excel) */}
                                                                        {fb.preferenza && (
                                                                            <Typography variant="caption" sx={{ display: 'block', fontWeight: '900', color: 'primary.main', lineHeight: 1.1 }}>
                                                                                PROPOSTA: {fb.preferenza}
                                                                            </Typography>
                                                                        )}

                                                                        {/* Rende la nota se esiste (Colonna C dell'Excel) */}
                                                                        {fb.note && (
                                                                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontStyle: 'italic', lineHeight: 1.2 }}>
                                                                                "{fb.note}"
                                                                            </Typography>
                                                                        )}
                                                                    </Box>
                                                                )}
                                                            </Box>
                                                        </Box>
                                                    </Stack>

                                                    <Stack direction="row" alignItems="center" spacing={1}>
                                                        {isInAttesa && (
                                                            <Typography variant="caption" fontWeight="900" sx={{ bgcolor: 'primary.main', color: 'white', px: 1, py: 0.5, borderRadius: 2, display: { xs: 'none', sm: 'block' } }}>
                                                                CONFERMA ORA
                                                            </Typography>
                                                        )}
                                                        <TouchAppIcon color={isInAttesa ? "primary" : "disabled"} sx={{ fontSize: 28, opacity: isInAttesa ? 1 : 0.3 }} />
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
                    Va bene questo appuntamento?
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" textAlign="center" color="text.secondary" sx={{ mb: 3 }}>
                        {feedbackDialog.slot?.giorno} ore {feedbackDialog.slot?.ora}
                    </Typography>

                    <Stack direction="row" spacing={1.5} justifyContent="center" sx={{ mb: 2.5 }}>
                        <Button
                            variant={choice === 'SI' ? "contained" : "outlined"}
                            color="success"
                            onClick={() => setChoice('SI')}
                            startIcon={<CheckIcon />}
                            sx={{
                                borderRadius: 4,
                                flex: 1, // Divide lo spazio equamente
                                py: 1.5,
                                px: 1,   // Riduciamo il padding laterale
                                fontWeight: 'bold',
                                fontSize: '0.7rem',   // Font leggermente più piccolo
                                lineHeight: 1.2,      // Interlinea stretta per il testo su due righe
                                whiteSpace: 'normal', // <--- FONDAMENTALE: permette al testo di andare a capo
                                textAlign: 'center',
                                minHeight: 64         // Altezza minima fissa per evitare salti di layout
                            }}
                            disabled={sendingFeedback}
                        >
                            Accetto
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
                                fontSize: '0.7rem',
                                lineHeight: 1.2,
                                whiteSpace: 'normal', // <--- FONDAMENTALE
                                textAlign: 'center',
                                minHeight: 64
                            }}
                            disabled={sendingFeedback}
                        >
                            Non posso
                        </Button>
                    </Stack>

                    <Fade in={choice === 'NO'} unmountOnExit>
                        <Box sx={{ mt: 2 }}>
                            {/* Titolo Sezione Proposta */}
                            <Typography variant="caption" fontWeight="900" color="primary" sx={{ mb: 1, display: 'block', textTransform: 'uppercase' }}>
                                📅 Proponi un'alternativa
                            </Typography>

                            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                                {/* Selettore Giorno */}
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

                                {/* Input Ora */}
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Ora (es. 17.00)"
                                    value={prefOra}
                                    placeholder="17.00"
                                    // Forza la formattazione mentre l'utente scrive
                                    onChange={(e) => setPrefOra(formatTimeInput(e.target.value))}
                                    // Suggerimento: imposta il tastierino numerico su mobile
                                    inputProps={{ inputMode: 'numeric', pattern: '[0-9.]*' }}
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: 3,
                                            bgcolor: 'white'
                                        }
                                    }}
                                />
                            </Stack>

                            {/* Campo Note Originale */}
                            <TextField
                                fullWidth
                                multiline
                                rows={3}
                                placeholder="Scrivi qui il motivo dell'assenza (opzionale)..."
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
                        {sendingFeedback ? <CircularProgress size={24} color="inherit" /> : "INVIA RISPOSTA"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}