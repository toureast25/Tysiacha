import React from 'react';

interface RulesModalProps {
  onClose: () => void;
}

const RulesModal: React.FC<RulesModalProps> = ({ onClose }) => {
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="relative w-full max-w-2xl max-h-[90vh] bg-slate-800 text-gray-300 rounded-2xl shadow-2xl border border-slate-600 flex flex-col"
        onClick={e => e.stopPropagation()} // Prevent closing when clicking inside
      >
        <header className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
          <h2 className="font-ruslan text-3xl text-yellow-300">Правила Игры "Тысяча"</h2>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-full bg-slate-700 hover:bg-slate-600"
            aria-label="Закрыть правила"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <main className="p-6 overflow-y-auto space-y-6">
          <section>
            <h3 className="text-xl font-bold text-yellow-400 mb-2">1. Цель игры</h3>
            <p>Первый игрок, набравший **1000 или более очков** по итогам завершенного раунда, объявляется победителем.</p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-yellow-400 mb-2">2. Ход игрока</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>В начале своего хода вы бросаете 5 костей.</li>
              <li>После каждого броска вы **обязаны отложить** хотя бы одну очковую кость или комбинацию.</li>
              <li>После этого у вас есть выбор:
                <ul className="list-['-_'] list-inside ml-6 mt-1">
                  <li>**Записать:** Завершить ход и добавить набранные очки к общему счёту.</li>
                  <li>**Бросить снова:** Бросить оставшиеся кости, чтобы набрать больше очков.</li>
                </ul>
              </li>
              <li>Ход продолжается до тех пор, пока вы не решите записать счёт или не получите "Болт".</li>
            </ul>
          </section>
          
          <section>
            <h3 className="text-xl font-bold text-yellow-400 mb-2">3. Подсчет очков</h3>
            <p className="mb-2 italic text-gray-400">Важно: Комбинация засчитывается, только если все её кости выпали в **одном броске**.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              <div>
                <h4 className="font-semibold text-lg text-white mb-1">Одиночные кости</h4>
                <p><span className="font-mono font-bold text-lg">1</span> = 10 очков</p>
                <p><span className="font-mono font-bold text-lg">5</span> = 5 очков</p>
              </div>
              <div>
                <h4 className="font-semibold text-lg text-white mb-1">Стрит (за 1 бросок)</h4>
                <p><span className="font-mono font-bold text-lg">1-2-3-4-5</span> = 125 очков</p>
              </div>
              <div>
                <h4 className="font-semibold text-lg text-white mb-1">Три одинаковых</h4>
                <p><span className="font-mono font-bold text-lg">1,1,1</span> = 100</p>
                <p><span className="font-mono font-bold text-lg">2,2,2</span> = 20</p>
                <p><span className="font-mono font-bold text-lg">3,3,3</span> = 30</p>
                <p><span className="font-mono font-bold text-lg">4,4,4</span> = 40</p>
                <p><span className="font-mono font-bold text-lg">5,5,5</span> = 50</p>
                <p><span className="font-mono font-bold text-lg">6,6,6</span> = 60</p>
              </div>
               <div>
                <h4 className="font-semibold text-lg text-white mb-1">Четыре одинаковых</h4>
                <p><span className="font-mono font-bold text-lg">1,1,1,1</span> = 200</p>
                <p><span className="font-mono font-bold text-lg">2,2,2,2</span> = 40</p>
                <p><span className="font-mono font-bold text-lg">3,3,3,3</span> = 60</p>
                <p><span className="font-mono font-bold text-lg">4,4,4,4</span> = 80</p>
                <p><span className="font-mono font-bold text-lg">5,5,5,5</span> = 100</p>
                <p><span className="font-mono font-bold text-lg">6,6,6,6</span> = 120</p>
              </div>
               <div>
                <h4 className="font-semibold text-lg text-white mb-1">Пять одинаковых</h4>
                <p><span className="font-mono font-bold text-lg">1,1,1,1,1</span> = 1000</p>
                <p><span className="font-mono font-bold text-lg">2,2,2,2,2</span> = 200</p>
                <p><span className="font-mono font-bold text-lg">3,3,3,3,3</span> = 300</p>
                <p><span className="font-mono font-bold text-lg">4,4,4,4,4</span> = 400</p>
                <p><span className="font-mono font-bold text-lg">5,5,5,5,5</span> = 500</p>
                <p><span className="font-mono font-bold text-lg">6,6,6,6,6</span> = 600</p>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-xl font-bold text-yellow-400 mb-2">4. Особые ситуации</h3>
            <dl>
              <dt className="font-semibold text-lg text-white">Болт</dt>
              <dd className="ml-4 mb-2">Вы получаете "Болт" (отмечается как **/** в таблице), если:
                  <ul className="list-disc list-inside mt-1">
                      <li>Ваш бросок не принес ни одной очковой кости или комбинации.</li>
                      <li>Вы решили записать счёт, набрав 0 очков за ход.</li>
                  </ul>
                 При получении "Болта" все очки, набранные в текущем ходу, сгорают, и ход переходит к следующему игроку.
              </dd>
              <dt className="font-semibold text-lg text-white">Горячие кости (Hot Dice)</dt>
              <dd className="ml-4">Если вы смогли отложить все 5 костей, вы можете сделать новый бросок всеми 5 костями, продолжая свой ход. Накопленные очки при этом сохраняются.</dd>
            </dl>
          </section>

          <section>
            <h3 className="text-xl font-bold text-yellow-400 mb-2">5. Управление</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>**Выбор костей:** Кликайте на кости, чтобы выбрать их для комбинации.</li>
              <li>**Отложить:** Перетащите выбранные кости в зону игрового поля или сделайте двойной клик по одной из них.</li>
              <li>**Ответственность игрока:** Игра не подсказывает комбинации. Вы сами должны их находить и правильно откладывать.</li>
              <li>**Дополнение комбинации:** Если вы отложили часть комбинации (например, 3 шестерки из 4-х выпавших), вы можете до-отложить оставшуюся кость в рамках того же броска.</li>
            </ul>
          </section>
        </main>
      </div>
    </div>
  );
};

export default RulesModal;