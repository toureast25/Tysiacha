import React from 'react';

interface LandingPageProps {
  onEnterLobby: () => void;
}

const FeatureCard: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
    <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700 text-center flex flex-col items-center">
        <div className="mb-4 text-yellow-300">{icon}</div>
        <h3 className="text-xl font-bold mb-2 text-white">{title}</h3>
        <p className="text-gray-400">{children}</p>
    </div>
);

const LandingPage: React.FC<LandingPageProps> = ({ onEnterLobby }) => {
  return (
    <div className="w-full h-full overflow-y-auto p-4 md:p-8 text-center flex flex-col items-center justify-center">
        <div className="max-w-4xl mx-auto">

            {/* Hero Section */}
            <header className="mb-12 md:mb-16">
                <h1 className="font-ruslan text-7xl md:text-9xl text-yellow-300 drop-shadow-[0_4px_4px_rgba(0,0,0,0.7)]">
                    ТЫСЯЧА
                </h1>
                <p className="text-lg md:text-2xl text-gray-300 mt-4 max-w-2xl mx-auto">
                    Легендарная игра в кости — теперь онлайн. Собери друзей и докажи, кто здесь мастер удачи и расчёта!
                </p>
                <button
                    onClick={onEnterLobby}
                    className="mt-8 px-12 py-4 bg-green-600 hover:bg-green-700 rounded-lg text-2xl font-bold uppercase tracking-wider transition-all duration-300 transform hover:scale-105 shadow-lg"
                >
                    Играть сейчас
                </button>
            </header>

            {/* Features Section */}
            <section className="mb-12 md:mb-16">
                <h2 className="font-ruslan text-4xl md:text-5xl text-white mb-8">Особенности игры</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FeatureCard
                        icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21v-1a6 6 0 00-5.197-5.975M15 21h6v-1a6 6 0 00-9-5.197" /></svg>}
                        title="Приватные комнаты"
                    >
                        Создайте игру и пригласите друзей по простому коду. Никаких посторонних.
                    </FeatureCard>
                    <FeatureCard
                        icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" /></svg>}
                        title="Классические правила"
                    >
                        Играйте в ту самую 'Тысячу', которую вы знаете и любите. Все комбинации и 'болты' на месте.
                    </FeatureCard>
                    <FeatureCard
                        icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
                        title="Удобный интерфейс"
                    >
                        Следите за счётом и бросайте кости в интуитивно понятном игровом интерфейсе.
                    </FeatureCard>
                </div>
            </section>

            {/* How to Play Section */}
            <section>
                 <h2 className="font-ruslan text-4xl md:text-5xl text-white mb-8">Как играть?</h2>
                 <div className="max-w-xl mx-auto text-left space-y-4 text-lg bg-slate-800/50 p-8 rounded-lg border border-slate-700">
                    <p><strong className="text-yellow-400">1. Бросайте кости:</strong> В свой ход бросайте 5 кубиков.</p>
                    <p><strong className="text-yellow-400">2. Набирайте очки:</strong> Откладывайте комбинации (единицы, пятёрки, сеты), чтобы заработать очки.</p>
                    <p><strong className="text-yellow-400">3. Рискуйте или сохраняйте:</strong> Бросайте оставшиеся кости, чтобы набрать больше, или запишите счёт. Но берегитесь "болта" — он сжигает все очки за ход!</p>
                    <hr className="border-slate-600 my-4"/>
                    <p className="text-center text-xl"><strong className="text-green-400">Цель:</strong> Первым набрать 1000 очков!</p>
                 </div>
            </section>
        </div>
    </div>
  );
};

export default LandingPage;