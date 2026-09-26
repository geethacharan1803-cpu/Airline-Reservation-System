import type { SeatMapResponse, SeatInfo } from '../api';

interface Props {
  seatMap: SeatMapResponse;
  selectedSeats: string[];
  fareClass: string;
  onSeatToggle: (seatNumber: string) => void;
  onOccupiedClick?: (seatNumber: string, status: 'booked' | 'waitlist' | 'locked') => void;
}

export function SeatMap2D({ seatMap, selectedSeats, fareClass, onSeatToggle, onOccupiedClick }: Props) {
  // Filter to show only the relevant fare class section (and above)
  const relevantSections = seatMap.sections.filter(s => {
    if (fareClass === 'first') return s.name === 'first';
    if (fareClass === 'business') return s.name === 'business' || s.name === 'first';
    return true; // economy sees all
  });

  return (
    <div className="seat-map">
      {/* Aircraft nose */}
      <div style={{
        width: 120,
        height: 40,
        margin: '0 auto var(--space-4)',
        background: 'var(--color-gray-100)',
        borderRadius: '60px 60px 0 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 'var(--text-xs)',
        color: 'var(--text-tertiary)',
        fontWeight: 500,
      }}>
        ✈ {seatMap.aircraft.code}
      </div>

      {relevantSections.map(section => {
        if (section.seats.length === 0) return null;
        
        const rows: Map<number, SeatInfo[]> = new Map();
        section.seats.forEach(seat => {
          if (!rows.has(seat.row)) rows.set(seat.row, []);
          rows.get(seat.row)!.push(seat);
        });

        const isSelectable = section.name === fareClass;

        return (
          <div key={section.name} className="seat-map__cabin">
            <div className="seat-map__section-title" style={{
              color: section.name === 'first' ? 'var(--color-gold-500)' :
                     section.name === 'business' ? 'var(--color-sky-500)' :
                     'var(--text-tertiary)',
            }}>
              {section.name === 'first' ? '★ First Class' :
               section.name === 'business' ? '◆ Business Class' :
               '● Economy'}
            </div>

            {Array.from(rows.entries()).map(([rowNum, seats]) => (
              <div key={rowNum} className="seat-map__row">
                <div className="seat-map__row-number">{rowNum}</div>
                {seats.map((seat, idx) => {
                  // Insert aisle gap
                  const showAisleBefore = section.aislePositions.includes(idx);
                  const isSelected = selectedSeats.includes(seat.number);
                  const isAvailable = seat.status === 'available' && isSelectable;

                  return (
                    <span key={seat.number} style={{ display: 'contents' }}>
                      {showAisleBefore && <div className="seat-map__aisle" />}
                      <button
                        type="button"
                        className={`seat ${
                          isSelected ? 'seat--selected' :
                          seat.status === 'booked' ? 'seat--booked' :
                          seat.status === 'waitlist' ? 'seat--waitlist' :
                          seat.status === 'locked' ? 'seat--locked' :
                          !isSelectable ? 'seat--booked' :
                          'seat--available'
                        }`}
                        onClick={() => {
                          if (isSelected || isAvailable) {
                            onSeatToggle(seat.number);
                          } else {
                            const statusType = seat.status === 'waitlist' ? 'waitlist' : seat.status === 'locked' ? 'locked' : 'booked';
                            onOccupiedClick?.(seat.number, statusType);
                          }
                        }}
                        title={`${seat.number} — ${seat.type} seat (${seat.status})`}
                        aria-label={`Seat ${seat.number}, ${seat.type}, ${isSelected ? 'selected' : seat.status}`}
                      >
                        {seat.letter}
                      </button>
                    </span>
                  );
                })}
                <div className="seat-map__row-number">{rowNum}</div>
              </div>
            ))}
          </div>
        );
      })}

      {/* Legend */}
      <div className="seat-legend">
        <div className="seat-legend__item">
          <div className="seat-legend__swatch" style={{ background: 'var(--color-gray-100)', border: '2px solid var(--color-gray-300)' }} />
          Available
        </div>
        <div className="seat-legend__item">
          <div className="seat-legend__swatch" style={{ background: 'var(--color-sky-500)', border: '2px solid var(--color-sky-600)' }} />
          Selected
        </div>
        <div className="seat-legend__item">
          <div className="seat-legend__swatch" style={{ background: 'rgba(239, 68, 68, 0.15)', border: '2px solid #ef4444' }} />
          Occupied
        </div>
        <div className="seat-legend__item">
          <div className="seat-legend__swatch" style={{ background: 'rgba(245, 158, 11, 0.15)', border: '2px solid #f59e0b' }} />
          Waitlist
        </div>
        <div className="seat-legend__item">
          <div className="seat-legend__swatch" style={{ background: 'rgba(148, 163, 184, 0.2)', border: '2px solid #94a3b8' }} />
          Held
        </div>
      </div>
    </div>
  );
}
