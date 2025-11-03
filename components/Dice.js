import React from 'react';

export const DiceIcon = ({ value, isSelected, onClick, onDragStart, onDoubleClick }) => {
  const dots = {
    1: ['center'],
    2: ['top-left', 'bottom-right'],
    3: ['top-left', 'center', 'bottom-right'],
    4: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
    5: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
    6: ['top-left', 'top-right', 'mid-left', 'mid-right', 'bottom-left', 'bottom-right'],
  };

  const dotClasses = {
      'center': 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
      'top-left': 'top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2',
      'top-right': 'top-1/4 right-1/4 translate-x-1/2 -translate-y-1/2',
      'bottom-left': 'bottom-1/4 left-1/4 -translate-x-1/2 translate-y-1/2',
      'bottom-right': 'bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2',
      'mid-left': 'top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2',
      'mid-right': 'top-1/2 right-1/4 translate-x-1/2 -translate-y-1/2',
  }
  
  const baseClasses = "w-16 sm:w-20 aspect-square bg-slate-200 rounded-lg shadow-md flex items-center justify-center relative border-2 transition-all duration-200 flex-shrink-0";
  
  let stateClasses = "border-slate-400";
  if (onClick) {
      stateClasses += " cursor-pointer";
  }

  if (isSelected) {
      stateClasses = "border-yellow-400 scale-105 shadow-lg shadow-yellow-400/50 cursor-pointer";
  }
  
  if (value === 0) {
      return React.createElement('div', { className: `${baseClasses} bg-slate-700/50 border-slate-600 border-dashed` });
  }

  return React.createElement(
    'div',
    {
      className: `${baseClasses} ${stateClasses}`,
      onClick: onClick,
      onDoubleClick: onDoubleClick,
      draggable: !!onDragStart,
      onDragStart: onDragStart
    },
    value > 0 && dots[value] && dots[value].map(pos => 
      React.createElement('div', { key: pos, className: `absolute w-[18%] h-[18%] bg-slate-900 rounded-full ${dotClasses[pos]}` })
    )
  );
};

export const SmallDiceIcon = ({ value }) => {
  const dots = {
    1: ['center'],
    2: ['top-left', 'bottom-right'],
    3: ['top-left', 'center', 'bottom-right'],
    4: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
    5: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
    6: ['top-left', 'top-right', 'mid-left', 'mid-right', 'bottom-left', 'bottom-right'],
  };

  const dotClasses = {
      'center': 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
      'top-left': 'top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2',
      'top-right': 'top-1/4 right-1/4 translate-x-1/2 -translate-y-1/2',
      'bottom-left': 'bottom-1/4 left-1/4 -translate-x-1/2 translate-y-1/2',
      'bottom-right': 'bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2',
      'mid-left': 'top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2',
      'mid-right': 'top-1/2 right-1/4 translate-x-1/2 -translate-y-1/2',
  }
  
  return React.createElement(
    'div',
    { className: "w-10 h-10 bg-slate-300 rounded shadow-sm flex items-center justify-center relative border border-slate-400" },
    value > 0 && dots[value] && dots[value].map(pos => 
      React.createElement('div', { key: pos, className: `absolute w-2 h-2 bg-slate-900 rounded-full ${dotClasses[pos]}` })
    )
  );
};
