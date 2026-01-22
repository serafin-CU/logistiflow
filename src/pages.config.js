import Alerts from './pages/Alerts';
import Dashboard from './pages/Dashboard';
import Deliveries from './pages/Deliveries';
import RingManagement from './pages/RingManagement';
import Settings from './pages/Settings';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Alerts": Alerts,
    "Dashboard": Dashboard,
    "Deliveries": Deliveries,
    "RingManagement": RingManagement,
    "Settings": Settings,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};