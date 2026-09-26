import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { ChatPanel } from './components/ChatPanel';
import { SeatWatchBanner } from './components/SeatWatchBanner';
import { HomePage } from './pages/HomePage';
import { SearchResultsPage } from './pages/SearchResultsPage';
import { BookingPage } from './pages/BookingPage';
import { ConfirmationPage } from './pages/ConfirmationPage';
import { ManageBookingPage } from './pages/ManageBookingPage';
import { SubjectsPage } from './pages/SubjectsPage';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <Header />
      <main style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/flights" element={<SearchResultsPage />} />
          <Route path="/book/:flightId" element={<BookingPage />} />
          <Route path="/confirmation/:pnr" element={<ConfirmationPage />} />
          <Route path="/manage" element={<ManageBookingPage />} />
          <Route path="/subjects" element={<SubjectsPage />} />
        </Routes>
      </main>
      <Footer />
      <ChatPanel />
      <SeatWatchBanner />
    </BrowserRouter>
  );
}

export default App;
