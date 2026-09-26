import { Link, useLocation } from 'react-router-dom';
import { Plane } from 'lucide-react';

export function Header() {
  const location = useLocation();
  
  const isActive = (path: string) => location.pathname === path ? 'header__nav-link active' : 'header__nav-link';

  return (
    <header className="header">
      <div className="header__inner">
        <Link to="/" className="header__logo">
          <div className="header__logo-icon">
            <Plane size={20} />
          </div>
          SkyVoyage
        </Link>
        <nav className="header__nav">
          <Link to="/" className={isActive('/')}>Search Flights</Link>
          <Link to="/manage" className={isActive('/manage')}>Manage Booking</Link>
          <Link to="/subjects" className={isActive('/subjects')}>Curriculum</Link>
        </nav>
      </div>
    </header>
  );
}
