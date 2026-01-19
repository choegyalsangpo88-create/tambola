import React from 'react';

/**
 * LottoTicket - Premium realistic ticket for gameplay
 * Modern 2026 design with physical ticket aesthetics
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

  const sizeConfig = {
    small: { 
      padding: '8px',
      headerFont: '9px',
      ticketFont: '11px',
      cellFont: '10px',
      gap: '2px',
      cellPadding: '2px'
    },
    normal: { 
      padding: '10px',
      headerFont: '11px',
      ticketFont: '13px',
      cellFont: '12px',
      gap: '3px',
      cellPadding: '3px'
    },
    large: { 
      padding: '12px',
      headerFont: '13px',
      ticketFont: '15px',
      cellFont: '16px',
      gap: '4px',
      cellPadding: '4px'
    }
  };

  const config = sizeConfig[size] || sizeConfig.normal;

  return (
    <div style={{
      background: 'linear-gradient(145deg, #ffd54f 0%, #ffb300 100%)',
      padding: config.padding,
      borderRadius: '12px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.3)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Paper texture */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
        opacity: 0.03,
        pointerEvents: 'none',
        borderRadius: '12px'
      }} />

      {/* Ticket card */}
      <div style={{
        background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.05)',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(180deg, #fafafa 0%, #f0f0f0 100%)',
          padding: '6px 10px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{
            fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
            fontWeight: '700',
            fontSize: config.headerFont,
            color: '#1a1a1a',
            letterSpacing: '1.5px',
            textTransform: 'uppercase'
          }}>
            Lotto Ticket
          </span>
          <span style={{
            fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
            fontWeight: '800',
            fontSize: config.ticketFont,
            color: '#f59e0b',
            textShadow: '0 1px 2px rgba(0,0,0,0.1)'
          }}>
            {ticketNumber || 'T001'}
          </span>
        </div>
        
        {/* Grid */}
        <div style={{ padding: '8px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(9, 1fr)',
            gap: config.gap,
            background: 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)',
            padding: config.cellPadding,
            borderRadius: '6px'
          }}>
            {numbers?.map((row, rowIndex) => (
              row.map((num, colIndex) => {
                const isMarked = num && calledSet.has(num);
                return (
                  <div
                    key={`${rowIndex}-${colIndex}`}
                    style={{
                      aspectRatio: '1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isMarked 
                        ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
                        : num 
                          ? 'linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)'
                          : 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)',
                      borderRadius: '4px',
                      fontFamily: '"SF Pro Text", -apple-system, BlinkMacSystemFont, sans-serif',
                      fontWeight: '700',
                      fontSize: config.cellFont,
                      color: isMarked ? '#ffffff' : num ? '#1e293b' : 'transparent',
                      boxShadow: isMarked
                        ? '0 2px 8px rgba(34, 197, 94, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)'
                        : num 
                          ? 'inset 0 1px 0 rgba(255,255,255,0.8), 0 1px 2px rgba(0,0,0,0.08)'
                          : 'inset 0 1px 2px rgba(0,0,0,0.05)',
                      transition: 'all 0.3s ease',
                      transform: isMarked ? 'scale(1.05)' : 'scale(1)'
                    }}
                  >
                    {num || ''}
                  </div>
                );
              })
            ))}
          </div>
        </div>

        {/* Remaining count */}
        {showRemaining && calledNumbers.length > 0 && (
          <div style={{
            padding: '6px 10px',
            borderTop: '1px solid #e0e0e0',
            background: 'linear-gradient(180deg, #fafafa 0%, #f0f0f0 100%)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{
              fontSize: '10px',
              color: '#64748b',
              fontWeight: '600'
            }}>
              {markedCount}/15 marked
            </span>
            <span style={{
              background: remaining <= 3 
                ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                : remaining <= 6 
                  ? 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)'
                  : 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
              color: '#ffffff',
              padding: '3px 10px',
              borderRadius: '12px',
              fontSize: '10px',
              fontWeight: '700',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              {remaining} left
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default LottoTicket;
