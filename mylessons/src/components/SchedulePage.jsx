import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, Paper, CircularProgress, IconButton,
    Card, Stack, Chip, Avatar, useTheme, useMediaQuery,
    ToggleButton, ToggleButtonGroup, Button, Dialog,
    DialogTitle, DialogContent, DialogActions, FormControl,
    Select, MenuItem, TextField, Fab, Zoom
} from '@mui/material';
import {
    ArrowBack as ArrowBackIcon,
    AccessTimeFilled as AccessTimeFilledIcon,
    Edit as EditIcon,
    DeleteSweep as DeleteSweepIcon,
    Save as SaveIcon,
    Refresh as RefreshIcon,
    DeleteForever as DeleteForeverIcon,
    WarningAmber as WarningAmberIcon,
    AddCircleOutline as AddCircleOutlineIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';
import { APPS_SCRIPT_URL } from "./config/config";

// Generazione colore studente per coerenza visiva
const getStudentColor = (email) => {
    if (!email) return '#9c27b0';
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
        hash = email.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 65%, 40%)`;
};

export default function SchedulePage() {
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    // localSchedules contiene la copia di lavoro dell'agenda
    const [localSchedules, setLocalSchedules] = useState([]);
    const [subscribers, setSubscribers] = useState([]);

    const [viewMode, setViewMode] = useState('giorno');
    const [filterDay, setFilterDay] = useState(
        new Date().toLocaleDateString('it-IT', { weekday: 'long' }).charAt(0).toUpperCase() +
        new Date().toLocaleDateString('it-IT', { weekday: 'long' }).slice(1)
    );

    const [editingSlot, setEditingSlot] = useState(null);
    const [openConfirmClearDay, setOpenConfirmClearDay] = useState(false);
    const [openConfirmClearWeek, setOpenConfirmClearWeek] = useState(false);
    const [openTimeDialog, setOpenTimeDialog] = useState(false);

    const [timeData, setTimeData] = useState({ old: '', new: '', index: null });

    const giorni = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

    const getAuthData = useCallback(() => {
        const sessionStr = Cookies.get('user_session');
        if (!sessionStr) return null;
        try { return JSON.parse(sessionStr); } catch (e) { return null; }
    }, []);

    // Recupero dati iniziale
    const fetchData = useCallback(async () => {
        const session = getAuthData();
        if (!session?.id_token) return navigate('/login');
        const teacherFullName = `${session.given_name} ${session.family_name}`;

        setLoading(true);
        try {
            const [resSched, resSubs] = await Promise.all([
                fetch(`${APPS_SCRIPT_URL}?action=getStudentSchedules&teacherName=${encodeURIComponent(teacherFullName)}&token=${session.id_token}`),
                fetch(`${APPS_SCRIPT_URL}?action=getTeacherSubscribers&teacherId=${session.sub}&token=${session.id_token}`)
            ]);

            const dataSched = await resSched.json();
            const dataSubs = await resSubs.json();

            if (dataSched.status === "success") {
                setLocalSchedules(dataSched.data);
            }
            if (dataSubs.status === "success") setSubscribers(dataSubs.data);
            setHasChanges(false);
        } catch (error) {
            console.error("Errore recupero dati:", error);
        } finally {
            setLoading(false);
        }
    }, [getAuthData, navigate]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Salvataggio: Il backend gestirà i +/- sui contatori basandosi sulle differenze
    const saveFullDay = async () => {
        const session = getAuthData();
        if (!session?.id_token) return navigate('/login');
        const teacherFullName = `${session.given_name} ${session.family_name}`;

        setSaving(true);
        try {
            const response = await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: "saveFullSchedule",
                    id_token: session.id_token,
                    teacherName: teacherFullName,
                    allSchedules: localSchedules
                })
            });
            const resultText = await response.text();
            if (resultText.includes("Success")) {
                setHasChanges(false);
                alert("Agenda salvata! I contatori degli studenti sono stati aggiornati.");
                fetchData(); // Ricarichiamo per sincronizzare eventuali ID o nomi aggiornati dal server
            }
        } catch (e) {
            alert("Errore di connessione durante il salvataggio.");
        } finally {
            setSaving(false);
        }
    };

    const handleAddEmptySlot = () => {
        const newSlot = { giorno: filterDay, ora: "12:00", email: "", nome: "" };
        setLocalSchedules([...localSchedules, newSlot]);
        setHasChanges(true);
    };

    // Funzione helper per ottenere le lezioni filtrate per giorno
    const getLessonsData = useCallback((targetDay) => {
        return localSchedules
            .map((slot, globalIdx) => ({ ...slot, globalIdx }))
            .filter(slot => slot.giorno === targetDay)
            .sort((a, b) => a.ora.localeCompare(b.ora));
    }, [localSchedules]);

    const handleRemoveSlotCompletely = (globalIdx) => {
        const updated = localSchedules.filter((_, idx) => idx !== globalIdx);
        setLocalSchedules(updated);
        setHasChanges(true);
    };

    const handleUpdateLocalSlot = (email, globalIdx) => {
        const student = subscribers.find(s => s.studentEmail.toLowerCase() === email.toLowerCase());
        const updated = [...localSchedules];
        updated[globalIdx] = {
            ...updated[globalIdx],
            email: email,
            nome: student ? student.studentName : (email === "" ? "" : email)
        };
        setLocalSchedules(updated);
        setHasChanges(true);
        setEditingSlot(null);
    };

    const handleClearFullDayLocal = () => {
        const updated = localSchedules.map(slot =>
            slot.giorno === filterDay ? { ...slot, email: "", nome: "" } : slot
        );
        setLocalSchedules(updated);
        setHasChanges(true);
        setOpenConfirmClearDay(false);
    };

    const handleClearEntireWeekLocal = () => {
        const updated = localSchedules.map(slot => ({ ...slot, email: "", nome: "" }));
        setLocalSchedules(updated);
        setHasChanges(true);
        setOpenConfirmClearWeek(false);
    };

    const handleUpdateLocalTime = () => {
        const updated = [...localSchedules];
        updated[timeData.index].ora = timeData.new;
        setLocalSchedules(updated);
        setHasChanges(true);
        setOpenTimeDialog(false);
    };

    return (
        <Box sx={{ p: isMobile ? 1.5 : 3, pb: isMobile ? 22 : 12, maxWidth: 650, mx: 'auto', bgcolor: '#f8f9fa', minHeight: '100vh' }}>
            {/* Header e Toggle Vista */}
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                    <IconButton onClick={() => navigate(-1)} size="large"><ArrowBackIcon /></IconButton>
                    <Typography variant="h5" fontWeight="800">Agenda</Typography>
                </Stack>
                <ToggleButtonGroup value={viewMode} exclusive onChange={(e, next) => next && setViewMode(next)} size="small">
                    <ToggleButton value="giorno">Giorno</ToggleButton>
                    <ToggleButton value="settimana">Settimana</ToggleButton>
                </ToggleButtonGroup>
            </Stack>

            {/* Chips Giorni */}
            {viewMode === 'giorno' && (
                <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', mb: 3, pb: 1 }}>
                    {giorni.map((g) => (
                        <Chip
                            key={g}
                            label={g}
                            clickable
                            color={filterDay === g ? "primary" : "default"}
                            variant={filterDay === g ? "filled" : "outlined"}
                            onClick={() => setFilterDay(g)}
                            sx={{ fontWeight: 'bold' }}
                        />
                    ))}
                </Box>
            )}

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>
            ) : (
                <Box>
                    {(viewMode === 'giorno' ? [filterDay] : giorni).map((currentDay) => {
                        const lessons = getLessonsData(currentDay);
                        if (viewMode === 'settimana' && lessons.length === 0) return null;

                        return (
                            <Box key={currentDay} sx={{ mb: 4 }}>
                                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                                    <Typography variant="overline" color="text.secondary" fontWeight="900" sx={{ ml: 1 }}>{currentDay}</Typography>
                                    {viewMode === 'giorno' && (
                                        <Button startIcon={<AddCircleOutlineIcon />} size="small" onClick={handleAddEmptySlot} sx={{ fontWeight: 'bold' }}>Nuovo Slot</Button>
                                    )}
                                </Stack>
                                <Stack spacing={1.5}>
                                    {lessons.map((slot) => {
                                        const isOccupied = slot.email !== "";
                                        const isEditing = editingSlot === `${slot.globalIdx}`;

                                        return (
                                            <Card key={slot.globalIdx} elevation={0} sx={{ borderRadius: 4, border: '1px solid', borderColor: isEditing ? 'primary.main' : '#e0e0e0' }}>
                                                <Box sx={{ display: 'flex', minHeight: 70 }}>
                                                    {/* Colonna Orario */}
                                                    <Box sx={{ p: 1, minWidth: 75, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid #eee', bgcolor: '#fafafa' }}>
                                                        <Typography variant="body2" fontWeight="800">{slot.ora}</Typography>
                                                        <IconButton size="small" onClick={() => { setTimeData({ old: slot.ora, new: slot.ora, index: slot.globalIdx }); setOpenTimeDialog(true); }}>
                                                            <AccessTimeFilledIcon sx={{ fontSize: 16 }} />
                                                        </IconButton>
                                                    </Box>

                                                    {/* Colonna Studente */}
                                                    <Box sx={{ p: 1, px: 2, flexGrow: 1, display: 'flex', alignItems: 'center' }}>
                                                        {isEditing ? (
                                                            <FormControl fullWidth size="small">
                                                                <Select
                                                                    value={slot.email || ""}
                                                                    onChange={(e) => handleUpdateLocalSlot(e.target.value, slot.globalIdx)}
                                                                >
                                                                    <MenuItem value=""><em>Libero (Rimuovi)</em></MenuItem>
                                                                    {subscribers.map((sub) => (
                                                                        <MenuItem key={sub.studentEmail} value={sub.studentEmail}>
                                                                            {sub.studentName}
                                                                        </MenuItem>
                                                                    ))}
                                                                </Select>
                                                            </FormControl>
                                                        ) : (
                                                            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ width: '100%' }}>
                                                                <Box sx={{ flexGrow: 1 }}>
                                                                    {isOccupied ? (
                                                                        <Chip
                                                                            label={slot.nome}
                                                                            avatar={<Avatar sx={{ width: 24, height: 24 }}>{slot.nome[0]}</Avatar>}
                                                                            sx={{ bgcolor: getStudentColor(slot.email), color: 'white', fontWeight: 'bold' }}
                                                                        />
                                                                    ) : (
                                                                        <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>Disponibile</Typography>
                                                                    )}
                                                                </Box>
                                                                <Stack direction="row">
                                                                    <IconButton onClick={() => setEditingSlot(`${slot.globalIdx}`)}><EditIcon fontSize="small" color="primary" /></IconButton>
                                                                    <IconButton onClick={() => handleRemoveSlotCompletely(slot.globalIdx)}><DeleteSweepIcon fontSize="small" color="error" /></IconButton>
                                                                </Stack>
                                                            </Stack>
                                                        )}
                                                    </Box>
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

            {/* Azioni Mobile */}
            <Paper elevation={10} sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, p: 2, borderRadius: '24px 24px 0 0', display: isMobile ? 'block' : 'none', bgcolor: 'white', zIndex: 1000 }}>
                <Stack direction="row" spacing={2}>
                    <Button fullWidth variant="outlined" color="error" startIcon={<DeleteSweepIcon />} onClick={() => setOpenConfirmClearDay(true)}>
                        Svuota {filterDay.slice(0,3)}
                    </Button>
                    <Button fullWidth variant="contained" color="error" startIcon={<DeleteForeverIcon />} onClick={() => setOpenConfirmClearWeek(true)}>
                        Reset Settimana
                    </Button>
                </Stack>
            </Paper>

            {/* Azioni Desktop */}
            {!isMobile && (
                <Box sx={{ mt: 4, textAlign: 'center' }}>
                    <Stack direction="row" spacing={2} justifyContent="center">
                        <Button variant="outlined" color="error" startIcon={<DeleteSweepIcon />} onClick={() => setOpenConfirmClearDay(true)}>Svuota Giorno Corrente</Button>
                        <Button variant="contained" color="error" startIcon={<DeleteForeverIcon />} onClick={() => setOpenConfirmClearWeek(true)}>Reset Totale</Button>
                    </Stack>
                </Box>
            )}

            {/* Dialogs di conferma */}
            <Dialog open={openConfirmClearWeek} onClose={() => setOpenConfirmClearWeek(false)} fullWidth maxWidth="xs">
                <DialogTitle sx={{ textAlign: 'center' }}><WarningAmberIcon color="error" fontSize="large" /><br/>Reset Settimana?</DialogTitle>
                <DialogContent><Typography textAlign="center">Tutti gli studenti verranno rimossi da ogni slot dell'intera settimana. I contatori di pagamento verranno aggiornati al salvataggio.</Typography></DialogContent>
                <DialogActions sx={{ p: 2, justifyContent: 'center' }}>
                    <Button onClick={() => setOpenConfirmClearWeek(false)}>Annulla</Button>
                    <Button onClick={handleClearEntireWeekLocal} variant="contained" color="error">Svuota Tutto</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={openConfirmClearDay} onClose={() => setOpenConfirmClearDay(false)} fullWidth maxWidth="xs">
                <DialogTitle sx={{ textAlign: 'center' }}>Svuota {filterDay}</DialogTitle>
                <DialogContent><Typography textAlign="center">Rimuovere tutti gli studenti assegnati a {filterDay}?</Typography></DialogContent>
                <DialogActions sx={{ p: 2, justifyContent: 'center' }}>
                    <Button onClick={() => setOpenConfirmClearDay(false)}>Annulla</Button>
                    <Button onClick={handleClearFullDayLocal} variant="contained" color="error">Conferma</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={openTimeDialog} onClose={() => setOpenTimeDialog(false)}>
                <DialogTitle>Modifica Orario</DialogTitle>
                <DialogContent>
                    <TextField fullWidth type="time" value={timeData.new} onChange={(e) => setTimeData({...timeData, new: e.target.value})} sx={{ mt: 1 }} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenTimeDialog(false)}>Annulla</Button>
                    <Button onClick={handleUpdateLocalTime} variant="contained">Aggiorna</Button>
                </DialogActions>
            </Dialog>

            {/* Floating Action Buttons per il Salvataggio */}
            <Zoom in={hasChanges}>
                <Box sx={{ position: 'fixed', bottom: isMobile ? 110 : 30, right: 30, zIndex: 3000, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Fab color="error" size="small" onClick={() => { if(window.confirm("Annullare le modifiche non salvate?")) fetchData(); }}><RefreshIcon /></Fab>
                    <Fab color="success" variant="extended" onClick={saveFullDay} disabled={saving}>
                        {saving ? <CircularProgress size={24} color="inherit" /> : <><SaveIcon sx={{ mr: 1 }} /> SALVA MODIFICHE</>}
                    </Fab>
                </Box>
            </Zoom>
        </Box>
    );
}