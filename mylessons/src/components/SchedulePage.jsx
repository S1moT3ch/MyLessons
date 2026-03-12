import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, Paper, CircularProgress, IconButton,
    Card, Stack, Chip, Avatar, useTheme, useMediaQuery,
    ToggleButton, ToggleButtonGroup, Button, Dialog,
    DialogTitle, DialogContent, DialogActions, FormControl,
    Select, MenuItem, TextField, Fab, Zoom
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AccessTimeFilledIcon from '@mui/icons-material/AccessTimeFilled';
import EditIcon from '@mui/icons-material/Edit';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
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

    const [schedules, setSchedules] = useState([]);
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
    const [openAddRowDialog, setOpenAddRowDialog] = useState(false);

    const [timeData, setTimeData] = useState({ old: '', new: '' });
    const [newTimeLabel, setNewTimeLabel] = useState('09:00');

    const giorni = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

    const fetchData = useCallback(async () => {
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
    }, [user.sub]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const getLessonsData = (targetDay) => {
        return localSchedules
            .filter(slot => slot.giorno === targetDay)
            .sort((a, b) => a.ora.localeCompare(b.ora));
    };

    const handleUpdateLocalSlot = (ora, giorno, email) => {
        const student = subscribers.find(s => s.studentEmail === email);
        const updated = localSchedules.map(slot =>
            (slot.giorno === giorno && slot.ora === ora)
                ? { ...slot, email: email, nome: student ? student.studentName : (email === "" ? "" : email) }
                : slot
        );
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
        const dayLessons = getLessonsData(filterDay);
        const isFirstRow = dayLessons.length > 0 && dayLessons[0].ora === timeData.old;
        let [ore, minuti] = timeData.new.split(':').map(Number);
        let startUpdating = false;

        const updated = localSchedules.map(slot => {
            if (slot.giorno !== filterDay) return slot;
            if (isFirstRow) {
                if (slot.ora === timeData.old) startUpdating = true;
                if (startUpdating) {
                    const newOra = `${String(ore).padStart(2, '0')}:${String(minuti).padStart(2, '0')}`;
                    ore = (ore + 1) % 24;
                    return { ...slot, ora: newOra };
                }
            } else {
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
            newSlots.push({ giorno: filterDay, ora: oraFormattata, email: "", nome: "" });
            ore = (ore + 1) % 24;
        }
        setLocalSchedules([...localSchedules, ...newSlots]);
        setHasChanges(true);
        setOpenAddRowDialog(false);
    };

    const saveFullDay = async () => {
        setSaving(true);
        try {
            await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: JSON.stringify({
                    action: "saveFullSchedule",
                    allSchedules: localSchedules
                })
            });
            setHasChanges(false);
            setSchedules(localSchedules);
        } catch (e) {
            console.error("Errore salvataggio:", e);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Box sx={{
            p: isMobile ? 1.5 : 3,
            pb: isMobile ? 22 : 12, // Più spazio in fondo per i bottoni mobile
            maxWidth: 650,
            mx: 'auto',
            bgcolor: '#f8f9fa',
            minHeight: '100vh'
        }}>

            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                    <IconButton onClick={() => navigate(-1)} size="large"><ArrowBackIcon /></IconButton>
                    <Typography variant="h5" fontWeight="800">Agenda</Typography>
                </Stack>
                <ToggleButtonGroup
                    value={viewMode}
                    exclusive
                    onChange={(e, next) => next && setViewMode(next)}
                    size="small"
                    sx={{ bgcolor: 'white' }}
                >
                    <ToggleButton value="giorno" sx={{ px: 2 }}>Giorno</ToggleButton>
                    <ToggleButton value="settimana" sx={{ px: 2 }}>Settimana</ToggleButton>
                </ToggleButtonGroup>
            </Stack>

            {viewMode === 'giorno' && (
                <Box sx={{
                    display: 'flex',
                    gap: 1,
                    overflowX: 'auto',
                    mb: 3,
                    pb: 1,
                    '&::-webkit-scrollbar': { display: 'none' }
                }}>
                    {giorni.map((g) => (
                        <Chip
                            key={g}
                            label={g}
                            clickable
                            color={filterDay === g ? "primary" : "default"}
                            variant={filterDay === g ? "filled" : "outlined"}
                            onClick={() => {
                                if (hasChanges) {
                                    if (window.confirm("Modifiche non salvate! Cambiando giorno le perderai.")) {
                                        setLocalSchedules(schedules);
                                        setHasChanges(false);
                                        setFilterDay(g);
                                    }
                                } else {
                                    setFilterDay(g);
                                }
                            }}
                            sx={{ fontWeight: 'bold', px: 1 }}
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
                                <Typography variant="overline" color="text.secondary" fontWeight="900" sx={{ ml: 1, fontSize: '0.8rem' }}>
                                    {currentDay.toUpperCase()}
                                </Typography>
                                <Stack spacing={1.5} sx={{ mt: 1 }}>
                                    {lessons.map((slot, idx) => {
                                        const isOccupied = slot.email !== "";
                                        const isEditing = editingSlot === `${slot.ora}-${currentDay}`;

                                        return (
                                            <Card key={idx} elevation={0} sx={{
                                                borderRadius: 4,
                                                border: '1px solid',
                                                borderColor: isEditing ? 'primary.main' : '#e0e0e0',
                                                boxShadow: isEditing ? '0 4px 12px rgba(25, 118, 210, 0.12)' : 'none'
                                            }}>
                                                <Box sx={{ display: 'flex', minHeight: 70 }}>
                                                    {/* Orario Box */}
                                                    <Box sx={{
                                                        bgcolor: isOccupied ? 'rgba(0,0,0,0.03)' : 'transparent',
                                                        p: 1,
                                                        minWidth: 75,
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        borderRight: '1px solid #eee'
                                                    }}>
                                                        <Typography variant="body2" fontWeight="800">{slot.ora}</Typography>
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => { setTimeData({ old: slot.ora, new: slot.ora }); setOpenTimeDialog(true); }}
                                                            sx={{ color: theme.palette.text.disabled }}
                                                        >
                                                            <AccessTimeFilledIcon sx={{ fontSize: 16 }} />
                                                        </IconButton>
                                                    </Box>

                                                    {/* Studente Area */}
                                                    <Box sx={{ p: 1, px: 2, flexGrow: 1, display: 'flex', alignItems: 'center' }}>
                                                        {isEditing ? (
                                                            <FormControl fullWidth size="small">
                                                                <Select
                                                                    value={slot.email}
                                                                    onChange={(e) => handleUpdateLocalSlot(slot.ora, currentDay, e.target.value)}
                                                                    autoOpen
                                                                    sx={{ borderRadius: 3 }}
                                                                >
                                                                    <MenuItem value=""><em>Libero</em></MenuItem>
                                                                    {subscribers.map((sub) => (
                                                                        <MenuItem key={sub.studentEmail} value={sub.studentEmail}>{sub.studentName}</MenuItem>
                                                                    ))}
                                                                </Select>
                                                            </FormControl>
                                                        ) : (
                                                            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ width: '100%' }}>
                                                                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                                                    {isOccupied ? (
                                                                        <Chip
                                                                            avatar={<Avatar sx={{ bgcolor: 'white !important', color: getStudentColor(slot.email) }}>{slot.nome?.charAt(0)}</Avatar>}
                                                                            label={slot.nome}
                                                                            sx={{
                                                                                bgcolor: getStudentColor(slot.email),
                                                                                color: 'white',
                                                                                fontWeight: 'bold',
                                                                                width: '100%',
                                                                                justifyContent: 'flex-start',
                                                                                '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.85rem' }
                                                                            }}
                                                                        />
                                                                    ) : (
                                                                        <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic', ml: 1 }}>Vuoto</Typography>
                                                                    )}
                                                                </Box>

                                                                <Stack direction="row" spacing={0.5}>
                                                                    <IconButton
                                                                        onClick={() => setEditingSlot(`${slot.ora}-${currentDay}`)}
                                                                        sx={{ bgcolor: 'rgba(25, 118, 210, 0.05)' }}
                                                                    >
                                                                        <EditIcon fontSize="small" color="primary" />
                                                                    </IconButton>
                                                                    {isOccupied && (
                                                                        <IconButton
                                                                            onClick={() => handleUpdateLocalSlot(slot.ora, currentDay, "")}
                                                                            sx={{ bgcolor: 'rgba(211, 47, 47, 0.05)' }}
                                                                        >
                                                                            <DeleteSweepIcon fontSize="small" color="error" />
                                                                        </IconButton>
                                                                    )}
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

            {/* Azioni Mobile Bar */}
            <Paper elevation={10} sx={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                p: 2,
                borderRadius: '24px 24px 0 0',
                zIndex: theme.zIndex.appBar,
                display: isMobile ? 'block' : 'none'
            }}>
                <Stack spacing={1.5}>
                    <Stack direction="row" spacing={2}>
                        <Button
                            fullWidth
                            variant="outlined"
                            color="error"
                            startIcon={<DeleteForeverIcon />}
                            onClick={() => setOpenConfirmClearDay(true)}
                            sx={{ borderRadius: 4, py: 1 }}
                        >
                            Giorno
                        </Button>
                        <Button
                            fullWidth
                            variant="text"
                            color="error"
                            onClick={() => setOpenConfirmClearWeek(true)}
                            sx={{ borderRadius: 4, py: 1, fontSize: '0.7rem' }}
                        >
                            Reset Totale
                        </Button>
                    </Stack>
                </Stack>
            </Paper>

            {/* Azioni Desktop (Normali) */}
            {!isMobile && (
                <Box sx={{ mt: 4, textAlign: 'center' }}>
                    <Stack direction="row" spacing={2} justifyContent="center">
                        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenAddRowDialog(true)} sx={{ borderRadius: 4, px: 4 }}>Genera Sequenza</Button>
                        <Button variant="outlined" color="error" startIcon={<DeleteForeverIcon />} onClick={() => setOpenConfirmClearDay(true)} sx={{ borderRadius: 4, px: 4 }}>Pulisci Giorno</Button>
                        <Button variant="text" color="error" onClick={() => setOpenConfirmClearWeek(true)}>Reset Totale</Button>
                    </Stack>
                </Box>
            )}

            {/* DIALOGS - ottimizzati per larghezza mobile */}
            <Dialog open={openConfirmClearWeek} onClose={() => setOpenConfirmClearWeek(false)} fullWidth maxWidth="xs">
                <DialogTitle sx={{ textAlign: 'center' }}><WarningAmberIcon color="error" fontSize="large" /><br/>Reset Totale?</DialogTitle>
                <DialogContent><Typography textAlign="center">Svuoterai tutta la settimana locale. Procedere?</Typography></DialogContent>
                <DialogActions sx={{ p: 2, justifyContent: 'center' }}>
                    <Button onClick={() => setOpenConfirmClearWeek(false)} variant="outlined">No</Button>
                    <Button onClick={handleClearEntireWeekLocal} variant="contained" color="error">Sì, svuota</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={openConfirmClearDay} onClose={() => setOpenConfirmClearDay(false)} fullWidth maxWidth="xs">
                <DialogTitle sx={{ textAlign: 'center' }}>Svuota {filterDay}</DialogTitle>
                <DialogContent><Typography textAlign="center">Rimuovere tutti gli studenti da questo giorno?</Typography></DialogContent>
                <DialogActions sx={{ p: 2, justifyContent: 'center' }}>
                    <Button onClick={() => setOpenConfirmClearDay(false)}>Annulla</Button>
                    <Button onClick={handleClearFullDayLocal} variant="contained" color="error">Conferma</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={openTimeDialog} onClose={() => setOpenTimeDialog(false)} fullWidth maxWidth="xs">
                <DialogTitle>Cambia Orario</DialogTitle>
                <DialogContent>
                    <Typography variant="caption" color="primary" sx={{ mb: 1, display: 'block' }}>
                        {getLessonsData(filterDay)[0]?.ora === timeData.old ? "Cascata +1h attiva" : "Modifica singola riga"}
                    </Typography>
                    <TextField fullWidth type="time" value={timeData.new} onChange={(e) => setTimeData({...timeData, new: e.target.value})} InputLabelProps={{ shrink: true }} sx={{ mt: 1 }} />
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setOpenTimeDialog(false)}>Annulla</Button>
                    <Button onClick={handleUpdateLocalTime} variant="contained">Applica</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={openAddRowDialog} onClose={() => setOpenAddRowDialog(false)} fullWidth maxWidth="xs">
                <DialogTitle>Genera Programma</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{ mb: 2 }}>Inserisci l'ora di inizio per creare 6 slot consecutivi.</Typography>
                    <TextField fullWidth type="time" label="Ora Inizio" value={newTimeLabel} onChange={(e) => setNewTimeLabel(e.target.value)} InputLabelProps={{ shrink: true }} />
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setOpenAddRowDialog(false)}>Annulla</Button>
                    <Button onClick={handleAddLocalSequence} variant="contained">Crea Slot</Button>
                </DialogActions>
            </Dialog>

            {/* FLOATING SAVE BUTTON */}
            <Zoom in={hasChanges}>
                <Box sx={{ position: 'fixed', bottom: isMobile ? 90 : 30, right: 30, zIndex: 3000, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Fab color="error" size="small" onClick={() => { if(window.confirm("Annullare?")) { setLocalSchedules(schedules); setHasChanges(false); } }}>
                        <RefreshIcon />
                    </Fab>
                    <Fab color="success" variant="extended" onClick={saveFullDay} disabled={saving} sx={{ boxShadow: 6, px: 3 }}>
                        {saving ? <CircularProgress size={24} color="inherit" /> : <><SaveIcon sx={{ mr: 1 }} /> SALVA</>}
                    </Fab>
                </Box>
            </Zoom>
        </Box>
    );
}