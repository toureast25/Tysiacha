import React from 'react';
import { MQTT_BROKER_URL, MQTT_TOPIC_PREFIX } from '../constants.js';

const { useState, useEffect } = React;

const Lobby = ({ onStartGame }) => {
  const [roomCode, setRoomCode] = useState('');
  const [playerCount, setPlayerCount] = useState(2);
  const [playerName, setPlayerName] = useState('');
  // Initialize state based on localStorage to avoid race conditions on mount
  const [isJoining, setIsJoining] = useState(() => !!localStorage.getItem('tysiacha-lastRoom'));
  const [roomStatus, setRoomStatus] = useState(null); // { status: 'loading' | 'active' | 'waiting' | 'not_found', host: 'name', message: '...' }

  useEffect(() => {
    // Pre-fill player name from a previous session if it exists
    const savedName = localStorage.getItem('tysiacha-playerName');
    if (savedName) {
        setPlayerName(savedName);
    }
    const lastRoom = localStorage.getItem('tysiacha-lastRoom');
    if(lastRoom) {
      setRoomCode(lastRoom);
      // setIsJoining is already handled by the useState initializer
    }
  }, []);

  useEffect(() => {
    if (!isJoining) {
      generateRoomCode();
      setRoomStatus(null);
    }
  }, [isJoining]);

  // Fetch room status when roomCode changes in joining mode
  useEffect(() => {
    const code = roomCode.trim();
    if (isJoining && code.length >= 4) {
      setRoomStatus({ status: 'loading' });
      const client = mqtt.connect(MQTT_BROKER_URL);
      const topic = `${MQTT_TOPIC_PREFIX}/${code}`;
      
      const timeoutId = setTimeout(() => {
        setRoomStatus({ status: 'not_found' });
        client.end();
      }, 3000);

      client.on('connect', () => {
        client.subscribe(topic);
      });

      client.on('message', (receivedTopic, message) => {
        clearTimeout(timeoutId);
        try {
          const gameState = JSON.parse(message.toString());
          const host = gameState.players.find(p => p.isClaimed && p.id === 0) || gameState.players.find(p => p.isClaimed);
          const claimedPlayers = gameState.players.filter(p => p.isClaimed && !p.isSpectator).length;
          const isGameRunning = claimedPlayers > 1 && gameState.players.some(p => p.scores.length > 0) && !gameState.isGameOver;

          setRoomStatus({
            status: isGameRunning ? 'active' : 'waiting',
            host: host ? host.name : 'Неизвестно',
            message: isGameRunning ? 'Идёт игра' : `Набор игроков (${claimedPlayers}/${gameState.players.length})`
          });
        } catch (e) {
          setRoomStatus({ status: 'not_found' });
        }
        client.end(true); // Force close
      });

      client.on('error', () => {
        clearTimeout(timeoutId);
        setRoomStatus({ status: 'not_found' });
        client.end(true); // Force close
      });

      return () => {
        clearTimeout(timeoutId);
        if (client) client.end(true);
      };

    } else {
      setRoomStatus(null);
    }
  }, [roomCode, isJoining]);

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
  
  const RoomStatusInfo = () => {
    if (!isJoining || !roomStatus) return null;
    
    let content;
    switch(roomStatus.status) {
        case 'loading':
            content = React.createElement('div', { className: "flex items-center" }, 
                React.createElement('div', {className: "w-4 h-4 border-2 border-t-transparent border-yellow-300 rounded-full animate-spin mr-2"}),
                'Проверка комнаты...'
            );
            break;
        case 'not_found':
            content = 'Комната не найдена или пуста.';
            break;
        case 'active':
        case 'waiting':
            content = `${roomStatus.message}. Хост: ${roomStatus.host}`;
            break;
        default:
            return null;
    }
    
    return React.createElement('div', { className: "text-sm text-gray-400 mt-2 min-h-[20px]" }, content);
  }

  return React.createElement(
    'div',
    { className: "w-full max-w-md p-8 bg-slate-800/80 backdrop-blur-md rounded-xl shadow-2xl border border-slate-700 text-center" },
    React.createElement('h2', { className: "font-ruslan text-4xl sm:text-5xl text-yellow-300 mb-6" }, isJoining ? 'Присоединиться' : 'Создать Игру'),
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
        isJoining ? React.createElement(RoomStatusInfo) : React.createElement('p', { className: "text-sm text-gray-400 mt-2" }, 'Поделитесь этим кодом с друзьями')
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
          disabled: roomCode.trim().length < 4 || playerName.trim().length < 3 || (isJoining && roomStatus?.status === 'not_found')
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
          className: "w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-xl font-bold uppercase tracking-wider transition-all duration-300 transform hover:scale-105 shadow-lg disabled:bg-gray-500 disabled:cursor-not-allowed",
          disabled: playerName.trim().length < 3
        },
        isJoining ? 'Создать свою игру' : 'Присоединиться к игре'
      )
    )
  );
};

export default Lobby;