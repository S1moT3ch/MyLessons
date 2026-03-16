import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, Paper, Grid, CircularProgress, IconButton,
    Stack, useMediaQuery, useTheme, Card, CardContent, Avatar
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
    TrendingUp as TrendingUpIcon,
    AccountBalanceWallet as WalletIcon,
    Savings as SavingsIcon,
    Visibility as VisibilityIcon,
    VisibilityOff as VisibilityOffIcon,
    Person as PersonIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';
import { APPS_SCRIPT_URL } from "./config/config";

export default function FinancialDashboard() {
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState([]);
    const [showPrivacy, setShowPrivacy] = useState(true);

    const fetchData = useCallback(async () => {
        const sessionStr = Cookies.get('user_session');
        if (!sessionStr) return navigate('/login');
        const session = JSON.parse(sessionStr);

        setLoading(true);
        try {
            const response = await fetch(`${APPS_SCRIPT_URL}?action=getTeacherSubscribers&teacherId=${session.sub}&token=${session.id_token}`);
            const result = await response.json();
            if (result.status === "success") setData(result.data);
        } catch (error) { console.error(error); } finally { setLoading(false); }
    }, [navigate]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // CALCOLI GLOBALI
    const stats = data.reduce((acc, student) => {
        const rate = student.tariffa || 0;
        const totalEarned = student.lezioniSvolte * rate;
        const toCollect = student.lezioniDaPagare * rate;
        const alreadyPaid = totalEarned - toCollect;

        acc.totalPotential += totalEarned;
        acc.totalCollected += alreadyPaid;
        acc.totalPending += toCollect;
        return acc;
    }, { totalPotential: 0, totalCollected: 0, totalPending: 0 });

    const formatMoney = (amount) => {
        if (showPrivacy) return "••••€";
        return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount);
    };

    if (loading) return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <CircularProgress />
        </Box>
    );

    return (
        <Box sx={{ p: isMobile ? 2 : 4, maxWidth: 900, mx: 'auto', bgcolor: isMobile ? '#f8f9fa' : 'transparent', minHeight: '100vh', pb: 10 }}>

            {/* Header */}
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 4 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                    <IconButton onClick={() => navigate(-1)} sx={{ bgcolor: 'white', boxShadow: 1 }}><ArrowBackIcon /></IconButton>
                    <Typography variant="h5" fontWeight="900">Guadagni</Typography>
                </Stack>
                <IconButton onClick={() => setShowPrivacy(!showPrivacy)} color="primary">
                    {showPrivacy ? <VisibilityIcon /> : <VisibilityOffIcon />}
                </IconButton>
            </Stack>

            {/* KPI Cards */}
            <Grid container spacing={2} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={4}>
                    <StatCard title="Incasso Totale" value={stats.totalCollected} icon={<SavingsIcon color="success" />} color="#e8f5e9" />
                </Grid>
                <Grid item xs={12} sm={4}>
                    <StatCard title="In Attesa" value={stats.totalPending} icon={<WalletIcon color="error" />} color="#ffebee" />
                </Grid>
                <Grid item xs={12} sm={4}>
                    <StatCard title="Potenziale" value={stats.totalPotential} icon={<TrendingUpIcon color="primary" />} color="#e3f2fd" />
                </Grid>
            </Grid>

            <Typography variant="h6" fontWeight="800" sx={{ mb: 2, ml: 1 }}>Dettaglio Studenti</Typography>

            {/* Lista Studenti */}
            <Stack spacing={2}>
                {data.map((student, index) => {
                    const studentPaid = (student.lezioniSvolte - student.lezioniDaPagare) * (student.tariffa || 0);
                    const studentPending = student.lezioniDaPagare * (student.tariffa || 0);

                    return (
                        <Paper key={index} elevation={0} sx={{ p: 2, borderRadius: 4, border: '1px solid #eee' }}>
                            <Stack direction="row" spacing={2} alignItems="center">
                                <Avatar sx={{ bgcolor: 'grey.200', color: 'grey.700' }}><PersonIcon /></Avatar>
                                <Box sx={{ flexGrow: 1 }}>
                                    <Typography variant="subtitle2" fontWeight="700">{student.studentName}</Typography>
                                    <Typography variant="caption" color="text.secondary">Tariffa: {student.tariffa}€/lez</Typography>
                                </Box>
                                <Box sx={{ textAlign: 'right' }}>
                                    <Typography variant="body2" fontWeight="800" color="success.main">
                                        {formatMoney(studentPaid)}
                                    </Typography>
                                    <Typography variant="caption" fontWeight="bold" color="error.main">
                                        {studentPending > 0 ? `-${formatMoney(studentPending)}` : "Saldato"}
                                    </Typography>
                                </Box>
                            </Stack>
                        </Paper>
                    );
                })}
            </Stack>
        </Box>
    );

    // Sottocomponente per le Card in alto
    function StatCard({ title, value, icon, color }) {
        return (
            <Card elevation={0} sx={{ borderRadius: 4, bgcolor: color, border: '1px solid rgba(0,0,0,0.05)' }}>
                <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Box>
                            <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ textTransform: 'uppercase' }}>{title}</Typography>
                            <Typography variant="h5" fontWeight="900">{formatMoney(value)}</Typography>
                        </Box>
                        <Avatar sx={{ bgcolor: 'white', boxShadow: 1 }}>{icon}</Avatar>
                    </Stack>
                </CardContent>
            </Card>
        );
    }
}