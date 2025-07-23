import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';

// Note: This version uses browser localStorage for persistence and React.lazy for performance.

/**
 * Helper function to shuffle an array using the Fisher-Yates algorithm.
 * @param {Array} array The array to shuffle.
 * @returns {Array} A new array with the elements shuffled.
 */
const shuffleArray = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// --- CONSTANTS ---
const SUBJECT_ORDER = ['History', 'Geography', 'Polity', 'Economics', 'Science', 'English'];

const HISTORY_TOPIC_ORDER = [
    'Ancient History', 'Miscellaneous (Pre-Delhi Sultanate)', 'Medieval History', 'Miscellaneous',
    'Modern India', 'British Acts and Policies', 'Expansion of British Rule', 'Governors and Viceroys',
    'Socio Religious Reforms', 'Indian National Congress and Its Sessions', 'Partition of Bengal and Swadeshi Movements',
    'Muslim League', 'Gandhian Era', 'The Revolutionaries', 'Struggle for Independence'
];

const GEOGRAPHY_TOPIC_ORDER = [
    'The Universe and The Solar System', 'Longitudes and Latitudes', 'Continents and Oceans', 'Mountains',
    'Volcano', 'Rocks', 'Soil', 'Climate', 'Atmosphere', 'World Drainage System', 'Vegetation',
    'Biosphere Reserves', 'Population', 'World Geography and Map', 'Neighbouring Countries of India',
    'Physiographic Division of India', 'Indian Drainage System', 'Minerals and Energy Resources in India',
    'Agriculture', 'Industries', 'Transportation', 'Miscellaneous'
];

const POLITY_TOPIC_ORDER = [
    'Sources of Indian Constitution', 'Constitution', 'Article, Schedule, Parts and List', 'Amendments',
    'Fundamental Rights and Duties', 'Executive', 'President, Vice President and Prime Minister',
    'Parliament', 'Judiciary', 'Government Bodies', 'Committee Reports', 'Polity of neighbouring countries',
    'Miscellaneous'
];

const ECONOMICS_TOPIC_ORDER = [
    'Basics of Economy', 'Concepts of Demand and Supply', 'Cost, Production, Consumption and Market',
    'Indian Economy: Central Problems and Planning', 'National Income, Inflation, Budget, Taxation and GDP',
    'Fiscal Policy and Monetary Policy', 'Money Banking and Financial Institutions', 'Banking and Finance',
    'Stock, Debentures and Foreign Trade', 'Five-Year Plans', 'Government Schemes',
    'Navratna / Maharatna / PSUs', 'International Organizations', 'Miscellaneous'
];

const SCIENCE_TOPIC_ORDER = ['Physics', 'Chemistry', 'Biology'];
const ENGLISH_TOPIC_ORDER = ['Synonyms', 'Antonyms', 'One Word Substitution', 'Idioms'];

const MIXED_QUIZ_QUESTION_COUNT = 25;
const PASS_SCORE_MIXED_QUIZ = 18;
const MAX_LEVELS = 50;
const AUTO_ADVANCE_DELAY = 3000;
const BOOKMARKS_STORAGE_KEY = 'quizAppBookmarks';


// --- UI COMPONENTS (Moved outside of App for performance and memoization) ---

const LoadingSpinner = () => (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
);

const ErrorDisplay = ({ message, onRetry }) => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-red-50 p-4 text-center">
        <div className="bg-white p-10 rounded-xl shadow-2xl">
            <h2 className="text-3xl font-bold text-red-600 mb-4">Oops! Something went wrong.</h2>
            <p className="text-lg text-gray-700 mb-6">{message}</p>
            <button onClick={onRetry} className="bg-red-500 text-white font-bold py-3 px-8 rounded-full hover:bg-red-600 transition-colors">
                Try Again
            </button>
        </div>
    </div>
);


const QuizModeSelection = React.memo(({ isLoading, setQuizMode, prepareQuizQuestions, setShowBookmarks, bookmarkedQuestions }) => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="w-full max-w-4xl text-center">
        <h1 className="text-5xl md:text-6xl font-extrabold text-gray-800 mb-4">Welcome, SSC Crackers!</h1>
        <p className="text-xl md:text-2xl text-gray-600 mb-12">Ready to test your knowledge? Choose your adventure.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {/* Card 1: Mixed Quiz */}
          <button 
            onClick={() => { setQuizMode('mixed'); prepareQuizQuestions('mixed'); }} 
            disabled={isLoading} 
            className="group bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 disabled:opacity-50 flex flex-col items-center border hover:border-blue-500"
          >
            <div className="mb-4 text-gray-400 group-hover:text-blue-500 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                    <line x1="12" y1="22.08" x2="12" y2="12"></line>
                </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Mixed Quiz</h3>
            <p className="text-gray-600">25 Random Questions</p>
          </button>
          
          {/* Card 2: Practice by Topic */}
          <button 
            onClick={() => setQuizMode('topic')} 
            disabled={isLoading} 
            className="group bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 disabled:opacity-50 flex flex-col items-center border hover:border-green-500"
          >
            <div className="mb-4 text-gray-400 group-hover:text-green-500 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Practice by Topic</h3>
            <p className="text-gray-600">Choose Your Focus</p>
          </button>

          {/* Card 3: My Bookmarks */}
          <button 
            onClick={() => setShowBookmarks(true)} 
            disabled={isLoading || bookmarkedQuestions.length === 0} 
            className="group bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 disabled:opacity-50 flex flex-col items-center border hover:border-amber-500"
          >
            <div className="mb-4 text-gray-400 group-hover:text-amber-500 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">My Bookmarks</h3>
            <p className="text-gray-600">{bookmarkedQuestions.length} Saved</p>
          </button>
        </div>
      </div>
    </div>
));

const SubjectTopicSelection = React.memo(({ availableSubjects, availableTopics, selectedSubject, setSelectedSubject, topicQuestionCount, setTopicQuestionCount, prepareQuizQuestions, resetQuiz }) => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="w-full max-w-4xl bg-white p-8 rounded-xl shadow-2xl text-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-6">Choose Your Focus</h2>
        {!selectedSubject ? (
          <>
            <h3 className="text-xl font-semibold text-gray-700 mb-4">📚 1. Select a Subject:</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {availableSubjects.map((subject, index) => {
                const buttonColors = ['bg-sky-500 hover:bg-sky-600', 'bg-emerald-500 hover:bg-emerald-600', 'bg-amber-500 hover:bg-amber-600', 'bg-rose-500 hover:bg-rose-600', 'bg-violet-500 hover:bg-violet-600', 'bg-cyan-500 hover:bg-cyan-600'];
                const colorClass = buttonColors[index % buttonColors.length];
                const baseClasses = "text-white font-bold py-3 px-4 rounded-lg shadow-md transition-all duration-200 transform hover:shadow-lg hover:-translate-y-0.5 active:scale-95";
                return <button key={subject} onClick={() => setSelectedSubject(subject)} className={`${baseClasses} ${colorClass}`}>{subject}</button>;
              })}
            </div>
          </>
        ) : (
          <>
            <div className="mb-8">
                <h3 className="text-xl font-semibold text-gray-700 mb-4">🔢 Select Number of Questions:</h3>
                <div className="flex justify-center gap-2 flex-wrap">
                    {[5, 10, 15, 20, 'all'].map(num => (
                        <button key={num} onClick={() => setTopicQuestionCount(num)} className={`py-2 px-5 rounded-full font-semibold transition-colors ${topicQuestionCount === num ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>{num === 'all' ? 'All' : num}</button>
                    ))}
                </div>
            </div>
            <div>
                <h3 className="text-xl font-semibold text-gray-700 mb-4">🎯 Select a Topic in <span className="text-blue-600">{selectedSubject}</span>:</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {availableTopics[selectedSubject]?.map((topic, index) => {
                    const buttonColors = ['bg-emerald-500 hover:bg-emerald-600', 'bg-sky-500 hover:bg-sky-600', 'bg-violet-500 hover:bg-violet-600', 'bg-rose-500 hover:bg-rose-600', 'bg-amber-500 hover:bg-amber-600'];
                    const colorClass = buttonColors[index % buttonColors.length];
                    const baseClasses = "text-white font-bold text-base py-3 px-4 rounded-lg shadow-md transition-all duration-200 transform hover:shadow-lg hover:-translate-y-0.5 active:scale-95";
                    return <button key={topic} onClick={() => prepareQuizQuestions('topic', selectedSubject, topic)} className={`${baseClasses} ${colorClass}`}>{topic}</button>;
                  })}
                </div>
            </div>
            <button onClick={() => setSelectedSubject(null)} className="mt-8 bg-gray-300 text-gray-800 font-semibold py-2 px-6 rounded-full hover:bg-gray-400 transition-colors">Back to Subjects</button>
          </>
        )}
        <button onClick={resetQuiz} className="mt-4 block mx-auto text-blue-600 hover:underline">Back to Home</button>
      </div>
    </div>
));

const QuestionDisplay = React.memo(({ quizMode, level, countdown, currentQuestion, filteredQuizData, currentQuestionIndex, userAnswer, showFeedback, handleAnswer, handleNextQuestion, resetQuiz, toggleBookmark, bookmarkedQuestions, handleSkipQuestion, showSkipConfirmation, confirmSkip, cancelSkip }) => {
    if (!currentQuestion) return null;
    
    const isBookmarked = bookmarkedQuestions.some(bq => bq.question === currentQuestion.question);
    const isCorrect = userAnswer === currentQuestion.correct_answer;
    const getTimerColorClass = (time) => time > 15 ? 'bg-green-500' : time > 5 ? 'bg-yellow-500' : 'bg-red-500';
    const progressPercentage = ((currentQuestionIndex + 1) / filteredQuizData.length) * 100;

    return (
      <div className="flex flex-col items-center justify-start min-h-screen bg-gray-100 p-4 sm:p-6">
        <div className="relative bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-4xl">
          <div className="flex items-center justify-between mb-4 pb-4 border-b">
            <button onClick={resetQuiz} className="bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-full hover:bg-gray-300 transition" aria-label="Return to home">🏠 Home</button>
            {quizMode === 'mixed' && <span className="bg-blue-500 text-white text-md font-bold px-4 py-2 rounded-full">🎯 Level {level}</span>}
            <div className={`flex items-center justify-center gap-2 px-4 py-2 rounded-full text-white font-bold text-lg ${getTimerColorClass(countdown)} transition-colors`}>⏱️ {countdown}s</div>
            <button onClick={() => toggleBookmark(currentQuestion)} className={`p-2 rounded-full transition-colors ${isBookmarked ? 'bg-yellow-400 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`} aria-label="Bookmark question">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill={isBookmarked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
            </button>
          </div>
          <div className="mb-6">
            <div className="w-full bg-gray-200 rounded-full h-2.5"><div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${progressPercentage}%` }}></div></div>
            <p className="text-right text-sm text-gray-600 mt-1">{currentQuestionIndex + 1} / {filteredQuizData.length}</p>
          </div>
          
          <div>
            <h2 className="text-2xl sm:text-3xl font-semibold text-gray-800 mb-6 min-h-[100px] animate-fade-in-up" style={{ animationDelay: '100ms' }}>{currentQuestion.question}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {currentQuestion.options.map((option, index) => (
                <button key={index} onClick={() => !showFeedback && handleAnswer(option)} disabled={showFeedback} 
                  className={`flex items-center py-3 px-5 rounded-lg text-left text-lg font-medium transition-all duration-200 disabled:cursor-not-allowed animate-fade-in-up ${showFeedback ? (option === currentQuestion.correct_answer ? 'bg-green-100 text-green-800 border-2 border-green-500' : (option === userAnswer ? 'bg-red-100 text-red-800 border-2 border-red-500' : 'bg-gray-100')) : 'bg-gray-100 text-gray-800 hover:bg-blue-100'}`}
                  style={{ animationDelay: `${200 + index * 100}ms` }}
                >
                  <span className="font-bold mr-3">{['A', 'B', 'C', 'D'][index]})</span> {option}
                </button>
              ))}
            </div>
          </div>

          {showFeedback && (
            <div className="mt-6 p-5 rounded-lg bg-gray-50 border animate-fade-in">
              <p className={`text-2xl font-semibold mb-2 ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>{isCorrect ? 'Correct! 🎉' : "That's incorrect.  "}</p>
              <p className="text-lg text-gray-800 mb-2">Correct Answer: <span className="font-bold text-green-700">{currentQuestion.correct_answer}</span></p>
              <p className="text-md text-gray-700"><span className="font-semibold">Explanation:</span> {currentQuestion.explanation}</p>
              <button onClick={handleNextQuestion} className="mt-4 bg-blue-500 text-white font-bold py-2 px-8 rounded-full hover:bg-blue-600">Next</button>
            </div>
          )}
          {!showFeedback && <button onClick={handleSkipQuestion} className="absolute bottom-5 right-5 bg-yellow-400 text-gray-800 font-semibold py-2 px-4 rounded-full shadow-lg hover:bg-yellow-500">Skip</button>}
          {showSkipConfirmation && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50"><div className="bg-white p-8 rounded-lg shadow-2xl text-center"><h3 className="text-xl font-bold mb-4">Skip Question?</h3><p className="mb-6">Are you sure?</p><div className="flex justify-center gap-4"><button onClick={confirmSkip} className="bg-red-500 text-white font-bold py-2 px-6 rounded-full">Yes, Skip</button><button onClick={cancelSkip} className="bg-gray-300 text-gray-800 font-bold py-2 px-6 rounded-full">Cancel</button></div></div></div>
          )}
        </div>
      </div>
    );
});

const ResultsScreen = React.memo(({ quizMode, score, filteredQuizData, level, resetQuiz, bookmarkedQuestions, setShowBookmarks, handleLevelProgression, prepareQuizQuestions, selectedSubject, selectedTopic }) => {
    const passedMixedQuiz = quizMode === 'mixed' && score >= PASS_SCORE_MIXED_QUIZ;
    useEffect(() => {
      if ((quizMode === 'topic' || (quizMode === 'mixed' && passedMixedQuiz)) && typeof window.confetti === 'function') {
        window.confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      }
    }, [passedMixedQuiz, quizMode]);
    
    const getMotivatingMessage = () => {
      if (quizMode === 'mixed') {
        return passedMixedQuiz ? "Fantastic job! You're a true quiz champion!" : "Every expert was once a beginner! Keep practicing.";
      }
      const percentage = (score / filteredQuizData.length) * 100;
      if (percentage === 100) return "Perfect score! You've mastered this topic!";
      if (percentage >= 70) return "Great effort! You're well on your way to mastery.";
      return "Learning is a journey. A little more practice and you'll shine!";
    };

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
        <div className="bg-white p-10 rounded-xl shadow-2xl text-center w-full max-w-4xl">
          <h2 className="text-4xl font-extrabold text-gray-800 mb-4">Quiz Completed!</h2>
          <p className="text-5xl font-bold text-blue-600 mb-6">{score} / {filteredQuizData.length}</p>
          <p className="text-xl text-gray-600 mb-8">{getMotivatingMessage()}</p>
          <div className="flex flex-wrap justify-center gap-4 mb-10">
            {quizMode === 'mixed' && passedMixedQuiz && level < MAX_LEVELS && (
              <button onClick={handleLevelProgression} className="bg-green-500 text-white font-bold py-3 px-6 rounded-full hover:bg-green-600 transition">
                Proceed to Level {level + 1}
              </button>
            )}
            {quizMode === 'mixed' && !passedMixedQuiz && (
              <button onClick={() => prepareQuizQuestions('mixed')} className="bg-yellow-500 text-white font-bold py-3 px-6 rounded-full hover:bg-yellow-600 transition">
                Retry Level {level}
              </button>
            )}
            {quizMode === 'topic' && (
              <button onClick={() => prepareQuizQuestions('topic', selectedSubject, selectedTopic)} className="bg-blue-500 text-white font-bold py-3 px-6 rounded-full hover:bg-blue-600 transition">
                Try More
              </button>
            )}
            <button onClick={resetQuiz} className="bg-blue-500 text-white font-bold py-3 px-6 rounded-full hover:bg-blue-600 transition">New Quiz</button>
            {bookmarkedQuestions.length > 0 && (
              <button onClick={() => setShowBookmarks(true)} className="bg-gray-700 text-white font-bold py-3 px-6 rounded-full hover:bg-gray-800 transition">
                Review Bookmarks ({bookmarkedQuestions.length})
              </button>
            )}
          </div>

          <div className="text-left mt-10 border-t pt-6">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">Review Your Answers</h3>
            <div className="space-y-6">
              {filteredQuizData.map((question, index) => (
                <div key={index} className="p-4 border rounded-lg">
                  <p className="font-semibold text-gray-800 mb-2">{index + 1}. {question.question}</p>
                  <div className="space-y-1">
                    {question.options.map((option, optIndex) => (
                      <p 
                        key={optIndex} 
                        className={`p-2 rounded ${option === question.correct_answer ? 'bg-green-100 text-green-800 font-bold' : 'text-gray-700'}`}
                      >
                        {option}
                      </p>
                    ))}
                  </div>
                  <p className="mt-2 text-sm text-gray-600"><span className="font-semibold">Explanation:</span> {question.explanation}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
});

const BookmarksViewer = React.memo(({ bookmarkedQuestions, setShowBookmarks, toggleBookmark }) => (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl h-full max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-2xl font-bold text-gray-800">My Bookmarks</h3>
          <button onClick={() => setShowBookmarks(false)} className="text-gray-500 hover:text-gray-800 text-3xl">&times;</button>
        </div>
        <div className="p-6 overflow-y-auto">
          {bookmarkedQuestions.length > 0 ? bookmarkedQuestions.map((item, index) => (
            <div key={index} className="mb-6 pb-6 border-b last:border-b-0">
              <div className="flex justify-between items-start">
                  <p className="text-lg font-semibold text-gray-800 mb-2 flex-1">{index + 1}. {item.question}</p>
                  <button onClick={() => toggleBookmark(item)} className="ml-4 p-2 text-red-500 hover:text-red-700" aria-label="Remove bookmark">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
              </div>
              <p className="text-md text-green-600 font-bold mb-2">Correct Answer: {item.correct_answer}</p>
              <p className="text-md text-gray-700"><span className="font-semibold">Explanation:</span> {item.explanation}</p>
            </div>
          )) : <p className="text-center text-gray-600 py-8">You haven't bookmarked any questions yet.</p>}
        </div>
      </div>
    </div>
));

// --- LAZY COMPONENTS ---
const LazyQuestionDisplay = lazy(() => Promise.resolve({ default: QuestionDisplay }));
const LazyResultsScreen = lazy(() => Promise.resolve({ default: ResultsScreen }));
const LazyBookmarksViewer = lazy(() => Promise.resolve({ default: BookmarksViewer }));


// Main App Component
const App = () => {
  const [quizData, setQuizData] = useState([]);
  const [filteredQuizData, setFilteredQuizData] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [quizMode, setQuizMode] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [userAnswer, setUserAnswer] = useState(null);
  const [questionHistory, setQuestionHistory] = useState(new Set());
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [availableTopics, setAvailableTopics] = useState({});
  const [level, setLevel] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [countdown, setCountdown] = useState(30);
  const [showSkipConfirmation, setShowSkipConfirmation] = useState(false);
  const [topicQuestionCount, setTopicQuestionCount] = useState(10);
  const [bookmarkedQuestions, setBookmarkedQuestions] = useState([]);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const timerRef = useRef(null);
  const feedbackTimerRef = useRef(null);
  
  useEffect(() => {
    try {
      const savedBookmarks = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
      if (savedBookmarks) {
        setBookmarkedQuestions(JSON.parse(savedBookmarks));
      }
    } catch (error) {
      console.error("Error loading bookmarks from local storage:", error);
      setBookmarkedQuestions([]);
    }
  }, []);

  const parseCSVRow = (row) => {
    const result = [];
    let inQuote = false;
    let currentField = '';
    for (let i = 0; i < row.length; i++) {
        const char = row[i];
        const nextChar = row[i + 1];
        if (char === '"') {
            if (inQuote && nextChar === '"') { currentField += '"'; i++; }
            else { inQuote = !inQuote; }
        } else if (char === ',' && !inQuote) {
            result.push(currentField.trim());
            currentField = '';
        } else {
            currentField += char;
        }
    }
    result.push(currentField.trim());
    if (result.length < 9) return null;
    const [question, o1, o2, o3, o4, correctAnswer, explanation, topic, subject] = result;
    const options = [o1, o2, o3, o4].filter(opt => opt);
    if (!question || options.length !== 4 || !correctAnswer || !subject || !topic) return null;
    return { question, options: shuffleArray(options), correct_answer: correctAnswer, explanation, subject, topic };
  };

  const fetchQuizData = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const response = await fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vQWdBcdp3GM1m97dy0yt3zRFEU_Hw-bjdlp8Mc1ZX2B43j0liArk1gveWZUn0TOK59Ffh4OyXoY5NCY/pub?output=csv');
      if (!response.ok) {
          throw new Error(`Network response was not ok: ${response.statusText}`);
      }
      const text = await response.text();
      const rows = text.split('\n').slice(1);
      const parsedData = rows.map(row => parseCSVRow(row)).filter(item => item !== null);
      setQuizData(parsedData);
      const subjects = new Set();
      const topicsBySubject = {};
      parsedData.forEach(q => {
        if (q.subject) {
          subjects.add(q.subject);
          if (!topicsBySubject[q.subject]) topicsBySubject[q.subject] = new Set();
          if (q.topic) topicsBySubject[q.subject].add(q.topic);
        }
      });

      const uniqueSubjects = Array.from(subjects);
      uniqueSubjects.sort((a, b) => {
        const indexA = SUBJECT_ORDER.indexOf(a);
        const indexB = SUBJECT_ORDER.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b);
      });
      setAvailableSubjects(uniqueSubjects);
      
      const sortedTopicsBySubject = {};
      for (const sub in topicsBySubject) {
        const topics = Array.from(topicsBySubject[sub]);
        let customTopicOrder = null;
        if (sub === 'History') customTopicOrder = HISTORY_TOPIC_ORDER;
        else if (sub === 'Geography') customTopicOrder = GEOGRAPHY_TOPIC_ORDER;
        else if (sub === 'Polity') customTopicOrder = POLITY_TOPIC_ORDER;
        else if (sub === 'Economics') customTopicOrder = ECONOMICS_TOPIC_ORDER;
        else if (sub === 'Science') customTopicOrder = SCIENCE_TOPIC_ORDER;
        else if (sub === 'English') customTopicOrder = ENGLISH_TOPIC_ORDER;
        if (customTopicOrder) {
          topics.sort((a, b) => {
            const indexA = customTopicOrder.indexOf(a);
            const indexB = customTopicOrder.indexOf(b);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return a.localeCompare(b);
          });
          sortedTopicsBySubject[sub] = topics;
        } else {
          sortedTopicsBySubject[sub] = topics.sort();
        }
      }
      setAvailableTopics(sortedTopicsBySubject);
    } catch (error) {
      console.error("Error fetching quiz data:", error);
      setFetchError("Could not load quiz data. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuizData();
  }, [fetchQuizData]);

  const toggleBookmark = (questionObject) => {
    const isAlreadyBookmarked = bookmarkedQuestions.some(bq => bq.question === questionObject.question);
    let newBookmarks = isAlreadyBookmarked
      ? bookmarkedQuestions.filter(bq => bq.question !== questionObject.question)
      : [...bookmarkedQuestions, questionObject];
    setBookmarkedQuestions(newBookmarks);
    localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(newBookmarks));
  };

  const prepareQuizQuestions = useCallback((mode, subject = null, topic = null) => {
    if (quizData.length === 0) return;
    let questionsPool = [];
    let count = 0;
    if (mode === 'mixed') {
      questionsPool = quizData.filter(q => q.subject !== 'English');
      count = MIXED_QUIZ_QUESTION_COUNT;
    } else if (mode === 'topic' && subject && topic) {
      setSelectedTopic(topic);
      questionsPool = quizData.filter(q => q.subject === subject && q.topic === topic);
      count = topicQuestionCount === 'all' ? questionsPool.length : topicQuestionCount;
    }
    let availableQuestions = questionsPool.filter(q => !questionHistory.has(q.question));
    if (availableQuestions.length < count && questionHistory.size > 0) {
      setQuestionHistory(new Set());
      availableQuestions = questionsPool;
    }
    const questionsToUse = shuffleArray(availableQuestions).slice(0, count);
    const newHistory = new Set(questionHistory);
    questionsToUse.forEach(q => newHistory.add(q.question));
    setQuestionHistory(newHistory);
    setFilteredQuizData(questionsToUse);
    setCurrentQuestionIndex(0);
    setScore(0);
    setQuizCompleted(false);
    setShowFeedback(false);
    setUserAnswer(null);
    setQuizStarted(true);
    setCountdown(30);
    if (questionsToUse.length === 0) {
      setQuizStarted(false);
      setQuizMode(null);
    }
  }, [quizData, questionHistory, topicQuestionCount]);

  const handleNextQuestion = useCallback(() => {
    clearTimeout(feedbackTimerRef.current);
    setShowFeedback(false);
    setUserAnswer(null);
    setCountdown(30);
    if (currentQuestionIndex < filteredQuizData.length - 1) {
      setCurrentQuestionIndex(prevIndex => prevIndex + 1);
    } else {
      setQuizCompleted(true);
      clearInterval(timerRef.current);
    }
  }, [currentQuestionIndex, filteredQuizData.length]);

  const handleAnswer = useCallback((selectedOption) => {
    clearInterval(timerRef.current);
    setUserAnswer(selectedOption);
    setShowFeedback(true);
    if (selectedOption === filteredQuizData[currentQuestionIndex]?.correct_answer) {
      setScore(prevScore => prevScore + 1);
    }
    feedbackTimerRef.current = setTimeout(handleNextQuestion, AUTO_ADVANCE_DELAY);
  }, [filteredQuizData, currentQuestionIndex, handleNextQuestion]);

  const handleAnswerRef = useRef(handleAnswer);
  useEffect(() => { handleAnswerRef.current = handleAnswer; }, [handleAnswer]);

  useEffect(() => {
    if (quizStarted && !quizCompleted && !showFeedback && filteredQuizData.length > 0) {
      timerRef.current = setInterval(() => {
        setCountdown(prevCount => {
          if (prevCount <= 1) {
            clearInterval(timerRef.current);
            handleAnswerRef.current(null);
            return 0;
          }
          return prevCount - 1;
        });
      }, 1000);
    }
    return () => { clearInterval(timerRef.current); clearTimeout(feedbackTimerRef.current); };
  }, [quizStarted, quizCompleted, showFeedback, filteredQuizData.length]);

  const handleSkipQuestion = () => setShowSkipConfirmation(true);
  const confirmSkip = () => { setShowSkipConfirmation(false); handleNextQuestion(); };
  const cancelSkip = () => setShowSkipConfirmation(false);

  const resetQuiz = () => {
    setQuizMode(null);
    setSelectedSubject(null);
    setSelectedTopic(null);
    setQuizStarted(false);
    setQuizCompleted(false);
    setScore(0);
    setCurrentQuestionIndex(0);
    setQuestionHistory(new Set());
    setLevel(1);
    clearInterval(timerRef.current);
    clearTimeout(feedbackTimerRef.current);
    setCountdown(30);
    setShowSkipConfirmation(false);
  };

  const handleLevelProgression = () => {
    if (score >= PASS_SCORE_MIXED_QUIZ) {
      if (typeof window.confetti === 'function') window.confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
      if (level < MAX_LEVELS) {
        setLevel(prevLevel => prevLevel + 1);
        prepareQuizQuestions('mixed');
      } else {
        setQuizCompleted(true);
      }
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return <LoadingSpinner />;
    }
    if (fetchError) {
        return <ErrorDisplay message={fetchError} onRetry={fetchQuizData} />;
    }
    if (quizCompleted) {
        return <Suspense fallback={<LoadingSpinner />}><LazyResultsScreen 
            quizMode={quizMode}
            score={score}
            filteredQuizData={filteredQuizData}
            level={level}
            resetQuiz={resetQuiz}
            bookmarkedQuestions={bookmarkedQuestions}
            setShowBookmarks={setShowBookmarks}
            handleLevelProgression={handleLevelProgression}
            prepareQuizQuestions={prepareQuizQuestions}
            selectedSubject={selectedSubject}
            selectedTopic={selectedTopic}
        /></Suspense>;
    }
    if (quizStarted) {
        return <Suspense fallback={<LoadingSpinner />}><LazyQuestionDisplay 
            key={currentQuestionIndex}
            quizMode={quizMode}
            level={level}
            countdown={countdown}
            currentQuestion={filteredQuizData[currentQuestionIndex]}
            filteredQuizData={filteredQuizData}
            currentQuestionIndex={currentQuestionIndex}
            userAnswer={userAnswer}
            showFeedback={showFeedback}
            handleAnswer={handleAnswer}
            handleNextQuestion={handleNextQuestion}
            resetQuiz={resetQuiz}
            toggleBookmark={toggleBookmark}
            bookmarkedQuestions={bookmarkedQuestions}
            handleSkipQuestion={handleSkipQuestion}
            showSkipConfirmation={showSkipConfirmation}
            confirmSkip={confirmSkip}
            cancelSkip={cancelSkip}
        /></Suspense>;
    }
    if (quizMode === 'topic') {
        return <SubjectTopicSelection 
            availableSubjects={availableSubjects}
            availableTopics={availableTopics}
            selectedSubject={selectedSubject}
            setSelectedSubject={setSelectedSubject}
            topicQuestionCount={topicQuestionCount}
            setTopicQuestionCount={setTopicQuestionCount}
            prepareQuizQuestions={prepareQuizQuestions}
            resetQuiz={resetQuiz}
        />;
    }
    return <QuizModeSelection 
        isLoading={isLoading}
        setQuizMode={setQuizMode}
        prepareQuizQuestions={prepareQuizQuestions}
        setShowBookmarks={setShowBookmarks}
        bookmarkedQuestions={bookmarkedQuestions}
    />;
  };

  return (
    <div className="font-sans antialiased text-gray-800">
      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.5s ease-out forwards;
          opacity: 0;
        }
        .bg-grid-pattern {
            background-image: linear-gradient(to right, rgba(255, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 1px, transparent 1px);
            background-size: 2rem 2rem;
        }
      `}</style>
      <Suspense fallback={<LoadingSpinner />}>
        {renderContent()}
        {showBookmarks && <LazyBookmarksViewer bookmarkedQuestions={bookmarkedQuestions} setShowBookmarks={setShowBookmarks} toggleBookmark={toggleBookmark} />}
      </Suspense>
    </div>
  );
};

export default App;
