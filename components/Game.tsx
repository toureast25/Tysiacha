import React, { useReducer, useState } from 'react';
import RulesModal from './RulesModal.tsx';

// --- Interfaces and Types ---
interface Player {
  id: number;
  name: string;
  scores: (number | string)[];
}

// Used for analyzing dice rolls
interface ScoringGroup {
  value: number[];
  score: number;
  indices: number[]; // Indices within the sub-array being analyzed
}

// Result of validating a player's selection
interface SelectionValidationResult {
  isValid: boolean;
  score: number;
  values: number[];
}

// Represents the state of the game board and player turn
interface GameState {
  players: Player[];
  currentPlayerIndex: number;
  
  // Dice state
  diceOnBoard: number[];
  keptDiceThisTurn: number[]; // All dice kept in the turn (for display)
  diceKeptFromThisRoll: number[]; // Dice kept from the current roll (for scoring)
  selectedDiceIndices: Set<number>;

  // Score state
  scoreFromPreviousRolls: number; // Score from previous rolls in this turn
  currentTurnScore: number;
  potentialScore: number; // Score for the current selection

  // Game flow state
  gameMessage: string;
  isGameOver: boolean;
  canRoll: boolean;
  canBank: boolean;
  canKeep: boolean;
}

type GameAction =
  | { type: 'ROLL_DICE' }
  | { type: 'TOGGLE_DIE_SELECTION'; payload: { index: number } }
  | { type: 'KEEP_DICE'; payload: { indices: number[] } }
  | { type: 'BANK_SCORE' }
  | { type: 'NEW_GAME' };


// --- Game Logic Utilities ---

/**
 * Analyzes an array of dice to find all scoring combinations.
 */
const analyzeDice = (dice: number[]): { scoringGroups: ScoringGroup[] } => {
    const scoringGroups: ScoringGroup[] = [];
    const usedIndices = new Set<number>();
    const counts: { [key: number]: number[] } = {}; // Store indices for each die value

    dice.forEach((d, i) => {
        if (!counts[d]) counts[d] = [];
        counts[d].push(i);
    });

    // Check for street (1-2-3-4-5)
    const isStreet = [1, 2, 3, 4, 5].every(val => counts[val] && counts[val].length > 0);
    if (isStreet && dice.length === 5) {
        return {
            scoringGroups: [{ value: dice, score: 125, indices: dice.map((_, i) => i) }]
        };
    }
    
    // Check for combinations from largest to smallest to prioritize higher scores
    // Five-of-a-kind
    for (let i = 1; i <= 6; i++) {
        if (counts[i] && counts[i].length >= 5) {
            const groupIndices = counts[i].slice(0, 5);
            scoringGroups.push({
                value: Array(5).fill(i),
                score: i === 1 ? 1000 : i * 100,
                indices: groupIndices,
            });
            groupIndices.forEach(idx => usedIndices.add(idx));
        }
    }

    // Four-of-a-kind
    for (let i = 1; i <= 6; i++) {
        const availableIndices = counts[i]?.filter(idx => !usedIndices.has(idx)) || [];
        if (availableIndices.length >= 4) {
            const groupIndices = availableIndices.slice(0, 4);
            scoringGroups.push({
                value: Array(4).fill(i),
                score: i === 1 ? 200 : i * 20,
                indices: groupIndices,
            });
            groupIndices.forEach(idx => usedIndices.add(idx));
        }
    }
    
    // Three-of-a-kind
    for (let i = 1; i <= 6; i++) {
        const availableIndices = counts[i]?.filter(idx => !usedIndices.has(idx)) || [];
        if (availableIndices.length >= 3) {
            const groupIndices = availableIndices.slice(0, 3);
            scoringGroups.push({
                value: Array(3).fill(i),
                score: i === 1 ? 100 : i * 10,
                indices: groupIndices,
            });
            groupIndices.forEach(idx => usedIndices.add(idx));
        }
    }

    // Score individual 1s and 5s remaining
    if (counts[1]) {
        counts[1].forEach(idx => {
            if (!usedIndices.has(idx)) {
                scoringGroups.push({ value: [1], score: 10, indices: [idx] });
            }
        });
    }
    if (counts[5]) {
        counts[5].forEach(idx => {
            if (!usedIndices.has(idx)) {
                scoringGroups.push({ value: [5], score: 5, indices: [idx] });
            }
        });
    }

    return { scoringGroups };
}


/**
 * Validates if a player's selected dice form a valid scoring combination.
 * All selected dice must be part of a scoring group.
 */
const validateSelection = (dice: number[]): SelectionValidationResult => {
    if (dice.length === 0) {
        return { isValid: false, score: 0, values: [] };
    }

    const { scoringGroups } = analyzeDice(dice);
    const usedDiceCount = scoringGroups.reduce((count, group) => count + group.value.length, 0);

    if (usedDiceCount < dice.length) {
        // Not all selected dice form a scoring combo
        return { isValid: false, score: 0, values: [] };
    }
    
    const totalScore = scoringGroups.reduce((sum, group) => sum + group.score, 0);

    return {
        isValid: true,
        score: totalScore,
        values: dice,
    };
};


// --- Component ---

interface GameProps {
  roomCode: string;
  playerCount: number;
  onExit: () => void;
}

const Game: React.FC<GameProps> = ({ roomCode, playerCount, onExit }) => {
  const [isScoreboardExpanded, setIsScoreboardExpanded] = useState(false);
  const [showRules, setShowRules] = useState(false);

  const createInitialState = (pCount: number): GameState => {
    return {
      players: Array.from({ length: pCount }, (_, i) => ({ id: i, name: `Игрок ${i + 1}`, scores: [] })),
      currentPlayerIndex: 0,
      diceOnBoard: [],
      keptDiceThisTurn: [],
      diceKeptFromThisRoll: [],
      selectedDiceIndices: new Set(),
      scoreFromPreviousRolls: 0,
      currentTurnScore: 0,
      potentialScore: 0,
      gameMessage: `Ход Игрока 1. Бросайте кости!`,
      isGameOver: false,
      canRoll: true,
      canBank: false,
      canKeep: false,
    };
  }
  
  const gameReducer = (state: GameState, action: GameAction): GameState => {
    switch (action.type) {
      case 'ROLL_DICE': {
        if (!state.canRoll || state.isGameOver) return state;

        const isHotDiceRoll = state.keptDiceThisTurn.length >= 5;
        const diceToRollCount = isHotDiceRoll ? 5 : 5 - state.keptDiceThisTurn.length;
        const newDice = Array.from({ length: diceToRollCount }, () => Math.floor(Math.random() * 6) + 1);
        const { scoringGroups } = analyzeDice(newDice);
        const rollScore = scoringGroups.reduce((sum, group) => sum + group.score, 0);


        if (rollScore === 0) {
          // BOLT!
          const newPlayers = state.players.map((player, index) => {
              if (index === state.currentPlayerIndex) {
                  return { ...player, scores: [...player.scores, '/'] };
              }
              return player;
          });
          const nextPlayerIndex = (state.currentPlayerIndex + 1) % playerCount;
          return {
            ...createInitialState(playerCount),
            players: newPlayers,
            currentPlayerIndex: nextPlayerIndex,
            diceOnBoard: newDice,
            gameMessage: `Болт! Очки сгорели. Ход Игрока ${nextPlayerIndex + 1}.`,
          };
        }
        
        const newScoreFromPreviousRolls = state.currentTurnScore;
        
        return {
          ...state,
          diceOnBoard: newDice,
          // Clear kept dice for display only on a hot dice roll
          keptDiceThisTurn: isHotDiceRoll ? [] : state.keptDiceThisTurn,
          // Reset scoring for the new roll
          diceKeptFromThisRoll: [],
          scoreFromPreviousRolls: newScoreFromPreviousRolls,
          gameMessage: `Ваш бросок. Выберите и перетащите очковые кости.`,
          canRoll: false,
          canBank: true,
          selectedDiceIndices: new Set(),
          canKeep: false,
          potentialScore: 0,
        };
      }

      case 'TOGGLE_DIE_SELECTION': {
        if (state.isGameOver || state.diceOnBoard.length === 0) return state;

        const { index } = action.payload;
        const newSelectedIndices = new Set(state.selectedDiceIndices);
        if (newSelectedIndices.has(index)) {
            newSelectedIndices.delete(index);
        } else {
            newSelectedIndices.add(index);
        }
        
        const selectedValues = Array.from(newSelectedIndices).map(i => state.diceOnBoard[i]);
        
        // Primary validation: Is the selection valid on its own?
        let validation = validateSelection(selectedValues);
        
        // Secondary validation: Can this selection be added to what's already kept from this roll?
        // This is only necessary if the primary validation fails.
        if (!validation.isValid && selectedValues.length > 0) {
            const combinedValidation = validateSelection([...state.diceKeptFromThisRoll, ...selectedValues]);
            if (combinedValidation.isValid) {
                // It's a valid *addition*. The "score" is the difference.
                const currentRollScore = validateSelection(state.diceKeptFromThisRoll).score;
                validation = {
                    isValid: true,
                    score: combinedValidation.score - currentRollScore, // Show the score *increase*
                    values: selectedValues
                };
            }
        }

        return {
            ...state,
            selectedDiceIndices: newSelectedIndices,
            canKeep: validation.isValid,
            potentialScore: validation.score > 0 ? validation.score : 0,
            gameMessage: validation.isValid 
                ? `Выбрано +${validation.score}. Перетащите или дважды кликните, чтобы отложить.`
                : `Выберите корректную комбинацию.`,
        };
      }
      
      case 'KEEP_DICE': {
          if (state.isGameOver) return state;

          const { indices } = action.payload;
          const newlySelectedValues = indices.map(i => state.diceOnBoard[i]);

          // Key change: Validate the combination of dice already kept from this roll
          // PLUS the new dice the player is trying to keep.
          const combinedDiceForValidation = [...state.diceKeptFromThisRoll, ...newlySelectedValues];
          const validation = validateSelection(combinedDiceForValidation);

          // If the combined set of dice does not form a valid scoring group, it's an invalid move.
          if (!validation.isValid) {
              return {
                  ...state,
                  gameMessage: "Неверный выбор. Эта кость не образует очковую комбинацию."
              }
          };

          // The score of this roll is the total score of the combined dice group.
          const scoreOfThisRoll = validation.score;
          
          // Total turn score is the score from previous rolls + the new total for this roll.
          const newTurnScore = state.scoreFromPreviousRolls + scoreOfThisRoll;
          const scoreAdded = newTurnScore - state.currentTurnScore;

          const newKeptDiceThisTurn = [...state.keptDiceThisTurn, ...newlySelectedValues];
          const newDiceKeptFromThisRoll = combinedDiceForValidation;
          const newDiceOnBoard = state.diceOnBoard.filter((_, i) => !indices.includes(i));
          const allDiceScored = newDiceOnBoard.length === 0;
          
          if(allDiceScored) {
             return {
              ...state,
              currentTurnScore: newTurnScore,
              keptDiceThisTurn: newKeptDiceThisTurn,
              diceKeptFromThisRoll: newDiceKeptFromThisRoll,
              diceOnBoard: [],
              gameMessage: `+${scoreAdded}! Очки за ход: ${newTurnScore}. Все кости сыграли! Бросайте снова.`,
              canRoll: true,
              canBank: true,
              selectedDiceIndices: new Set(),
              canKeep: false,
              potentialScore: 0,
             }
          }

          return {
              ...state,
              currentTurnScore: newTurnScore,
              keptDiceThisTurn: newKeptDiceThisTurn,
              diceKeptFromThisRoll: newDiceKeptFromThisRoll,
              diceOnBoard: newDiceOnBoard,
              gameMessage: `+${scoreAdded}! Очки за ход: ${newTurnScore}. Бросайте снова или запишите.`,
              canRoll: true,
              canBank: true,
              selectedDiceIndices: new Set(),
              canKeep: false,
              potentialScore: 0,
          };
      }

      case 'BANK_SCORE': {
        if (!state.canBank || state.isGameOver) return state;
        
        let finalTurnScore = state.currentTurnScore;
        if (state.canKeep && state.potentialScore > 0) {
            finalTurnScore += state.potentialScore;
        }
        
        // Player gets a bolt if they bank 0 points
        if (finalTurnScore === 0) {
          const currentPlayerName = state.players[state.currentPlayerIndex].name;
          const newPlayersWithBolt = state.players.map((player, index) => {
            if (index === state.currentPlayerIndex) {
              return { ...player, scores: [...player.scores, '/'] };
            }
            return player;
          });
          const nextPlayerIndex = (state.currentPlayerIndex + 1) % playerCount;
          return {
            ...createInitialState(playerCount),
            players: newPlayersWithBolt,
            currentPlayerIndex: nextPlayerIndex,
            gameMessage: `${currentPlayerName} получает болт. Ход Игрока ${nextPlayerIndex + 1}.`
          };
        }

        const newPlayers = state.players.map((player, index) => {
            if (index === state.currentPlayerIndex) {
                return {
                    ...player,
                    scores: [...player.scores, finalTurnScore],
                };
            }
            return player;
        });
        
        const currentPlayer = newPlayers[state.currentPlayerIndex];
        // FIX: Operator '+' cannot be applied to types 'string | number'.
        // Safely sum scores by treating non-numeric values as 0.
        const totalScore = currentPlayer.scores
          .filter((s): s is number => typeof s === 'number')
          .reduce((sum, s) => sum + s, 0);
        
        if (totalScore >= 1000) {
          return {
            ...createInitialState(playerCount),
            players: newPlayers,
            isGameOver: true,
            gameMessage: `${currentPlayer.name} победил, набрав ${totalScore} очков!`,
          };
        }

        const nextPlayerIndex = (state.currentPlayerIndex + 1) % playerCount;
        return {
          ...createInitialState(playerCount),
          players: newPlayers,
          currentPlayerIndex: nextPlayerIndex,
          gameMessage: `${currentPlayer.name} записал ${finalTurnScore} очков. Ход Игрока ${nextPlayerIndex + 1}.`
        };
      }

      case 'NEW_GAME':
        return createInitialState(playerCount);
      
      default:
        return state;
    }
  };

  const [state, dispatch] = useReducer(gameReducer, createInitialState(playerCount));
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    // If the dragged die is part of a selection, drag the whole selection.
    // Otherwise, drag just the single die.
    if (state.selectedDiceIndices.size > 0 && state.selectedDiceIndices.has(index)) {
      e.dataTransfer.setData('text/plain', 'selection');
      e.dataTransfer.effectAllowed = 'move';
    } else {
      const singleDieIndex = JSON.stringify([index]);
      e.dataTransfer.setData('application/json', singleDieIndex);
      e.dataTransfer.setData('text/plain', 'group'); // Use 'group' to be handled by the drop logic for single items
      e.dataTransfer.effectAllowed = 'move';
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); // Necessary to allow dropping
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const type = e.dataTransfer.getData('text/plain');

    if (type === 'selection' && state.canKeep) {
      dispatch({ type: 'KEEP_DICE', payload: { indices: Array.from(state.selectedDiceIndices) } });
    } else if (type === 'group') {
      try {
        const indicesString = e.dataTransfer.getData('application/json');
        const indices = JSON.parse(indicesString);
        if (Array.isArray(indices)) {
            dispatch({ type: 'KEEP_DICE', payload: { indices } });
        }
      } catch (error) {
        console.error("Failed to parse dropped dice group:", error);
      }
    }
  };

  const handleDieDoubleClick = (index: number) => {
    if (state.isGameOver || state.diceOnBoard.length === 0) return;

    // If the double-clicked die is part of an existing selection, keep the whole selection.
    if (state.selectedDiceIndices.size > 0 && state.selectedDiceIndices.has(index)) {
        dispatch({ type: 'KEEP_DICE', payload: { indices: Array.from(state.selectedDiceIndices) } });
    } else {
        // Otherwise, try to keep just that single die.
        // The reducer will validate if it's a scoring die on its own.
        dispatch({ type: 'KEEP_DICE', payload: { indices: [index] } });
    }
  };


  const DiceIcon = ({ value, isSelected, onClick, onDragStart, onDoubleClick }: { value: number, isSelected?: boolean, onClick?: () => void, onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void, onDoubleClick?: () => void }) => {
    const dots: { [key:number]: string[] } = {
      1: ['center'],
      2: ['top-left', 'bottom-right'],
      3: ['top-left', 'center', 'bottom-right'],
      4: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
      5: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
      6: ['top-left', 'top-right', 'mid-left', 'mid-right', 'bottom-left', 'bottom-right'],
    };

    const dotClasses: {[key: string]: string} = {
        'center': 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
        'top-left': 'top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2',
        'top-right': 'top-1/4 right-1/4 translate-x-1/2 -translate-y-1/2',
        'bottom-left': 'bottom-1/4 left-1/4 -translate-x-1/2 translate-y-1/2',
        'bottom-right': 'bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2',
        'mid-left': 'top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2',
        'mid-right': 'top-1/2 right-1/4 translate-x-1/2 -translate-y-1/2',
    }
    
    const baseClasses = "w-16 sm:w-20 aspect-square bg-slate-200 rounded-lg shadow-md flex items-center justify-center relative border-2 transition-all duration-200 flex-shrink-0";
    
    let stateClasses = "border-slate-400";
    if (onClick) {
        stateClasses += " cursor-pointer";
    }

    if (isSelected) {
        stateClasses = "border-yellow-400 scale-105 shadow-lg shadow-yellow-400/50 cursor-pointer";
    }
    
    if (value === 0) {
        return <div className={`${baseClasses} bg-slate-700/50 border-slate-600 border-dashed`}></div>;
    }

    return (
      <div 
        className={`${baseClasses} ${stateClasses}`} 
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        draggable={!!onDragStart}
        onDragStart={onDragStart}
      >
        {value > 0 && dots[value] && dots[value].map(pos => <div key={pos} className={`absolute w-[18%] h-[18%] bg-slate-900 rounded-full ${dotClasses[pos]}`}></div>)}
      </div>
    );
  };

  const SmallDiceIcon = ({ value }: { value: number }) => {
    const dots: { [key:number]: string[] } = {
      1: ['center'],
      2: ['top-left', 'bottom-right'],
      3: ['top-left', 'center', 'bottom-right'],
      4: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
      5: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
      6: ['top-left', 'top-right', 'mid-left', 'mid-right', 'bottom-left', 'bottom-right'],
    };

    const dotClasses: {[key: string]: string} = {
        'center': 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
        'top-left': 'top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2',
        'top-right': 'top-1/4 right-1/4 translate-x-1/2 -translate-y-1/2',
        'bottom-left': 'bottom-1/4 left-1/4 -translate-x-1/2 translate-y-1/2',
        'bottom-right': 'bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2',
        'mid-left': 'top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2',
        'mid-right': 'top-1/2 right-1/4 translate-x-1/2 -translate-y-1/2',
    }
    
    return (
      <div className="w-10 h-10 bg-slate-300 rounded shadow-sm flex items-center justify-center relative border border-slate-400">
        {value > 0 && dots[value] && dots[value].map(pos => <div key={pos} className={`absolute w-2 h-2 bg-slate-900 rounded-full ${dotClasses[pos]}`}></div>)}
      </div>
    );
  };

  const isHotDiceRoll = state.keptDiceThisTurn.length >= 5;
  const diceToRollCount = isHotDiceRoll ? 5 : 5 - state.keptDiceThisTurn.length;
  const rollButtonText = diceToRollCount === 5 ? 'Бросить все' : `Бросить ${diceToRollCount}`;

  const totalDiceSlots = 5;
  const placeholdersToRender = totalDiceSlots - state.diceOnBoard.length;


  return (
    <>
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      <div className="w-full h-full flex flex-col p-4 text-white overflow-hidden">
        {/* Header */}
        <header className="flex justify-between items-center mb-4 flex-shrink-0">
          <div className="p-2 bg-black/50 rounded-lg text-sm">
            <p className="font-mono">КОД КОМНАТЫ: {roomCode}</p>
          </div>
          <h1 
            onClick={() => setShowRules(true)}
            className="font-ruslan text-4xl text-yellow-300 cursor-pointer hover:text-yellow-200 transition-colors"
            title="Показать правила"
          >
            ТЫСЯЧА
          </h1>
          <button onClick={onExit} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-bold">
            Выйти
          </button>
        </header>

        {/* Main Game Area */}
        <div className="flex-grow flex flex-col lg:grid lg:grid-cols-4 gap-4 min-h-0">
          {/* Player Scores */}
          <aside className={`lg:col-span-1 bg-slate-800/80 p-4 rounded-xl border border-slate-700 flex flex-col transition-all duration-500 ease-in-out ${isScoreboardExpanded ? 'h-full' : 'flex-shrink-0'}`}>
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
                  <h2 className="font-ruslan text-3xl text-yellow-300">Игроки</h2>
                  <button 
                      onClick={() => setIsScoreboardExpanded(!isScoreboardExpanded)}
                      className="p-1 rounded-full hover:bg-slate-700/50 lg:hidden"
                      aria-label={isScoreboardExpanded ? "Свернуть таблицу" : "Развернуть таблицу"}
                      aria-expanded={isScoreboardExpanded}
                  >
                      <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 text-yellow-300 transition-transform duration-300 ${isScoreboardExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                  </button>
              </div>
            <div className="flex-grow overflow-y-auto relative">
              <table className="w-full text-sm text-left text-gray-300">
                <thead className="text-xs text-yellow-300 uppercase bg-slate-800 sticky top-0 z-10">
                  <tr>
                    {state.players.map((player, index) => (
                      <th key={player.id} scope="col" className={`h-10 px-2 text-center align-middle transition-colors duration-300 ${index === state.currentPlayerIndex && !state.isGameOver ? 'bg-yellow-400 text-slate-900' : 'bg-slate-700/50'}`}>
                        {player.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className={isScoreboardExpanded ? '' : 'hidden lg:table-row-group'}>
                  {(() => {
                    const maxRounds = state.players.reduce((max, p) => Math.max(max, p.scores.length), 0);
                    if (maxRounds === 0) {
                      return (
                        <tr>
                          <td colSpan={playerCount} className="py-4 px-2 text-center text-gray-400 italic">
                            Еще не было записано очков.
                          </td>
                        </tr>
                      );
                    }
                    const rows = [];
                    for (let i = 0; i < maxRounds; i++) {
                      rows.push(
                        <tr key={i} className="border-b border-slate-700 hover:bg-slate-700/30">
                          {state.players.map(player => (
                            <td key={`${player.id}-${i}`} className="py-2 px-2 text-center font-mono">
                              {player.scores[i] !== undefined ? player.scores[i] : <span className="text-slate-500">-</span>}
                            </td>
                          ))}
                        </tr>
                      );
                    }
                    return rows;
                  })()}
                </tbody>
                <tfoot className="sticky bottom-0 bg-slate-800 font-bold text-white border-t-2 border-slate-500">
                  <tr>
                    {state.players.map((player, index) => {
                      // FIX: Operator '+' cannot be applied to types 'string | number'.
                      // Safely sum scores by treating non-numeric values as 0.
                      const totalScore = player.scores
                        .filter((s): s is number => typeof s === 'number')
                        .reduce((sum, s) => sum + s, 0);
                      return (
                          <td key={player.id} className={`h-10 px-2 text-center text-lg font-mono align-middle transition-colors duration-300 ${index === state.currentPlayerIndex && !state.isGameOver ? 'bg-yellow-400/80 text-slate-900' : 'bg-slate-900/50'}`}>
                            {totalScore}
                          </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          </aside>

          {/* Game Board & Actions */}
          <main 
            className={`relative flex-grow lg:col-span-3 bg-slate-900/70 rounded-xl border-2 flex flex-col justify-between transition-all duration-300 min-h-0 ${isDragOver ? 'border-green-400 shadow-2xl shadow-green-400/20' : 'border-slate-600'} p-4`}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragLeave={handleDragLeave}
          >
            {/* Top Area: Status and Kept Dice */}
            <div className="w-full">
              {/* Game Status Message */}
              <div className={`w-full p-3 mb-4 text-center rounded-lg ${state.isGameOver ? 'bg-green-600' : 'bg-slate-800'} border border-slate-600 flex items-center justify-center min-h-[72px]`}>
                    <p className="text-lg font-semibold">{state.gameMessage}</p>
                </div>

              {/* Kept Dice Area */}
              <div className="w-full flex justify-center md:justify-end">
                <div className="p-3 rounded-lg bg-black/40 border border-slate-700 w-full md:w-auto md:min-w-[300px]">
                    <p className="text-xs text-gray-400 mb-2 text-center uppercase tracking-wider">Отложено</p>
                    <div className="flex gap-2 flex-wrap justify-center min-h-[40px] items-center">
                        {state.keptDiceThisTurn.length > 0
                            ? state.keptDiceThisTurn.map((value, i) => <SmallDiceIcon key={`kept-${i}`} value={value} />)
                            : <span className="text-slate-500 italic">Пусто</span>
                        }
                    </div>
                </div>
              </div>
            </div>
            

            {/* Dice Display Area */}
            <div className="flex-grow w-full flex flex-col items-center justify-center pt-3 pb-6">
              {/* Rolled Dice on Board */}
              <div className="w-full sm:max-w-[480px] flex items-center justify-between min-h-[80px]">
                  {state.diceOnBoard.map((value, i) => (
                        <DiceIcon 
                          key={`board-${i}`} 
                          value={value} 
                          isSelected={state.selectedDiceIndices.has(i)}
                          onClick={() => dispatch({type: 'TOGGLE_DIE_SELECTION', payload: { index: i }})}
                          onDragStart={(e) => handleDragStart(e, i)}
                          onDoubleClick={() => handleDieDoubleClick(i)}
                        />
                  ))}
                  {Array.from({ length: placeholdersToRender }).map((_, i) => (
                      <DiceIcon key={`placeholder-${i}`} value={0} />
                  ))}
              </div>
            </div>
            
            {/* Turn Info & Actions */}
            <div className="w-full">
              <div className="text-center mb-4">
                  <p className="text-xl">Очки за ход: <span className="font-ruslan text-5xl text-green-400">{state.currentTurnScore + state.potentialScore}</span></p>
              </div>
              
              <div className="max-w-2xl mx-auto">
                {state.isGameOver ? (
                  <button 
                    onClick={() => dispatch({type: 'NEW_GAME'})}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 rounded-lg text-2xl font-bold uppercase tracking-wider transition-all duration-300 transform hover:scale-105 shadow-lg"
                  >
                    Новая Игра
                  </button>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => dispatch({type: 'ROLL_DICE'})}
                      disabled={!state.canRoll}
                      className="w-full py-3 bg-green-600 hover:bg-green-700 rounded-lg text-xl font-bold uppercase tracking-wider transition-all duration-300 transform hover:scale-105 shadow-lg disabled:bg-gray-500 disabled:cursor-not-allowed disabled:scale-100"
                    >
                      {rollButtonText}
                    </button>
                    <button 
                      onClick={() => dispatch({type: 'BANK_SCORE'})}
                      disabled={!state.canBank}
                      className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 text-slate-900 rounded-lg text-xl font-bold uppercase tracking-wider transition-all duration-300 transform hover:scale-105 shadow-lg disabled:bg-gray-500 disabled:cursor-not-allowed disabled:scale-100"
                    >
                      Записать
                    </button>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
};

export default Game;
