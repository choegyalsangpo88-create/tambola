import React from 'react';

/**
 * LottoTicket - Accurate replica of physical Indian Tambola tickets
 * Matches real printed housie book tickets
 * Used for gameplay views (LiveGame, MyTickets, etc.)
 */
const LottoTicket = ({ 
  ticketNumber, 
  numbers, 
  calledNumbers = [], 
  backgroundColor = '#f1c40f',
  showRemaining = true,
  size = 'normal'
}) => {
  const calledSet = new Set(calledNumbers);
  const allNums = numbers?.flat().filter(n => n !== null) || [];
  const markedCount = allNums.filter(n => calledSet.has(n)).length;
  const remaining = 15 - markedCount;

  // Size configurations
  const sizeConfig = {
    small: { 
      cellHeight: '24px', 
      fontSize: '11px', 
      headerFontSize: '9px',
      padding: '6px'
    },
    normal: { 
      cellHeight: '32px', 
      fontSize: '14px', 
      headerFontSize: '11px',
      padding: '8px'
    },
    large: { 
      cellHeight: '40px', 
      fontSize: '18px', 
      headerFontSize: '13px',
      padding: '10px'
    }
  };

  const config = sizeConfig[size] || sizeConfig.normal;

  return (
    <div style={{
      backgroundColor: backgroundColor,
      padding: config.padding,
      display: 'inline-block',
      width: '100%'
    }}>
      {/* Ticket container */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '2px solid #000000'
      }}>
        {/* Header */}
        <div style={{
          backgroundColor: '#f5f5f5',
          borderBottom: '2px solid #000000',
          padding: '3px 6px',
          textAlign: 'center'
        }}>
          <span style={{
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontWeight: 'bold',
            fontSize: config.headerFontSize,
            color: '#000000',
            letterSpacing: '0.5px'
          }}>
            LOTTO TICKET {ticketNumber || '001'}
          </span>
        </div>
        
        {/* Grid - using table for accurate print-style layout */}
        <table 
          style={{
            borderCollapse: 'collapse',
            width: '100%'
          }}
          cellSpacing="0"
          cellPadding="0"
        >
          <tbody>
            {numbers?.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((num, colIndex) => {
                  const isMarked = num && calledSet.has(num);
                  return (
                    <td
                      key={`${rowIndex}-${colIndex}`}
                      style={{
                        width: '11.11%',
                        height: config.cellHeight,
                        border: '1px solid #000000',
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        backgroundColor: isMarked ? '#22c55e' : '#e8f4fc',
                        fontFamily: 'Arial Black, Arial, sans-serif',
                        fontWeight: 'bold',
                        fontSize: config.fontSize,
                        color: isMarked ? '#ffffff' : '#000000',
                        padding: '0',
                        margin: '0',
                        transition: 'background-color 0.2s'
                      }}
                    >
                      {num || ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Remaining count during gameplay */}
      {showRemaining && calledNumbers.length > 0 && (
        <div style={{
          marginTop: '4px',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '9px',
          color: '#000000',
          fontFamily: 'Arial, sans-serif',
          fontWeight: 'bold'
        }}>
          <span>{markedCount}/15</span>
          <span style={{
            backgroundColor: remaining <= 3 ? '#dc2626' : remaining <= 6 ? '#ea580c' : '#4b5563',
            color: '#ffffff',
            padding: '1px 6px'
          }}>
            {remaining} left
          </span>
        </div>
      )}
    </div>
  );
};

export default LottoTicket;
