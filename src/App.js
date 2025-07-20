import React, { useState, useEffect, useRef, useCallback } from 'react';
// Import confetti library
// Note: In a real-world project, you'd typically install this via npm/yarn and import.
// For this environment, we'll load it via CDN in the HTML section.

// Helper function to shuffle an array
const shuffleArray = (array) => {
  const newArray = [...array]; // Create a shallow copy to avoid mutating original
  // Corrected for loop syntax: condition should be a boolean expression
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]]; // Swap elements
  }
  return newArray;
};

// Main App Component
const App = () => {
  const [quizData, setQuizData] = useState([]); // Stores all questions from CSV
  const [filteredQuizData, setFilteredQuizData] = useState([]); // Questions for current quiz mode
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [quizMode, setQuizMode] = useState(null); // 'mixed' or 'topic'
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [userAnswer, setUserAnswer] = useState(null);
  const [questionHistory, setQuestionHistory] = useState(new Set()); // Tracks questions asked in current session
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [availableTopics, setAvailableTopics] = useState({}); // {subject: [topic1, topic2]}
  const [level, setLevel] = useState(1); // For mixed quiz progression
  const [isLoading, setIsLoading] = useState(true); // New state to track loading
  const [countdown, setCountdown] = useState(30); // State for real-time countdown
  const [showSkipConfirmation, setShowSkipConfirmation] = useState(false); // New state for skip confirmation modal

  const timerRef = useRef(null);
  const feedbackTimerRef = useRef(null); // New ref for auto-advance timer

  // Constants for quiz limits
  const MIXED_QUIZ_QUESTION_COUNT = 25;
  const TOPIC_QUIZ_QUESTION_COUNT = 10;
  const PASS_SCORE_MIXED_QUIZ = 18;
  const MAX_LEVELS = 50; // Soft limit for levels
  const AUTO_ADVANCE_DELAY = 3000; // 3 seconds delay for auto-advance after feedback

  // Custom CSV parsing function to handle quoted fields correctly
  const parseCSVRow = (row) => {
      const result = [];
      let inQuote = false;
      let currentField = '';

      for (let i = 0; i < row.length; i++) {
          const char = row[i];
          const nextChar = row[i + 1];

          if (char === '"') {
              if (inQuote && nextChar === '"') { // Handle escaped double quote ""
                  currentField += '"';
                  i++; // Skip the next quote
              } else {
                  inQuote = !inQuote;
              }
          } else if (char === ',' && !inQuote) {
              result.push(currentField.trim());
              currentField = '';
          } else {
              currentField += char;
          }
      }
      result.push(currentField.trim()); // Push the last field

      // Map the parsed fields to the correct structure based on CSV column order
      // Question, Option1, Option2, Option3, Option4, CorrectAnswer, Explanation, Topic, Subject
      if (result.length < 9) { // Ensure all 9 expected columns are present
          console.warn("Skipping malformed row (not enough columns):", row);
          return null;
      }

      const [
          question,
          option1,
          option2,
          option3,
          option4,
          correctAnswer,
          explanation,
          topic,
          subject
      ] = result;

      const options = [option1, option2, option3, option4].filter(opt => opt);

      // Basic validation for parsed data
      if (!question || options.length !== 4 || !correctAnswer || !subject || !topic) {
          console.warn("Skipping incomplete or invalid question data:", { question, options, correctAnswer, explanation, topic, subject });
          return null;
      }

      // Shuffle options here before returning
      const shuffledOptions = shuffleArray(options);

      return {
          question,
          options: shuffledOptions, // Options are now shuffled
          correct_answer: correctAnswer,
          explanation,
          subject,
          topic
      };
  };

  // Fetch and parse CSV data
  useEffect(() => {
    const fetchQuizData = async () => {
      try {
        const response = await fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vQWdBcdp3GM1m97dy0yt3zRFEU_Hw-bjdlp8Mc1ZX2B43j0liArk1gveWZUn0TOK59Ffh4OyXoY5NCY/pub?output=csv');
        const text = await response.text();
        const rows = text.split('\n').slice(1); // Skip header row

        const parsedData = rows.map(row => parseCSVRow(row)).filter(item => item !== null); // Use the new parsing function

        setQuizData(parsedData);

        // Extract subjects and topics for selection
        const subjects = new Set();
        const topicsBySubject = {};
        parsedData.forEach(q => {
          if (q.subject) {
            subjects.add(q.subject);
            // Ensure topicsBySubject[q.subject] is a Set before adding a topic
            topicsBySubject[q.subject] = topicsBySubject[q.subject] || new Set(); // Fix applied here
            if (q.topic) {
              topicsBySubject[q.subject].add(q.topic);
            }
          }
        });
        setAvailableSubjects(Array.from(subjects).sort());
        const sortedTopicsBySubject = {};
        for (const sub in topicsBySubject) {
          sortedTopicsBySubject[sub] = Array.from(topicsBySubject[sub]).sort();
        }
        setAvailableTopics(sortedTopicsBySubject);

      } catch (error) {
        console.error("Error fetching or parsing quiz data:", error);
      } finally {
        setIsLoading(false); // Set loading to false after fetch attempt
      }
    };

    fetchQuizData();
  }, []);

  // Function to select and shuffle questions for a new quiz
  const prepareQuizQuestions = useCallback((mode, subject = null, topic = null) => {
    // Ensure quizData is loaded before attempting to prepare questions
    if (quizData.length === 0) {
        console.warn("Quiz data not loaded yet. Cannot prepare questions.");
        setFilteredQuizData([]); // Ensure no questions are displayed
        setQuizStarted(false); // Go back to selection if no data
        return;
    }

    let questionsPool = [];
    let count = 0;

    if (mode === 'mixed') {
      questionsPool = quizData;
      count = MIXED_QUIZ_QUESTION_COUNT;
    } else if (mode === 'topic' && subject && topic) {
      questionsPool = quizData.filter(q => q.subject === subject && q.topic === topic);
      count = TOPIC_QUIZ_QUESTION_COUNT;
    }

    // Filter out questions already asked in this session
    let availableQuestions = questionsPool.filter(q => !questionHistory.has(q.question));

    // If not enough unique questions are available for the current 'count',
    // and we have a history (meaning we've exhausted the pool), reset history.
    if (availableQuestions.length < count && questionHistory.size > 0) {
        console.warn(`[Analytics] Question history reset for ${mode} quiz. Previous unique pool exhausted.`);
        setQuestionHistory(new Set()); // Clear history
        availableQuestions = questionsPool; // All questions are now available again
    } else if (availableQuestions.length === 0 && questionsPool.length > 0) {
        console.warn(`[Analytics] No unique questions left for ${mode} quiz. Resetting history to reuse questions.`);
        setQuestionHistory(new Set());
        availableQuestions = questionsPool;
    }


    // Shuffle all available questions and pick the required count
    const questionsToUse = availableQuestions
        .sort(() => Math.random() - 0.5)
        .slice(0, count);

    // Add selected questions to history
    questionsToUse.forEach(q => questionHistory.add(q.question));
    setQuestionHistory(new Set(questionHistory)); // Update state to trigger re-render if needed

    setFilteredQuizData(questionsToUse);
    setCurrentQuestionIndex(0);
    setScore(0);
    setQuizCompleted(false);
    setShowFeedback(false);
    setUserAnswer(null);
    setQuizStarted(true);
    setCountdown(30); // Reset countdown for the first question

    // If no questions were found at all after all attempts
    if (questionsToUse.length === 0) {
        console.error("No questions could be prepared for the quiz. Check CSV data or filter criteria.");
        setQuizStarted(false); // Go back to selection if no questions
        setQuizMode(null); // Return to home screen
    }

  }, [quizData, questionHistory]);


  // Proceed to next question - Defined FIRST
  const handleNextQuestion = useCallback(() => {
    clearTimeout(feedbackTimerRef.current); // Clear any pending auto-advance timer
    setShowFeedback(false);
    setUserAnswer(null);
    setCountdown(30); // Reset countdown for next question

    if (currentQuestionIndex < filteredQuizData.length - 1) {
      setCurrentQuestionIndex(prevIndex => prevIndex + 1);
    } else {
      setQuizCompleted(true);
      clearInterval(timerRef.current);
    }
  }, [currentQuestionIndex, filteredQuizData.length]);

  // Handle user answering a question or time expiring - Defined SECOND (depends on handleNextQuestion)
  const handleAnswer = useCallback((selectedOption) => {
    clearInterval(timerRef.current); // Stop the main timer
    setUserAnswer(selectedOption);
    setShowFeedback(true);

    const currentQuestion = filteredQuizData[currentQuestionIndex];
    if (selectedOption === currentQuestion.correct_answer) {
      setScore(prevScore => prevScore + 1);
    }

    // Auto-advance after a delay (whether answered or time ran out)
    feedbackTimerRef.current = setTimeout(() => {
      handleNextQuestion();
    }, AUTO_ADVANCE_DELAY);
  }, [filteredQuizData, currentQuestionIndex, handleNextQuestion]); // handleNextQuestion is a dependency

  // Store handleAnswer in a ref to avoid dependency issues in useEffect
  const handleAnswerRef = useRef(handleAnswer);
  useEffect(() => {
      handleAnswerRef.current = handleAnswer; // Keep the ref updated with the latest handleAnswer
  }, [handleAnswer]); // Update ref when handleAnswer changes


  // Timer logic - Defined THIRD (depends on handleAnswerRef)
  useEffect(() => {
    if (quizStarted && !quizCompleted && filteredQuizData.length > 0 && !showFeedback) {
      timerRef.current = setInterval(() => {
        setCountdown(prevCount => {
          if (prevCount <= 0) {
            clearInterval(timerRef.current);
            handleAnswerRef.current(null); // Use the ref here
            return 0;
          }
          return prevCount - 1;
        });
      }, 1000);
    }

    // Cleanup function for timers
    return () => {
      clearInterval(timerRef.current);
      clearTimeout(feedbackTimerRef.current);
    };
  }, [quizStarted, quizCompleted, filteredQuizData, showFeedback]); // Removed handleAnswer from dependencies


  // Handle user initiating skip question
  const handleSkipQuestion = () => {
    setShowSkipConfirmation(true); // Show custom confirmation modal
  };

  // Confirm skip from modal
  const confirmSkip = () => {
    setShowSkipConfirmation(false);
    handleNextQuestion(); // Proceed to next question
  };

  // Cancel skip from modal
  const cancelSkip = () => {
    setShowSkipConfirmation(false);
  };

  // Reset quiz to home screen
  const resetQuiz = () => {
    setQuizMode(null);
    setSelectedSubject(null);
    setSelectedTopic(null);
    setQuizStarted(false);
    setQuizCompleted(false);
    setScore(0);
    setCurrentQuestionIndex(0);
    setQuestionHistory(new Set()); // Clear history for a truly new session
    setLevel(1);
    clearInterval(timerRef.current);
    clearTimeout(feedbackTimerRef.current); // Clear any pending auto-advance timer
    setCountdown(30); // Reset countdown
    setShowSkipConfirmation(false); // Hide modal if visible
  };

  // Handle mixed quiz level progression
  const handleLevelProgression = () => {
    if (score >= PASS_SCORE_MIXED_QUIZ) {
      if (level < MAX_LEVELS) {
        setLevel(prevLevel => prevLevel + 1);
        prepareQuizQuestions('mixed'); // Start new set of 25 questions
        // Trigger confetti on level clear
        if (typeof window.confetti === 'function') {
          window.confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
          });
        }
      } else {
        // Max levels reached, maybe a special message
        setQuizCompleted(true); // Still show completion, but with max level message
      }
    } else {
      // Failed to pass, give options
      // This state will be handled in the ResultsScreen component
    }
  };

  // Components for different views

  // Home Screen: Quiz Mode Selection
  const QuizModeSelection = () => {
    // Calculate total unique questions and subjects for motivational context
    // Removed unused variable: const uniqueSubjects = new Set(quizData.map(q => q.subject)).size;
    const totalQuestions = quizData.length; // Still need totalQuestions
    const subjectList = Array.from(new Set(quizData.map(q => q.subject))).join(', ');


    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-100 to-white p-4 relative overflow-hidden">
        {/* Animated Gradient Background */}
        <div className="absolute inset-0 animate-gradient-move bg-gradient-to-br from-blue-100 to-white"></div>

        <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-screen-lg px-4 py-8">
          <h1 className="text-6xl sm:text-7xl font-extrabold text-gray-900 mb-4 text-center drop-shadow-lg animate-fade-in-slide-up" style={{ animationDelay: '0.2s' }}>
            Welcome, SSC Crackers!
          </h1>
          <p className="text-xl sm:text-2xl text-gray-700 mb-2 text-center max-w-2xl animate-fade-in-slide-up" style={{ animationDelay: '0.4s' }}>
            Ready to test your knowledge? Choose your adventure!
          </p>
          <p className="text-lg text-gray-600 mb-8 text-center max-w-2xl animate-fade-in-slide-up" style={{ animationDelay: '0.6s' }}>
            Daily practice keeps your edge sharp.
          </p>
          {totalQuestions > 0 && (
            <p className="text-md text-gray-500 mb-12 text-center max-w-2xl animate-fade-in-slide-up" style={{ animationDelay: '0.7s' }}>
              Over {totalQuestions}+ questions from {subjectList}.
            </p>
          )}


          <div className="flex flex-col sm:flex-row gap-6 w-full justify-center mt-8 mb-8">
            <button
              onClick={() => {
                setQuizMode('mixed');
                prepareQuizQuestions('mixed');
              }}
              disabled={isLoading}
              className={`
                flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold py-3 px-8 rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 transition-transform duration-150 ease-in-out text-xl w-full sm:w-1/2 lg:w-1/3
                ${isLoading ? 'opacity-50 cursor-not-allowed' : 'animate-fade-in-slide-up'}
              `}
              style={{ animationDelay: '0.8s' }}
              aria-label="Start Mixed Quiz with 25 Questions"
            >
              <span className="text-2xl">🎮</span> Mixed Quiz (25 Questions)
              <span className="block text-sm font-normal opacity-80 mt-1">Random from all subjects</span>
            </button>
            <button
              onClick={() => setQuizMode('topic')}
              disabled={isLoading}
              className={`
                flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold py-3 px-8 rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 transition-transform duration-150 ease-in-out text-xl w-full sm:w-1/2 lg:w-1/3
                ${isLoading ? 'opacity-50 cursor-not-allowed' : 'animate-fade-in-slide-up'}
              `}
              style={{ animationDelay: '1s' }}
              aria-label="Practice Quiz by Subject or Topic"
            >
              <span className="text-2xl">📚</span> Practice by Subject/Topic
              <span className="block text-sm font-normal opacity-80 mt-1">Choose your focus area</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Subject/Topic Selection Screen
  const SubjectTopicSelection = () => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-purple-600 to-pink-500 p-4 relative overflow-hidden">
      {/* Animated Gradient Background */}
      <div className="absolute inset-0 animate-gradient-move bg-gradient-to-br from-purple-600 to-pink-500"></div>

      <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-screen-lg px-4 py-8">
        <h2 className="sm:text-4xl text-3xl font-extrabold text-white mb-8 text-center drop-shadow-lg">
          Choose Your Focus!
        </h2>
        {isLoading ? (
          <div className="text-white text-2xl">Loading subjects and topics...</div>
        ) : (
          <>
            {!selectedSubject ? (
              <div className="w-full max-w-5xl bg-white p-8 rounded-xl shadow-2xl mt-8 mb-8">
                <h3 className="text-2xl font-semibold text-gray-800 mb-6 text-center">Select a Subject:</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {availableSubjects.map(subject => (
                    <button
                      key={subject}
                      onClick={() => setSelectedSubject(subject)}
                      className="bg-blue-500 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:bg-blue-600 transform hover:scale-105 active:scale-95 transition-transform duration-150 ease-in-out text-lg"
                    >
                      {subject}
                    </button>
                  ))}
                </div>
                <button
                  onClick={resetQuiz}
                  className="mt-8 bg-gray-300 text-gray-800 font-semibold py-2 px-6 rounded-full hover:bg-gray-400 transform hover:scale-105 active:scale-95 transition-transform duration-150 ease-in-out text-lg"
                >
                  Back to Home
                </button>
              </div>
            ) : (
              <div className="w-full max-w-5xl bg-white p-8 rounded-xl shadow-2xl mt-8 mb-8">
                <h3 className="text-2xl font-semibold text-gray-800 mb-6 text-center">
                  Topics in <span className="text-purple-600">{selectedSubject}</span>:
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {availableTopics[selectedSubject]?.map(topic => (
                    <button
                      key={topic}
                      onClick={() => {
                        setSelectedTopic(topic);
                        prepareQuizQuestions('topic', selectedSubject, topic);
                      }}
                      className="bg-green-500 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:bg-green-600 transform hover:scale-105 active:scale-95 transition-transform duration-150 ease-in-out text-lg"
                    >
                      {topic}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between w-full mt-8">
                  <button
                    onClick={() => setSelectedSubject(null)}
                    className="bg-gray-300 text-gray-800 font-semibold py-2 px-6 rounded-full hover:bg-gray-400 transform hover:scale-105 active:scale-95 transition-transform duration-150 ease-in-out text-lg"
                  >
                    Back to Subjects
                  </button>
                  <button
                    onClick={resetQuiz}
                    className="bg-gray-300 text-gray-800 font-semibold py-2 px-6 rounded-full hover:bg-gray-400 transform hover:scale-105 active:scale-95 transition-transform duration-150 ease-in-out text-lg"
                  >
                    Back to Home
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  // Quiz Question Display
  const QuestionDisplay = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
          <p className="text-xl text-gray-700">Loading questions...</p>
        </div>
      );
    }

    if (!filteredQuizData.length) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
          <p className="text-xl text-gray-700">No questions available for this selection. Please try another quiz mode or topic.</p>
          <button
            onClick={resetQuiz}
            className="mt-8 bg-blue-500 text-white font-bold py-3 px-6 rounded-full shadow-lg hover:bg-blue-600 transition duration-300"
          >
            Start New Quiz
          </button>
        </div>
      );
    }

    const currentQuestion = filteredQuizData[currentQuestionIndex];
    const isCorrect = userAnswer === currentQuestion.correct_answer;

    // Determine timer color
    const getTimerColorClass = (time) => {
      if (time > 20) return 'bg-green-500';
      if (time > 10) return 'bg-orange-500';
      return 'bg-red-500';
    };

    const alphabetLabels = ['A', 'B', 'C', 'D'];
    const progressPercentage = ((currentQuestionIndex + 1) / filteredQuizData.length) * 100;

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-100 to-white p-4 relative overflow-hidden">
        {/* Animated Gradient Background */}
        <div className="absolute inset-0 animate-gradient-move bg-gradient-to-br from-blue-100 to-white"></div>

        <div className="relative z-10 bg-white p-8 rounded-xl shadow-2xl w-full max-w-5xl mt-8 mb-8"> {/* Increased max-w */}
          {/* Top Navigation Bar */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 shadow-sm">
            {/* Home Button (Pill-shaped) */}
            <button
              onClick={resetQuiz}
              className="bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-full shadow-md hover:bg-gray-400 transform hover:scale-105 active:scale-95 transition-transform duration-150 ease-in-out text-lg min-w-[80px] min-h-[44px]"
              aria-label="Return to home screen"
            >
              🏠 Home
            </button>

            {/* Level Display (Pill-shaped, Centered) */}
            {quizMode === 'mixed' && (
              <span className="bg-purple-500 text-white text-md font-bold px-4 py-2 rounded-full shadow-md">
                🎯 Level {level}
              </span>
            )}

            {/* Timer (Pill-shaped) */}
            <div className={`flex items-center justify-center gap-1 px-4 py-2 rounded-full shadow-md text-white font-bold text-lg ${getTimerColorClass(countdown)} transition-colors duration-300 ease-in-out min-w-[80px] min-h-[44px]`}>
              ⏱️ {countdown < 0 ? 0 : countdown}s
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2.5 mt-4 mb-4">
            <div
              className="bg-blue-500 h-2.5 rounded-full transition-all duration-300 ease-out animate-progress-pulse"
              style={{ width: `${progressPercentage}%` }}
              role="progressbar"
              aria-valuenow={Math.round(progressPercentage)}
              aria-valuemin="0"
              aria-valuemax="100"
            ></div>
            <p className="text-right text-sm text-gray-600 mt-1">
              {Math.round(progressPercentage)}% Completed ({currentQuestionIndex + 1}/{filteredQuizData.length})
            </p>
          </div>

          <h2 className="text-3xl sm:text-4xl font-semibold text-gray-900 mb-8 leading-relaxed max-w-prose mx-auto pt-4 max-h-[60vh] overflow-y-auto" style={{ lineHeight: '1.5' }}>
            {currentQuestion.question}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {currentQuestion.options.map((option, index) => (
              <button
                key={index}
                onClick={() => !showFeedback && handleAnswer(option)}
                className={`
                  flex items-center py-4 px-6 rounded-lg shadow-md text-left text-lg font-medium transition-transform duration-150 ease-in-out transform min-h-[44px]
                  ${showFeedback
                    ? (option === currentQuestion.correct_answer
                      ? 'bg-green-200 text-green-800 border-2 border-green-500'
                      : (option === userAnswer
                        ? 'bg-red-200 text-red-800 border-2 border-red-500'
                        : 'bg-gray-100 text-gray-700'))
                    : (userAnswer === option // Highlight selected option before full feedback
                        ? 'bg-blue-200 text-blue-800'
                        : 'bg-blue-100 text-blue-800 hover:bg-blue-200 hover:shadow-lg')
                  }
                  ${showFeedback && 'cursor-not-allowed'}
                  active:scale-98
                `}
                disabled={showFeedback}
              >
                <span className="font-bold mr-3 text-xl">{alphabetLabels[index]})</span> {option}
              </button>
            ))}
          </div>

          {showFeedback && (
            <div className="mt-8 p-6 rounded-lg shadow-inner bg-gray-50 border border-gray-200">
              <p className={`text-2xl font-semibold mb-3 ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                {isCorrect ? 'Correct! 🎉 Great job!' : 'Oops! That\'s incorrect. 😔 Almost there, keep going!'}
              </p>
              <p className="text-lg text-gray-800 mb-2">
                The correct answer was: <span className="font-semibold text-green-700">{currentQuestion.correct_answer}</span>
              </p>
              <p className="text-lg text-gray-700">
                <span className="font-semibold">Explanation:</span> {currentQuestion.explanation}
              </p>
              <button
                onClick={handleNextQuestion}
                className="mt-6 bg-purple-600 text-white font-bold py-3 px-8 rounded-full shadow-lg hover:bg-purple-700 transform hover:scale-105 active:scale-95 transition-transform duration-150 ease-in-out text-xl"
              >
                Next Question
              </button>
            </div>
          )}
          {/* Skip Button (Floating Action Button style) */}
          {!showFeedback && (
            <button
              onClick={handleSkipQuestion}
              className="absolute bottom-4 right-4 bg-yellow-400 text-gray-800 font-semibold py-3 px-6 rounded-full shadow-lg hover:bg-yellow-500 transform hover:scale-105 active:scale-95 transition-transform duration-150 ease-in-out text-lg"
              style={{ zIndex: 20 }} // Ensure it floats above other content
            >
              Skip Question
            </button>
          )}

          {/* Custom Skip Confirmation Modal */}
          {showSkipConfirmation && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white p-8 rounded-lg shadow-2xl text-center max-w-sm w-full">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">Skip Question?</h3>
                <p className="text-lg text-gray-700 mb-8">Are you sure you want to skip this question?</p>
                <div className="flex justify-center gap-4">
                  <button
                    onClick={confirmSkip}
                    className="bg-red-500 text-white font-bold py-3 px-6 rounded-full shadow-lg hover:bg-red-600 transform hover:scale-105 active:scale-95 transition-transform duration-150 ease-in-out text-lg"
                  >
                    Yes, Skip
                  </button>
                  <button
                    onClick={cancelSkip}
                    className="bg-gray-300 text-gray-800 font-bold py-3 px-6 rounded-full shadow-lg hover:bg-gray-400 transform hover:scale-105 active:scale-95 transition-transform duration-150 ease-in-out text-lg"
                  >
                    No, Don't Skip
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Quiz Results Screen
  const ResultsScreen = () => {
    const passedMixedQuiz = quizMode === 'mixed' && score >= PASS_SCORE_MIXED_QUIZ;

    // Confetti for topic quiz completion
    useEffect(() => {
      // This effect should run only when quizMode changes to 'topic' and confetti is available
      // It's already correctly set up to run once based on quizMode change
      if (quizMode === 'topic' && typeof window.confetti === 'function') {
        window.confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    }, []); //  // Run once on mount, or change based on actual trigger you intend


    const getMotivatingMessage = () => {
      if (quizMode === 'mixed') {
        if (passedMixedQuiz) {
          return "Fantastic job! You're a true quiz champion!";
        } else {
          return "Don't worry, every expert was once a beginner! Keep practicing, you've got this!";
        }
      } else { // Topic-wise quiz
        if (score === TOPIC_QUIZ_QUESTION_COUNT) {
          return "Absolutely brilliant! You've mastered this topic!";
        } else if (score >= TOPIC_QUIZ_QUESTION_COUNT / 2) {
          return "Great effort! You're well on your way to becoming a master of this topic!";
        } else {
          return "Learning is a journey, not a race! A little more practice and you'll shine!";
        }
      }
    };

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-indigo-500 to-purple-700 p-4 relative overflow-hidden">
        {/* Animated Gradient Background */}
        <div className="absolute inset-0 animate-gradient-move bg-gradient-to-br from-indigo-500 to-purple-700"></div>

        <div className="relative z-10 bg-white p-10 rounded-xl shadow-2xl text-center w-full max-w-5xl mt-8 mb-8"> {/* Increased max-w */}
          <h2 className="text-5xl font-extrabold text-gray-900 mb-6 drop-shadow-lg">
            Quiz Completed!
          </h2>
          <p className="text-4xl font-bold text-blue-600 mb-8">
            Your Score: {score} / {filteredQuizData.length}
          </p>

          {quizMode === 'mixed' && (
            <p className="text-2xl text-gray-700 mb-4">
              Level {level} Result: {passedMixedQuiz ? 'Passed!' : 'Did not pass.'}
            </p>
          )}

          <p className="text-2xl text-gray-800 mb-10 leading-relaxed">
            {getMotivatingMessage()}
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4">
            {quizMode === 'mixed' && !passedMixedQuiz && (
              <button
                onClick={() => {
                  prepareQuizQuestions('mixed'); // Retry current level
                }}
                className="bg-red-500 text-white font-bold py-3 px-6 rounded-full shadow-lg hover:bg-red-600 transform hover:scale-105 active:scale-95 transition-transform duration-150 ease-in-out text-xl"
              >
                Retry Level {level}
              </button>
            )}
            {quizMode === 'mixed' && passedMixedQuiz && level < MAX_LEVELS && (
              <button
                onClick={handleLevelProgression}
                className="bg-green-500 text-white font-bold py-3 px-6 rounded-full shadow-lg hover:bg-green-600 transform hover:scale-105 active:scale-95 transition-transform duration-150 ease-in-out text-xl"
              >
                Proceed to Level {level + 1}
              </button>
            )}
            {quizMode === 'topic' && (
              <button
                onClick={() => {
                  // Reset score and current index, then prepare new questions for the same topic
                  prepareQuizQuestions('topic', selectedSubject, selectedTopic);
                }}
                className="bg-purple-500 text-white font-bold py-3 px-6 rounded-full shadow-lg hover:bg-purple-600 transform hover:scale-105 active:scale-95 transition-transform duration-150 ease-in-out text-xl"
              >
                Try 10 More Questions
              </button>
            )}
            <button
              onClick={resetQuiz}
              className="bg-blue-500 text-white font-bold py-3 px-6 rounded-full shadow-lg hover:bg-blue-600 transform hover:scale-105 active:scale-95 transition-transform duration-150 ease-in-out text-xl"
            >
              Start New Quiz
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render logic based on quiz state
  let content;
  if (isLoading) {
    content = (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-400 to-purple-600 p-4">
        <h1 className="text-5xl font-extrabold text-white mb-10 text-center drop-shadow-lg animate-pulse">
          Loading Quiz Data...
        </h1>
        <p className="text-2xl text-white">Please wait a moment.</p>
      </div>
    );
  } else if (!quizStarted && !quizMode) {
    content = <QuizModeSelection />;
  } else if (!quizStarted && quizMode === 'topic' && (!selectedSubject || !selectedTopic)) {
    content = <SubjectTopicSelection />;
  } else if (quizStarted && !quizCompleted) {
    content = <QuestionDisplay />;
  } else if (quizCompleted) {
    content = <ResultsScreen />;
  }

  return (
    <div className="font-sans antialiased">
      {/* Confetti CDN - This script should be in public/index.html instead of JSX */}
      {/* <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/dist/confetti.browser.min.js"></script> */}
      <style>
        {`
        body {
          font-family: 'Inter', sans-serif;
        }

        /* Custom text shadow for readability */
        .drop-shadow-lg {
          text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }

        /* Keyframes for fade-in and slide-up animation */
        @keyframes fadeInSlideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in-slide-up {
          animation: fadeInSlideUp 0.7s ease-out forwards;
          opacity: 0; /* Start invisible */
        }

        /* Keyframes for subtle gradient background movement */
        @keyframes gradientMove {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .animate-gradient-move {
          background-size: 200% 200%;
          animation: gradientMove 15s ease infinite;
        }

        /* Keyframes for subtle pulse animation for timer */
        @keyframes pulseSubtle {
          0% { transform: scale(1); }
          50% { transform: scale(1.03); }
          100% { transform: scale(1); }
        }

        .animate-pulse-subtle {
          animation: pulseSubtle 2s infinite ease-in-out;
        }

        /* Keyframes for progress bar pulse */
        @keyframes progressPulse {
          0% { box-shadow: 0 0 0 rgba(59, 130, 246, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
          100% { box-shadow: 0 0 0 rgba(59, 130, 246, 0); }
        }

        .animate-progress-pulse {
          animation: progressPulse 1.5s infinite;
        }
        `}
      </style>
      {content}
    </div>
  );
};

export default App;
