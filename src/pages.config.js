import Dashboard from './pages/Dashboard';
import Deliveries from './pages/Deliveries';
import Alerts from './pages/Alerts';
import Settings from './pages/Settings';
import RingManagement from './pages/RingManagement';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Deliveries": Deliveries,
    "Alerts": Alerts,
    "Settings": Settings,
    "RingManagement": RingManagement,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};