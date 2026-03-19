import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Accounts } from './pages/Accounts';
import { Proxies } from './pages/Proxies';
import { Actions } from './pages/Actions';
import { Jobs } from './pages/Jobs';
import { Identities } from './pages/Identities';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="proxies" element={<Proxies />} />
          <Route path="actions" element={<Actions />} />
          <Route path="jobs" element={<Jobs />} />
          <Route path="identities" element={<Identities />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
