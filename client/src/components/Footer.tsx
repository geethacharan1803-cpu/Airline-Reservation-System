import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__grid">
          <div>
            <div className="footer__brand">✈ SkyVoyage Airlines</div>
            <p className="footer__description">
              Experience world-class travel with intelligent booking, personalized recommendations, 
              and seamless service across 20 global destinations.
            </p>
          </div>
          <div>
            <div className="footer__title">Quick Links</div>
            <ul className="footer__links">
              <li><Link to="/">Search Flights</Link></li>
              <li><Link to="/manage">Manage Booking</Link></li>
              <li><Link to="/subjects">Curriculum</Link></li>
            </ul>
          </div>
          <div>
            <div className="footer__title">Support</div>
            <ul className="footer__links">
              <li><a href="#">Help Center</a></li>
              <li><a href="#">Baggage Policy</a></li>
              <li><a href="#">Refund Policy</a></li>
              <li><a href="#">Contact Us</a></li>
            </ul>
          </div>
          <div>
            <div className="footer__title">Legal</div>
            <ul className="footer__links">
              <li><a href="#">Terms of Service</a></li>
              <li><a href="#">Privacy Policy</a></li>
              <li><a href="#">Cookie Policy</a></li>
            </ul>
          </div>
        </div>
        <div className="footer__bottom">
          © {new Date().getFullYear()} SkyVoyage Airlines. All rights reserved. 
          This is a demonstration project.
        </div>
      </div>
    </footer>
  );
}
