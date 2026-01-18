import React from 'react';

/**
 * LottoTicket - A classic physical Tambola/Lotto ticket design
 * Mimics the yellow paper tickets with "LOTTO TICKET" header
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
      padding: 'p-1',
      headerText: 'text-[8px]',
      ticketNumText: 'text-[10px]',
      cellText: 'text-[8px]',
      cellSize: 'w-5 h-5',
      gap: 'gap-[1px]',
      headerPadding: 'py-0.5 px-1',
    },
    normal: {
      padding: 'p-1.5',
      headerText: 'text-[10px]',
      ticketNumText: 'text-sm',
      cellText: 'text-[10px]',
      cellSize: 'w-6 h-6 md:w-7 md:h-7',
      gap: 'gap-[2px]',
      headerPadding: 'py-1 px-2',
    },
    large: {
      padding: 'p-2',
      headerText: 'text-xs',
      ticketNumText: 'text-base',
      cellText: 'text-xs md:text-sm',
      cellSize: 'w-8 h-8 md:w-9 md:h-9',
      gap: 'gap-1',
      headerPadding: 'py-1.5 px-3',
    }
  };

  const config = sizeConfig[size] || sizeConfig.normal;

  return (
    <div className={`bg-amber-400 rounded-lg shadow-lg overflow-hidden border-2 border-amber-600 ${config.padding}`}>
      {/* Header with LOTTO TICKET */}
      <div className={`bg-amber-500 ${config.headerPadding} rounded-t-md mb-1 text-center border-b-2 border-amber-600`}>
        <span className={`font-bold text-amber-900 tracking-wider ${config.headerText}`}>
          LOTTO TICKET
        </span>
        <span className={`font-black text-amber-900 ml-1 ${config.ticketNumText}`}>
          {ticketNumber || 'T001'}
        </span>
      </div>

      {/* Ticket Grid - 3 rows x 9 columns */}
      <div className={`grid grid-cols-9 ${config.gap} bg-amber-300 p-1 rounded-md`}>
        {numbers?.map((row, rowIdx) => (
          row.map((num, colIdx) => {
            const isMarked = num && calledSet.has(num);
            return (
              <div
                key={`${rowIdx}-${colIdx}`}
                className={`
                  ${config.cellSize} 
                  flex items-center justify-center 
                  ${config.cellText} 
                  font-bold 
                  rounded-sm
                  transition-all duration-200
                  ${num 
                    ? isMarked 
                      ? 'bg-green-500 text-white shadow-md ring-2 ring-green-600 scale-105' 
                      : 'bg-white text-gray-800 border border-gray-300'
                    : 'bg-amber-200 border border-amber-300'
                  }
                `}
              >
                {num || ''}
              </div>
            );
          })
        ))}
      </div>

      {/* Footer showing remaining count */}
      {showRemaining && (
        <div className="mt-1 flex justify-between items-center px-1">
          <span className={`${config.headerText} text-amber-800`}>
            {markedCount}/15 marked
          </span>
          <span className={`
            ${config.headerText} 
            px-1.5 py-0.5 
            rounded 
            font-bold
            ${remaining <= 3 
              ? 'bg-red-500 text-white animate-pulse' 
              : remaining <= 6 
                ? 'bg-orange-500 text-white' 
                : 'bg-amber-600 text-amber-100'
            }
          `}>
            {remaining} left
          </span>
        </div>
      )}
    </div>
  );
};

export default LottoTicket;
