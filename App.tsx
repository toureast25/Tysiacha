import React, { useState, useCallback } from 'react';
import Lobby from './components/Lobby.tsx';
import Game from './components/Game.tsx';

type GameScreen = 'LOBBY' | 'GAME';

const App: React.FC = () => {
  const [screen, setScreen] = useState<GameScreen>('LOBBY');
  const [roomCode, setRoomCode] = useState('');
  const [playerCount, setPlayerCount] = useState(2);

  const handleStartGame = useCallback((code: string, players: number) => {
    setRoomCode(code);
    setPlayerCount(players);
    setScreen('GAME');
  }, []);

  const handleExitGame = useCallback(() => {
    setRoomCode('');
    setScreen('LOBBY');
  }, []);

  const renderScreen = () => {
    switch (screen) {
      case 'GAME':
        return <Game roomCode={roomCode} playerCount={playerCount} onExit={handleExitGame} />;
      case 'LOBBY':
      default:
        return <Lobby onStartGame={handleStartGame} />;
    }
  };

  return (
    <main className="w-screen h-screen bg-cover bg-center bg-no-repeat text-white" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1585501374353-8199cf8e1324?q=80&w=1920&auto=format&fit=crop')" }}>
      <div className="w-full h-full bg-black/70 backdrop-blur-sm flex items-center justify-center">
        {renderScreen()}
      </div>
    </main>
  );
};

export default App;