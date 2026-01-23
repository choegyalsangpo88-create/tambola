import { LottoTicketCard } from './LottoTicketCard';

// Full Sheet Component - 6 tickets stacked vertically with individual selection
export function FullSheet({ sheetId, tickets, selectedTickets, onToggleTicket, onSelectAll, pageNumber, zoomLevel = 1 }) {
  // Check booking status
  const allBooked = tickets.every(t => t.is_booked);
  const availableTickets = tickets.filter(t => !t.is_booked);
  const selectedCount = tickets.filter(t => selectedTickets.includes(t.ticket_id)).length;
  const allAvailableSelected = availableTickets.length > 0 && availableTickets.every(t => selectedTickets.includes(t.ticket_id));
  
  return (
    <div data-testid={`full-sheet-${sheetId}`}>
      {/* Sheet header with ID, status, and Select All button */}
      <div className="flex items-center justify-between mb-1 px-1">
        <div className="flex items-center gap-2">
          <span className={`font-bold ${selectedCount > 0 ? 'text-amber-400' : 'text-amber-500/80'} ${zoomLevel === 1 ? 'text-sm' : zoomLevel === 2 ? 'text-xs' : 'text-[10px]'}`}>
            {sheetId}
          </span>
          <span className={`text-gray-500 ${zoomLevel === 1 ? 'text-xs' : zoomLevel === 2 ? 'text-[10px]' : 'text-[8px]'}`}>
            {tickets[0]?.ticket_number} - {tickets[5]?.ticket_number}
          </span>
          {selectedCount > 0 && (
            <span className={`text-amber-400 font-bold ${zoomLevel === 1 ? 'text-xs' : 'text-[10px]'}`}>{selectedCount}/6 selected</span>
          )}
        </div>
        {!allBooked && (
          <button
            onClick={() => onSelectAll(tickets)}
            className={`px-2 py-0.5 rounded ${zoomLevel === 1 ? 'text-[10px]' : zoomLevel === 2 ? 'text-[9px]' : 'text-[8px]'} ${
              allAvailableSelected 
                ? 'bg-amber-500 text-black' 
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            {allAvailableSelected ? '✓ All Selected' : 'Select All 6'}
          </button>
        )}
      </div>
      
      {/* The Full Sheet - Mustard Yellow background */}
      <div 
        className="p-1"
        style={{
          backgroundColor: '#E6B800',
          border: selectedCount > 0 ? '2px solid #f59e0b' : '1px solid #cca300'
        }}
      >
        {/* 6 Tickets stacked vertically - each individually selectable */}
        {tickets.map((ticket, index) => (
          <LottoTicketCard
            key={ticket.ticket_id}
            ticket={ticket}
            isFirst={index === 0}
            pageNumber={pageNumber}
            isSelected={selectedTickets.includes(ticket.ticket_id)}
            onToggle={onToggleTicket}
            isBooked={ticket.is_booked}
            zoomLevel={zoomLevel}
          />
        ))}
      </div>
    </div>
  );
}

export default FullSheet;
