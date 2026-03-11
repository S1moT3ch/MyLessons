import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Cookies from 'js-cookie';
import {Box} from "@mui/material";

import LoginPage from './components/LoginPage';
import DashboardInsegnante from './components/DashboardInsegnante';
import DashboardStudente from './components/DashboardStudente';
import SchedulePage from "./components/SchedulePage";

// Componente per proteggere le rotte e gestire il layout
const DashboardLayout = () => {
    const sessionCookie = Cookies.get('user_session');

    if (!sessionCookie) {
        return <Navigate to="/login" replace />;
    }

    // Se esiste la sessione, rendiamo l'Outlet (le rotte figlie)
    return (
        <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>
            <Outlet />
        </Box>
    );
};

// Helper per decidere quale Home Dashboard mostrare
const DashboardHome = () => {
    const session = JSON.parse(Cookies.get('user_session'));
    return session.role === 'Insegnante'
        ? <DashboardInsegnante user={session} />
        : <DashboardStudente user={session} />;
};

function App() {
    return (
        <Router>
            <Routes>
                {/* Rotta Pubblica */}
                <Route path="/login" element={<LoginPage />} />

                {/* Rotte Protette Annidate */}
                <Route path="/dashboard" element={<DashboardLayout />}>
                    {/* Questa è la rotta base /dashboard */}
                    <Route index element={<DashboardHome />} />

                    {/* Questa è la rotta /dashboard/schedule */}
                    <Route
                        path="schedule"
                        element={
                            <SchedulePageWrapper />
                        }
                    />
                </Route>

                {/* Redirect automatico */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
        </Router>
    );
}

// Wrapper per passare la sessione a SchedulePage in modo sicuro
const SchedulePageWrapper = () => {
    const session = JSON.parse(Cookies.get('user_session'));
    return <SchedulePage user={session} />;
}

export default App;