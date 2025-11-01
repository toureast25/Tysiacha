import React, { useState, useCallback } from 'react';
import Lobby from './components/Lobby.tsx';
import Game from './components/Game.tsx';

type GameScreen = 'MENU' | 'LOBBY' | 'GAME';

const App: React.FC = () => {
  const [screen, setScreen] = useState<GameScreen>('MENU');
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
      case 'LOBBY':
        return <Lobby onStartGame={handleStartGame} />;
      case 'GAME':
        return <Game roomCode={roomCode} playerCount={playerCount} onExit={handleExitGame} />;
      case 'MENU':
      default:
        return <MainMenu onEnterLobby={() => setScreen('LOBBY')} />;
    }
  };

  return (
    <main className="w-screen h-screen bg-cover bg-center bg-no-repeat text-white" style={{ backgroundImage: "url('https://picsum.photos/seed/boardgame/1920/1080')" }}>
      <div className="w-full h-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
        {renderScreen()}
      </div>
    </main>
  );
};

interface MainMenuProps {
  onEnterLobby: () => void;
}

const MainMenu: React.FC<MainMenuProps> = ({ onEnterLobby }) => {
  return (
    <div className="text-center p-8 bg-black/50 rounded-lg shadow-2xl">
      <h1 className="font-ruslan text-7xl md:text-8xl text-yellow-300 drop-shadow-[0_4px_4px_rgba(0,0,0,0.7)]">
        ТЫСЯЧА
      </h1>
      <p className="text-xl text-gray-300 mt-2 mb-8">рубанись в камни со Стёпиным</p>
      <button
        onClick={onEnterLobby}
        className="px-12 py-4 bg-green-600 hover:bg-green-700 rounded-lg text-2xl font-bold uppercase tracking-wider transition-all duration-300 transform hover:scale-105 shadow-lg"
      >
        Играть
      </button>
    </div>
  );
};


export default App;