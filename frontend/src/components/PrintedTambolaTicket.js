import React from 'react';

/**
 * PrintedTambolaTicket - Accurate replica of physical Indian Tambola tickets
 * Matches real printed housie book tickets
 */
const PrintedTambolaTicket = ({ 
  ticketNumber, 
  numbers, 
  calledNumbers = [], 
  backgroundColor = '#f1c40f', // Yellow default, can be pink (#e91e63), green (#4caf50)
  showRemaining = false,
  size = 'normal'
}) => {
  const calledSet = new Set(calledNumbers);
  const allNums = numbers?.flat().filter(n => n !== null) || [];
  const markedCount = allNums.filter(n => calledSet.has(n)).length;
  const remaining = 15 - markedCount;

  // Size configurations
  const sizeConfig = {
    small: { 
      cellHeight: '28px', 
      fontSize: '14px', 
      headerFontSize: '11px',
      padding: '8px',
      borderWidth: '1px'
    },
    normal: { 
      cellHeight: '36px', 
      fontSize: '18px', 
      headerFontSize: '13px',
      padding: '10px',
      borderWidth: '2px'
    },
    large: { 
      cellHeight: '44px', 
      fontSize: '22px', 
      headerFontSize: '15px',
      padding: '12px',
      borderWidth: '2px'
    }
  };

  const config = sizeConfig[size] || sizeConfig.normal;

  return (
    <div 
      style={{
        backgroundColor: backgroundColor,
        padding: config.padding,
        display: 'inline-block'
      }}
    >
      {/* Ticket container with white background */}
      <div style={{
        backgroundColor: '#ffffff',
        border: `${config.borderWidth} solid #000000`
      }}>
        {/* Header - LOTTO TICKET number */}
        <div style={{
          backgroundColor: '#f5f5f5',
          borderBottom: `${config.borderWidth} solid #000000`,
          padding: '4px 8px',
          textAlign: 'center'
        }}>
          <span style={{
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontWeight: 'bold',
            fontSize: config.headerFontSize,
            color: '#000000',
            letterSpacing: '1px'
          }}>
            LOTTO TICKET {ticketNumber || '001'}
          </span>
        </div>
        
        {/* Grid - 3 rows x 9 columns */}
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
                        margin: '0'
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

      {/* Remaining count - only during gameplay */}
      {showRemaining && calledNumbers.length > 0 && (
        <div style={{
          marginTop: '4px',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '10px',
          color: '#000000',
          fontFamily: 'Arial, sans-serif'
        }}>
          <span>{markedCount}/15</span>
          <span style={{
            backgroundColor: remaining <= 3 ? '#dc2626' : remaining <= 6 ? '#ea580c' : '#4b5563',
            color: '#ffffff',
            padding: '1px 6px',
            fontWeight: 'bold'
          }}>
            {remaining} left
          </span>
        </div>
      )}
    </div>
  );
};

export default PrintedTambolaTicket;
