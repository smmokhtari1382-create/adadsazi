
import { useState, useEffect, useRef } from 'react';
import './App.css';

type Difficulty = 'آسان' | 'متوسط' | 'سخت';
type DifficultyChoice = Difficulty | 'تصادفی';
type Extremum = 'largest' | 'smallest' | 'none';
type GameMode = 'عادی' | 'مسابقه‌ای';
type Screen = 'register' | 'home' | 'game' | 'result' | 'history';

type PlaceCondition = {
  position: number;
  digit: number;
};

type Question = {
  digits: number[];
  text: string;
  answer: string;
  type: Extremum;
  digitCount: number;
  placeCondition: PlaceCondition | null;
  divisor: number | null;
  time: number;
  difficulty: Difficulty;
};

type Result = {
  correct: boolean;
  timeout: boolean;
};

type GameHistory = {
  id: string;
  date: string;
  studentName?: string;
  difficulty: DifficultyChoice;
  totalQuestions: number;
  correct: number;
  percentage: number;
  infinite: boolean;
  burned: boolean;
  gameMode?: GameMode;
};

const SETTINGS: Record<Difficulty, { count: number }> = {
  آسان: { count: 3 },
  متوسط: { count: 4 },
  سخت: { count: 6 },
};

const DIVISORS = [2, 3, 5, 6, 9, 10];

const PLACE_NAMES: Record<number, string> = {
  1: 'یکان',
  2: 'دهگان',
  3: 'صدگان',
  4: 'هزارگان',
  5: 'ده‌هزارگان',
  6: 'صد‌هزارگان',
};

const TIME_MULTIPLIERS: Record<Difficulty, number> = {
  آسان: 5,
  متوسط: 4,
  سخت: 3,
};

const toPersianDigits = (value: string | number): string =>
  String(value).replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);

const randomInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const shuffle = <T,>(array: T[]): T[] => {
  const result = [...array];

  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
};

const getRandomDifficulty = (): Difficulty => {
  const levels: Difficulty[] = ['آسان', 'متوسط', 'سخت'];
  return levels[randomInt(0, levels.length - 1)];
};

/**
 * محاسبه زمان سؤال
 *
 * حالت عادی:
 * آسان × ۵
 * متوسط × ۴
 * سخت × ۳
 *
 * حالت مسابقه‌ای:
 * زمان پایه بدون ضریب
 */
const calculateQuestionTime = (
  digitCount: number,
  extremum: Extremum,
  hasPlaceCondition: boolean,
  divisor: number | null,
  difficulty: Difficulty,
  gameMode: GameMode
): number => {
  let time = 1 + digitCount;

  if (extremum !== 'none') time += 2;

  if (hasPlaceCondition) time += 2;

  if (divisor !== null) {
    if ([2, 5, 10].includes(divisor)) {
      time += 2;
    } else {
      time += 5;
    }
  }

  if (gameMode === 'عادی') {
    time *= TIME_MULTIPLIERS[difficulty];
  }

  return time;
};

const getPlaceDigit = (
  number: number,
  position: number
): number => {
  const numberString = String(number);
  const index = numberString.length - position;

  if (index < 0 || index >= numberString.length) return -1;

  return Number(numberString[index]);
};

const getPlaceText = (position: number): string =>
  PLACE_NAMES[position] || `${toPersianDigits(position)}مین رقم`;

const buildQuestionText = (
  type: Extremum,
  digitCount: number,
  placeCondition: PlaceCondition | null,
  divisor: number | null
): string => {
  const parts: string[] = [];

  if (type === 'largest') {
    parts.push(
      `بزرگ‌ترین عدد ${toPersianDigits(digitCount)} رقمی را بساز`
    );
  } else if (type === 'smallest') {
    parts.push(
      `کوچک‌ترین عدد ${toPersianDigits(digitCount)} رقمی را بساز`
    );
  } else {
    parts.push(`یک عدد ${toPersianDigits(digitCount)} رقمی بساز`);
  }

  if (placeCondition) {
    parts.push(
      `رقم ${getPlaceText(placeCondition.position)} آن ${toPersianDigits(
        placeCondition.digit
      )} باشد`
    );
  }

  if (divisor !== null) {
    parts.push(`بر ${toPersianDigits(divisor)} بخش‌پذیر باشد`);
  }

  return parts.join(' و ');
};

/**
 * تولید تمام اعداد معتبر با کارت‌های موجود
 */
const getAllValidNumbers = (
  digits: number[],
  digitCount: number,
  placeCondition: PlaceCondition | null,
  divisor: number | null
): number[] => {
  const results = new Set<number>();

  const generate = (current: number[], remaining: number[]) => {
    if (current.length === digitCount) {
      if (current[0] === 0) return;

      const number = Number(current.join(''));

      if (
        placeCondition &&
        getPlaceDigit(number, placeCondition.position) !==
          placeCondition.digit
      ) {
        return;
      }

      if (divisor !== null && number % divisor !== 0) {
        return;
      }

      results.add(number);
      return;
    }

    for (let i = 0; i < remaining.length; i++) {
      const digit = remaining[i];

      if (current.length === 0 && digit === 0) continue;

      const nextCurrent = [...current, digit];
      const nextRemaining = [...remaining];

      nextRemaining.splice(i, 1);

      generate(nextCurrent, nextRemaining);
    }
  };

  generate([], [...digits]);

  return [...results];
};

/**
 * تولید سؤال معتبر
 */
const generateQuestion = (
  difficulty: Difficulty,
  gameMode: GameMode
): Question => {
  const cardCount = SETTINGS[difficulty].count;

  for (let attempt = 0; attempt < 500; attempt++) {
    const digits = shuffle(
      Array.from({ length: 10 }, (_, i) => i)
    ).slice(0, cardCount);

    const extremumOptions: Extremum[] = [
      'largest',
      'smallest',
      'none',
    ];

    const type =
      extremumOptions[randomInt(0, extremumOptions.length - 1)];

    const digitCount = randomInt(1, cardCount);

    let placeCondition: PlaceCondition | null = null;

    if (Math.random() < 0.5 && digitCount >= 2) {
      const position = randomInt(1, digitCount);
      const digit = digits[randomInt(0, digits.length - 1)];

      placeCondition = {
        position,
        digit,
      };
    }

    const divisor =
      Math.random() < 0.5
        ? DIVISORS[randomInt(0, DIVISORS.length - 1)]
        : null;

    const validNumbers = getAllValidNumbers(
      digits,
      digitCount,
      placeCondition,
      divisor
    );

    if (validNumbers.length === 0) continue;

    let answer: number;

    if (type === 'largest') {
      answer = Math.max(...validNumbers);
    } else if (type === 'smallest') {
      answer = Math.min(...validNumbers);
    } else {
      answer =
        validNumbers[randomInt(0, validNumbers.length - 1)];
    }

    const time = calculateQuestionTime(
      digitCount,
      type,
      placeCondition !== null,
      divisor,
      difficulty,
      gameMode
    );

    return {
      digits,
      text: buildQuestionText(
        type,
        digitCount,
        placeCondition,
        divisor
      ),
      answer: String(answer),
      type,
      digitCount,
      placeCondition,
      divisor,
      time,
      difficulty,
    };
  }

  // سؤال پشتیبان
  return {
    digits: [1, 2, 3],
    text: 'بزرگ‌ترین عدد ۳ رقمی را بساز',
    answer: '321',
    type: 'largest',
    digitCount: 3,
    placeCondition: null,
    divisor: null,
    time:
      gameMode === 'عادی'
        ? 6 * TIME_MULTIPLIERS[difficulty]
        : 6,
    difficulty,
  };
};

/**
 * بررسی صحت پاسخ
 */
const checkAnswer = (
  question: Question,
  selectedDigits: number[]
): boolean => {
  if (selectedDigits.length !== question.digitCount) {
    return false;
  }

  if (selectedDigits.length === 0 || selectedDigits[0] === 0) {
    return false;
  }

  const availableDigits = [...question.digits];

  for (const digit of selectedDigits) {
    const index = availableDigits.indexOf(digit);

    if (index === -1) return false;

    availableDigits.splice(index, 1);
  }

  const answer = Number(selectedDigits.join(''));

  if (question.placeCondition) {
    const actualDigit = getPlaceDigit(
      answer,
      question.placeCondition.position
    );

    if (actualDigit !== question.placeCondition.digit) {
      return false;
    }
  }

  if (
    question.divisor !== null &&
    answer % question.divisor !== 0
  ) {
    return false;
  }

  if (question.type !== 'none') {
    return answer === Number(question.answer);
  }

  return true;
};

/**
 * خواندن تاریخچه از حافظه مرورگر
 */
const getHistory = (): GameHistory[] => {
  try {
    const saved = localStorage.getItem('numberGameHistory');

    if (!saved) return [];

    return JSON.parse(saved) as GameHistory[];
  } catch {
    return [];
  }
};

/**
 * ذخیره تاریخچه در حافظه مرورگر
 */
const saveHistory = (history: GameHistory[]) => {
  try {
    localStorage.setItem(
      'numberGameHistory',
      JSON.stringify(history.slice(0, 100))
    );
  } catch (error) {
    console.error('خطا در ذخیره تاریخچه:', error);
  }
};

function App() {
  // ثبت‌نام دانش‌آموز و بازیابی نام ذخیره‌شده
  const savedName = localStorage.getItem('numberGameStudentName') || '';

  const [studentName, setStudentName] = useState(savedName);
  const [nameInput, setNameInput] = useState(savedName);

  const [screen, setScreen] = useState<Screen>(
    savedName.trim() ? 'home' : 'register'
  );

  const [questionCount, setQuestionCount] = useState<number | null>(10);

  const [difficultyChoice, setDifficultyChoice] =
    useState<DifficultyChoice>('متوسط');

  const [gameMode, setGameMode] = useState<GameMode>('عادی');

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedDigits, setSelectedDigits] = useState<number[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [history, setHistory] = useState<GameHistory[]>(getHistory);

  const [gameBurned, setGameBurned] = useState(false);

  // زمان ذخیره‌شده در حالت مسابقه‌ای
  const [bonusTime, setBonusTime] = useState(0);
  const bonusTimeRef = useRef(0);

  // جلوگیری از ثبت چندباره پاسخ
  const submittedRef = useRef(false);
  const historySavedRef = useRef(false);

  // مدیریت تایمر بازخورد پاسخ اشتباه
  const wrongAnswerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const [wrongAnswerFeedback, setWrongAnswerFeedback] = useState<{
    answer: string;
    type: Extremum;
    timeout: boolean;
  } | null>(null);

  const currentQuestion = questions[currentIndex];

  const isInfinite = questionCount === null;
  const isCompetition = gameMode === 'مسابقه‌ای';

  /**
   * ثبت نام / ذخیره نام دانش‌آموز
   */
  const registerStudent = () => {
    const trimmedName = nameInput.trim();

    if (!trimmedName) return;

    setStudentName(trimmedName);

    localStorage.setItem(
      'numberGameStudentName',
      trimmedName
    );

    setScreen('home');
  };

  /**
   * تعیین سطح سؤال بعدی
   */
  const createQuestionForGame = (): Question => {
    const level =
      difficultyChoice === 'تصادفی'
        ? getRandomDifficulty()
        : difficultyChoice;

    return generateQuestion(level, gameMode);
  };

  /**
   * ذخیره نتیجه بازی در تاریخچه
   */
  const storeCurrentGame = (
    resultsToSave: Result[],
    infinite: boolean,
    burned: boolean
  ) => {
    if (historySavedRef.current) return;

    historySavedRef.current = true;

    if (resultsToSave.length === 0) return;

    const correct = resultsToSave.filter(
      (result) => result.correct
    ).length;

    const newHistory: GameHistory = {
      id: `${Date.now()}`,
      date: new Date().toLocaleDateString('fa-IR'),
      studentName,
      difficulty: difficultyChoice,
      totalQuestions: resultsToSave.length,
      correct,
      percentage: Math.round(
        (correct / resultsToSave.length) * 100
      ),
      infinite,
      burned,
      gameMode,
    };

    const updated = [newHistory, ...history];

    setHistory(updated);
    saveHistory(updated);
  };

  /**
   * شروع بازی جدید
   */
  const startGame = () => {
    const firstQuestion = createQuestionForGame();

    setQuestions([firstQuestion]);
    setCurrentIndex(0);
    setSelectedDigits([]);
    setResults([]);

    bonusTimeRef.current = 0;
    setBonusTime(0);

    setTimeLeft(firstQuestion.time);

    setGameBurned(false);
    setWrongAnswerFeedback(null);

    if (wrongAnswerTimerRef.current) {
      clearTimeout(wrongAnswerTimerRef.current);
      wrongAnswerTimerRef.current = null;
    }

    submittedRef.current = false;
    historySavedRef.current = false;

    setScreen('game');
  };

  /**
   * ساخت سؤال بعدی
   */
  const createNextQuestion = () => {
    const nextQuestion = createQuestionForGame();

    setQuestions((previous) => [...previous, nextQuestion]);
    setCurrentIndex((previous) => previous + 1);

    setSelectedDigits([]);

    const nextTime =
      nextQuestion.time +
      (isCompetition ? bonusTimeRef.current : 0);

    setTimeLeft(nextTime);

    submittedRef.current = false;
  };

  /**
   * انتخاب و لغو انتخاب کارت
   */
  const toggleDigit = (digit: number) => {
    if (submittedRef.current || !currentQuestion) return;

    setSelectedDigits((previous) => {
      if (previous.includes(digit)) {
        return previous.filter((item) => item !== digit);
      }

      if (previous.length >= currentQuestion.digitCount) {
        return previous;
      }

      return [...previous, digit];
    });
  };

  /**
   * ثبت پاسخ
   *
   * پاسخ صحیح: ادامه پس از مکث کوتاه
   * پاسخ اشتباه: نمایش صفحه قرمز برای ۵ ثانیه
   * حالت بی‌نهایت: پاسخ اشتباه موجب پایان بازی می‌شود
   */
  const submitAnswer = (timeout = false) => {
    if (submittedRef.current || !currentQuestion) return;

    submittedRef.current = true;

    const correct =
      !timeout &&
      checkAnswer(currentQuestion, selectedDigits);

    const newResult: Result = {
      correct,
      timeout,
    };

    const updatedResults = [...results];
    updatedResults[currentIndex] = newResult;

    setResults(updatedResults);

    // مدیریت زمان ذخیره‌شده در حالت مسابقه‌ای
    if (isCompetition) {
      if (correct) {
        // فقط زمان باقی‌مانده ذخیره می‌شود؛ زمان‌ها روی هم انباشته نمی‌شوند
        bonusTimeRef.current = timeLeft;
        setBonusTime(timeLeft);
      } else {
        bonusTimeRef.current = 0;
        setBonusTime(0);
      }
    }

    // پاسخ صحیح
    if (correct) {
      setTimeout(() => {
        if (isInfinite) {
          createNextQuestion();
          return;
        }

        const nextIndex = currentIndex + 1;

        if (
          questionCount !== null &&
          nextIndex < questionCount
        ) {
          createNextQuestion();
          return;
        }

        storeCurrentGame(updatedResults, false, false);
        setScreen('result');
      }, 700);

      return;
    }

    // پاسخ غلط یا اتمام زمان: نمایش پاسخ صحیح
    setWrongAnswerFeedback({
      answer: currentQuestion.answer,
      type: currentQuestion.type,
      timeout,
    });

    // حالت بی‌نهایت: بازی بعد از نمایش بازخورد تمام می‌شود
    if (isInfinite) {
      setGameBurned(true);
    }

    // پس از ۵ ثانیه، ادامه بازی یا نمایش نتیجه
    wrongAnswerTimerRef.current = setTimeout(() => {
      setWrongAnswerFeedback(null);
      wrongAnswerTimerRef.current = null;

      if (isInfinite) {
        storeCurrentGame(updatedResults, true, true);
        setScreen('result');
        return;
      }

      const nextIndex = currentIndex + 1;

      if (
        questionCount !== null &&
        nextIndex < questionCount
      ) {
        createNextQuestion();
        return;
      }

      storeCurrentGame(updatedResults, false, false);
      setScreen('result');
    }, 5000);
  };

  /**
   * خروج دستی از بازی
   */
  const exitGame = () => {
    if (wrongAnswerTimerRef.current) {
      clearTimeout(wrongAnswerTimerRef.current);
      wrongAnswerTimerRef.current = null;
    }

    setWrongAnswerFeedback(null);

    if (isInfinite) {
      storeCurrentGame(results, true, false);
    }

    setScreen('home');
  };

  /**
   * بازگشت به صفحه اصلی
   */
  const backHome = () => {
    setScreen('home');
  };

  /**
   * پاک کردن تاریخچه
   */
  const clearHistory = () => {
    setHistory([]);
    saveHistory([]);
  };

  /**
   * پاک‌سازی تایمر بازخورد هنگام خروج از کامپوننت
   */
  useEffect(() => {
    return () => {
      if (wrongAnswerTimerRef.current) {
        clearTimeout(wrongAnswerTimerRef.current);
      }
    };
  }, []);

  /**
   * تایمر سؤال
   */
  useEffect(() => {
    if (
      screen !== 'game' ||
      submittedRef.current ||
      wrongAnswerFeedback !== null
    ) {
      return;
    }

    if (timeLeft <= 0) {
      submitAnswer(true);
      return;
    }

    const timer = setTimeout(() => {
      setTimeLeft((previous) => previous - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [timeLeft, screen, wrongAnswerFeedback]);

  /**
   * صفحه ثبت‌نام
   */
  if (screen === 'register') {
    return (
      <div className="container">
        <div className="brand-icon">🔢</div>

        <h1>ثبت‌نام دانش‌آموز</h1>

        <p className="subtitle">
          برای شروع بازی، نام و نام خانوادگی خودت را وارد کن.
        </p>

        <div className="setting">
          <h3>نام و نام خانوادگی</h3>

          <input
            type="text"
            value={nameInput}
            onChange={(event) => setNameInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                registerStudent();
              }
            }}
            placeholder="مثلاً سید مهدی مختاری فرد"
            autoFocus
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '14px',
              borderRadius: '12px',
              border: '2px solid #d1d5db',
              fontSize: '18px',
              textAlign: 'center',
              direction: 'rtl',
              outline: 'none',
              marginTop: '10px',
              backgroundColor: '#ffffff',
              color: '#1f2937',
            }}
          />
        </div>

        <button
          className="primary-button"
          onClick={registerStudent}
          disabled={!nameInput.trim()}
        >
          ورود به بازی
        </button>

        {studentName.trim() && (
          <button
            className="text-button"
            onClick={() => setScreen('home')}
          >
            بازگشت به صفحه اصلی
          </button>
        )}

        <div className="footer">
          نام شما برای دفعات بعد در همین دستگاه ذخیره می‌شود.
        </div>
      </div>
    );
  }

  /**
   * صفحه اصلی
   */
  if (screen === 'home') {
    return (
      <div className="container">
        <div className="brand-icon">🔢</div>

        <h1>بازی عددسازی</h1>

        <p className="subtitle">
          سلام {studentName}!
          <br />
          با کارت‌های عددی، هوش ریاضی خودت را به چالش بکش.
        </p>

        <button
          className="text-button"
          onClick={() => {
            setNameInput(studentName);
            setScreen('register');
          }}
        >
          تغییر نام دانش‌آموز
        </button>

        <div className="setting">
          <h3>حالت بازی</h3>

          <div className="options">
            {(['عادی', 'مسابقه‌ای'] as GameMode[]).map((mode) => (
              <button
                key={mode}
                className={`option ${
                  gameMode === mode ? 'active' : ''
                }`}
                onClick={() => setGameMode(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div className="setting">
          <h3>تعداد سؤال</h3>

          <div className="options">
            {[5, 10, 15, 20].map((count) => (
              <button
                key={count}
                className={`option ${
                  questionCount === count ? 'active' : ''
                }`}
                onClick={() => setQuestionCount(count)}
              >
                {toPersianDigits(count)}
              </button>
            ))}

            <button
              className={`option ${
                questionCount === null ? 'active' : ''
              }`}
              onClick={() => setQuestionCount(null)}
            >
              ∞ بی‌نهایت
            </button>
          </div>
        </div>

        <div className="setting">
          <h3>سطح دشواری</h3>

          <div className="options">
            {(
              ['آسان', 'متوسط', 'سخت', 'تصادفی'] as DifficultyChoice[]
            ).map((level) => (
              <button
                key={level}
                className={`option ${
                  difficultyChoice === level ? 'active' : ''
                }`}
                onClick={() => setDifficultyChoice(level)}
              >
                {level}
              </button>
            ))}
          </div>

          <div className="level-info">
            {difficultyChoice === 'آسان' &&
              '۳ کارت عددی در هر سؤال'}
            {difficultyChoice === 'متوسط' &&
              '۴ کارت عددی در هر سؤال'}
            {difficultyChoice === 'سخت' &&
              '۶ کارت عددی در هر سؤال'}
            {difficultyChoice === 'تصادفی' &&
              'سطح هر سؤال به‌صورت مستقل و تصادفی تغییر می‌کند'}
          </div>
        </div>

        <button className="primary-button" onClick={startGame}>
          شروع بازی
        </button>

        <button
          className="text-button"
          onClick={() => setScreen('history')}
        >
          مشاهده تاریخچه بازی‌ها
        </button>

        <div className="footer">
          طراحی و توسعه برای تمرین مهارت عددنویسی
        </div>
      </div>
    );
  }

  /**
   * صفحه بازی
   */
  if (screen === 'game') {
    if (!currentQuestion) {
      return (
        <div className="container">
          <p>در حال آماده‌سازی سؤال...</p>
        </div>
      );
    }

    const selectedNumber = selectedDigits.join('');
    const isDanger = timeLeft <= 3;

    return (
      <>
        <div className="container game-screen">
          <div className="game-header">
            <button className="text-button" onClick={exitGame}>
              خروج از بازی
            </button>

            <div className={`timer ${isDanger ? 'danger' : ''}`}>
              ⏱ {toPersianDigits(timeLeft)} ثانیه
            </div>
          </div>

          {isCompetition && (
            <div className="level-info">
              زمان ذخیره‌شده: {toPersianDigits(bonusTime)} ثانیه
            </div>
          )}

          {!isInfinite && questionCount !== null && (
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${
                    ((currentIndex + 1) / questionCount) * 100
                  }%`,
                }}
              />
            </div>
          )}

          <div className="question-number">
            {isInfinite
              ? `سؤال ${toPersianDigits(currentIndex + 1)}`
              : `سؤال ${toPersianDigits(currentIndex + 1)} از ${toPersianDigits(
                  questionCount ?? 0
                )}`}
          </div>

          {difficultyChoice === 'تصادفی' && (
            <div className="level-info">
              سطح این سؤال: {currentQuestion.difficulty}
            </div>
          )}

          <h2 className="question">{currentQuestion.text}</h2>

          <p className="instruction">
            کارت‌ها را انتخاب کن و عدد موردنظر را بساز.
            <br />
            برای لغو انتخاب، دوباره روی کارت بزن.
          </p>

          <div className="number-cards">
            {currentQuestion.digits.map((digit, index) => {
              const isSelected = selectedDigits.includes(digit);

              return (
                <button
                  key={`${digit}-${index}`}
                  className={`digit-card ${
                    isSelected ? 'selected' : ''
                  }`}
                  onClick={() => toggleDigit(digit)}
                  disabled={
                    !isSelected &&
                    selectedDigits.length >= currentQuestion.digitCount
                  }
                >
                  {toPersianDigits(digit)}
                </button>
              );
            })}
          </div>

          <div className="answer-box">
            <div className="answer-label">پاسخ شما</div>

            <div className="answer-number">
              {selectedNumber
                ? toPersianDigits(selectedNumber)
                : '؟'}
            </div>

            <div className="answer-hint">
              {toPersianDigits(selectedDigits.length)} از{' '}
              {toPersianDigits(currentQuestion.digitCount)} رقم انتخاب شده
            </div>
          </div>

          <button
            className="primary-button"
            disabled={
              selectedDigits.length !== currentQuestion.digitCount
            }
            onClick={() => submitAnswer(false)}
          >
            ثبت پاسخ
          </button>

          <button
            className="text-button"
            onClick={() => setSelectedDigits([])}
          >
            پاک کردن انتخاب‌ها
          </button>
        </div>

        {/* پوشش قرمز تمام صفحه هنگام پاسخ اشتباه یا پایان زمان */}
        {wrongAnswerFeedback && (
          <div
            role="alert"
            aria-live="assertive"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              backgroundColor: '#dc2626',
              color: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center',
              padding: '24px',
              boxSizing: 'border-box',
              direction: 'rtl',
            }}
          >
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>
              {wrongAnswerFeedback.timeout ? '⏱️' : '❌'}
            </div>

            <h1 style={{ fontSize: '32px', marginBottom: '20px' }}>
              {wrongAnswerFeedback.timeout
                ? 'زمان به پایان رسید!'
                : 'پاسخ اشتباه است!'}
            </h1>

            <div
              style={{
                fontSize: '22px',
                marginBottom: '12px',
                fontWeight: 'bold',
              }}
            >
              {wrongAnswerFeedback.type === 'none'
                ? 'یک پاسخ صحیح نمونه:'
                : 'پاسخ صحیح:'}
            </div>

            <div
              style={{
                fontSize: '48px',
                fontWeight: 'bold',
                backgroundColor: '#ffffff',
                color: '#dc2626',
                borderRadius: '16px',
                padding: '16px 32px',
                marginBottom: '24px',
                direction: 'ltr',
              }}
            >
              {toPersianDigits(wrongAnswerFeedback.answer)}
            </div>

            <p style={{ fontSize: '18px' }}>
              {isInfinite
                ? 'بازی بی‌نهایت به پایان رسید.'
                : '۵ ثانیه فرصت داری پاسخ صحیح را یاد بگیری!'}
            </p>

            <div
              style={{
                fontSize: '14px',
                marginTop: '16px',
                opacity: 0.9,
              }}
            >
              {isInfinite
                ? 'در حال نمایش نتیجه...'
                : 'سؤال بعدی به‌زودی شروع می‌شود.'}
            </div>
          </div>
        )}
      </>
    );
  }

  /**
   * صفحه نتیجه
   */
  if (screen === 'result') {
    const finalCorrect = results.filter(
      (result) => result.correct
    ).length;

    const total = results.length;

    const finalPercentage =
      total > 0
        ? Math.round((finalCorrect / total) * 100)
        : 0;

    const modeLabel = gameMode === 'عادی' ? 'عادی' : 'مسابقه‌ای';

    const difficultyLabel = difficultyChoice;

    const questionCountLabel = isInfinite
      ? `${toPersianDigits(total)} سؤال (حالت بی‌نهایت)`
      : `${toPersianDigits(questionCount ?? total)} سؤال`;

    return (
      <div className="container result-screen">
        <div className="brand-icon">
          {gameBurned
            ? '🔥'
            : finalPercentage >= 80
              ? '🏆'
              : finalPercentage >= 50
                ? '⭐'
                : '💪'}
        </div>

        <h1>
          {gameBurned ? 'سوختی!' : 'پایان بازی!'}
        </h1>

        {gameBurned && (
          <p className="subtitle">
            پاسخ اشتباه بود یا زمان به پایان رسید.
            <br />
            بازی بی‌نهایت تمام شد!
          </p>
        )}

        {/* مشخصات دانش‌آموز و آزمون */}
        <div
          style={{
            width: '100%',
            boxSizing: 'border-box',
            backgroundColor: '#f3f4f6',
            borderRadius: '16px',
            padding: '16px',
            margin: '16px 0',
            textAlign: 'right',
            direction: 'rtl',
            color: '#1f2937',
          }}
        >
          <div style={{ marginBottom: '12px', fontSize: '18px' }}>
            <strong>نام دانش‌آموز:</strong> {studentName}
          </div>

          <div style={{ marginBottom: '12px', fontSize: '16px' }}>
            <strong>حالت آزمون:</strong> {modeLabel}
          </div>

          <div style={{ marginBottom: '12px', fontSize: '16px' }}>
            <strong>سطح دشواری:</strong> {difficultyLabel}
          </div>

          <div style={{ fontSize: '16px' }}>
            <strong>تعداد سؤال‌ها:</strong> {questionCountLabel}
          </div>
        </div>

        <div className="score-circle">
          <div className="result-percent">
            {toPersianDigits(finalPercentage)}٪
          </div>
          <div className="score-caption">درصد موفقیت</div>
        </div>

        <h2>
          {toPersianDigits(finalCorrect)} پاسخ صحیح از{' '}
          {toPersianDigits(total)} سؤال
        </h2>

        <div className="results-list">
          {results.map((result, index) => (
            <div
              key={index}
              className={`result-item ${
                result.correct ? 'correct' : 'incorrect'
              }`}
            >
              <span>
                سؤال {toPersianDigits(index + 1)}
              </span>

              <span>
                {result.correct
                  ? '✓ صحیح'
                  : result.timeout
                    ? '⏱ پایان زمان'
                    : '✗ نادرست'}
              </span>
            </div>
          ))}
        </div>

        <button className="primary-button" onClick={backHome}>
          بازگشت به صفحه اصلی
        </button>
      </div>
    );
  }

  /**
   * صفحه تاریخچه
   */
  if (screen === 'history') {
    return (
      <div className="container result-screen">
        <div className="brand-icon">📊</div>

        <h1>تاریخچه بازی‌ها</h1>

        {history.length === 0 ? (
          <p className="subtitle">
            هنوز بازی‌ای ثبت نشده است.
          </p>
        ) : (
          <div className="results-list">
            {history.map((item) => (
              <div className="history-item" key={item.id}>
                <div className="history-header">
                  <span>{item.date}</span>

                  <span className="history-level">
                    {item.difficulty}
                    {item.gameMode ? ` ـ ${item.gameMode}` : ''}
                  </span>
                </div>

                {item.studentName && (
                  <div className="history-details">
                    دانش‌آموز: {item.studentName}
                  </div>
                )}

                <div className="history-details">
                  {item.infinite
                    ? item.burned
                      ? 'بازی بی‌نهایت (سوختن)'
                      : 'بازی بی‌نهایت'
                    : `${toPersianDigits(item.totalQuestions)} سؤال`}
                </div>

                <div className="history-score">
                  {toPersianDigits(item.correct)} پاسخ صحیح از{' '}
                  {toPersianDigits(item.totalQuestions)}
                </div>

                <div className="history-percent">
                  {toPersianDigits(item.percentage)}٪
                </div>
              </div>
            ))}
          </div>
        )}

        <button className="primary-button" onClick={backHome}>
          بازگشت
        </button>

        {history.length > 0 && (
          <button className="text-button" onClick={clearHistory}>
            پاک کردن تاریخچه
          </button>
        )}

        <div className="footer">
          تاریخچه فقط در همین مرورگر و دستگاه ذخیره می‌شود.
        </div>
      </div>
    );
  }

  return null;
}

export default App;
