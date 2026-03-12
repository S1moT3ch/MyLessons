import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Cookies from 'js-cookie';
import { Box } from "@mui/material";

import LoginPage from './components/LoginPage';
import DashboardInsegnante from './components/DashboardInsegnante';
import DashboardStudente from './components/DashboardStudente';
import SchedulePage from "./components/SchedulePage";
import StudentSchedulePage from "./components/StudentSchedulePage";

// 1. Layout protetto: gestisce il controllo sessione una volta sola
const DashboardLayout = () => {
    const sessionCookie = Cookies.get('user_session');

    if (!sessionCookie) {
        return <Navigate to="/login" replace />;
    }

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>
            {/* Outlet renderizzerà o DashboardHome o SchedulePageWrapper */}
            <Outlet />
        </Box>
    );
};

// 2. Componente per la rotta "/" di /dashboard
const DashboardHome = () => {
    const sessionCookie = Cookies.get('user_session');
    if (!sessionCookie) return <Navigate to="/login" replace />;

    const session = JSON.parse(sessionCookie);
    return session.role === 'Insegnante'
        ? <DashboardInsegnante user={session} />
        : <DashboardStudente />; // DashboardStudente recupererà i dati dal cookie internamente
};

// 3. Wrapper specifico per differenziare l'agenda
const SchedulePageWrapper = () => {
    const sessionCookie = Cookies.get('user_session');
    if (!sessionCookie) return <Navigate to="/login" replace />;

    const session = JSON.parse(sessionCookie);

    return session.role === 'Insegnante'
        ? <SchedulePage user={session} />
        : <StudentSchedulePage />;
};

function App() {
    return (
        <Router>
            <Routes>
                {/* Rotta Pubblica */}
                <Route path="/login" element={<LoginPage />} />

                {/* Rotte Protette */}
                <Route path="/dashboard" element={<DashboardLayout />}>
                    {/* Questo renderizza DashboardInsegnante o DashboardStudente a /dashboard */}
                    <Route index element={<DashboardHome />} />

                    {/* Questo renderizza SchedulePage o StudentSchedulePage a /dashboard/schedule */}
                    <Route path="schedule" element={<SchedulePageWrapper />} />
                </Route>

                {/* Redirect di fallback */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
        </Router>
    );
}

export default App;