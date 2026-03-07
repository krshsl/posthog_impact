import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Topbar } from '@/components/layout/Topbar';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { DashboardPage } from '@/pages/DashboardPage';
import { UserProfilePage } from '@/pages/UserProfilePage';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-cyan-500/30">
        <Topbar />
        <PageWrapper>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/user/:author" element={<UserProfilePage />} />
          </Routes>
        </PageWrapper>
      </div>
    </BrowserRouter>
  );
}

export default App;
