// 
import React from 'react';
import Lobby from './Lobby.js';
import Game from './Game.js';

const BlockedTab = () => {
  return React.createElement(
    'div',
    { className: "w-full max-w-md p-8 bg-slate-800/80 backdrop-blur-md rounded-xl shadow-2xl border border-slate-700 text-center" },
    React.createElement('h2', { className: "font-ruslan text-4xl text-yellow-300 mb-4" }, 'Игра уже запущена'),
    React.createElement('p', { className: "text-lg text-gray-300" }, 'Пожалуйста, закройте эту вкладку и вернитесь в ту, где игра уже открыта.'),
    React.createElement('p', { className: "text-sm text-gray-500 mt-4" }, 'Это ограничение необходимо для предотвращения конфликтов и ошибок синхронизации.')
  );
};

const App = () => {
  const [screen, setScreen] = React.useState('LOBBY');
  const [gameProps, setGameProps] = React.useState({});
  const [tabStatus, setTabStatus] = React.useState('CHECKING'); // CHECKING, PRIMARY, BLOCKED
  const channelRef = React.useRef(null);

  React.useEffect(() => {
    // Инициализация канала связи между вкладками
    channelRef.current = new BroadcastChannel('tysiacha-tab-sync');
    const channel = channelRef.current;
    
    let isChecking = true;

    // Таймер, который определит, является ли эта вкладка главной, если никто не ответит
    const electionTimeout = setTimeout(() => {
      if (isChecking) {
        isChecking = false;
        setTabStatus('PRIMARY');
      }
    }, 250); // Даем другим вкладкам четверть секунды на ответ

    channel.onmessage = (event) => {
      // Если мы получили сообщение 'PONG', значит, главная вкладка уже есть.
      // Эта вкладка становится заблокированной.
      if (event.data === 'PONG' && isChecking) {
        isChecking = false;
        clearTimeout(electionTimeout);
        setTabStatus('BLOCKED');
      }
      // Если мы уже главная вкладка, отвечаем на 'PING' от новых вкладок
      if (event.data === 'PING' && tabStatus === 'PRIMARY') {
        channel.postMessage('PONG');
      }
    };

    // Отправляем 'PING', чтобы найти другие активные вкладки
    channel.postMessage('PING');

    return () => {
      clearTimeout(electionTimeout);
      if (channel) {
        channel.close();
      }
    };
  }, [tabStatus]); // Перезапускаем логику, если статус изменился (например, главная вкладка стала отвечать)


  React.useEffect(() => {
    if (tabStatus !== 'PRIMARY') return;
    
    try {
        const savedSession = localStorage.getItem('tysiacha-session');
        if (savedSession) {
            const { roomCode, playerName } = JSON.parse(savedSession);
            handleStartGame(roomCode, playerName);
        }
    } catch(e) {
        console.error("Failed to load session:", e);
        localStorage.removeItem('tysiacha-session');
    }
  }, [tabStatus]); // Этот эффект зависит от того, стала ли вкладка главной

  const handleStartGame = React.useCallback((roomCode, playerName) => {
    setGameProps({ roomCode, playerName });
    setScreen('GAME');
  }, []);

  const handleExitGame = React.useCallback(() => {
    localStorage.removeItem('tysiacha-session');
    setGameProps({});
    setScreen('LOBBY');
  }, []);

  const renderScreen = () => {
    switch (tabStatus) {
      case 'CHECKING':
        return React.createElement('div', { className: "text-center text-lg text-gray-300" }, 'Проверка вкладок...');
      case 'BLOCKED':
        return React.createElement(BlockedTab);
      case 'PRIMARY':
        switch (screen) {
          case 'GAME':
            return React.createElement(Game, { key: gameProps.roomCode, ...gameProps, onExit: handleExitGame });
          case 'LOBBY':
          default:
            return React.createElement(Lobby, { onStartGame: handleStartGame });
        }
      default:
        return null;
    }
  };

  return React.createElement(
    'main',
    {
      className: "w-screen h-screen bg-cover bg-center bg-no-repeat text-white",
      style: { backgroundImage: "url('https://images.unsplash.com/photo-1585501374353-8199cf8e1324?q=80&w=1920&auto=format&fit=crop')" }
    },
    React.createElement(
      'div',
      { className: "w-full h-full bg-black/70 backdrop-blur-sm flex items-center justify-center" },
      renderScreen()
    )
  );
};

export default App;