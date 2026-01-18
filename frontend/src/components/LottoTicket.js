import React from 'react';

/**
 * LottoTicket - Clean realistic design
 * Yellow background, white cells, black borders
 */
const LottoTicket = ({ 
  ticketNumber, 
  numbers, 
  calledNumbers = [], 
  showRemaining = true,
  size = 'normal'
}) => {
  const calledSet = new Set(calledNumbers);
  const allNums = numbers?.flat().filter(n => n !== null) || [];
  const markedCount = allNums.filter(n => calledSet.has(n)).length;
  const remaining = 15 - markedCount;

  // Size configurations
  const sizeConfig = {
    small: { rowHeight: '24px', fontSize: '10px', padding: '8px', titleSize: '10px' },
    normal: { rowHeight: '32px', fontSize: '14px', padding: '12px', titleSize: '12px' },
    large: { rowHeight: '40px', fontSize: '18px', padding: '12px', titleSize: '14px' }
  };

  const config = sizeConfig[size] || sizeConfig.normal;

  return (
    <div style={{
      background: '#f1c40f',
      padding: config.padding,
      borderRadius: '4px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      {/* Ticket Title */}
      <div style={{
        textAlign: 'center',
        fontWeight: 'bold',
        marginBottom: '6px',
        color: '#000',
        fontSize: config.titleSize
      }}>
        LOTTO TICKET {ticketNumber || 'T001'}
      </div>
      
      {/* Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(9, 1fr)',
        gridTemplateRows: `repeat(3, ${config.rowHeight})`,
        gap: '0',
        background: 'black'
      }}>
        {numbers?.map((row, rowIndex) => (
          row.map((num, colIndex) => {
            const isMarked = num && calledSet.has(num);
            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                style={{
                  background: isMarked ? '#22c55e' : 'white',
                  border: '1px solid black',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: config.fontSize,
                  color: isMarked ? 'white' : '#000'
                }}
              >
                {num || ''}
              </div>
            );
          })
        ))}
      </div>

      {/* Footer - remaining count */}
      {showRemaining && calledNumbers.length > 0 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '6px',
          fontSize: '10px',
          color: '#000'
        }}>
          <span>{markedCount}/15 marked</span>
          <span style={{
            background: remaining <= 3 ? '#ef4444' : remaining <= 6 ? '#f97316' : '#6b7280',
            color: 'white',
            padding: '2px 6px',
            borderRadius: '4px',
            fontWeight: 'bold'
          }}>
            {remaining} left
          </span>
        </div>
      )}
    </div>
  );
};

export default LottoTicket;
