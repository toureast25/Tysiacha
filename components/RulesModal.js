
// 
import React from 'react';

const RulesModal = ({ onClose }) => {
  return React.createElement(
    'div',
    {
      className: "fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm",
      onClick: onClose,
      'aria-modal': "true",
      role: "dialog"
    },
    React.createElement(
      'div',
      {
        className: "relative w-full max-w-2xl max-h-[90vh] bg-slate-800 text-gray-300 rounded-2xl shadow-2xl border border-slate-600 flex flex-col",
        onClick: e => e.stopPropagation()
      },
      React.createElement(
        'header',
        { className: "flex items-center justify-between p-3 sm:p-4 border-b border-slate-700 flex-shrink-0" },
        React.createElement('h2', { className: "font-ruslan text-3xl text-yellow-300" }, 'Правила Игры "Тысяча"'),
        React.createElement(
          'button',
          {
            onClick: onClose,
            className: "text-gray-400 hover:text-white transition-colors p-1 rounded-full bg-slate-700 hover:bg-slate-600",
            'aria-label': "Закрыть правила"
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
        { className: "p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6" },
        React.createElement(
          'section',
          null,
          React.createElement('h3', { className: "text-xl font-bold text-yellow-400 mb-2" }, '1. Цель игры'),
          React.createElement('p', null, 'Первый игрок, набравший 1000 или более очков по итогам завершенного раунда, объявляется победителем.')
        ),
        React.createElement(
          'section',
          null,
          React.createElement('h3', { className: "text-xl font-bold text-yellow-400 mb-2" }, '2. Ход игрока'),
          React.createElement(
            'ul',
            { className: "list-disc list-inside space-y-1" },
            React.createElement('li', null, 'В начале своего хода вы бросаете 5 костей.'),
            React.createElement('li', null, 'После каждого броска вы обязаны отложить хотя бы одну очковую кость или комбинацию.'),
            React.createElement(
              'li',
              null,
              'После этого у вас есть выбор:',
              React.createElement(
                'ul',
                { className: "list-['-_'] list-inside ml-6 mt-1" },
                React.createElement('li', null, 'Записать: Завершить ход и добавить набранные очки к общему счёту.'),
                React.createElement('li', null, 'Бросить снова: Бросить оставшиеся кости, чтобы набрать больше очков.')
              )
            ),
            React.createElement('li', null, 'Ход продолжается до тех пор, пока вы не решите записать счёт или не получите "Болт".')
          )
        ),
        React.createElement(
          'section',
          null,
          React.createElement('h3', { className: "text-xl font-bold text-yellow-400 mb-2" }, '3. Подсчет очков'),
          React.createElement('p', { className: "mb-2 italic text-gray-400" }, 'Важно: Комбинация засчитывается, только если все её кости выпали в одном броске.'),
          React.createElement(
            'div',
            { className: "grid grid-cols-1 md:grid-cols-2 gap-x-4 sm:gap-x-8 gap-y-3 sm:gap-y-4" },
            React.createElement(
              'div',
              null,
              React.createElement('h4', { className: "font-semibold text-lg text-white mb-1" }, 'Одиночные кости'),
              React.createElement('p', null, React.createElement('span', { className: "font-mono font-bold text-lg" }, '1'), ' = 10 очков'),
              React.createElement('p', null, React.createElement('span', { className: "font-mono font-bold text-lg" }, '5'), ' = 5 очков')
            ),
            React.createElement(
              'div',
              null,
              React.createElement('h4', { className: "font-semibold text-lg text-white mb-1" }, 'Стрит (за 1 бросок)'),
              React.createElement('p', null, React.createElement('span', { className: "font-mono font-bold text-lg" }, '1-2-3-4-5'), ' = 125 очков')
            ),
            React.createElement(
              'div',
              null,
              React.createElement('h4', { className: "font-semibold text-lg text-white mb-1" }, 'Три одинаковых'),
              React.createElement('p', null, React.createElement('span', { className: "font-mono font-bold text-lg" }, '1,1,1'), ' = 100'),
              React.createElement('p', null, React.createElement('span', { className: "font-mono font-bold text-lg" }, '2,2,2'), ' = 20'),
              React.createElement('p', null, React.createElement('span', { className: "font-mono font-bold text-lg" }, '3,3,3'), ' = 30'),
              React.createElement('p', null, React.createElement('span', { className: "font-mono font-bold text-lg" }, '4,4,4'), ' = 40'),
              React.createElement('p', null, React.createElement('span', { className: "font-mono font-bold text-lg" }, '5,5,5'), ' = 50'),
              React.createElement('p', null, React.createElement('span', { className: "font-mono font-bold text-lg" }, '6,6,6'), ' = 60')
            ),
            React.createElement(
              'div',
              null,
              React.createElement('h4', { className: "font-semibold text-lg text-white mb-1" }, 'Четыре одинаковых'),
              React.createElement('p', null, React.createElement('span', { className: "font-mono font-bold text-lg" }, '1,1,1,1'), ' = 200'),
              React.createElement('p', null, React.createElement('span', { className: "font-mono font-bold text-lg" }, '2,2,2,2'), ' = 40'),
              React.createElement('p', null, React.createElement('span', { className: "font-mono font-bold text-lg" }, '3,3,3,3'), ' = 60'),
              React.createElement('p', null, React.createElement('span', { className: "font-mono font-bold text-lg" }, '4,4,4,4'), ' = 80'),
              React.createElement('p', null, React.createElement('span', { className: "font-mono font-bold text-lg" }, '5,5,5,5'), ' = 100'),
              React.createElement('p', null, React.createElement('span', { className: "font-mono font-bold text-lg" }, '6,6,6,6'), ' = 120')
            ),
            React.createElement(
              'div',
              null,
              React.createElement('h4', { className: "font-semibold text-lg text-white mb-1" }, 'Пять одинаковых'),
              React.createElement('p', null, React.createElement('span', { className: "font-mono font-bold text-lg" }, '1,1,1,1,1'), ' = 1000'),
              React.createElement('p', null, React.createElement('span', { className: "font-mono font-bold text-lg" }, '2,2,2,2,2'), ' = 200'),
              React.createElement('p', null, React.createElement('span', { className: "font-mono font-bold text-lg" }, '3,3,3,3,3'), ' = 300'),
              React.createElement('p', null, React.createElement('span', { className: "font-mono font-bold text-lg" }, '4,4,4,4,4'), ' = 400'),
              React.createElement('p', null, React.createElement('span', { className: "font-mono font-bold text-lg" }, '5,5,5,5,5'), ' = 500'),
              React.createElement('p', null, React.createElement('span', { className: "font-mono font-bold text-lg" }, '6,6,6,6,6'), ' = 600')
            )
          )
        ),
        React.createElement(
          'section',
          null,
          React.createElement('h3', { className: "text-xl font-bold text-yellow-400 mb-2" }, '4. Особые ситуации и Штрафы'),
          React.createElement(
            'dl',
            { className: "space-y-3 sm:space-y-4" },
            React.createElement('div', null,
                React.createElement('dt', { className: "font-semibold text-lg text-white" }, 'Вход в игру ("открытие" счёта)'),
                React.createElement(
                    'dd',
                    { className: "ml-4" },
                    'Чтобы начать набирать очки, ваш первый результативный ход должен быть 50 очков или больше. Если вы записываете меньше 50, эти очки сгорают, а ваш общий счёт остаётся нулевым.'
                )
            ),
            React.createElement('div', null,
                React.createElement('dt', { className: "font-semibold text-lg text-white" }, 'Болт'),
                React.createElement(
                  'dd',
                  { className: "ml-4" },
                  'Вы получаете "Болт" (отмечается как /), если:',
                  React.createElement(
                    'ul',
                    { className: "list-disc list-inside mt-1" },
                    React.createElement('li', null, 'Ваш бросок не принес ни одной очковой кости или комбинации.'),
                    React.createElement('li', null, 'Вы не набрали 50 очков для "входа в игру".'),
                    React.createElement('li', null, 'Вы не смогли "сойти с бочки" (см. ниже).')
                  ),
                  'При получении "Болта" все очки, набранные в текущем ходу, сгорают, и ход переходит к следующему игроку.'
                )
            ),
            React.createElement('div', null,
                React.createElement('dt', { className: "font-semibold text-lg text-white" }, 'Горячие кости (Hot Dice)'),
                React.createElement('dd', { className: "ml-4" }, 'Если вы смогли отложить все 5 костей, вы можете сделать новый бросок всеми 5 костями, продолжая свой ход. Накопленные очки при этом сохраняются.')
            ),
            React.createElement('div', null,
                React.createElement('dt', { className: "font-semibold text-lg text-white" }, 'Штраф за обгон'),
                React.createElement(
                  'dd',
                  { className: "ml-4 space-y-2" },
                   React.createElement('p', null, 'Если другой игрок своим ходом догоняет или обгоняет вас по очкам, вы получаете штраф -50 очков. Штраф применяется, только если у вас было 100 или более очков.'),
                   React.createElement('p', null, React.createElement('strong', { className: 'text-yellow-400' }, 'Исключение:'), ' Штраф не начисляется, если из-за него ваш счёт попадёт в диапазон "бочки" (например, при счёте 210 вы не получите штраф до 160).')
                )
            ),
            React.createElement('div', null,
                React.createElement('dt', { className: "font-semibold text-lg text-white" }, 'Правила "Бочки"'),
                React.createElement(
                    'dd',
                    { className: "ml-4 mt-1 space-y-2" },
                     React.createElement('p', null, 'Игрок считается "на бочке", если его счёт находится в диапазоне 200-295 или 700-795 очков.'),
                     React.createElement('p', null, React.createElement('strong', { className: 'text-yellow-400' }, 'Обязательный выход:'), ' Находясь на бочке, вы обязаны за один ход набрать столько очков, чтобы ваш суммарный счёт стал 300+ (или 800+). Если вы записываете ход, но итоговый счёт остаётся меньше 300 (или 800), вы получаете "болт" — все очки за ход сгорают.'),
                     React.createElement('p', null, React.createElement('strong', { className: 'text-yellow-400' }, 'Штраф за 3 болта:'), ' Если вы получаете три "болта" подряд, находясь на одной и той же бочке, ваш счёт откатывается до 150 (или 650) очков соответственно.'),
                     React.createElement('p', null, React.createElement('strong', { className: 'text-yellow-400' }, 'Столкновение:'), ' На одной "бочке" может быть только один игрок. Если вы своим ходом попадаете на бочку, где уже стоит другой игрок, тот игрок "сбивается" и его счёт откатывается до 150 (или 650) очков.')
                )
            )
          )
        ),
        React.createElement(
          'section',
          null,
          React.createElement('h3', { className: "text-xl font-bold text-yellow-400 mb-2" }, '5. Управление'),
          React.createElement(
            'ul',
            { className: "list-disc list-inside space-y-1" },
            React.createElement('li', null, 'Выбор костей: Кликайте на кости, чтобы выбрать их для комбинации.'),
            React.createElement('li', null, 'Отложить: Перетащите выбранные кости в зону игрового поля или сделайте двойной клик по одной из них.'),
            React.createElement('li', null, 'Ответственность игрока: Игра не подсказывает комбинации. Вы сами должны их находить и правильно откладывать.'),
            React.createElement('li', null, 'Дополнение комбинации: Если вы отложили часть комбинации (например, 3 шестерки из 4-х выпавших), вы можете до-отложить оставшуюся кость в рамках того же броска.')
          )
        )
      )
    )
  );
};

export default RulesModal;