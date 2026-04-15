import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, CircularProgress, IconButton,
    Card, Stack, Paper, Divider, useMediaQuery, useTheme,
    ToggleButton, ToggleButtonGroup, Tab, Tabs
} from '@mui/material';
import {
    ArrowBack as ArrowBackIcon,
    CheckCircle as ConfirmIcon,
    CalendarMonth as CalendarIcon,
    Cancel as CancelIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';
import { APPS_SCRIPT_URL } from "./config/config";

export default function TeacherFeedbackPage() {
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const [loading, setLoading] = useState(true);
    const [feedbackList, setFeedbackList] = useState([]);

    // Filtri: 'today', 'specific', 'all'
    const [viewFilter, setViewFilter] = useState('today');
    const [selectedDay, setSelectedDay] = useState(new Date().toLocaleDateString('it-IT', { weekday: 'long' }).charAt(0).toUpperCase() + new Date().toLocaleDateString('it-IT', { weekday: 'long' }).slice(1));

    const giorniSettimana = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

    const fetchData = useCallback(async () => {
        const sessionStr = Cookies.get('user_session');
        if (!sessionStr) return navigate('/login');
        const session = JSON.parse(sessionStr);
        const teacherFullName = `${session.given_name} ${session.family_name}`;

        setLoading(true);
        try {
            const res = await fetch(`${APPS_SCRIPT_URL}?action=getTeacherFeedbackSummary&teacherName=${encodeURIComponent(teacherFullName)}&token=${session.id_token}`);
            const result = await res.json();
            if (result.status === "success") {
                setFeedbackList(result.data);
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [navigate]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const renderFeedbackCard = (item, idx) => (
        <Card key={idx} elevation={0} sx={{
            borderRadius: 4, border: '1px solid',
            borderColor: item.status === "Assente" ? '#ffcdd2' : '#e0e0e0',
            bgcolor: 'white'
        }}>
            <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography sx={{ minWidth: 55, fontWeight: '900', color: 'text.secondary' }}>
                    {item.ora.slice(0, 2)}:{item.ora.slice(2)}
                </Typography>
                <Divider orientation="vertical" flexItem />
                <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="body1" fontWeight="800">{item.studentName}</Typography>

                    <Stack direction="row" alignItems="center" spacing={0.5}>
                        {item.status === "Confermata" ?
                            <ConfirmIcon sx={{ fontSize: 16, color: '#4caf50' }} /> :
                            <CancelIcon sx={{ fontSize: 16, color: '#f44336' }} />
                        }
                        <Typography variant="caption" fontWeight="bold" color={item.status === "Assente" ? "error.main" : "success.main"}>
                            {item.status === "Assente" ? "NON DISPONIBILE" : "CONFERMATO"}
                        </Typography>
                    </Stack>

                    {/* --- NUOVA SEZIONE PROPOSTA ALTERNATIVA --- */}
                    {item.status === "Assente" && item.preferenza && (
                        <Box sx={{
                            mt: 1, p: 1,
                            bgcolor: 'primary.light',
                            color: 'primary.contrastText',
                            borderRadius: 2,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1
                        }}>
                            <CalendarIcon sx={{ fontSize: 16 }} />
                            <Typography variant="caption" fontWeight="900">
                                PROPONE: {item.preferenza.toUpperCase()}
                            </Typography>
                        </Box>
                    )}

                    {item.note && (
                        <Typography variant="body2" sx={{
                            mt: 1, p: 1,
                            bgcolor: '#f5f5f5',
                            borderRadius: 2,
                            fontSize: '0.85rem',
                            fontStyle: 'italic',
                            borderLeft: '4px solid #ddd'
                        }}>
                            "{item.note}"
                        </Typography>
                    )}
                </Box>
            </Box>
        </Card>
    );

    const renderContent = () => {
        if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>;

        let displayData = [];
        if (viewFilter === 'today' || viewFilter === 'specific') {
            const targetDay = viewFilter === 'today' ? selectedDay : selectedDay;
            displayData = feedbackList.filter(f => f.giorno === targetDay).sort((a, b) => a.ora.localeCompare(b.ora));

            return (
                <Stack spacing={1.5}>
                    {displayData.length > 0 ? (
                        displayData.map((item, idx) => renderFeedbackCard(item, idx))
                    ) : (
                        <Typography variant="body2" textAlign="center" color="text.secondary" sx={{ mt: 4 }}>
                            Nessuna risposta per {targetDay}
                        </Typography>
                    )}
                </Stack>
            );
        }

        // Vista Settimana Intera
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

            {/* Header */}
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                    <IconButton onClick={() => navigate(-1)}><ArrowBackIcon /></IconButton>
                    <Typography variant="h5" fontWeight="900">Risposte</Typography>
                </Stack>

                <ToggleButtonGroup
                    value={viewFilter}
                    exclusive
                    onChange={(e, val) => val && setViewFilter(val)}
                    size="small"
                    color="primary"
                    sx={{ bgcolor: 'white' }}
                >
                    <ToggleButton value="specific" sx={{ px: 2, fontWeight: 'bold' }}>Giorno</ToggleButton>
                    <ToggleButton value="all" sx={{ px: 2, fontWeight: 'bold' }}>Settimana</ToggleButton>
                </ToggleButtonGroup>
            </Stack>

            {/* Selettore Giorno (mostrato solo se 'specific' o 'today') */}
            {viewFilter !== 'all' && (
                <Paper elevation={0} sx={{ mb: 3, borderRadius: 4, border: '1px solid #e0e0e0', overflow: 'hidden' }}>
                    <Tabs
                        value={giorniSettimana.indexOf(selectedDay)}
                        onChange={(e, val) => {
                            setSelectedDay(giorniSettimana[val]);
                            if(viewFilter === 'today') setViewFilter('specific');
                        }}
                        variant="scrollable"
                        scrollButtons="auto"
                        sx={{ bgcolor: 'white' }}
                    >
                        {giorniSettimana.map((g, i) => (
                            <Tab key={i} label={isMobile ? g.substring(0, 3) : g} sx={{ fontWeight: 'bold', minWidth: isMobile ? 60 : 100 }} />
                        ))}
                    </Tabs>
                </Paper>
            )}

            <Box sx={{ mt: 2 }}>
                {renderContent()}
            </Box>
        </Box>
    );
}