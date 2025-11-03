import React from 'react';

const SpectatorsModal = ({ spectators, onClose }) => {
  return React.createElement(
    'div',
    {
      className: "fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm",
      onClick: onClose,
      'aria-modal': "true",
      role: "dialog"
    },
    React.createElement(
      'div',
      {
        className: "relative w-full max-w-md bg-slate-800 text-gray-300 rounded-2xl shadow-2xl border border-slate-600 flex flex-col",
        onClick: e => e.stopPropagation()
      },
      React.createElement(
        'header',
        { className: "flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0" },
        React.createElement('h2', { className: "font-ruslan text-3xl text-yellow-300" }, `Зрители (${spectators.length})`),
        React.createElement(
          'button',
          {
            onClick: onClose,
            className: "text-gray-400 hover:text-white transition-colors p-1 rounded-full bg-slate-700 hover:bg-slate-600",
            'aria-label': "Закрыть список зрителей"
          },
          React.createElement(
            'svg',
            { xmlns: "http://www.w3.org/2000/svg", className: "h-6 w-6", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 2 },
            React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M6 18L18 6M6 6l12 12" })
          )
        )
      ),
      React.createElement(
        'main',
        { className: "p-6 overflow-y-auto max-h-[60vh]" },
        spectators.length > 0
          ? React.createElement('ul', { className: "space-y-2" },
              spectators.map((spectator, index) =>
                React.createElement('li', { key: `modal-spectator-${index}`, className: "flex items-center p-2 rounded-md bg-slate-700/50" },
                  React.createElement('svg', { xmlns: "http://www.w3.org/2000/svg", className: "h-5 w-5 mr-3 text-gray-400 flex-shrink-0", viewBox: "0 0 20 20", fill: "currentColor" },
                      React.createElement('path', { d: "M10 12a2 2 0 100-4 2 2 0 000 4z" }),
                      React.createElement('path', { fillRule: "evenodd", d: "M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z", clipRule: "evenodd" })
                  ),
                  React.createElement('span', { className: "text-gray-200 text-lg" }, spectator.name)
                )
              )
            )
          : React.createElement('p', { className: "text-center text-gray-400" }, 'Зрителей нет.')
      )
    )
  );
};

export default SpectatorsModal;
