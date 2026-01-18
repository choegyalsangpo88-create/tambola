import React from 'react';

/**
 * LottoTicket - Realistic physical Tambola/Lotto ticket design
 * Matches the classic yellow paper tickets with light blue cells
 */
const LottoTicket = ({ 
  ticketNumber, 
  numbers, 
  calledNumbers = [], 
  showRemaining = true,
  size = 'normal' // 'small', 'normal', 'large'
}) => {
  const calledSet = new Set(calledNumbers);
  const allNums = numbers?.flat().filter(n => n !== null) || [];
  const markedCount = allNums.filter(n => calledSet.has(n)).length;
  const remaining = 15 - markedCount;

  // Size configurations
  const sizeConfig = {
    small: {
      headerSize: '8px',
      cellSize: '10px',
      padding: '2px',
    },
    normal: {
      headerSize: '10px',
      cellSize: '12px',
      padding: '4px',
    },
    large: {
      headerSize: '12px',
      cellSize: '14px',
      padding: '6px',
    }
  };

  const config = sizeConfig[size] || sizeConfig.normal;

  return (
    <div 
      className="rounded overflow-hidden"
      style={{ 
        backgroundColor: '#f5d742',
        boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
      }}
    >
      {/* Header - LOTTO TICKET centered */}
      <div 
        className="text-center py-1 border-b"
        style={{ 
          backgroundColor: '#f5d742',
          borderColor: '#c9a82c'
        }}
      >
        <span 
          className="font-bold tracking-wide"
          style={{ 
            fontSize: config.headerSize,
            color: '#1a1a1a',
            fontFamily: 'Arial, sans-serif'
          }}
        >
          LOTTO TICKET {ticketNumber || 'T001'}
        </span>
      </div>
      
      {/* Ticket Grid - Light blue cells like physical ticket */}
      <div style={{ padding: config.padding, backgroundColor: '#f5d742' }}>
        <div 
          className="border"
          style={{ 
            borderColor: '#1a1a1a',
            backgroundColor: '#d8e4f0'
          }}
        >
          {numbers?.map((row, rowIndex) => (
            <div key={rowIndex} className="flex">
              {row.map((num, colIndex) => {
                const isMarked = num && calledSet.has(num);
                return (
                  <div
                    key={`${rowIndex}-${colIndex}`}
                    className="flex items-center justify-center font-bold transition-all"
                    style={{
                      width: '100%',
                      aspectRatio: '1.2/1',
                      backgroundColor: isMarked ? '#22c55e' : '#d8e4f0',
                      borderRight: colIndex < 8 ? '1px solid #1a1a1a' : 'none',
                      borderBottom: rowIndex < 2 ? '1px solid #1a1a1a' : 'none',
                      fontSize: config.cellSize,
                      color: isMarked ? '#ffffff' : '#1a1a1a',
                      fontFamily: 'Arial Black, Arial, sans-serif'
                    }}
                  >
                    {num || ''}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Footer showing remaining count */}
      {showRemaining && calledNumbers.length > 0 && (
        <div 
          className="flex justify-between items-center px-2 py-1"
          style={{ backgroundColor: '#f5d742', borderTop: '1px solid #c9a82c' }}
        >
          <span style={{ fontSize: '9px', color: '#1a1a1a' }}>
            {markedCount}/15
          </span>
          <span 
            className="px-1.5 py-0.5 rounded font-bold"
            style={{ 
              fontSize: '9px',
              backgroundColor: remaining <= 3 ? '#ef4444' : remaining <= 6 ? '#f97316' : '#6b7280',
              color: '#ffffff'
            }}
          >
            {remaining} left
          </span>
        </div>
      )}
    </div>
  );
};

export default LottoTicket;
