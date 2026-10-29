import { createRoot } from 'react-dom/client';
import App from './App';
import WorkspaceHome from './WorkspaceHome';
import './styles.css';
// Without a workspace in the address, show the workspace list; with one, enter that office.
const params = new URLSearchParams(location.search);
createRoot(document.getElementById('root')!).render(params.get('room') && !params.has('new') ? <App /> : <WorkspaceHome />);
