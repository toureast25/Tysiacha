import React from 'react';

const { useState, useEffect } = React;

const Lobby = ({ onStartGame }) => {
  const [roomCode, setRoomCode] = useState('');
  const [playerCount, setPlayerCount] = useState(2);
  const [playerName, setPlayerName] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    // Pre-fill player name from a previous session if it exists
    const savedName = localStorage.getItem('tysiacha-playerName');
    if (savedName) {
        setPlayerName(savedName);
    }
  }, []);

  useEffect(() => {
    if (!isJoining) {
      generateRoomCode();
    }
  }, [isJoining]);

  const generateRoomCode = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomCode(code);
  };

  const handleStart = () => {
    const finalRoomCode = roomCode.trim();
    const finalPlayerName = playerName.trim();
    if (finalRoomCode.length >= 4 && finalPlayerName.length > 2) {
      localStorage.setItem('tysiacha-playerName', finalPlayerName);
      onStartGame(finalRoomCode, playerCount, finalPlayerName);
    }
  };

  return React.createElement(
    'div',
    { className: "w-full max-w-md p-8 bg-slate-800/80 backdrop-blur-md rounded-xl shadow-2xl border border-slate-700 text-center" },
    React.createElement('h2', { className: "font-ruslan text-5xl text-yellow-300 mb-6" }, isJoining ? 'Присоединиться' : 'Создать Игру'),
    React.createElement(
      'div',
      { className: "space-y-6" },
      React.createElement(
        'div',
        null,
        React.createElement(
          'label',
          { htmlFor: "playerName", className: "block text-lg font-semibold text-gray-300 mb-2" },
          'Ваше имя'
        ),
        React.createElement('input', {
          id: "playerName",
          type: "text",
          value: playerName,
          onChange: (e) => setPlayerName(e.target.value),
          placeholder: "Введите имя",
          className: "w-full p-3 text-center bg-slate-900 border-2 border-slate-600 rounded-lg text-xl font-semibold text-white focus:outline-none focus:border-yellow-400 transition-colors"
        })
      ),
      React.createElement(
        'div',
        null,
        React.createElement(
          'label',
          { htmlFor: "roomCode", className: "block text-lg font-semibold text-gray-300 mb-2" },
          isJoining ? 'Введите код комнаты' : 'Код вашей комнаты'
        ),
        React.createElement('input', {
          id: "roomCode",
          type: "text",
          value: roomCode,
          onChange: (e) => setRoomCode(e.target.value.toUpperCase()),
          readOnly: !isJoining,
          className: "w-full p-3 text-center bg-slate-900 border-2 border-slate-600 rounded-lg text-2xl font-mono tracking-widest text-white focus:outline-none focus:border-yellow-400 transition-colors"
        }),
        !isJoining && React.createElement('p', { className: "text-sm text-gray-400 mt-2" }, 'Поделитесь этим кодом с друзьями')
      ),
      React.createElement(
        'div',
        null,
        React.createElement(
          'label',
          { htmlFor: "playerCount", className: "block text-lg font-semibold text-gray-300 mb-2" },
          'Количество игроков'
        ),
        React.createElement(
          'div',
          { className: "flex items-center justify-center space-x-4" },
          [2, 3, 4, 5].map(num =>
            React.createElement(
              'button',
              {
                key: num,
                onClick: () => setPlayerCount(num),
                disabled: isJoining,
                className: `w-12 h-12 text-xl font-bold rounded-full transition-all ${playerCount === num && !isJoining ? 'bg-yellow-400 text-slate-900 scale-110' : 'bg-slate-700 text-white hover:bg-slate-600'} ${isJoining ? 'opacity-50 cursor-not-allowed' : ''}`
              },
              num
            )
          )
        )
      ),
      React.createElement(
        'button',
        {
          onClick: handleStart,
          className: "w-full py-3 bg-green-600 hover:bg-green-700 rounded-lg text-xl font-bold uppercase tracking-wider transition-all duration-300 transform hover:scale-105 shadow-lg disabled:bg-gray-500 disabled:cursor-not-allowed",
          disabled: roomCode.trim().length < 4 || playerName.trim().length < 3
        },
        isJoining ? 'Войти' : 'Начать игру'
      ),
      React.createElement(
        'div',
        { className: "relative flex py-2 items-center" },
        React.createElement('div', { className: "flex-grow border-t border-gray-600" }),
        React.createElement('span', { className: "flex-shrink mx-4 text-gray-400" }, 'ИЛИ'),
        React.createElement('div', { className: "flex-grow border-t border-gray-600" })
      ),
      React.createElement(
        'button',
        {
          onClick: () => setIsJoining(!isJoining),
          className: "w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-xl font-bold uppercase tracking-wider transition-all duration-300 transform hover:scale-105 shadow-lg"
        },
        isJoining ? 'Создать свою игру' : 'Присоединиться к игре'
      )
    )
  );
};

export default Lobby;
