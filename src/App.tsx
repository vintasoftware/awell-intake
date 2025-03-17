import { AppShell } from '@mantine/core';
import { ErrorBoundary, Loading, useMedplum, useMedplumProfile } from '@medplum/react';
import { IconUsers, IconHome, IconLogout } from '@tabler/icons-react';
import { Suspense } from 'react';
import { Route, Routes, useNavigate, useLocation } from 'react-router-dom';
import { PatientList } from './components/PatientList';
import { PatientDetail } from './components/PatientDetail';
import { HomePage } from './pages/HomePage';
import { LandingPage } from './pages/LandingPage';
import { SignInPage } from './pages/SignInPage';
import { MantineProvider, Text } from '@mantine/core';
import { BrowserRouter as Router } from 'react-router-dom';
import { MedplumProvider } from '@medplum/react';
import { theme } from './theme';
import { CalendarPage } from './pages/CalendarPage';

function MainLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { icon: IconHome, label: 'Home', path: '/' },
    { icon: IconUsers, label: 'Patients', path: '/patients' },
  ];

  return (
    <AppShell
      padding="md"
      navbar={{
        width: 250,
        breakpoint: 'sm',
        collapsed: { mobile: false },
      }}
    >
      <AppShell.Navbar p="xs" style={{ backgroundColor: 'var(--mantine-color-blue-6)' }}>
        <AppShell.Section mt="xs">
          <Text size="xl" fw={700} c="white" ta="center" mb="xl">
            Vinta Clinic
          </Text>
        </AppShell.Section>

        <AppShell.Section grow>
          {navItems.map((item) => (
            <div
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                padding: '12px 16px',
                marginBottom: '8px',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: location.pathname === item.path ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                transition: 'background-color 0.2s',
              }}
              onMouseOver={(e) => {
                if (location.pathname !== item.path) {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                }
              }}
              onMouseOut={(e) => {
                if (location.pathname !== item.path) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <item.icon size={20} />
              <Text>{item.label}</Text>
            </div>
          ))}
        </AppShell.Section>

        <AppShell.Section>
          <div
            style={{
              padding: '12px 16px',
              cursor: 'pointer',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            }}
            onClick={() => {
              // Add logout logic here
            }}
          >
            <IconLogout size={20} />
            <Text>Logout</Text>
          </div>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
        {children}
      </AppShell.Main>
    </AppShell>
  );
}

export function App(): JSX.Element | null {
  const medplum = useMedplum();
  const profile = useMedplumProfile();

  if (medplum.isLoading()) {
    return null;
  }

  return (
    <MedplumProvider medplum={medplum}>
      <MantineProvider theme={theme}>
        <Router>
          <ErrorBoundary>
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route path="/signin" element={<SignInPage />} />
                <Route
                  path="*"
                  element={
                    <MainLayout>
                      <Routes>
                        <Route path="/" element={profile ? <HomePage /> : <LandingPage />} />
                        <Route path="/patients" element={<PatientList />} />
                        <Route path="/patients/:id" element={<PatientDetail />} />
                        <Route path="/calendar" element={<CalendarPage />} />
                      </Routes>
                    </MainLayout>
                  }
                />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </Router>
      </MantineProvider>
    </MedplumProvider>
  );
}
