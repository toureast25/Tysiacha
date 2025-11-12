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
  const [initialRoomCode, setInitialRoomCode] = React.useState(null);
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


  const handleStartGame = React.useCallback((roomCode, playerName) => {
    setGameProps({ roomCode, playerName });
    setScreen('GAME');
  }, []);
  
  React.useEffect(() => {
    if (tabStatus !== 'PRIMARY') return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const roomCodeFromUrl = urlParams.get('room');

    // Case 1: Joining via URL
    if (roomCodeFromUrl) {
      // Clean up the URL immediately to prevent issues on refresh
      window.history.replaceState({}, document.title, window.location.pathname);
      
      const savedPlayerName = localStorage.getItem('tysiacha-playerName');
      
      // Always clear a full session when joining from a link to prevent conflicts
      localStorage.removeItem('tysiacha-session');

      if (savedPlayerName) {
        // Player name exists, bypass lobby and go straight to the game
        handleStartGame(roomCodeFromUrl.toUpperCase(), savedPlayerName);
      } else {
        // No player name, go to lobby with pre-filled room code
        setGameProps({}); // Ensure no old game props are lingering
        setScreen('LOBBY');
        setInitialRoomCode(roomCodeFromUrl.toUpperCase());
      }
      return; // Stop further processing
    }
    
    // Case 2: Resuming a previous session (no room in URL)
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
  }, [tabStatus, handleStartGame]);

  const handleExitGame = React.useCallback(() => {
    localStorage.removeItem('tysiacha-session');
    setGameProps({});
    setScreen('LOBBY');
    setInitialRoomCode(null); // Reset initial code on exit
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
            return React.createElement(Lobby, { onStartGame: handleStartGame, initialRoomCode: initialRoomCode });
        }
      default:
        return null;
    }
  };

  return React.createElement(
    'main',
    {
      className: "w-full h-full text-white",
    },
    React.createElement(
      'div',
      { className: "w-full h-full flex items-center justify-center" },
      renderScreen()
    )
  );
};

export default App;