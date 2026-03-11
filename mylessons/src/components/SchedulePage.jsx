import React, { useState, useEffect, useMemo } from 'react';
import {
    Box, Typography, Paper, CircularProgress, IconButton,
    Card, Stack, Chip, Avatar, useTheme, useMediaQuery,
    ToggleButton, ToggleButtonGroup, Button, Dialog,
    DialogTitle, DialogContent, DialogActions, FormControl,
    InputLabel, Select, MenuItem, TextField, Fab, Zoom
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AccessTimeFilledIcon from '@mui/icons-material/AccessTimeFilled';
import EditIcon from '@mui/icons-material/Edit';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useNavigate } from 'react-router-dom';
import { APPS_SCRIPT_URL } from "./config/config";

const getStudentColor = (email) => {
    if (!email) return '#9c27b0';
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
        hash = email.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 65%, 40%)`;
};

export default function SchedulePage({ user }) {
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    // schedules è il database reale, localSchedules è il buffer di lavoro
    const [schedules, setSchedules] = useState([]);
    const [localSchedules, setLocalSchedules] = useState([]);
    const [subscribers, setSubscribers] = useState([]);

    const [viewMode, setViewMode] = useState('giorno');
    const [filterDay, setFilterDay] = useState(
        new Date().toLocaleDateString('it-IT', { weekday: 'long' }).charAt(0).toUpperCase() +
        new Date().toLocaleDateString('it-IT', { weekday: 'long' }).slice(1)
    );

    const [openDialog, setOpenDialog] = useState(false);
    const [openConfirmClear, setOpenConfirmClear] = useState(false);
    const [openTimeDialog, setOpenTimeDialog] = useState(false);
    const [openAddRowDialog, setOpenAddRowDialog] = useState(false);

    const [selectedSlot, setSelectedSlot] = useState({ ora: '', giorno: '' });
    const [timeData, setTimeData] = useState({ old: '', new: '' });
    const [newTimeLabel, setNewTimeLabel] = useState('09:00');
    const [selectedStudent, setSelectedStudent] = useState('');

    const giorni = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

    const fetchData = async () => {
        setLoading(true);
        try {
            const [resSched, resSubs] = await Promise.all([
                fetch(`${APPS_SCRIPT_URL}?action=getStudentSchedules&teacherId=${user.sub}`),
                fetch(`${APPS_SCRIPT_URL}?action=getTeacherSubscribers&teacherId=${user.sub}`)
            ]);
            const dataSched = await resSched.json();
            const dataSubs = await resSubs.json();
            if (dataSched.status === "success") {
                setSchedules(dataSched.data);
                setLocalSchedules(dataSched.data);
            }
            if (dataSubs.status === "success") setSubscribers(dataSubs.data);
            setHasChanges(false);
        } catch (error) {
            console.error("Errore recupero dati:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [user.sub]);

    // Filtra e ordina i dati dallo stato LOCALE
    const getLessonsData = (targetDay) => {
        return localSchedules
            .filter(slot => slot.giorno === targetDay)
            .sort((a, b) => a.ora.localeCompare(b.ora))
            .map(slot => ({
                ora: slot.ora,
                studenti: slot.email ? [{ email: slot.email, nome: slot.nome }] : []
            }));
    };

    // --- LOGICA BUFFER LOCALE (Nessuna fetch qui) ---

    const handleUpdateLocalSlot = (ora, giorno, email) => {
        const student = subscribers.find(s => s.studentEmail === email);
        const updated = localSchedules.map(slot =>
            (slot.giorno === giorno && slot.ora === ora)
                ? { ...slot, email: email, nome: student ? student.studentName : email }
                : slot
        );
        setLocalSchedules(updated);
        setHasChanges(true);
        setOpenDialog(false);
        setOpenConfirmClear(false);
    };

    const handleUpdateLocalTime = () => {
        const dayLessons = getLessonsData(filterDay);
        const isFirstRow = dayLessons.length > 0 && dayLessons[0].ora === timeData.old;

        let [ore, minuti] = timeData.new.split(':').map(Number);
        let startUpdating = false;

        const updated = localSchedules.map(slot => {
            if (slot.giorno !== filterDay) return slot;

            // Se è la prima riga, attiviamo la cascata locale
            if (isFirstRow) {
                if (slot.ora === timeData.old) startUpdating = true;
                if (startUpdating) {
                    const newOra = `${String(ore).padStart(2, '0')}:${String(minuti).padStart(2, '0')}`;
                    ore = (ore + 1) % 24;
                    return { ...slot, ora: newOra };
                }
            } else {
                // Modifica singola se non è la prima riga
                if (slot.ora === timeData.old) return { ...slot, ora: timeData.new };
            }
            return slot;
        });

        setLocalSchedules(updated);
        setHasChanges(true);
        setOpenTimeDialog(false);
    };

    const handleAddLocalSequence = () => {
        let [ore, minuti] = newTimeLabel.split(':').map(Number);
        const newSlots = [];
        for (let i = 0; i < 6; i++) {
            const oraFormattata = `${String(ore).padStart(2, '0')}:${String(minuti).padStart(2, '0')}`;
            newSlots.push({
                giorno: filterDay,
                ora: oraFormattata,
                email: "",
                nome: ""
            });
            ore = (ore + 1) % 24;
        }
        setLocalSchedules([...localSchedules, ...newSlots]);
        setHasChanges(true);
        setOpenAddRowDialog(false);
    };

    // --- SALVATAGGIO FINALE SUL DATABASE ---

    const saveFullDay = async () => {
        setSaving(true);
        const dayData = localSchedules.filter(s => s.giorno === filterDay);

        try {
            await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: JSON.stringify({
                    action: "saveFullDay",
                    giorno: filterDay,
                    lessons: dayData.map(d => ({ ora: d.ora, email: d.email }))
                })
            });
            setHasChanges(false);
            // Non facciamo fetchData per non perdere la fluidità,
            // ma aggiorniamo lo stato "reale" con quello "locale"
            setSchedules(localSchedules);
        } catch (e) {
            console.error("Errore salvataggio:", e);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Box sx={{ p: isMobile ? 1 : 3, pb: 12, maxWidth: 650, mx: 'auto' }}>

            {/* Header */}
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                    <IconButton onClick={() => navigate(-1)}><ArrowBackIcon /></IconButton>
                    <Typography variant="h5" fontWeight="bold">Agenda</Typography>
                </Stack>
                <ToggleButtonGroup
                    value={viewMode}
                    exclusive
                    onChange={(e, next) => next && setViewMode(next)}
                    size="small"
                >
                    <ToggleButton value="giorno">Giorno</ToggleButton>
                    <ToggleButton value="settimana">Settimana</ToggleButton>
                </ToggleButtonGroup>
            </Stack>

            {/* Selettore Giorni */}
            {viewMode === 'giorno' && (
                <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', mb: 3, pb: 1 }}>
                    {giorni.map((g) => (
                        <Chip
                            key={g}
                            label={g}
                            clickable
                            color={filterDay === g ? "secondary" : "default"}
                            onClick={() => {
                                if (hasChanges) {
                                    if (window.confirm("Hai modifiche non salvate su questo giorno. Vuoi cambiare giorno e perdere le modifiche?")) {
                                        setLocalSchedules(schedules);
                                        setHasChanges(false);
                                        setFilterDay(g);
                                    }
                                } else {
                                    setFilterDay(g);
                                }
                            }}
                        />
                    ))}
                </Box>
            )}

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
            ) : (
                <Box>
                    {(viewMode === 'giorno' ? [filterDay] : giorni).map((currentDay) => {
                        const lessons = getLessonsData(currentDay);
                        if (viewMode === 'settimana' && lessons.length === 0) return null;

                        return (
                            <Box key={currentDay} sx={{ mb: 4 }}>
                                <Typography variant="h6" color="secondary" fontWeight="bold" sx={{ mb: 2, ml: 1 }}>{currentDay}</Typography>
                                <Stack spacing={2}>
                                    {lessons.map((slot, idx) => {
                                        const isOccupied = slot.studenti.length > 0;
                                        return (
                                            <Card key={idx} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', borderStyle: isOccupied ? 'solid' : 'dashed' }}>
                                                <Box sx={{ display: 'flex' }}>
                                                    <Box sx={{ bgcolor: isOccupied ? 'grey.100' : 'transparent', p: 1.5, minWidth: 95, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid', borderColor: 'divider' }}>
                                                        <Typography variant="subtitle2" fontWeight="bold">{slot.ora}</Typography>
                                                        <IconButton size="small" onClick={() => { setTimeData({ old: slot.ora, new: slot.ora }); setOpenTimeDialog(true); }}>
                                                            <AccessTimeFilledIcon sx={{ fontSize: 16 }} color="primary" />
                                                        </IconButton>
                                                    </Box>
                                                    <Box sx={{ p: 1.5, flexGrow: 1 }}>
                                                        <Stack spacing={1}>
                                                            {isOccupied ? (
                                                                slot.studenti.map((s, sIdx) => (
                                                                    <Chip key={sIdx} avatar={<Avatar>{s.nome.charAt(0)}</Avatar>} label={s.nome} sx={{ bgcolor: getStudentColor(s.email), color: 'white', fontWeight: 'bold' }} />
                                                                ))
                                                            ) : (
                                                                <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>Slot Libero</Typography>
                                                            )}
                                                            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                                                                <Button size="small" variant="outlined" startIcon={<EditIcon fontSize="small"/>} onClick={() => { setSelectedSlot({ ora: slot.ora, giorno: currentDay }); setSelectedStudent(isOccupied ? slot.studenti[0].email : ''); setOpenDialog(true); }}>
                                                                    Modifica
                                                                </Button>
                                                                {isOccupied && (
                                                                    <IconButton size="small" color="error" onClick={() => { setSelectedSlot({ ora: slot.ora, giorno: currentDay }); setOpenConfirmClear(true); }}>
                                                                        <DeleteSweepIcon fontSize="small"/>
                                                                    </IconButton>
                                                                )}
                                                            </Stack>
                                                        </Stack>
                                                    </Box>
                                                </Box>
                                            </Card>
                                        );
                                    })}
                                </Stack>
                            </Box>
                        );
                    })}

                    <Button fullWidth variant="contained" color="primary" startIcon={<AddIcon />} onClick={() => setOpenAddRowDialog(true)} sx={{ mt: 2, borderRadius: 3, py: 1.2 }}>
                        Programma Giornata ({filterDay})
                    </Button>
                </Box>
            )}

            {/* --- DIALOGS (Modificano solo lo stato locale) --- */}

            <Dialog open={openTimeDialog} onClose={() => setOpenTimeDialog(false)} fullWidth maxWidth="xs">
                <DialogTitle>Modifica Orario</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                        {getLessonsData(filterDay)[0]?.ora === timeData.old ? "⚠️ Prima riga: attiva cascata (+1h)." : "Modifica singola."}
                    </Typography>
                    <TextField fullWidth type="time" value={timeData.new} onChange={(e) => setTimeData({...timeData, new: e.target.value})} InputLabelProps={{ shrink: true }} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenTimeDialog(false)}>Annulla</Button>
                    <Button onClick={handleUpdateLocalTime} variant="contained">Applica</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={openAddRowDialog} onClose={() => setOpenAddRowDialog(false)} fullWidth maxWidth="xs">
                <DialogTitle>Genera Orari</DialogTitle>
                <DialogContent>
                    <TextField fullWidth type="time" label="Ora Inizio" value={newTimeLabel} onChange={(e) => setNewTimeLabel(e.target.value)} InputLabelProps={{ shrink: true }} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenAddRowDialog(false)}>Annulla</Button>
                    <Button onClick={handleAddLocalSequence} variant="contained">Genera 6 Ore</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={openDialog} onClose={() => setOpenDialog(false)} fullWidth maxWidth="xs">
                <DialogTitle>Assegna Studente</DialogTitle>
                <DialogContent>
                    <FormControl fullWidth sx={{ mt: 1 }}>
                        <InputLabel>Studente</InputLabel>
                        <Select value={selectedStudent} label="Studente" onChange={(e) => setSelectedStudent(e.target.value)}>
                            <MenuItem value=""><em>Nessuno</em></MenuItem>
                            {subscribers.map((sub) => (
                                <MenuItem key={sub.studentEmail} value={sub.studentEmail}>{sub.studentName}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenDialog(false)}>Annulla</Button>
                    <Button onClick={() => handleUpdateLocalSlot(selectedSlot.ora, selectedSlot.giorno, selectedStudent)} variant="contained">Applica</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={openConfirmClear} onClose={() => setOpenConfirmClear(false)}>
                <DialogTitle>Libera Slot?</DialogTitle>
                <DialogActions>
                    <Button onClick={() => setOpenConfirmClear(false)}>No</Button>
                    <Button onClick={() => handleUpdateLocalSlot(selectedSlot.ora, selectedSlot.giorno, "")} color="error" variant="contained">Sì, libera</Button>
                </DialogActions>
            </Dialog>

            {/* --- FAB DI SALVATAGGIO (Appare solo se ci sono modifiche) --- */}
            <Zoom in={hasChanges}>
                <Box sx={{ position: 'fixed', bottom: 20, right: 20, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Fab color="error" size="small" onClick={() => { setLocalSchedules(schedules); setHasChanges(false); }}>
                        <RefreshIcon />
                    </Fab>
                    <Fab color="success" variant="extended" onClick={saveFullDay} disabled={saving}>
                        {saving ? <CircularProgress size={24} /> : <><SaveIcon sx={{ mr: 1 }} /> SALVA {filterDay.toUpperCase()}</>}
                    </Fab>
                </Box>
            </Zoom>
        </Box>
    );
}