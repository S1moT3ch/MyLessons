import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, Paper, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Avatar, Chip,
    CircularProgress, IconButton, Stack, TextField, InputAdornment,
    useMediaQuery, useTheme, Divider, Dialog, DialogTitle,
    DialogContent, DialogActions, Button, Menu, MenuItem, ListItemIcon, ListItemText
} from '@mui/material';
import {
    ArrowBack as ArrowBackIcon,
    Search as SearchIcon,
    Paid as PaidIcon,
    Euro as EuroIcon,
    Settings as SettingsIcon,
    Save as SaveIcon,
    Visibility as VisibilityIcon,
    VisibilityOff as VisibilityOffIcon,
    CalendarMonth as CalendarIcon,
    AccountBalanceWallet as WalletIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';
import { APPS_SCRIPT_URL } from "./config/config";

export default function StudentsManagementPage() {
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const [loading, setLoading] = useState(true);
    const [studentsData, setStudentsData] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Privacy selettiva per il debito economico
    const [visibleStudentEmail, setVisibleStudentEmail] = useState(null);

    const [payDialog, setPayDialog] = useState({ open: false, student: null, amountPaid: 1 });
    const [rateDialog, setRateDialog] = useState({ open: false, student: null, rate: 0 });
    const [isSaving, setIsSaving] = useState(false);
    const [anchorEl, setAnchorEl] = useState(null);
    const [selectedStudent, setSelectedStudent] = useState(null);

    const fetchData = useCallback(async () => {
        const sessionStr = Cookies.get('user_session');
        if (!sessionStr) return navigate('/login');
        const session = JSON.parse(sessionStr);

        setLoading(true);
        try {
            const response = await fetch(`${APPS_SCRIPT_URL}?action=getTeacherSubscribers&teacherId=${session.sub}&token=${session.id_token}`);
            const result = await response.json();
            if (result.status === "success") setStudentsData(result.data);
        } catch (error) { console.error(error); } finally { setLoading(false); }
    }, [navigate]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleConfirmPayment = async () => {
        const sessionStr = Cookies.get('user_session');
        if (!sessionStr || !payDialog.student) return;
        const session = JSON.parse(sessionStr);

        const newDebtValue = Math.max(0, payDialog.student.lezioniDaPagare - payDialog.amountPaid);

        setIsSaving(true);
        try {
            const response = await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'cors',
                body: JSON.stringify({
                    action: "updatePaidLessons",
                    id_token: session.id_token,
                    teacherId: session.sub,
                    studentEmail: payDialog.student.studentEmail,
                    newPaidValue: newDebtValue
                })
            });
            if ((await response.text()).includes("Success")) {
                setStudentsData(prev => prev.map(s => s.studentEmail === payDialog.student.studentEmail ? { ...s, lezioniDaPagare: newDebtValue } : s));
                setPayDialog({ open: false, student: null, amountPaid: 1 });
            }
        } catch (e) { console.error(e); } finally { setIsSaving(false); }
    };

    const handleSaveRate = async () => {
        const sessionStr = Cookies.get('user_session');
        if (!sessionStr || !rateDialog.student) return;
        const session = JSON.parse(sessionStr);

        setIsSaving(true);
        try {
            const response = await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'cors',
                body: JSON.stringify({
                    action: "updateStudentRate",
                    id_token: session.id_token,
                    teacherId: session.sub,
                    studentEmail: rateDialog.student.studentEmail,
                    newRate: rateDialog.rate
                })
            });
            if ((await response.text()).includes("Success")) {
                setStudentsData(prev => prev.map(s => s.studentEmail === rateDialog.student.studentEmail ? { ...s, tariffa: rateDialog.rate } : s));
                setRateDialog({ open: false, student: null, rate: 0 });
            }
        } catch (e) { console.error(e); } finally { setIsSaving(false); }
    };

    const handleOpenMenu = (event, student) => {
        setAnchorEl(event.currentTarget);
        setSelectedStudent(student);
    };

    const handleCloseMenu = () => {
        setAnchorEl(null);
        setSelectedStudent(null);
    };

    const formatCurrency = (studentEmail, amount) => {
        if (visibleStudentEmail !== studentEmail) return "•••€";
        return `${amount.toFixed(2)}€`;
    };

    const filteredStudents = studentsData.filter(s =>
        s.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.studentEmail.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // --- CARD MOBILE ---
    const MobileCard = ({ student }) => {
        const isVisible = visibleStudentEmail === student.studentEmail;
        const isSettled = student.lezioniDaPagare === 0;

        return (
            <Paper elevation={0} sx={{ p: 2, mb: 2, borderRadius: 4, border: '1px solid #eee', bgcolor: 'white' }}>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
                    <Avatar sx={{ bgcolor: 'primary.main', fontWeight: 'bold', width: 40, height: 40, fontSize: '1rem' }}>
                        {student.studentName.charAt(0)}
                    </Avatar>
                    <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
                        <Typography variant="subtitle2" fontWeight="800" noWrap>{student.studentName}</Typography>
                        <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                            <Chip icon={<CalendarIcon sx={{ fontSize: '12px !important' }} />} label={student.lessonCount} size="small" variant="outlined" sx={{ height: 20, fontSize: 10 }} />
                            <Typography variant="caption" color="text.secondary">Tot: <b>{student.lezioniSvolte}</b></Typography>
                            <Typography variant="caption" color={isSettled ? "success.main" : "error.main"}>Debt: <b>{student.lezioniDaPagare}</b></Typography>
                        </Stack>
                    </Box>
                    <IconButton size="small" onClick={(e) => handleOpenMenu(e, student)}>
                        <SettingsIcon fontSize="inherit" color="action" />
                    </IconButton>
                </Stack>

                <Divider sx={{ mb: 1.5, borderStyle: 'dashed', opacity: 0.5 }} />

                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box
                        onClick={() => setVisibleStudentEmail(isVisible ? null : student.studentEmail)}
                        sx={{ cursor: 'pointer', p: 0.5, borderRadius: 1 }}
                    >
                        <Typography variant="caption" color="text.disabled" display="block" sx={{ fontWeight: 'bold', lineHeight: 1, fontSize: 9 }}>
                            DEBITO EURO
                        </Typography>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                            <Typography variant="body1" fontWeight="900" color={isSettled ? "success.main" : "error.main"}>
                                {formatCurrency(student.studentEmail, student.lezioniDaPagare * (student.tariffa || 0))}
                            </Typography>
                            {isVisible ? <VisibilityIcon sx={{ fontSize: 12, color: 'text.disabled' }} /> : <VisibilityOffIcon sx={{ fontSize: 12, color: 'text.disabled' }} />}
                        </Stack>
                    </Box>

                    <Button
                        variant={isSettled ? "text" : "contained"}
                        color={isSettled ? "success" : "primary"}
                        size="small"
                        onClick={() => setPayDialog({ open: true, student, amountPaid: student.lezioniDaPagare || 1 })}
                        disabled={isSettled}
                        sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 'bold', minWidth: 80 }}
                    >
                        {isSettled ? 'Saldato' : 'Incassa'}
                    </Button>
                </Stack>
            </Paper>
        );
    };

    return (
        <Box sx={{ p: isMobile ? 2 : 4, maxWidth: 900, mx: 'auto', bgcolor: isMobile ? '#f8f9fa' : 'transparent', minHeight: '100vh' }}>

            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
                <IconButton onClick={() => navigate(-1)} sx={{ bgcolor: 'white', boxShadow: 1, width: 35, height: 35 }}>
                    <ArrowBackIcon fontSize="small" />
                </IconButton>
                <Typography variant="h6" fontWeight="900">Gestione Studenti</Typography>
            </Stack>

            <TextField
                fullWidth
                placeholder="Cerca..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                sx={{ mb: 3, bgcolor: 'white' }}
                InputProps={{
                    startAdornment: (<InputAdornment position="start"><SearchIcon fontSize="small" color="action" /></InputAdornment>),
                    style: { borderRadius: 16, height: 45 }
                }}
            />

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress size={30} /></Box>
            ) : isMobile ? (
                <Box>{filteredStudents.map((s, i) => <MobileCard key={i} student={s} />)}</Box>
            ) : (
                <TableContainer component={Paper} sx={{ borderRadius: 4, border: '1px solid #eee', boxShadow: 'none' }}>
                    <Table size="small">
                        <TableHead sx={{ bgcolor: '#fafafa' }}>
                            <TableRow>
                                <TableCell sx={{ fontWeight: '800' }}>Studente</TableCell>
                                <TableCell align="center" sx={{ fontWeight: '800' }}>In Agenda</TableCell>
                                <TableCell align="center" sx={{ fontWeight: '800' }}>Svolte (Tot)</TableCell>
                                <TableCell align="center" sx={{ fontWeight: '800' }}>Da Pagare</TableCell>
                                <TableCell align="center" sx={{ fontWeight: '800' }}>Debito (€)</TableCell>
                                <TableCell align="right" sx={{ fontWeight: '800' }}>Azioni</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredStudents.map((student, index) => {
                                const isSettled = student.lezioniDaPagare === 0;
                                return (
                                    <TableRow key={index} hover>
                                        <TableCell>
                                            <Typography variant="body2" fontWeight="700">{student.studentName}</Typography>
                                            <Typography variant="caption" color="text.secondary">{student.studentEmail}</Typography>
                                        </TableCell>
                                        <TableCell align="center">
                                            <Chip label={student.lessonCount} size="small" variant="outlined" />
                                        </TableCell>
                                        <TableCell align="center">{student.lezioniSvolte}</TableCell>
                                        <TableCell align="center">
                                            <Chip
                                                label={student.lezioniDaPagare}
                                                size="small"
                                                color={isSettled ? "success" : "error"}
                                            />
                                        </TableCell>
                                        <TableCell
                                            align="center"
                                            sx={{
                                                fontWeight: 'bold',
                                                cursor: 'pointer',
                                                color: isSettled ? "success.main" : "error.main"
                                            }}
                                            onClick={() => setVisibleStudentEmail(visibleStudentEmail === student.studentEmail ? null : student.studentEmail)}
                                        >
                                            {formatCurrency(student.studentEmail, student.lezioniDaPagare * (student.tariffa || 0))}
                                        </TableCell>
                                        <TableCell align="right">
                                            <IconButton size="small" onClick={(e) => handleOpenMenu(e, student)}><SettingsIcon fontSize="inherit" /></IconButton>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                    <Button
                        onClick={() => navigate('/revenue')}
                        variant="outlined"
                        startIcon={<WalletIcon />}
                    >
                        Visualizza Guadagni
                    </Button>
                </TableContainer>
            )}

            {/* MENU E DIALOGS */}
            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleCloseMenu} slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
                <MenuItem onClick={() => { setPayDialog({ open: true, student: selectedStudent, amountPaid: selectedStudent?.lezioniDaPagare || 1 }); handleCloseMenu(); }}>
                    <ListItemIcon><PaidIcon fontSize="small" color="primary" /></ListItemIcon>
                    <ListItemText primary="Registra Pagamento" primaryTypographyProps={{ variant: 'body2' }} />
                </MenuItem>
                <MenuItem onClick={() => { setRateDialog({ open: true, student: selectedStudent, rate: selectedStudent?.tariffa || 0 }); handleCloseMenu(); }}>
                    <ListItemIcon><EuroIcon fontSize="small" color="success" /></ListItemIcon>
                    <ListItemText primary="Imposta Tariffa" primaryTypographyProps={{ variant: 'body2' }} />
                </MenuItem>
            </Menu>

            {/* DIALOG INCASSO */}
            <Dialog open={payDialog.open} onClose={() => !isSaving && setPayDialog({ ...payDialog, open: false })} fullWidth maxWidth="xs">
                <DialogTitle sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>Saldo Lezioni</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{ mb: 2 }}>Studente: {payDialog.student?.studentName}</Typography>
                    <TextField
                        fullWidth
                        type="number"
                        label="Lezioni saldate"
                        value={payDialog.amountPaid}
                        onChange={(e) => setPayDialog({ ...payDialog, amountPaid: parseInt(e.target.value) || 0 })}
                        error={payDialog.amountPaid > (payDialog.student?.lezioniDaPagare || 0)}
                        helperText={payDialog.amountPaid > (payDialog.student?.lezioniDaPagare || 0) ? "Valore superiore al debito!" : ""}
                    />
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setPayDialog({ ...payDialog, open: false })}>Annulla</Button>
                    <Button
                        onClick={handleConfirmPayment}
                        variant="contained"
                        disabled={isSaving || payDialog.amountPaid > (payDialog.student?.lezioniDaPagare || 0) || payDialog.amountPaid <= 0}
                    >
                        Conferma
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={rateDialog.open} onClose={() => !isSaving && setRateDialog({ ...rateDialog, open: false })} fullWidth maxWidth="xs">
                <DialogTitle sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>Tariffa Lezione</DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth
                        type="number"
                        label="Prezzo (€)"
                        value={rateDialog.rate}
                        onChange={(e) => setRateDialog({ ...rateDialog, rate: parseFloat(e.target.value) || 0 })}
                        InputProps={{ startAdornment: <InputAdornment position="start">€</InputAdornment> }}
                        sx={{ mt: 2 }}
                    />
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setRateDialog({ ...rateDialog, open: false })}>Chiudi</Button>
                    <Button onClick={handleSaveRate} variant="contained" startIcon={<SaveIcon />} disabled={isSaving}>Salva</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}