// 
import React from 'react';
import Lobby from './Lobby.js';
import Game from './Game.js';

const { useState, useEffect, useCallback } = React;

const App = () => {
  const [screen, setScreen] = useState('LOBBY');
  const [gameProps, setGameProps] = useState({});

  useEffect(() => {
    try {
        const savedSession = localStorage.getItem('tysiacha-session');
        if (savedSession) {
            const { roomCode, playerCount, playerName } = JSON.parse(savedSession);
            // We don't pass myPlayerId here, Game component will restore it itself
            handleStartGame(roomCode, playerCount, playerName);
        }
    } catch(e) {
        console.error("Failed to load session:", e);
        localStorage.removeItem('tysiacha-session');
    }
  }, []);

  const handleStartGame = useCallback((roomCode, playerCount, playerName) => {
    setGameProps({ roomCode, playerCount, playerName });
    setScreen('GAME');
  }, []);

  const handleExitGame = useCallback(() => {
    localStorage.removeItem('tysiacha-session');
    setGameProps({});
    setScreen('LOBBY');
  }, []);

  const renderScreen = () => {
    switch (screen) {
      case 'GAME':
        return React.createElement(Game, { key: gameProps.roomCode, ...gameProps, onExit: handleExitGame });
      case 'LOBBY':
      default:
        return React.createElement(Lobby, { onStartGame: handleStartGame });
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
