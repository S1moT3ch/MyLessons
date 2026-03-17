import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, Paper, CircularProgress, IconButton,
    Stack, Divider, Avatar, Card, CardContent,
    useMediaQuery, useTheme, Button, Fade, Grow, Zoom
} from '@mui/material';
import {
    ArrowBack as ArrowBackIcon,
    School as SchoolIcon,
    CheckCircleOutline as DoneIcon,
    Payments as PaymentsIcon,
    EventAvailable as EventIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';
import { APPS_SCRIPT_URL } from "./config/config";

export default function StudentBalancePage() {
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const [loading, setLoading] = useState(true);
    const [balances, setBalances] = useState([]);

    const fetchData = useCallback(async () => {
        const sessionStr = Cookies.get('user_session');
        if (!sessionStr) return navigate('/login');
        const session = JSON.parse(sessionStr);

        setLoading(true);
        try {
            const response = await fetch(`${APPS_SCRIPT_URL}?action=getStudentBalances&studentEmail=${encodeURIComponent(session.email)}&token=${session.id_token}`);
            const result = await response.json();

            if (result.status === "success") {
                setBalances(result.data);
            }
        } catch (error) {
            console.error("Errore recupero bilancio:", error);
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    useEffect(() => { fetchData(); }, [fetchData]);

    if (loading) return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <CircularProgress color="primary" />
        </Box>
    );

    if (balances.length === 0) return (
        <Fade in={true} timeout={800}>
            <Box sx={{ p: 4, textAlign: 'center', mt: 10 }}>
                <DoneIcon sx={{ fontSize: 80, color: 'success.light', mb: 2 }} />
                <Typography variant="h5" fontWeight="900">Sei in pari!</Typography>
                <Typography variant="body1" color="text.secondary">Non hai lezioni da saldare al momento.</Typography>
                <Button
                    onClick={() => navigate(-1)}
                    variant="contained"
                    sx={{ mt: 4, borderRadius: 4, px: 4, py: 1.5, fontWeight: 'bold' }}
                >
                    Torna alla Home
                </Button>
            </Box>
        </Fade>
    );

    return (
        <Box sx={{ p: isMobile ? 2 : 4, maxWidth: 500, mx: 'auto', minHeight: '100vh', bgcolor: '#f8f9fa', pb: 10 }}>

            {/* Header Animato */}
            <Fade in={true} timeout={500}>
                <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 4 }}>
                    <IconButton
                        onClick={() => navigate(-1)}
                        sx={{ bgcolor: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', width: 42, height: 42 }}
                    >
                        <ArrowBackIcon fontSize="small" />
                    </IconButton>
                    <Box>
                        <Typography variant="h5" fontWeight="900" sx={{ lineHeight: 1 }}>Il mio Bilancio</Typography>
                        <Typography variant="caption" color="text.secondary">Gestione pagamenti</Typography>
                    </Box>
                </Stack>
            </Fade>

            {balances.length === 1 ? (
                // --- LAYOUT SINGOLO INSEGNANTE (Focus) ---
                <Grow in={true} timeout={600}>
                    <Box>
                        <Paper elevation={0} sx={{ p: 3, borderRadius: 6, border: '1px solid #eee', bgcolor: 'white', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                            <Avatar sx={{ width: 60, height: 60, mx: 'auto', mb: 2, bgcolor: 'primary.light', color: 'primary.main', boxShadow: '0 4px 12px rgba(25, 118, 210, 0.2)' }}>
                                <SchoolIcon fontSize="medium" />
                            </Avatar>

                            <Typography variant="h6" fontWeight="900" sx={{ mb: 3 }}>
                                {balances[0].teacherName}
                            </Typography>

                            <Zoom in={true} style={{ transitionDelay: '300ms' }}>
                                <Box sx={{ mb: 4, py: 3, px: 2, bgcolor: '#fff5f5', borderRadius: 5, border: '2px solid #ffe3e3' }}>
                                    <Typography variant="caption" color="error.main" fontWeight="900" sx={{ textTransform: 'uppercase', letterSpacing: 1.5, display: 'block', mb: 0.5 }}>
                                        DA SALDARE
                                    </Typography>
                                    <Typography variant="h2" fontWeight="900" color="error.main" sx={{ letterSpacing: -1 }}>
                                        {balances[0].amountDue.toFixed(2)}€
                                    </Typography>
                                </Box>
                            </Zoom>

                            <GridStats svolte={balances[0].lezioniSvolte} daPagare={balances[0].lezioniDaPagare} />
                        </Paper>
                    </Box>
                </Grow>
            ) : (
                // --- LAYOUT MULTI INSEGNANTE (Lista Animata) ---
                <Stack spacing={2.5}>
                    {balances.map((item, index) => (
                        <Grow in={true} timeout={400 + (index * 200)} key={index}>
                            <Card elevation={0} sx={{ borderRadius: 5, border: '1px solid #eee', transition: '0.3s', '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(0,0,0,0.05)' } }}>
                                <CardContent sx={{ p: 2.5 }}>
                                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                                        <Typography variant="subtitle1" fontWeight="900" sx={{ color: 'text.primary' }}>{item.teacherName}</Typography>
                                        <Typography variant="h6" fontWeight="900" color="error.main">
                                            {item.amountDue.toFixed(2)}€
                                        </Typography>
                                    </Stack>

                                    <Divider sx={{ mb: 2, borderStyle: 'dashed', opacity: 0.6 }} />

                                    <Stack direction="row" spacing={4}>
                                        <Box>
                                            <Typography variant="caption" color="text.disabled" sx={{ fontWeight: '900', fontSize: 10, textTransform: 'uppercase' }}>Svolte</Typography>
                                            <Typography variant="body1" fontWeight="800" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <EventIcon sx={{ fontSize: 16, color: 'primary.main' }} /> {item.lezioniSvolte}
                                            </Typography>
                                        </Box>
                                        <Box>
                                            <Typography variant="caption" color="text.disabled" sx={{ fontWeight: '900', fontSize: 10, textTransform: 'uppercase' }}>In Debito</Typography>
                                            <Typography variant="body1" fontWeight="800" color="error.main" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <PaymentsIcon sx={{ fontSize: 16 }} /> {item.lezioniDaPagare}
                                            </Typography>
                                        </Box>
                                    </Stack>
                                </CardContent>
                            </Card>
                        </Grow>
                    ))}

                    <Zoom in={true} style={{ transitionDelay: '800ms' }}>
                        <Paper elevation={8} sx={{ p: 2.5, mt: 2, bgcolor: 'primary.main', color: 'white', borderRadius: 5, boxShadow: '0 8px 24px rgba(25, 118, 210, 0.4)' }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Box>
                                    <Typography variant="caption" sx={{ opacity: 0.8, fontWeight: 'bold', textTransform: 'uppercase' }}>Totale Complessivo</Typography>
                                    <Typography variant="h6" fontWeight="900" sx={{ lineHeight: 1 }}>DA PAGARE</Typography>
                                </Box>
                                <Typography variant="h4" fontWeight="1000">
                                    {balances.reduce((acc, curr) => acc + curr.amountDue, 0).toFixed(2)}€
                                </Typography>
                            </Stack>
                        </Paper>
                    </Zoom>
                </Stack>
            )}
        </Box>
    );

    function GridStats({ svolte, daPagare }) {
        return (
            <Stack direction="row" spacing={2}>
                <Box sx={{ flex: 1, p: 2, bgcolor: '#f0f4f8', borderRadius: 4, transition: '0.3s', '&:hover': { bgcolor: '#e2e8f0' } }}>
                    <Typography variant="caption" color="text.secondary" fontWeight="900" sx={{ textTransform: 'uppercase' }}>Tot. Svolte</Typography>
                    <Typography variant="h5" fontWeight="900" sx={{ mt: 0.5 }}>{svolte}</Typography>
                </Box>
                <Box sx={{ flex: 1, p: 2, bgcolor: '#fff5f5', borderRadius: 4, transition: '0.3s', '&:hover': { bgcolor: '#ffebeb' } }}>
                    <Typography variant="caption" color="text.secondary" fontWeight="900" sx={{ textTransform: 'uppercase' }}>Da Saldare</Typography>
                    <Typography variant="h5" fontWeight="900" color="error.main" sx={{ mt: 0.5 }}>{daPagare}</Typography>
                </Box>
            </Stack>
        );
    }
}