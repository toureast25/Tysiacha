// 
import React from 'react';

const KickConfirmModal = ({ playerToKick, onConfirm, onCancel }) => {
  if (!playerToKick) return null;

  return React.createElement(
    'div',
    {
      className: "fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm",
      onClick: onCancel,
      'aria-modal': "true",
      role: "dialog"
    },
    React.createElement(
      'div',
      {
        className: "relative w-full max-w-md bg-slate-800 text-gray-300 rounded-2xl shadow-2xl border border-slate-600 flex flex-col p-6",
        onClick: e => e.stopPropagation()
      },
      React.createElement(
        'header',
        { className: "flex items-center justify-between mb-4" },
        React.createElement('h2', { className: "font-ruslan text-3xl text-yellow-300" }, 'Подтверждение'),
        React.createElement(
          'button',
          {
            onClick: onCancel,
            className: "text-gray-400 hover:text-white transition-colors p-1 rounded-full bg-slate-700 hover:bg-slate-600",
            'aria-label': "Отмена"
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
        { className: "mb-6" },
        React.createElement('p', { className: "text-lg text-center" }, 
            'Вы уверены, что хотите исключить игрока ',
            React.createElement('strong', { className: 'text-white font-bold' }, playerToKick.name),
            '?'
        ),
        React.createElement('p', { className: "text-sm text-gray-400 text-center mt-2" }, 'Это действие необратимо, очки игрока не будут сохранены для повторного входа.')
      ),
      React.createElement(
        'footer',
        { className: "flex justify-end gap-4" },
        React.createElement('button', { onClick: onCancel, className: "px-6 py-2 bg-slate-600 hover:bg-slate-700 rounded-lg font-bold" }, 'Отмена'),
        React.createElement('button', { onClick: onConfirm, className: "px-6 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-bold" }, 'Исключить')
      )
    )
  );
};

export default KickConfirmModal;
