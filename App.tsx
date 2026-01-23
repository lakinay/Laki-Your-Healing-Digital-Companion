
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Send, Image as ImageIcon, Sparkles, X, Heart, Palette, Wand2, Camera, RefreshCw, Dumbbell, Upload, Play, Pause, Activity, Eye, MessageCircle, BookOpen, Coffee, RotateCcw, Video, VideoOff, Globe, Clock, GlassWater, SplitSquareHorizontal, Timer, BookHeart, PenLine, Link, CalendarCheck, Zap, ClipboardList, Gamepad2, Trophy, RotateCw, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import { Message, Role, LakiMood, LakiShape, ImageSize, AppMode, ThemeMode, UserSettings, JournalEntry, UserProfile } from './types';
import * as geminiService from './services/geminiService';
import LakiAvatar from './components/LakiAvatar';
import ChatBubble from './components/ChatBubble';

// --- TETRIS CONFIG ---
const COLS = 10;
const ROWS = 20;
// Macaron Colors
const COLORS = [
    'bg-sky-100', // Empty
    'bg-sky-200 border-sky-300',      // I (Sky)
    'bg-yellow-100 border-yellow-200', // O (Cream)
    'bg-violet-200 border-violet-300', // T (Lavender)
    'bg-emerald-200 border-emerald-300', // S (Mint)
    'bg-rose-200 border-rose-300',     // Z (Berry)
    'bg-blue-200 border-blue-300',     // J (Blueberry)
    'bg-orange-200 border-orange-300'  // L (Peach)
];

const SHAPES = [
    [], // Empty
    [[1, 1, 1, 1]], // I
    [[2, 2], [2, 2]], // O
    [[0, 3, 0], [3, 3, 3]], // T
    [[0, 4, 4], [4, 4, 0]], // S
    [[5, 5, 0], [0, 5, 5]], // Z
    [[6, 0, 0], [6, 6, 6]], // J
    [[0, 0, 7], [7, 7, 7]]  // L
];

const App: React.FC = () => {
  // --- STATE ---
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [userSettings, setUserSettings] = useState<UserSettings>({ language: 'zh', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
  const [themeMode, setThemeMode] = useState<ThemeMode>(ThemeMode.MORNING);
  const [appMode, setAppMode] = useState<AppMode>(AppMode.CHAT);
  const [themeOverride, setThemeOverride] = useState<ThemeMode | null>(null);

  // Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [mood, setMood] = useState<LakiMood>(LakiMood.NEUTRAL);
  const [shape, setShape] = useState<LakiShape>(LakiShape.CLOUD);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const typingTimeoutRef = useRef<any>(null);

  // Tools State
  const [waterCount, setWaterCount] = useState(0);
  const [showWaterModal, setShowWaterModal] = useState(false);
  const [lastDrinkTime, setLastDrinkTime] = useState(Date.now());
  const [showJournal, setShowJournal] = useState(false);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [isWritingJournal, setIsWritingJournal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>({ height: '', weight: '', targetWeight: '', fitnessGoal: '', studyTopic: '', schedule: '', heartRate: '72', sleepHours: '7.5' });
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);

  // Gym/Study State
  const [gymSubMode, setGymSubMode] = useState<'COMPARE' | 'FREE' | 'TIMER'>('COMPARE');
  const [gymVideoSrc, setGymVideoSrc] = useState<string | null>(null);
  const [gymFeedback, setGymFeedback] = useState<string>("");
  const [isAnalyzingPose, setIsAnalyzingPose] = useState(false);
  const [workoutSeconds, setWorkoutSeconds] = useState(0);
  const [isWorkoutTimerRunning, setIsWorkoutTimerRunning] = useState(false);
  
  const [studyTimer, setStudyTimer] = useState(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [studyPhase, setStudyPhase] = useState<'FOCUS' | 'BREAK'>('FOCUS');
  const [focusDuration, setFocusDuration] = useState(25);
  const [breakDuration, setBreakDuration] = useState(5);
  const [studyFeedback, setStudyFeedback] = useState<string>("");
  const [isCheckingFocus, setIsCheckingFocus] = useState(false);
  const [isStudyCameraOn, setIsStudyCameraOn] = useState(false);

  // --- TETRIS STATE ---
  const [grid, setGrid] = useState<number[][]>(Array.from({ length: ROWS }, () => Array(COLS).fill(0)));
  const [activePiece, setActivePiece] = useState<{shape: number[][], x: number, y: number, colorIdx: number} | null>(null);
  const [score, setScore] = useState(0);
  const [isGameActive, setIsGameActive] = useState(false);
  const [gameFeedback, setGameFeedback] = useState("");
  const gameIntervalRef = useRef<any>(null);

  // Tools
  const [showImgGen, setShowImgGen] = useState(false);
  const [imgGenPrompt, setImgGenPrompt] = useState('');
  const [imgGenSize, setImgGenSize] = useState<ImageSize>('1K');

  const [availableTimezones] = useState<string[]>(['UTC', 'Asia/Shanghai', 'America/New_York', 'Europe/London']);
  
  // Refs
  const gymWebcamRef = useRef<HTMLVideoElement>(null);
  const gymVideoRef = useRef<HTMLVideoElement>(null);
  const studyWebcamRef = useRef<HTMLVideoElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // --- THEME & MOOD LOGIC ---
  useEffect(() => {
    if (hasOnboarded && !themeOverride) {
        const h = new Date().getHours();
        if (h >= 5 && h < 11) setThemeMode(ThemeMode.MORNING);
        else if (h >= 11 && h < 16) setThemeMode(ThemeMode.NOON);
        else if (h >= 16 && h < 19) setThemeMode(ThemeMode.SUNSET);
        else setThemeMode(ThemeMode.NIGHT);
    }
  }, [hasOnboarded, themeOverride]);

  useEffect(() => {
      if (appMode === AppMode.GYM) setMood(LakiMood.COACH);
      else if (appMode === AppMode.STUDY) setMood(LakiMood.STUDY);
      else if (appMode === AppMode.GAME) setMood(LakiMood.MENTOR);
      else setMood(LakiMood.NEUTRAL);
  }, [appMode]);

  // --- TIMERS LOGIC (Restored) ---
  useEffect(() => {
      let interval: any = null;
      if (isTimerRunning && studyTimer > 0) {
          interval = setInterval(() => setStudyTimer(prev => prev - 1), 1000);
      } else if (studyTimer === 0 && isTimerRunning) {
          setIsTimerRunning(false);
          const nextPhase = studyPhase === 'FOCUS' ? 'BREAK' : 'FOCUS';
          setStudyPhase(nextPhase);
          setStudyTimer((nextPhase === 'FOCUS' ? focusDuration : breakDuration) * 60);
          setMessages(prev => [...prev, {
              id: Date.now().toString(), role: Role.MODEL,
              text: nextPhase === 'BREAK' ? "Time for a break! ☕" : "Ready to focus again? 📚",
              timestamp: new Date()
          }]);
          setMood(nextPhase === 'BREAK' ? LakiMood.HAPPY : LakiMood.STUDY);
      }
      return () => clearInterval(interval);
  }, [isTimerRunning, studyTimer, studyPhase]);

  useEffect(() => {
      let interval: any = null;
      if (isWorkoutTimerRunning) {
          interval = setInterval(() => setWorkoutSeconds(prev => prev + 1), 1000);
      }
      return () => clearInterval(interval);
  }, [isWorkoutTimerRunning]);

  // --- TETRIS LOGIC ---
  const spawnPiece = useCallback(() => {
      const typeId = Math.floor(Math.random() * 7) + 1;
      const shape = SHAPES[typeId];
      setActivePiece({
          shape,
          x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
          y: 0,
          colorIdx: typeId
      });
  }, []);

  const checkCollision = (piece: any, g: number[][], offsetX = 0, offsetY = 0) => {
      for (let y = 0; y < piece.shape.length; y++) {
          for (let x = 0; x < piece.shape[y].length; x++) {
              if (piece.shape[y][x] !== 0) {
                  const newX = piece.x + x + offsetX;
                  const newY = piece.y + y + offsetY;
                  if (newX < 0 || newX >= COLS || newY >= ROWS || (newY >= 0 && g[newY][newX] !== 0)) {
                      return true;
                  }
              }
          }
      }
      return false;
  };

  const rotatePiece = () => {
      if (!activePiece || !isGameActive) return;
      const rotatedShape = activePiece.shape[0].map((_, index) => activePiece.shape.map(row => row[index]).reverse());
      const testPiece = { ...activePiece, shape: rotatedShape };
      if (!checkCollision(testPiece, grid)) {
          setActivePiece(testPiece);
      }
  };

  const movePiece = (dir: number) => {
      if (!activePiece || !isGameActive) return;
      if (!checkCollision(activePiece, grid, dir, 0)) {
          setActivePiece({ ...activePiece, x: activePiece.x + dir });
      }
  };

  const lockPiece = async () => {
      if (!activePiece) return;
      const newGrid = grid.map(row => [...row]);
      for (let y = 0; y < activePiece.shape.length; y++) {
          for (let x = 0; x < activePiece.shape[y].length; x++) {
              if (activePiece.shape[y][x] !== 0) {
                  if (activePiece.y + y < 0) { // Game Over logic
                      setIsGameActive(false);
                      handleGameOver();
                      return;
                  }
                  newGrid[activePiece.y + y][activePiece.x + x] = activePiece.colorIdx;
              }
          }
      }

      // Check lines
      let linesCleared = 0;
      for (let y = ROWS - 1; y >= 0; y--) {
          if (newGrid[y].every(cell => cell !== 0)) {
              newGrid.splice(y, 1);
              newGrid.unshift(Array(COLS).fill(0));
              linesCleared++;
              y++; // Check same row index again
          }
      }

      if (linesCleared > 0) {
          setScore(prev => prev + linesCleared * 100);
          setMood(LakiMood.HAPPY);
          const feedback = await geminiService.sendMessageToGemini(`[System: User cleared ${linesCleared} lines in Tetris! Cheer!]`);
          setGameFeedback(feedback);
          setTimeout(() => setMood(LakiMood.MENTOR), 2000);
      }

      setGrid(newGrid);
      spawnPiece();
  };

  const dropPiece = () => {
      if (!activePiece || !isGameActive) return;
      if (!checkCollision(activePiece, grid, 0, 1)) {
          setActivePiece({ ...activePiece, y: activePiece.y + 1 });
      } else {
          lockPiece();
      }
  };

  // Game Loop
  useEffect(() => {
      if (isGameActive) {
          gameIntervalRef.current = setInterval(dropPiece, 800);
      } else {
          clearInterval(gameIntervalRef.current);
      }
      return () => clearInterval(gameIntervalRef.current);
  }, [isGameActive, activePiece, grid]);

  // Init Game
  useEffect(() => {
    if (appMode === AppMode.GAME && !isGameActive && score === 0) {
        setGrid(Array.from({ length: ROWS }, () => Array(COLS).fill(0)));
        spawnPiece();
        setIsGameActive(true);
        setGameFeedback(userSettings.language === 'zh' ? "准备好了吗？像堆甜点一样堆起来吧！🍬" : "Ready? Stack them like sweet treats! 🍬");
    } else if (appMode !== AppMode.GAME) {
        setIsGameActive(false);
    }
  }, [appMode]);

  const handleGameOver = async () => {
      setMood(LakiMood.SHY);
      const text = await geminiService.sendMessageToGemini("[System: Game Over in Tetris. Comfort the user gently.]");
      setGameFeedback(text);
  };
  
  const resetGame = () => {
      setGrid(Array.from({ length: ROWS }, () => Array(COLS).fill(0)));
      setScore(0);
      spawnPiece();
      setIsGameActive(true);
      setMood(LakiMood.MENTOR);
      setGameFeedback("Rebuilding the tower! 🏗️");
  };

  // Render Grid Helper
  const renderGrid = () => {
      const displayGrid = grid.map(row => [...row]);
      if (activePiece) {
          for (let y = 0; y < activePiece.shape.length; y++) {
              for (let x = 0; x < activePiece.shape[y].length; x++) {
                  if (activePiece.shape[y][x] !== 0) {
                      const py = activePiece.y + y;
                      const px = activePiece.x + x;
                      if (py >= 0 && py < ROWS && px >= 0 && px < COLS) {
                          displayGrid[py][px] = activePiece.colorIdx;
                      }
                  }
              }
          }
      }
      return displayGrid;
  };

  // --- ACTIONS ---
  const handleSmartPlan = async () => {
      setIsGeneratingPlan(true);
      setShowLinkModal(false);
      setAppMode(AppMode.CHAT);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: Role.MODEL, text: "Analyzing...", timestamp: new Date() }]);
      const planText = await geminiService.generateLifePlan(userProfile);
      setMessages(prev => [...prev, { id: (Date.now()+1).toString(), role: Role.MODEL, text: planText, timestamp: new Date() }]);
      setIsGeneratingPlan(false);
  };

  const generateJournal = async () => {
      // Allow generation even if history is short (service handles defaults)
      if (isWritingJournal) return;
      setIsWritingJournal(true);
      const result = await geminiService.generateJournalSummary(messages);
      setJournalEntries(prev => [{ id: Date.now().toString(), date: new Date().toLocaleDateString(), content: result.content, emoji: result.emoji }, ...prev]);
      setIsWritingJournal(false);
  };

  const handleGenerateImage = async () => {
    if (!imgGenPrompt.trim() || isProcessing) return;
    setIsProcessing(true);
    setShowImgGen(false);
    setMood(LakiMood.THINKING);
    const userMsg: Message = { id: Date.now().toString(), role: Role.USER, text: `Paint me: ${imgGenPrompt}`, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    try {
        const base64 = await geminiService.generateImage(imgGenPrompt, imgGenSize);
        if (base64) {
             setMessages(prev => [...prev, { id: (Date.now()+1).toString(), role: Role.MODEL, text: userSettings.language === 'zh' ? "画好啦！希望你喜欢！🎨" : "Here is your painting! 🎨", image: base64, timestamp: new Date() }]);
             setMood(LakiMood.HAPPY);
        } else { throw new Error("Failed"); }
    } catch (e) {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: Role.MODEL, text: "I couldn't paint that... maybe the clouds are too thick?", timestamp: new Date() }]);
        setMood(LakiMood.SHY);
    } finally { setIsProcessing(false); setImgGenPrompt(''); }
  };

  const handleSendMessage = async () => {
    if ((!inputText.trim() && !selectedImage) || isProcessing) return;
    const userMsg: Message = { id: Date.now().toString(), role: Role.USER, text: inputText, image: selectedImage || undefined, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInputText(''); setSelectedImage(null); setIsProcessing(true); setMood(LakiMood.THINKING);
    try {
      const base64Image = userMsg.image ? userMsg.image.split(',')[1] : undefined;
      const rawResponse = await geminiService.sendMessageToGemini(userMsg.text, base64Image);
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: Role.MODEL, text: rawResponse, timestamp: new Date() }]);
      setMood(LakiMood.HAPPY);
      setTimeout(() => setMood(appMode === AppMode.GYM ? LakiMood.COACH : LakiMood.NEUTRAL), 3000);
    } catch (e) { setMood(LakiMood.SHY); } finally { setIsProcessing(false); }
  };

  // --- HELPER ACTIONS FOR MODES ---
  const resetTimer = () => {
      setIsTimerRunning(false);
      setStudyTimer((studyPhase === 'FOCUS' ? focusDuration : breakDuration) * 60);
  };

  const formatWorkoutTime = (secs: number) => {
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = secs % 60;
      return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  };

  const finishWorkout = () => {
      setIsWorkoutTimerRunning(false);
      const mins = Math.floor(workoutSeconds / 60);
      setMessages(prev => [...prev, {
          id: Date.now().toString(), role: Role.MODEL,
          text: `Wow! You worked out for ${mins} minutes! Laki is proud! 💪🔥`, timestamp: new Date()
      }]);
      setAppMode(AppMode.CHAT);
      setWorkoutSeconds(0);
  };

  const checkStudyFocus = async () => {
      setIsCheckingFocus(true);
      try {
        if (!isStudyCameraOn) {
            const res = await geminiService.sendMessageToGemini(`[STUDY BLIND] User in ${studyPhase}. Timer: ${Math.floor(studyTimer/60)}m. Encourage them.`);
            setStudyFeedback(res);
        } else if (studyWebcamRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = studyWebcamRef.current.videoWidth;
            canvas.height = studyWebcamRef.current.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.translate(canvas.width, 0); ctx.scale(-1, 1);
                ctx.drawImage(studyWebcamRef.current, 0, 0);
                const base64 = canvas.toDataURL('image/jpeg').split(',')[1];
                const res = await geminiService.sendMessageToGemini("", base64);
                setStudyFeedback(res);
            }
        }
      } catch(e) { setStudyFeedback("Laki is resting..."); } 
      finally { setIsCheckingFocus(false); }
  };

  const handleGymAnalysis = async () => {
      if (!gymWebcamRef.current || isAnalyzingPose) return;
      if (gymSubMode === 'COMPARE' && !gymVideoRef.current) return;

      setIsAnalyzingPose(true);
      setMood(LakiMood.COACH);

      const userCanvas = document.createElement('canvas');
      userCanvas.width = gymWebcamRef.current.videoWidth;
      userCanvas.height = gymWebcamRef.current.videoHeight;
      const ctx = userCanvas.getContext('2d');
      if (ctx) {
          ctx.translate(userCanvas.width, 0); ctx.scale(-1, 1);
          ctx.drawImage(gymWebcamRef.current, 0, 0);
          const userBase64 = userCanvas.toDataURL('image/jpeg').split(',')[1];
          let rawRes;
          if (gymSubMode === 'COMPARE') {
              rawRes = await geminiService.sendMessageToGemini("", userBase64, undefined, "REF_PLACEHOLDER");
          } else {
              rawRes = await geminiService.sendMessageToGemini("[GYM: FREE MODE] Analyze my form based on this image. Keep it short.", userBase64);
          }
          setGymFeedback(rawRes);
      }
      setIsAnalyzingPose(false);
  };

  const handleOnboardingComplete = () => {
      geminiService.initializeChat(userSettings);
      setMessages([{ id: 'welcome', role: Role.MODEL, text: userSettings.language === 'zh' ? "你好呀！我是 Laki。(づ｡◕‿‿◕｡)づ" : "Hello! I am Laki. The sky is ready.", timestamp: new Date() }]);
      setHasOnboarded(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const reader = new FileReader();
      reader.onloadend = () => setSelectedImage(reader.result as string);
      reader.readAsDataURL(e.target.files[0]);
    }
  };
  
  const cycleShape = () => {
      const shapes = Object.values(LakiShape);
      const nextIndex = (shapes.indexOf(shape) + 1) % shapes.length;
      setShape(shapes[nextIndex]);
      setMood(LakiMood.HAPPY);
  };

  const getBackgroundClass = () => {
    if (themeOverride === ThemeMode.ANXIETY_RELIEF) return "bg-gradient-to-b from-blue-900 via-slate-800 to-slate-900";
    if (themeOverride === ThemeMode.HIGH_ENERGY) return "bg-gradient-to-b from-orange-400 via-red-400 to-rose-500";
    if (themeMode === ThemeMode.NIGHT) return "bg-gradient-to-b from-indigo-900 via-purple-900 to-slate-900 text-indigo-100";
    if (themeMode === ThemeMode.SUNSET) return "bg-gradient-to-b from-indigo-400 via-purple-400 to-orange-300";
    return "bg-gradient-to-b from-sky-300 via-morning-blue to-morning-orange";
  };

  if (!hasOnboarded) {
      return (
          <div className="h-screen w-full flex flex-col items-center justify-center bg-cream p-6 animate-in fade-in duration-700">
              <div className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-2xl text-center relative overflow-hidden">
                  <div className="mb-6 flex justify-center"><LakiAvatar mood={LakiMood.HAPPY} shape={LakiShape.CLOUD} theme={ThemeMode.MORNING} /></div>
                  <h1 className="text-2xl font-bold text-soft-brown mb-2">Welcome to Laki</h1>
                  <div className="space-y-4 text-left">
                      <select value={userSettings.language} onChange={(e) => setUserSettings({...userSettings, language: e.target.value as any})} className="w-full p-3 rounded-xl bg-gray-50 border border-gray-100"><option value="zh">中文</option><option value="en">English</option></select>
                      <select value={userSettings.timezone} onChange={(e) => setUserSettings({...userSettings, timezone: e.target.value})} className="w-full p-3 rounded-xl bg-gray-50 border border-gray-100">{availableTimezones.map(tz => <option key={tz} value={tz}>{tz}</option>)}</select>
                  </div>
                  <button onClick={handleOnboardingComplete} className="w-full mt-8 py-4 bg-gradient-to-r from-sky-300 to-sky-400 text-white rounded-xl font-bold">Enter the Sky</button>
              </div>
          </div>
      );
  }

  return (
    <div className={`flex flex-col h-screen max-w-md mx-auto relative overflow-hidden shadow-2xl transition-all duration-[2000ms] ${getBackgroundClass()}`}>
      
      {/* Header */}
      <div className={`flex flex-col items-center justify-center relative transition-all duration-700 ${appMode !== AppMode.CHAT ? 'flex-[0.5] min-h-[160px]' : 'flex-1'}`}>
        <LakiAvatar mood={mood} shape={shape} theme={themeOverride || themeMode} />
        
        {/* Mode Buttons */}
        <div className="absolute top-4 left-4 z-10 flex gap-2">
            {[AppMode.CHAT, AppMode.GYM, AppMode.STUDY].map(m => (
                <button key={m} onClick={() => setAppMode(m)} className={`p-2 rounded-full shadow-md transition-all ${appMode === m ? 'bg-white text-sky-400 scale-110' : 'bg-white/30 text-white'}`}>
                    {m === AppMode.CHAT ? <MessageCircle size={18} /> : m === AppMode.GYM ? <Dumbbell size={18}/> : <BookOpen size={18}/>}
                </button>
            ))}
        </div>

        {/* Tool Buttons */}
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
             <button onClick={() => setShowLinkModal(true)} className="p-2 bg-white/30 backdrop-blur-md rounded-full shadow-md text-white"><Link size={24} /></button>
             <button onClick={() => setAppMode(AppMode.GAME)} className={`p-2 backdrop-blur-md rounded-full shadow-md transition-all ${appMode === AppMode.GAME ? 'bg-white text-sky-400 scale-110' : 'bg-white/30 text-white'}`}><Gamepad2 size={24} /></button>
             <button onClick={cycleShape} className="p-2 bg-white/30 backdrop-blur-md rounded-full shadow-md text-white"><Wand2 size={24} /></button>
             <button onClick={() => setShowImgGen(true)} className="p-2 bg-white/30 backdrop-blur-md rounded-full shadow-md text-white"><Palette size={24} /></button>
             <button onClick={() => setShowJournal(true)} className="p-2 bg-white/30 backdrop-blur-md rounded-full shadow-md text-white"><BookHeart size={24} /></button>
        </div>
      </div>

      {/* Main Content */}
      <div className={`bg-white/70 backdrop-blur-xl rounded-t-[3rem] shadow-[0_-10px_40px_rgba(0,0,0,0.05)] flex flex-col overflow-hidden border-t border-white/40 transition-all duration-500 ${appMode !== AppMode.CHAT ? 'flex-[2.5]' : 'flex-[1.5]'}`}>
        
        {appMode === AppMode.CHAT && (
            <>
                <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
                    {messages.map(msg => <ChatBubble key={msg.id} message={msg} />)}
                    {isProcessing && <div className="text-center text-xs text-soft-brown/60 italic">Laki is thinking...</div>}
                    <div ref={messagesEndRef} />
                </div>
                <div className="p-4 bg-white/60 backdrop-blur-md flex items-center gap-2">
                     <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleFileUpload} />
                     <button onClick={() => fileInputRef.current?.click()} className="p-3 text-sky-500/80 bg-white/50 rounded-full"><ImageIcon size={22} /></button>
                     <input value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="Chat..." className="flex-1 bg-white/80 border-white rounded-full py-3 px-4 text-soft-brown focus:outline-none shadow-inner" />
                     <button onClick={() => handleSendMessage()} className="p-3 bg-sky-400 text-white rounded-full shadow-md"><Send size={20}/></button>
                </div>
            </>
        )}

        {appMode === AppMode.GAME && (
            <div className="flex flex-col h-full bg-indigo-50/30 p-4">
                <div className="flex-1 flex flex-col items-center justify-center">
                    {/* Game Board */}
                    <div className="relative bg-cream/80 p-2 rounded-xl shadow-inner border-2 border-white">
                        <div className="grid grid-cols-10 gap-[1px] bg-slate-200 border border-slate-200">
                            {renderGrid().map((row, y) => (
                                row.map((cell, x) => (
                                    <div key={`${y}-${x}`} className={`w-5 h-5 sm:w-6 sm:h-6 ${COLORS[cell]} rounded-[2px] transition-colors duration-100`}></div>
                                ))
                            ))}
                        </div>
                        {/* Game Over Overlay */}
                        {!isGameActive && score > 0 && (
                             <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center backdrop-blur-sm z-10">
                                 <Trophy className="text-yellow-400 mb-2" size={40} />
                                 <h3 className="text-xl font-bold text-soft-brown">Score: {score}</h3>
                                 <button onClick={resetGame} className="mt-4 px-6 py-2 bg-sky-300 text-white rounded-full shadow-lg font-bold">Try Again</button>
                             </div>
                        )}
                    </div>
                    
                    {/* Controls */}
                    <div className="mt-6 flex flex-col gap-3 w-full max-w-[240px]">
                         <div className="flex justify-between">
                             <button onClick={() => movePiece(-1)} className="p-4 bg-white rounded-full shadow-md active:scale-95 text-sky-400"><ArrowLeft size={24}/></button>
                             <button onClick={rotatePiece} className="p-4 bg-rose-200 rounded-full shadow-md active:scale-95 text-white"><RotateCw size={24}/></button>
                             <button onClick={() => movePiece(1)} className="p-4 bg-white rounded-full shadow-md active:scale-95 text-sky-400"><ArrowRight size={24}/></button>
                         </div>
                         <button onClick={dropPiece} className="w-full p-4 bg-sky-100 rounded-full shadow-md active:scale-95 text-sky-500 flex justify-center"><ArrowDown size={24}/></button>
                    </div>
                </div>

                {/* Mentor Feedback */}
                <div className="bg-white/60 p-3 rounded-2xl border border-white/50 backdrop-blur-md mt-2 flex items-center gap-3">
                     <div className="bg-sky-100 p-2 rounded-full"><Trophy size={16} className="text-sky-500"/></div>
                     <div>
                         <div className="text-[10px] font-bold text-gray-400 uppercase">Score: {score}</div>
                         <div className="text-xs text-soft-brown italic">{gameFeedback}</div>
                     </div>
                </div>
            </div>
        )}

        {appMode === AppMode.STUDY && (
             <div className="flex flex-col h-full bg-orange-50/20">
                 <div className="flex-1 flex flex-col items-center justify-center">
                     <span className={`text-xs font-bold tracking-widest mb-2 px-3 py-1 rounded-full ${studyPhase === 'FOCUS' ? 'bg-rose-100 text-rose-500' : 'bg-green-100 text-green-500'}`}>
                         {studyPhase === 'FOCUS' ? 'FOCUS TIME' : 'BREAK TIME'}
                     </span>
                     <div className="text-6xl font-mono font-bold text-soft-brown mb-4 drop-shadow-sm transition-all">
                         {Math.floor(studyTimer/60)}:{(studyTimer%60).toString().padStart(2,'0')}
                     </div>
                     
                     <div className="flex items-center gap-4 mb-4">
                        <button onClick={() => setIsTimerRunning(!isTimerRunning)} className="p-4 bg-sky-400 text-white rounded-full shadow-lg hover:scale-105 transition-transform">
                            {isTimerRunning ? <Pause size={24}/> : <Play size={24}/>}
                        </button>
                        <button onClick={resetTimer} className="p-4 bg-white text-gray-400 rounded-full shadow-lg hover:text-gray-600 transition-colors">
                            <RotateCcw size={24} />
                        </button>
                     </div>

                     {!isTimerRunning && (
                         <div className="flex gap-4 bg-white/40 p-3 rounded-2xl mb-4 animate-in fade-in">
                             <div className="flex flex-col items-center">
                                 <label className="text-[10px] font-bold text-gray-400 uppercase">Focus</label>
                                 <input type="number" value={focusDuration} onChange={(e) => setFocusDuration(Number(e.target.value))} className="w-12 text-center bg-white/80 rounded-lg p-1 text-sm font-bold text-soft-brown focus:ring-2 ring-sky-200 outline-none" />
                             </div>
                             <div className="flex flex-col items-center">
                                 <label className="text-[10px] font-bold text-gray-400 uppercase">Break</label>
                                 <input type="number" value={breakDuration} onChange={(e) => setBreakDuration(Number(e.target.value))} className="w-12 text-center bg-white/80 rounded-lg p-1 text-sm font-bold text-soft-brown focus:ring-2 ring-sky-200 outline-none" />
                             </div>
                         </div>
                     )}

                     <div className="relative">
                        <div className={`w-24 h-24 rounded-2xl overflow-hidden border-2 border-white shadow-lg transition-all ${isStudyCameraOn ? 'opacity-100' : 'opacity-50 bg-gray-200'}`}>
                             {isStudyCameraOn && <video ref={studyWebcamRef} className="w-full h-full object-cover transform scale-x-[-1]" autoPlay playsInline muted />}
                        </div>
                        <button onClick={() => setIsStudyCameraOn(!isStudyCameraOn)} className="absolute -bottom-2 -right-2 p-2 bg-white rounded-full shadow hover:bg-gray-50">
                            {isStudyCameraOn ? <Video size={14}/> : <VideoOff size={14}/>}
                        </button>
                     </div>
                 </div>
                 
                 <div className="h-32 bg-white/60 p-4 border-t border-white/50">
                     <div className="flex justify-between items-center mb-2">
                        <h3 className="text-xs font-bold text-soft-brown">Laki's Note</h3>
                        <button onClick={checkStudyFocus} disabled={isCheckingFocus} className="text-xs bg-sky-300 text-white px-2 py-1 rounded-full flex items-center gap-1 hover:bg-sky-400 transition">
                            {isCheckingFocus ? <RefreshCw size={10} className="animate-spin"/> : <Eye size={10}/>} Check Me
                        </button>
                     </div>
                     <p className="text-sm text-gray-600 italic">{studyFeedback || (studyPhase === 'FOCUS' ? "Stay focused, I'm watching over you..." : "Relax, you earned it!")}</p>
                 </div>
             </div>
        )}

        {appMode === AppMode.GYM && (
            <div className="flex flex-col h-full bg-slate-100">
                <div className="flex justify-center p-4 bg-white/50 gap-2">
                    <button onClick={() => setGymSubMode('COMPARE')} className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${gymSubMode === 'COMPARE' ? 'bg-sky-400 text-white shadow-md' : 'bg-white text-gray-400'}`}><SplitSquareHorizontal size={14} /> Compare</button>
                    <button onClick={() => setGymSubMode('FREE')} className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${gymSubMode === 'FREE' ? 'bg-sky-400 text-white shadow-md' : 'bg-white text-gray-400'}`}><Camera size={14} /> Free</button>
                    <button onClick={() => setGymSubMode('TIMER')} className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${gymSubMode === 'TIMER' ? 'bg-sky-400 text-white shadow-md' : 'bg-white text-gray-400'}`}><Timer size={14} /> Timer</button>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center p-4 relative">
                    {gymSubMode === 'COMPARE' && (
                        <div className="flex w-full h-full gap-2">
                             <div className="flex-1 h-full bg-black/10 rounded-2xl overflow-hidden border-2 border-white/50 relative">
                                 {gymVideoSrc ? <video ref={gymVideoRef} src={gymVideoSrc} className="w-full h-full object-cover" controls playsInline /> : <button onClick={() => videoInputRef.current?.click()} className="w-full h-full flex flex-col items-center justify-center text-gray-400"><Upload size={24}/><span className="text-xs">Ref Video</span></button>}
                                 <input type="file" ref={videoInputRef} className="hidden" accept="video/*" onChange={(e) => {if(e.target.files?.[0]) setGymVideoSrc(URL.createObjectURL(e.target.files[0]))}} />
                             </div>
                             <div className="flex-1 h-full bg-black/80 rounded-2xl overflow-hidden border-2 border-white/50">
                                 <video ref={gymWebcamRef} className="w-full h-full object-cover transform scale-x-[-1]" autoPlay playsInline muted />
                             </div>
                        </div>
                    )}

                    {gymSubMode === 'FREE' && (
                         <div className="w-full h-full bg-black/80 rounded-2xl overflow-hidden border-2 border-white/50 shadow-lg relative">
                             <video ref={gymWebcamRef} className="w-full h-full object-cover transform scale-x-[-1]" autoPlay playsInline muted />
                             <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                                 <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-full text-white text-xs flex items-center gap-2">
                                     <Eye size={12} className="text-sky-300"/> Laki is watching your form
                                 </div>
                             </div>
                         </div>
                    )}

                    {gymSubMode === 'TIMER' && (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-white/40 rounded-3xl border border-white">
                             <div className="text-[5rem] font-bold text-soft-brown font-mono tracking-tighter">
                                 {formatWorkoutTime(workoutSeconds)}
                             </div>
                             <div className="flex gap-6 mt-8">
                                 <button onClick={() => setIsWorkoutTimerRunning(!isWorkoutTimerRunning)} className={`p-6 rounded-full shadow-lg hover:scale-105 transition-all text-white ${isWorkoutTimerRunning ? 'bg-orange-400' : 'bg-sky-400'}`}>
                                     {isWorkoutTimerRunning ? <Pause size={32} /> : <Play size={32} fill="white" />}
                                 </button>
                                 {!isWorkoutTimerRunning && workoutSeconds > 0 && (
                                     <button onClick={finishWorkout} className="p-6 bg-green-400 text-white rounded-full shadow-lg hover:scale-105 transition-all">
                                         <Heart size={32} fill="white"/>
                                     </button>
                                 )}
                             </div>
                             <p className="mt-8 text-gray-400 text-sm font-medium">Just move at your own pace.</p>
                        </div>
                    )}
                    
                    {gymSubMode !== 'TIMER' && !gymFeedback && (
                        <div className="absolute top-20 right-4 z-10 animate-in fade-in slide-in-from-right">
                             <button onClick={handleSmartPlan} className="p-3 bg-gradient-to-r from-green-400 to-emerald-500 text-white rounded-2xl shadow-lg flex flex-col items-center gap-1 hover:scale-105 transition-transform" title="Get Plan from Coach Lumi">
                                 <ClipboardList size={20} />
                                 <span className="text-[10px] font-bold">Ask Lumi</span>
                             </button>
                        </div>
                    )}
                </div>
                
                {gymSubMode !== 'TIMER' && (
                    <div className="h-32 bg-white/60 p-4 border-t border-white/50">
                         <div className="flex justify-between items-center mb-2">
                            <h3 className="text-xs font-bold text-soft-brown">Coach Lumi</h3>
                            <button onClick={handleGymAnalysis} disabled={isAnalyzingPose || (gymSubMode === 'COMPARE' && !gymVideoSrc)} className="text-xs bg-sky-300 text-white px-3 py-1.5 rounded-full flex items-center gap-1 hover:bg-sky-400 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                                {isAnalyzingPose ? <RefreshCw size={12} className="animate-spin"/> : <Eye size={12}/>} Analyze Form
                            </button>
                         </div>
                         <p className="text-sm text-gray-600 italic whitespace-pre-wrap leading-relaxed">{gymFeedback || (gymSubMode === 'COMPARE' ? "Upload a video to start comparing!" : "Ready to check your form!")}</p>
                    </div>
                )}
            </div>
        )}

        {/* --- MODALS SECTION --- */}
        
        {/* Water Modal */}
        {showWaterModal && (
            <div className="absolute inset-0 z-50 bg-black/20 backdrop-blur-md flex items-end sm:items-center justify-center p-4">
                <div className="bg-white/90 w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in slide-in-from-bottom-10 border border-white/50 backdrop-blur-xl">
                     <div className="flex justify-between items-start mb-4">
                        <h3 className="text-lg font-semibold text-soft-brown flex items-center gap-2"><GlassWater size={20} className="text-sky-400"/> Hydration</h3>
                        <button onClick={() => setShowWaterModal(false)} className="text-gray-400 bg-white/50 rounded-full p-2"><X size={20} /></button>
                    </div>
                    <div className="text-center py-6">
                        <div className="text-5xl font-bold text-sky-400 mb-2">{waterCount}</div>
                        <div className="text-xs font-bold text-soft-brown uppercase">Glasses</div>
                    </div>
                    <button onClick={() => {setWaterCount(c=>c+1); setShowWaterModal(false)}} className="w-full py-4 bg-sky-100 text-sky-600 rounded-2xl font-bold hover:bg-sky-200">Drink Water</button>
                </div>
            </div>
        )}

        {/* Image Gen Modal */}
        {showImgGen && (
          <div className="absolute inset-0 z-50 bg-black/20 backdrop-blur-md flex items-end sm:items-center justify-center p-4">
              <div className="bg-white/90 w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in slide-in-from-bottom-10 border border-white/50 backdrop-blur-xl">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-soft-brown flex items-center gap-2"><Palette size={20} className="text-sky-400"/> Magic Canvas</h3>
                      <button onClick={() => setShowImgGen(false)} className="text-gray-400 bg-white/50 rounded-full p-2"><X size={20} /></button>
                  </div>
                  <textarea value={imgGenPrompt} onChange={(e) => setImgGenPrompt(e.target.value)} placeholder="Describe what you want Laki to paint..." className="w-full h-24 p-4 bg-white/50 rounded-2xl border border-white focus:ring-2 focus:ring-sky-200/50 resize-none text-sm mb-4 text-gray-600 shadow-inner focus:outline-none" />
                  <div className="flex gap-2 mb-6">
                      {(['1K', '2K', '4K'] as ImageSize[]).map(size => (
                          <button key={size} onClick={() => setImgGenSize(size)} className={`flex-1 py-2 rounded-xl text-xs font-bold ${imgGenSize === size ? 'bg-sky-100 text-sky-600 border border-sky-200' : 'bg-white/50 text-gray-400'}`}>{size}</button>
                      ))}
                  </div>
                  <button onClick={handleGenerateImage} disabled={isProcessing} className="w-full py-3.5 bg-gradient-to-r from-sky-300 to-sky-400 text-white rounded-xl font-medium shadow-lg flex justify-center items-center gap-2">
                      {isProcessing ? <RefreshCw className="animate-spin" size={18}/> : <Sparkles size={18} />} Generate
                  </button>
              </div>
          </div>
        )}

        {/* Laki Link Modal */}
        {showLinkModal && (
            <div className="absolute inset-0 z-50 bg-black/20 backdrop-blur-md flex items-end sm:items-center justify-center p-4">
                <div className="bg-white/95 w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in slide-in-from-bottom-10 border border-white/50 backdrop-blur-xl max-h-[90vh] overflow-y-auto no-scrollbar">
                     <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-semibold text-soft-brown flex items-center gap-2"><Link size={20} className="text-green-500"/> Laki Link</h3>
                        <button onClick={() => setShowLinkModal(false)} className="text-gray-400 bg-white/50 rounded-full p-2"><X size={20} /></button>
                    </div>
                    <div className="space-y-4">
                        <div className="bg-orange-50/50 p-4 rounded-2xl border border-orange-100">
                            <h4 className="text-xs font-bold text-orange-400 uppercase mb-3 flex items-center gap-1"><Activity size={12}/> Body Data</h4>
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <input placeholder="Height (cm)" value={userProfile.height} onChange={e => setUserProfile({...userProfile, height: e.target.value})} className="p-2 bg-white rounded-xl text-sm"/>
                                <input placeholder="Weight (kg)" value={userProfile.weight} onChange={e => setUserProfile({...userProfile, weight: e.target.value})} className="p-2 bg-white rounded-xl text-sm"/>
                            </div>
                            <input placeholder="Fitness Goal" value={userProfile.fitnessGoal} onChange={e => setUserProfile({...userProfile, fitnessGoal: e.target.value})} className="w-full p-2 bg-white rounded-xl text-sm"/>
                        </div>
                        <button onClick={handleSmartPlan} className="w-full py-4 bg-gradient-to-r from-green-400 to-emerald-500 text-white rounded-2xl font-bold shadow-lg flex items-center justify-center gap-2"><Zap size={20}/> {isGeneratingPlan ? "Thinking..." : "Generate Plan"}</button>
                    </div>
                </div>
            </div>
        )}

        {/* Journal Sidebar */}
        {showJournal && (
            <div className="absolute inset-0 z-50 flex justify-end">
                <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowJournal(false)}></div>
                <div className="relative w-[85%] h-full bg-[#fffdf9] shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col p-6 overflow-hidden">
                    <div className="flex justify-between items-center mb-6">
                         <h3 className="text-xl font-bold text-soft-brown font-serif tracking-wide flex items-center gap-2"><BookHeart size={24} className="text-rose-400" /> Our Memories</h3>
                         <button onClick={() => setShowJournal(false)} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200"><X size={20} /></button>
                    </div>
                    <button onClick={generateJournal} disabled={isWritingJournal} className="mb-6 w-full py-3 border-2 border-dashed border-rose-300 rounded-xl text-rose-400 font-bold flex items-center justify-center gap-2 hover:bg-rose-50 transition-colors">
                        {isWritingJournal ? <RefreshCw size={18} className="animate-spin" /> : <PenLine size={18} />} {isWritingJournal ? "Writing..." : "Write Entry"}
                    </button>
                    <div className="flex-1 overflow-y-auto pr-2 space-y-6 no-scrollbar">
                        {journalEntries.map(entry => (
                            <div key={entry.id} className="relative pl-6 border-l-2 border-gray-200">
                                <div className="absolute -left-[9px] top-0 w-4 h-4 bg-rose-200 rounded-full border-2 border-white"></div>
                                <div className="text-xs font-bold text-gray-400 mb-1">{entry.date}</div>
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-sm text-soft-brown leading-relaxed font-serif relative">
                                    <span className="absolute top-2 right-2 text-xl">{entry.emoji}</span>{entry.content}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default App;
