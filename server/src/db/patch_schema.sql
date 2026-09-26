-- ==========================================================
-- SkyVoyage SeatWatch & Dynamic Upgrade Monetization Patch
-- ==========================================================

-- Table: seat_watchers
-- Enrolls passengers who desire unavailable seat types (Window, Aisle, Extra Legroom)
CREATE TABLE IF NOT EXISTS seat_watchers (
    watch_id INTEGER PRIMARY KEY AUTOINCREMENT,
    flight_id INTEGER NOT NULL,
    passenger_id INTEGER,
    passenger_name TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    preferred_seat_type TEXT NOT NULL CHECK(preferred_seat_type IN ('window', 'aisle', 'extra_legroom', 'any')),
    preferred_seat_class TEXT DEFAULT 'economy' CHECK(preferred_seat_class IN ('economy', 'business', 'first')),
    priority_score REAL DEFAULT 0.0,
    loyalty_tier TEXT DEFAULT 'standard' CHECK(loyalty_tier IN ('standard', 'silver', 'gold', 'platinum')),
    max_upgrade_bid REAL DEFAULT 0.0,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'notified', 'claimed', 'expired', 'cancelled')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (flight_id) REFERENCES flights(id) ON DELETE CASCADE
);

-- Table: upgrade_offers
-- Tracks real-time upgrade notifications, temporary reservation locks, and 60-second claim expirations
CREATE TABLE IF NOT EXISTS upgrade_offers (
    offer_id INTEGER PRIMARY KEY AUTOINCREMENT,
    watch_id INTEGER NOT NULL,
    flight_id INTEGER NOT NULL,
    passenger_id INTEGER,
    seat_number TEXT NOT NULL,
    seat_type TEXT NOT NULL,
    seat_class TEXT NOT NULL,
    upgrade_fee REAL NOT NULL,
    claim_deadline DATETIME NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'claimed', 'expired', 'declined')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (watch_id) REFERENCES seat_watchers(watch_id) ON DELETE CASCADE,
    FOREIGN KEY (flight_id) REFERENCES flights(id) ON DELETE CASCADE
);

-- Indexes for instant queue lookup and priority dispatch
CREATE INDEX IF NOT EXISTS idx_seat_watchers_flight ON seat_watchers(flight_id, preferred_seat_type, status);
CREATE INDEX IF NOT EXISTS idx_upgrade_offers_passenger ON upgrade_offers(passenger_id, status, claim_deadline);
CREATE INDEX IF NOT EXISTS idx_upgrade_offers_flight_seat ON upgrade_offers(flight_id, seat_number, status);
