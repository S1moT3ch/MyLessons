import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, CircularProgress, IconButton,
    Card, Stack, Paper, useMediaQuery, useTheme,
    ToggleButton, ToggleButtonGroup, Tab, Tabs,
    Divider, Button, Collapse, Dialog, DialogTitle,
    DialogContent, DialogActions, Snackbar, Alert,
    List, ListItem, ListItemText, ListItemIcon
} from '@mui/material';
import {
    ArrowBack as ArrowBackIcon,
    CalendarMonth as CalendarIcon,
    CheckCircle as DoneIcon,
    AutoAwesome as AiIcon,
    InfoOutlined as InfoIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';
import { APPS_SCRIPT_URL } from "./config/config";

export default function TeacherFeedbackPage() {
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    // --- STATI DATI E CACHE ---
    const [feedbackList, setFeedbackList] = useState(() => {
        const saved = localStorage.getItem('cache_feedbacks');
        return saved ? JSON.parse(saved) : [];
    });
    const [fullSchedule, setFullSchedule] = useState(() => {
        const saved = localStorage.getItem('cache_schedules');
        return saved ? JSON.parse(saved) : [];
    });

    // --- STATI UI ---
    const [loading, setLoading] = useState(feedbackList.length === 0);
    const [isResolving, setIsResolving] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);

    // --- STATI NOTIFICHE E DIALOG ---
    const [confirmDialog, setConfirmDialog] = useState({ open: false, item: null, idx: null });
    const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });
    const [errorDialog, setErrorDialog] = useState({ open: false, title: '', message: '' });
    const [aiDialog, setAiDialog] = useState({ open: false, suggestions: [] });

    // Filtri
    const [viewFilter, setViewFilter] = useState('today');
    const [selectedDay, setSelectedDay] = useState(
        new Date().toLocaleDateString('it-IT', { weekday: 'long' }).charAt(0).toUpperCase() +
        new Date().toLocaleDateString('it-IT', { weekday: 'long' }).slice(1)
    );

    const giorniSettimana = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

    // --- FETCH DATI ---
    const fetchData = useCallback(async (isSilent = false) => {
        const sessionStr = Cookies.get('user_session');
        if (!sessionStr) return navigate('/login');
        const session = JSON.parse(sessionStr);
        const teacherFullName = `${session.given_name} ${session.family_name}`;

        if (!isSilent) setLoading(true);

        try {
            const [resFb, resSched] = await Promise.all([
                fetch(`${APPS_SCRIPT_URL}?action=getTeacherFeedbackSummary&teacherName=${encodeURIComponent(teacherFullName)}&token=${session.id_token}`),
                fetch(`${APPS_SCRIPT_URL}?action=getStudentSchedules&teacherName=${encodeURIComponent(teacherFullName)}&token=${session.id_token}`)
            ]);

            const resultFb = await resFb.json();
            const resultSched = await resSched.json();

            if (resultFb.status === "success") {
                setFeedbackList(resultFb.data);
                localStorage.setItem('cache_feedbacks', JSON.stringify(resultFb.data));
                const absences = resultFb.data.filter(f => f.status === "Assente");
                localStorage.setItem('cache_absences', JSON.stringify(absences));
            }

            if (resultSched.status === "success") {
                setFullSchedule(resultSched.data);
                localStorage.setItem('cache_schedules', JSON.stringify(resultSched.data));
            }
        } catch (e) {
            console.error("Errore fetch feedback:", e);
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    useEffect(() => {
        const hasCache = feedbackList.length > 0;
        fetchData(hasCache);
    }, [fetchData]);

    // --- LOGICA AI: OTTIMIZZAZIONE RISCHEDULAZIONE ---
    const handleAIOptimize = async () => {
        const sessionStr = Cookies.get('user_session');
        if (!sessionStr) return;
        const session = JSON.parse(sessionStr);

        setAiLoading(true);
        try {
            const response = await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: "getAIOptimizedSchedule",
                    id_token: session.id_token,
                    teacherName: `${session.given_name} ${session.family_name}`.trim(),
                    schedule: fullSchedule,
                    feedbacks: feedbackList.filter(f => f.status === "Assente")
                })
            });

            const result = await response.json();
            if (result.proposte) {
                setAiDialog({ open: true, suggestions: result.proposte });
            } else {
                throw new Error("Formato risposta AI non valido");
            }
        } catch (e) {
            setErrorDialog({ open: true, title: 'Errore AI', message: 'Non è stato possibile generare suggerimenti automatici.' });
        } finally {
            setAiLoading(false);
        }
    };

    // --- LOGICA RISOLUZIONE MANUALE ---
    const askResolveConfirmation = (item, idx) => {
        setConfirmDialog({ open: true, item, idx });
    };

    const handleResolveFeedback = async () => {
        const { item, idx } = confirmDialog;
        const sessionStr = Cookies.get('user_session');
        if (!sessionStr || !item) return;
        const session = JSON.parse(sessionStr);

        setConfirmDialog({ ...confirmDialog, open: false });
        setIsResolving(idx);

        try {
            const oraPulita = item.ora.replace(":", "").trim();
            const response = await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: "resolveFeedback",
                    teacherName: `${session.given_name} ${session.family_name}`.trim(),
                    studentName: item.studentName,
                    ora: oraPulita,
                    giorno: item.giorno.trim(),
                    studentEmail: item.studentEmail
                })
            });

            const result = await response.text();
            if (result.includes("Success")) {
                setIsResolving(`exiting-${idx}`);
                await new Promise(res => setTimeout(res, 350));

                setFeedbackList(prev => {
                    const newList = prev.filter((_, i) => i !== prev.indexOf(item));
                    localStorage.setItem('cache_feedbacks', JSON.stringify(newList));
                    localStorage.setItem('cache_absences', JSON.stringify(newList.filter(f => f.status === "Assente")));
                    return newList;
                });
                setNotification({ open: true, message: 'Lezione risolta correttamente!', severity: 'success' });
            } else {
                setErrorDialog({ open: true, title: 'Errore', message: `Database: ${result}` });
            }
        } catch (e) {
            setErrorDialog({ open: true, title: 'Errore Rete', message: 'Controlla la connessione internet.' });
        } finally {
            setIsResolving(null);
        }
    };

    // --- HELPER TEMPORALI ---
    const timeToMinutes = (timeStr) => {
        const [hrs, mins] = timeStr.replace('.', ':').split(':').map(Number);
        return hrs * 60 + mins;
    };

    const checkOverlap = (start1, duration1, start2) => {
        const s1 = timeToMinutes(start1);
        const e1 = s1 + Number(duration1);
        const s2 = timeToMinutes(start2);
        return s2 >= s1 && s2 < e1;
    };

    const getOccupantAt = (preferenzaString) => {
        if (!preferenzaString || !fullSchedule.length) return null;
        const match = preferenzaString.match(/^([a-zA-Zàèìòù]+)\s+(\d{2})[:.](\d{2})$/i);
        if (!match) return null;

        const giornoProposto = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
        const oraProposta = `${match[2]}:${match[3]}`;

        const occupanti = fullSchedule.filter(slot => {
            if (slot.giorno !== giornoProposto) return false;
            return checkOverlap(slot.ora, slot.durata || 60, oraProposta);
        });

        if (occupanti.length > 0) {
            const nomi = occupanti.flatMap(slot => slot.students ? slot.students.map(st => st.nome) : []);
            return [...new Set(nomi)].join(", ");
        }
        return null;
    };

    // --- RENDERING CARD ---
    const renderFeedbackCard = (item, idx) => {
        const occupante = getOccupantAt(item.preferenza);
        const isAssente = item.status === "Assente";
        const resolving = isResolving === idx;
        const exiting = isResolving === `exiting-${idx}`;

        return (
            <Collapse in={!exiting} timeout={300} unmountOnExit key={idx}>
                <Card elevation={0} sx={{
                    borderRadius: 4, border: '1px solid', borderColor: isAssente ? '#ffebee' : '#f0f0f0',
                    bgcolor: 'white', mb: 2, overflow: 'hidden', opacity: resolving ? 0.6 : 1,
                    transform: exiting ? 'scale(0.95)' : 'scale(1)', transition: 'all 0.3s ease-out'
                }}>
                    <Box sx={{ display: 'flex' }}>
                        <Box sx={{ width: 6, bgcolor: isAssente ? '#f44336' : '#4caf50' }} />
                        <Box sx={{ p: 2, flexGrow: 1 }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
                                <Box>
                                    <Typography variant="h6" fontWeight="900" sx={{ lineHeight: 1, color: '#2c3e50' }}>
                                        {item.ora.replace(":", "") === item.ora ? `${item.ora.slice(0, 2)}:${item.ora.slice(2)}` : item.ora}
                                    </Typography>
                                    <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ textTransform: 'uppercase' }}>
                                        {viewFilter === 'all' ? item.giorno : 'Slot Orario'}
                                    </Typography>
                                </Box>
                                <Box sx={{ px: 1.5, py: 0.5, borderRadius: 2, bgcolor: isAssente ? '#fff5f5' : '#e8f5e9', border: '1px solid', borderColor: isAssente ? '#feb2b2' : '#c6f6d5' }}>
                                    <Typography variant="caption" fontWeight="900" color={isAssente ? "#c53030" : "#22543d"}>
                                        {isAssente ? "NON DISPONIBILE" : "CONFERMATO"}
                                    </Typography>
                                </Box>
                            </Stack>
                            <Typography variant="body1" fontWeight="800" sx={{ mb: 1.5, fontSize: '1.1rem' }}>{item.studentName}</Typography>
                            {isAssente && item.preferenza && (
                                <Paper elevation={0} sx={{ p: 1.5, mb: 1.5, borderRadius: 3, bgcolor: '#f8faff', border: '1px solid #e0e7ff' }}>
                                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                                        <CalendarIcon sx={{ fontSize: 18, color: '#3f51b5' }} />
                                        <Typography variant="caption" fontWeight="900" color="#3f51b5">PROPOSTA ALTERNATIVA</Typography>
                                    </Stack>
                                    <Typography variant="body2" fontWeight="800" sx={{ mb: 0.5 }}>{item.preferenza.toUpperCase()}</Typography>
                                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.3, borderRadius: 1.5, bgcolor: occupante ? '#fffaf0' : '#f0fff4', color: occupante ? '#9c4221' : '#276749', border: '1px solid', borderColor: occupante ? '#feebc8' : '#c6f6d5' }}>
                                        <Typography sx={{ fontSize: '0.65rem', fontWeight: 'bold' }}>
                                            {occupante ? `⚠️ OCCUPATO DA: ${occupante}` : "✅ SLOT LIBERO"}
                                        </Typography>
                                    </Box>
                                </Paper>
                            )}
                            {item.note && (
                                <Box sx={{ p: 1.5, mb: isAssente ? 2 : 0, bgcolor: '#f1f3f5', borderRadius: '12px 12px 12px 4px' }}>
                                    <Typography variant="body2" sx={{ color: '#495057', fontSize: '0.85rem', fontStyle: 'italic', lineHeight: 1.4 }}>"{item.note}"</Typography>
                                </Box>
                            )}
                            {isAssente && (
                                <>
                                    <Divider sx={{ my: 1.5, opacity: 0.5 }} />
                                    <Stack direction="row" justifyContent="flex-end">
                                        <Button size="small" color="success" variant="text" onClick={() => askResolveConfirmation(item, idx)} disabled={resolving || exiting} startIcon={(resolving || exiting) ? <CircularProgress size={16} color="inherit" /> : <DoneIcon />} sx={{ fontWeight: '900', borderRadius: 2, textTransform: 'none' }}>
                                            {(resolving || exiting) ? 'Risoluzione...' : 'Segna come risolto'}
                                        </Button>
                                    </Stack>
                                </>
                            )}
                        </Box>
                    </Box>
                </Card>
            </Collapse>
        );
    };

    const renderContent = () => {
        if (loading && feedbackList.length === 0) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>;
        let displayData = [];
        if (viewFilter !== 'all') {
            displayData = feedbackList.filter(f => f.giorno === selectedDay).sort((a, b) => a.ora.localeCompare(b.ora));
            return (
                <Stack spacing={1.5}>
                    {displayData.length > 0 ? displayData.map((item, idx) => renderFeedbackCard(item, idx)) : (
                        <Typography variant="body2" textAlign="center" color="text.secondary" sx={{ mt: 4 }}>Nessuna risposta per {selectedDay}</Typography>
                    )}
                </Stack>
            );
        }
        return giorniSettimana.map(giorno => {
            const dayData = feedbackList.filter(f => f.giorno === giorno).sort((a, b) => a.ora.localeCompare(b.ora));
            if (dayData.length === 0) return null;
            return (
                <Box key={giorno} sx={{ mb: 4 }}>
                    <Typography variant="subtitle2" color="primary" fontWeight="900" sx={{ mb: 1.5, ml: 1, textTransform: 'uppercase' }}>{giorno}</Typography>
                    <Stack spacing={1.5}>{dayData.map((item, idx) => renderFeedbackCard(item, idx))}</Stack>
                </Box>
            );
        });
    };

    return (
        <Box sx={{ p: isMobile ? 2 : 3, pb: 10, maxWidth: 650, mx: 'auto', bgcolor: '#f8f9fa', minHeight: '100vh' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                    <IconButton onClick={() => navigate(-1)}><ArrowBackIcon /></IconButton>
                    <Typography variant="h5" fontWeight="900">Risposte</Typography>
                </Stack>

                <Button
                    variant="contained"
                    size="small"
                    startIcon={aiLoading ? <CircularProgress size={16} color="inherit" /> : <AiIcon />}
                    onClick={handleAIOptimize}
                    disabled={aiLoading || feedbackList.filter(f => f.status === "Assente").length === 0}
                    sx={{
                        borderRadius: 5,
                        textTransform: 'none',
                        fontWeight: 'bold',
                        background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                        boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)'
                    }}
                >
                    {aiLoading ? "Analisi..." : "Suggerimenti AI"}
                </Button>
            </Stack>

            <ToggleButtonGroup value={viewFilter} exclusive onChange={(e, val) => val && setViewFilter(val)} size="small" color="primary" sx={{ bgcolor: 'white', mb: 2, width: '100%' }}>
                <ToggleButton value="specific" sx={{ flex: 1, fontWeight: 'bold' }}>Giorno</ToggleButton>
                <ToggleButton value="all" sx={{ flex: 1, fontWeight: 'bold' }}>Settimana</ToggleButton>
            </ToggleButtonGroup>

            {viewFilter !== 'all' && (
                <Paper elevation={0} sx={{ mb: 3, borderRadius: 4, border: '1px solid #e0e0e0', overflow: 'hidden' }}>
                    <Tabs value={giorniSettimana.indexOf(selectedDay)} onChange={(e, val) => setSelectedDay(giorniSettimana[val])} variant="scrollable" scrollButtons="auto" sx={{ bgcolor: 'white' }}>
                        {giorniSettimana.map((g, i) => (
                            <Tab key={i} label={isMobile ? g.substring(0, 3) : g} sx={{ fontWeight: 'bold', minWidth: isMobile ? 60 : 100 }} />
                        ))}
                    </Tabs>
                </Paper>
            )}

            <Box sx={{ mt: 2 }}>{renderContent()}</Box>

            {/* DIALOG AI SUGGESTIONS */}
            <Dialog
                open={aiDialog.open}
                onClose={() => setAiDialog({ ...aiDialog, open: false })}
                fullWidth
                maxWidth="xs"
                PaperProps={{ sx: { borderRadius: 5, p: 1 } }}
            >
                <DialogTitle sx={{ fontWeight: '900', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AiIcon color="primary" /> Suggerimenti AI
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Ho analizzato le assenze e trovato le seguenti soluzioni:
                    </Typography>
                    <List disablePadding>
                        {aiDialog.suggestions.map((s, i) => (
                            <ListItem key={i} sx={{ px: 0, py: 1.5, borderBottom: i !== aiDialog.suggestions.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                                <ListItemIcon sx={{ minWidth: 36 }}><InfoIcon color="info" fontSize="small" /></ListItemIcon>
                                <ListItemText
                                    primary={<Typography fontWeight="800" variant="body2">{s.studente}</Typography>}
                                    secondary={
                                        <Typography variant="caption" color="text.primary">
                                            Sposta da <b>{s.vecchioOrario}</b> a <b style={{color: '#2e7d32'}}>{s.nuovoOrario}</b>. {s.nota}
                                        </Typography>
                                    }
                                />
                            </ListItem>
                        ))}
                    </List>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setAiDialog({ ...aiDialog, open: false })} variant="contained" fullWidth sx={{ borderRadius: 3, fontWeight: 'bold' }}>
                        Grazie!
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ALTRI DIALOG */}
            <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog({ ...confirmDialog, open: false })} PaperProps={{ sx: { borderRadius: 5, p: 1 } }}>
                <DialogTitle sx={{ fontWeight: '900' }}>Confermi l'azione?</DialogTitle>
                <DialogContent><Typography variant="body2" color="text.secondary">La risposta verrà rimossa definitivamente dal database.</Typography></DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setConfirmDialog({ ...confirmDialog, open: false })} sx={{ fontWeight: 'bold' }}>Annulla</Button>
                    <Button onClick={handleResolveFeedback} variant="contained" color="success" sx={{ borderRadius: 3, fontWeight: 'bold', px: 3 }}>Sì, Risolto</Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={notification.open} autoHideDuration={4000} onClose={() => setNotification({ ...notification, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert severity={notification.severity} variant="filled" sx={{ borderRadius: 3, width: '100%' }}>{notification.message}</Alert>
            </Snackbar>

            <Dialog open={errorDialog.open} onClose={() => setErrorDialog({ ...errorDialog, open: false })}>
                <DialogTitle sx={{ fontWeight: '900', color: 'error.main' }}>Attenzione</DialogTitle>
                <DialogContent><Typography variant="body2">{errorDialog.message}</Typography></DialogContent>
                <DialogActions><Button onClick={() => setErrorDialog({ ...errorDialog, open: false })} sx={{ fontWeight: 'bold' }}>Chiudi</Button></DialogActions>
            </Dialog>
        </Box>
    );
}