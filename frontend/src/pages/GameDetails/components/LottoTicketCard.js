// Single Lotto Ticket Component (clickable for individual selection)
// Consistent styling whether in a full sheet or standalone
export function LottoTicketCard({ ticket, isFirst, pageNumber, isSelected, onToggle, isBooked, isInFullSheet = false, zoomLevel = 1 }) {
  const bookedByName = ticket.booked_by_name || ticket.holder_name;

  return (
    <div 
      className={`bg-white cursor-pointer transition-all duration-200 ${
        isBooked 
          ? 'opacity-50 cursor-not-allowed' 
          : ''
      }`}
      style={{ 
        border: isSelected ? '2px solid #f59e0b' : '1px solid #d4a800',
        margin: '1px',
        borderRadius: '0px',
        boxShadow: isSelected ? '0 0 6px rgba(245, 158, 11, 0.5)' : 'none'
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isBooked && onToggle) {
          onToggle(ticket.ticket_id);
        }
      }}
      data-testid={`ticket-${ticket.ticket_number}`}
    >
      {/* Header with ticket number and user name */}
      <div className="py-0.5 border-b border-gray-300 bg-gray-100">
        {/* Ticket header with user name on right */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1">
            {isFirst && pageNumber && (
              <span 
                className={`font-bold text-gray-600 mr-1 ${zoomLevel === 1 ? 'text-[9px]' : zoomLevel === 2 ? 'text-[8px]' : 'text-[7px]'}`}
                style={{ fontFamily: 'Arial, sans-serif' }}
              >
                {pageNumber}
              </span>
            )}
            <p 
              className={`font-bold text-black uppercase ${zoomLevel === 1 ? 'text-[10px]' : zoomLevel === 2 ? 'text-[9px]' : 'text-[7px]'}`}
              style={{ fontFamily: 'Arial, sans-serif' }}
            >
              LOTTO TICKET {ticket.ticket_number}
            </p>
            {isSelected && (
              <span className={`text-amber-500 font-bold ${zoomLevel === 1 ? 'text-[10px]' : 'text-[8px]'}`}>✓</span>
            )}
          </div>
          {bookedByName && (
            <span 
              className={`font-bold text-black ${zoomLevel === 1 ? 'text-[9px]' : zoomLevel === 2 ? 'text-[8px]' : 'text-[7px]'}`}
              style={{ fontFamily: 'Arial, sans-serif' }}
            >
              {bookedByName.length > 8 ? bookedByName.slice(0, 8) + '..' : bookedByName}
            </span>
          )}
        </div>
      </div>
      
      {/* Number Grid - 3 rows x 9 columns */}
      <div className="grid grid-cols-9">
        {ticket.numbers.map((row, rowIndex) => (
          row.map((num, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              className="flex items-center justify-center border-r border-b border-gray-200 last:border-r-0"
              style={{
                height: zoomLevel === 1 ? '22px' : zoomLevel === 2 ? '18px' : '14px',
                fontFamily: 'Arial, sans-serif',
                fontSize: zoomLevel === 1 ? '12px' : zoomLevel === 2 ? '10px' : '8px',
                fontWeight: 'bold',
                color: '#000'
              }}
            >
              {num || ''}
            </div>
          ))
        ))}
      </div>
    </div>
  );
}

export default LottoTicketCard;
