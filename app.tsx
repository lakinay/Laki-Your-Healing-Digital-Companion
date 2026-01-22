
import React, { useState, useRef, useEffect } from 'react';
import { Mic, Send, Image as ImageIcon, Sparkles, X, Heart, Palette, Wand2, Camera, RefreshCw, Dumbbell, Upload, Play, Pause, Activity, Eye, MessageCircle, BookOpen, Coffee, RotateCcw, Video, VideoOff, Globe, Clock, GlassWater, SplitSquareHorizontal, Timer, BookHeart, PenLine, Link, CalendarCheck, Zap, ClipboardList, Gamepad2, Trophy } from 'lucide-react';
import { Message, Role, LakiMood, LakiShape, ImageSize, AppMode, ThemeMode, UserSettings, JournalEntry, UserProfile } from './types';
import * as geminiService from './services/geminiService';
import LakiAvatar from './components/LakiAvatar';
import ChatBubble from './components/ChatBubble';

interface GameCloud {
    id: string;
    scale: number;
    color: string;
    x: number; // Percentage
    y: number; // Percentage
    isPopped: boolean;
}

const App: React.FC = () => {
  // --- STATE ---
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [userSettings, setUserSettings] = useState<UserSettings>({ language: 'zh', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
  const [themeMode, setThemeMode] = useState<ThemeMode>(ThemeMode.MORNING);
  const [appMode, setAppMode] = useState<AppMode>(AppMode.CHAT);
  const [themeOverride, setThemeOverride] = useState<ThemeMode | null>(null); // For Anxiety/Energy states

  // Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [mood, setMood] = useState<LakiMood>(LakiMood.NEUTRAL);
  const [shape, setShape] = useState<LakiShape>(LakiShape.CLOUD);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const typingTimeoutRef = useRef<any>(null);

  // Water Reminder State
  const [waterCount, setWaterCount] = useState(0);
  const [showWaterModal, setShowWaterModal] = useState(false);
  const [lastDrinkTime, setLastDrinkTime] = useState(Date.now());
  const REMINDER_INTERVAL = 60 * 60 * 1000; // 1 Hour

  // Journal State
  const [showJournal, setShowJournal] = useState(false);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [isWritingJournal, setIsWritingJournal] = useState(false);

  // Smart Link / User Profile State
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>({
      height: '',
      weight: '',
      targetWeight: '',
      fitnessGoal: '',
      studyTopic: '',
      schedule: '',
      heartRate: '72', // Default simulated
      sleepHours: '7.5'
  });
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);

  // Gym / Study State
  const [gymSubMode, setGymSubMode] = useState<'COMPARE' | 'FREE' | 'TIMER'>('COMPARE');
  const [gymVideoSrc, setGymVideoSrc] = useState<string | null>(null);
  const [gymFeedback, setGymFeedback] = useState<string>("");
  const [isAnalyzingPose, setIsAnalyzingPose] = useState(false);
  const [workoutSeconds, setWorkoutSeconds] = useState(0);
  const [isWorkoutTimerRunning, setIsWorkoutTimerRunning] = useState(false);
  
  // Pomodoro State
  const [studyTimer, setStudyTimer] = useState(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [studyPhase, setStudyPhase] = useState<'FOCUS' | 'BREAK'>('FOCUS');
  const [focusDuration, setFocusDuration] = useState(25);
  const [breakDuration, setBreakDuration] = useState(5);
  const [studyFeedback, setStudyFeedback] = useState<string>("");
  const [isCheckingFocus, setIsCheckingFocus] = useState(false);
  const [isStudyCameraOn, setIsStudyCameraOn] = useState(false);

  // Game State
  const [gameClouds, setGameClouds] = useState<GameCloud[]>([]);
  const [gameFeedback, setGameFeedback] = useState("");
  const [isGameWon, setIsGameWon] = useState(false);

  // Tools State
  const [showImgGen, setShowImgGen] = useState(false);
  const [imgGenPrompt, setImgGenPrompt] = useState('');
  const [imgGenSize, setImgGenSize] = useState<ImageSize>('1K');
  const [isGeneratingImg, setIsGeneratingImg] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraImage, setCameraImage] = useState<string | null>(null);

  // Timezones fallback
  const [availableTimezones] = useState<string[]>(() => {
    try {
        if ((Intl as any).supportedValuesOf) {
            return (Intl as any).supportedValuesOf('timeZone');
        }
    } catch (e) {}
    const defaults = [
      'UTC', 'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Singapore', 
      'Europe/London', 'Europe/Paris', 'Europe/Berlin', 
      'America/New_York', 'America/Los_Angeles', 'America/Chicago'
    ];
    const current = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!defaults.includes(current)) defaults.push(current);
    return defaults.sort();
  });

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const gymWebcamRef = useRef<HTMLVideoElement>(null);
  const gymVideoRef = useRef<HTMLVideoElement>(null);
  const studyWebcamRef = useRef<HTMLVideoElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // --- INITIALIZATION & TIME LOGIC ---
  const calculateThemeFromTime = () => {
    if (themeOverride) return; 
    const now = new Date();
    const localTime = new Date(now.toLocaleString('en-US', { timeZone: userSettings.timezone }));
    const hour = localTime.getHours();

    if (hour >= 5 && hour < 11) setThemeMode(ThemeMode.MORNING);
    else if (hour >= 11 && hour < 16) setThemeMode(ThemeMode.NOON);
    else if (hour >= 16 && hour < 19) setThemeMode(ThemeMode.SUNSET);
    else setThemeMode(ThemeMode.NIGHT);
  };

  useEffect(() => {
    if (hasOnboarded) {
        calculateThemeFromTime();
        const interval = setInterval(calculateThemeFromTime, 60000); 
        return () => clearInterval(interval);
    }
  }, [hasOnboarded, userSettings.timezone, themeOverride]);

  // Pomodoro Logic
  useEffect(() => {
      let interval: any = null;
      if (isTimerRunning && studyTimer > 0) {
          interval = setInterval(() => {
              setStudyTimer((prev) => prev - 1);
          }, 1000);
      } else if (studyTimer === 0 && isTimerRunning) {
          // Timer Finished
          setIsTimerRunning(false);
          const nextPhase = studyPhase === 'FOCUS' ? 'BREAK' : 'FOCUS';
          setStudyPhase(nextPhase);
          setStudyTimer((nextPhase === 'FOCUS' ? focusDuration : breakDuration) * 60);
          
          const text = nextPhase === 'BREAK' 
             ? (userSettings.language === 'zh' ? "专注时间结束啦！休息一下吧~ (づ｡◕‿‿◕｡)づ" : "Focus time is over! Take a break~")
             : (userSettings.language === 'zh' ? "休息结束！准备好开始下一轮专注了吗？" : "Break is over! Ready for the next focus session?");
          
          setMessages(prev => [...prev, {
              id: Date.now().toString(),
              role: Role.MODEL,
              text: text,
              timestamp: new Date()
          }]);
          
          setMood(nextPhase === 'BREAK' ? LakiMood.HAPPY : LakiMood.STUDY);
      }
      return () => clearInterval(interval);
  }, [isTimerRunning, studyTimer, studyPhase, focusDuration, breakDuration, userSettings.language]);

  // Workout Timer Logic
  useEffect(() => {
      let interval: any = null;
      if (isWorkoutTimerRunning) {
          interval = setInterval(() => {
              setWorkoutSeconds(prev => prev + 1);
          }, 1000);
      }
      return () => clearInterval(interval);
  }, [isWorkoutTimerRunning]);

  // Water Reminder Check
  useEffect(() => {
    if (!hasOnboarded) return;
    const waterCheck = setInterval(() => {
        const timeSinceDrink = Date.now() - lastDrinkTime;
        if (timeSinceDrink > REMINDER_INTERVAL) {
            const lastMsg = messages[messages.length - 1];
            if (lastMsg?.role !== Role.MODEL || (!lastMsg.text.includes("hydration") && !lastMsg.text.includes("喝水"))) {
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    role: Role.MODEL,
                    text: userSettings.language === 'zh' 
                        ? "咕噜咕噜... 身体好像有点干了，我们一起喝杯水吧？💧" 
                        : "Gulp... I feel a bit dry. Shall we drink some water together? 💧",
                    timestamp: new Date()
                }]);
            }
        }
    }, 60000 * 5); 
    return () => clearInterval(waterCheck);
  }, [hasOnboarded, lastDrinkTime, messages, userSettings.language]);


  // Force mood update when mode changes
  useEffect(() => {
      if (appMode === AppMode.GYM) setMood(LakiMood.COACH);
      else if (appMode === AppMode.STUDY) setMood(LakiMood.STUDY);
      else if (appMode === AppMode.GAME) setMood(LakiMood.MENTOR);
      else setMood(LakiMood.NEUTRAL);
  }, [appMode]);

  // Game Logic Effect
  useEffect(() => {
      if (appMode === AppMode.GAME) {
          startNewGame();
      }
  }, [appMode]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  // --- GAME LOGIC ---
  const startNewGame = () => {
      setIsGameWon(false);
      const newClouds: GameCloud[] = [];
      const count = 4;
      const colors = ['#bae6fd', '#ffe4e6', '#e0f2fe', '#fffdf9'];
      
      for(let i=0; i<count; i++) {
          newClouds.push({
              id: i.toString(),
              scale: 0.5 + Math.random() * 0.8, // 0.5 to 1.3
              color: colors[Math.floor(Math.random()*colors.length)],
              x: 10 + Math.random() * 60, // 10% to 70% left
              y: 10 + Math.random() * 60, // 10% to 70% top
              isPopped: false
          });
      }
      setGameClouds(newClouds);
      setGameFeedback(userSettings.language === 'zh' ? "准备好了吗？从小到大点击云朵！☁️" : "Ready? Pop clouds from smallest to largest! ☁️");
      setMood(LakiMood.MENTOR);
  };

  const handleCloudClick = (clickedCloud: GameCloud) => {
      if (clickedCloud.isPopped || isGameWon) return;

      const activeClouds = gameClouds.filter(c => !c.isPopped);
      // Find smallest
      const smallest = activeClouds.reduce((prev, curr) => prev.scale < curr.scale ? prev : curr);

      if (clickedCloud.id === smallest.id) {
          // Correct
          const updatedClouds = gameClouds.map(c => c.id === clickedCloud.id ? {...c, isPopped: true} : c);
          setGameClouds(updatedClouds);
          
          if (updatedClouds.every(c => c.isPopped)) {
              // Win
              setIsGameWon(true);
              setMood(LakiMood.HAPPY);
              handleGameWin();
          } else {
              setGameFeedback(userSettings.language === 'zh' ? "太棒了！继续！✨" : "Great! Keep going! ✨");
          }
      } else {
          // Wrong
          setMood(LakiMood.SHY);
          setGameFeedback(userSettings.language === 'zh' ? "没关系，再试一次！那个看起来大一点点哦~" : "It's okay! Try again, that one looks a bit bigger~");
          setTimeout(() => setMood(LakiMood.MENTOR), 1500);
      }
  };

  const handleGameWin = async () => {
      const winText = await geminiService.sendMessageToGemini("[System: User finished Focus Game successfully. Praise them gently.]");
      setGameFeedback(winText);
  };


  // --- ACTIONS ---

  const handleSmartPlan = async () => {
      setIsGeneratingPlan(true);
      setShowLinkModal(false);
      setAppMode(AppMode.CHAT); // Switch to chat to see the result
      
      const promptText = userSettings.language === 'zh' 
        ? "Coach Lumi 正在分析你的体能数据... 准备接收专业计划！🩺💪" 
        : "Coach Lumi is analyzing your biometrics... Preparing your pro plan! 🩺💪";

      setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: Role.MODEL,
          text: promptText,
          timestamp: new Date()
      }]);

      const planText = await geminiService.generateLifePlan(userProfile);
      
      setMessages(prev => [...prev, {
          id: (Date.now()+1).toString(),
          role: Role.MODEL,
          text: planText,
          timestamp: new Date()
      }]);
      setIsGeneratingPlan(false);
  };

  const generateJournal = async () => {
      if (messages.length < 2 || isWritingJournal) return;
      setIsWritingJournal(true);
      const result = await geminiService.generateJournalSummary(messages);
      const newEntry: JournalEntry = {
          id: Date.now().toString(),
          date: new Date().toLocaleDateString(userSettings.language === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          content: result.content,
          emoji: result.emoji
      };
      setJournalEntries(prev => [newEntry, ...prev]);
      setIsWritingJournal(false);
  };

  const resetTimer = () => {
      setIsTimerRunning(false);
      setStudyTimer((studyPhase === 'FOCUS' ? focusDuration : breakDuration) * 60);
  };

  const finishWorkout = () => {
      setIsWorkoutTimerRunning(false);
      const mins = Math.floor(workoutSeconds / 60);
      const text = userSettings.language === 'zh'
        ? `哇！你坚持运动了 ${mins} 分钟！流汗的感觉是不是很棒？Laki 为你骄傲！💪🔥`
        : `Wow! You worked out for ${mins} minutes! Doesn't it feel great? Laki is proud of you! 💪🔥`;
      
      setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: Role.MODEL,
          text: text,
          timestamp: new Date()
      }]);
      setAppMode(AppMode.CHAT);
      setWorkoutSeconds(0);
  };

  const formatWorkoutTime = (secs: number) => {
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = secs % 60;
      return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  };

  const checkShapeKeywords = (text: string) => {
      const t = text.toLowerCase();
      if (t.includes('rabbit') || t.includes('兔子')) return LakiShape.RABBIT;
      if (t.includes('cat') || t.includes('猫') || t.includes('咪')) return LakiShape.CAT;
      if (t.includes('dog') || t.includes('狗') || t.includes('汪')) return LakiShape.DOG;
      if (t.includes('whale') || t.includes('鲸')) return LakiShape.WHALE;
      if (t.includes('flower') || t.includes('花')) return LakiShape.FLOWER;
      if (t.includes('bird') || t.includes('鸟')) return LakiShape.BIRD;
      if (t.includes('cloud') || t.includes('云') || t.includes('变回来')) return LakiShape.CLOUD;
      return null;
  };

  const cycleShape = () => {
      const shapes = Object.values(LakiShape);
      const currentIndex = shapes.indexOf(shape);
      const nextIndex = (currentIndex + 1) % shapes.length;
      setShape(shapes[nextIndex]);
      setMood(LakiMood.HAPPY);
      setTimeout(() => {
        if (appMode === AppMode.STUDY) setMood(LakiMood.STUDY);
        else if (appMode === AppMode.GYM) setMood(LakiMood.COACH);
        else if (appMode === AppMode.GAME) setMood(LakiMood.MENTOR);
        else setMood(LakiMood.NEUTRAL);
      }, 1000);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputText(e.target.value);
      if (mood !== LakiMood.HAPPY && !isProcessing) {
          setMood(LakiMood.HAPPY);
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
          if (appMode === AppMode.STUDY) setMood(LakiMood.STUDY);
          else if (appMode === AppMode.GYM) setMood(LakiMood.COACH);
          else if (appMode === AppMode.GAME) setMood(LakiMood.MENTOR);
          else setMood(LakiMood.NEUTRAL);
      }, 1000);
  };

  const handleDrinkWater = () => {
      setWaterCount(prev => prev + 1);
      setLastDrinkTime(Date.now());
      setMood(LakiMood.HAPPY);
      
      const praises = userSettings.language === 'zh'
        ? ["啊~ 水真好喝！身体变得轻盈了呢！💧", "咕嘟咕嘟~ 补充能量成功！✨", "太棒啦！要保持水润润的哦！(づ｡◕‿‿◕｡)づ"]
        : ["Ahh~ Water is refreshing! I feel lighter! 💧", "Gulp gulp~ Energy restored! ✨", "Great job! Stay hydrated! (づ｡◕‿‿◕｡)づ"];
      
      const randomPraise = praises[Math.floor(Math.random() * praises.length)];

      setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: Role.MODEL,
          text: randomPraise,
          timestamp: new Date()
      }]);

      setTimeout(() => {
          if (appMode === AppMode.STUDY) setMood(LakiMood.STUDY);
          else if (appMode === AppMode.GYM) setMood(LakiMood.COACH);
          else if (appMode === AppMode.GAME) setMood(LakiMood.MENTOR);
          else setMood(LakiMood.NEUTRAL);
      }, 3000);
  };

  const handleOnboardingComplete = () => {
      geminiService.initializeChat(userSettings);
      const welcomeText = userSettings.language === 'zh' 
            ? "你好呀！我是 Laki。天空为你准备好了，我们开始吧？(づ｡◕‿‿◕｡)づ"
            : "Hello! I am Laki. The sky is ready for you, shall we begin?";
      
      setMessages([{
        id: 'welcome',
        role: Role.MODEL,
        text: welcomeText,
        timestamp: new Date(),
      }]);

      setJournalEntries([{
          id: 'init',
          date: new Date().toLocaleDateString(),
          content: userSettings.language === 'zh' ? "今天我们相遇了。天空很高，云朵很软。" : "Today we met. The sky is high and the clouds are soft.",
          emoji: "✨"
      }]);

      setHasOnboarded(true);
  };

  const handleSendMessage = async (text: string = inputText, image: string | null = selectedImage) => {
    if ((!text.trim() && !image) || isProcessing) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: Role.USER,
      text: text,
      image: image || undefined,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setSelectedImage(null);
    setIsProcessing(true);
    setMood(LakiMood.THINKING);

    const newShape = checkShapeKeywords(userMsg.text);
    if (newShape) setShape(newShape);

    try {
      const base64Image = userMsg.image ? userMsg.image.split(',')[1] : undefined;
      const rawResponse = await geminiService.sendMessageToGemini(userMsg.text, base64Image);
      const cleanResponse = processGeminiResponse(rawResponse);

      const lakiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: Role.MODEL,
        text: cleanResponse,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, lakiMsg]);
      setMood(LakiMood.HAPPY);
      setTimeout(() => {
          if (appMode === AppMode.STUDY) setMood(LakiMood.STUDY);
          else if (appMode === AppMode.GYM) setMood(LakiMood.COACH);
          else if (appMode === AppMode.GAME) setMood(LakiMood.MENTOR);
          else setMood(LakiMood.NEUTRAL);
      }, 3000);
    } catch (error) {
       setMood(LakiMood.SHY);
    } finally {
      setIsProcessing(false);
    }
  };

  // Reused helpers
  const getBackgroundClass = () => {
    const activeTheme = themeOverride || themeMode;
    switch (activeTheme) {
        case ThemeMode.ANXIETY_RELIEF: return "bg-gradient-to-b from-blue-900 via-slate-800 to-slate-900";
        case ThemeMode.HIGH_ENERGY: return "bg-gradient-to-b from-orange-400 via-red-400 to-rose-500";
        case ThemeMode.NIGHT: return "bg-gradient-to-b from-indigo-900 via-purple-900 to-slate-900 text-indigo-100";
        case ThemeMode.SUNSET: return "bg-gradient-to-b from-indigo-400 via-purple-400 to-orange-300";
        case ThemeMode.NOON: return "bg-gradient-to-b from-sky-400 via-blue-300 to-white";
        case ThemeMode.MORNING:
        default: return "bg-gradient-to-b from-sky-300 via-morning-blue to-morning-orange";
    }
  };

  const processGeminiResponse = (text: string): string => {
      let cleanText = text;
      if (text.includes("[THEME: ANXIETY_RELIEF]")) {
          setThemeOverride(ThemeMode.ANXIETY_RELIEF);
          cleanText = text.replace("[THEME: ANXIETY_RELIEF]", "");
          setTimeout(() => setThemeOverride(null), 30000);
      } else if (text.includes("[THEME: HIGH_ENERGY]")) {
          setThemeOverride(ThemeMode.HIGH_ENERGY);
          cleanText = text.replace("[THEME: HIGH_ENERGY]", "");
          setTimeout(() => setThemeOverride(null), 30000);
      }
      return cleanText;
  };

  const checkStudyFocus = async () => {
      setIsCheckingFocus(true);
      try {
        if (!isStudyCameraOn) {
            const prompt = `[STUDY BLIND] User in ${studyPhase}. Timer: ${Math.floor(studyTimer/60)}m. Encourage them.`;
            const res = await geminiService.sendMessageToGemini(prompt);
            setStudyFeedback(res);
        } else if (studyWebcamRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = studyWebcamRef.current.videoWidth;
            canvas.height = studyWebcamRef.current.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(studyWebcamRef.current, 0, 0);
                const base64 = canvas.toDataURL('image/jpeg').split(',')[1];
                const rawRes = await geminiService.sendMessageToGemini("", base64);
                const cleanRes = processGeminiResponse(rawRes);
                setStudyFeedback(cleanRes);
            }
        }
      } catch(e) { setStudyFeedback("Laki is resting..."); } 
      finally { setIsCheckingFocus(false); }
  };

  const handleGymAnalysis = async () => {
      if (!gymWebcamRef.current || isAnalyzingPose) return;
      
      // Need reference video for COMPARE mode
      if (gymSubMode === 'COMPARE' && !gymVideoRef.current) return;

      setIsAnalyzingPose(true);
      setMood(LakiMood.COACH);

      const userCanvas = document.createElement('canvas');
      userCanvas.width = gymWebcamRef.current.videoWidth;
      userCanvas.height = gymWebcamRef.current.videoHeight;
      const ctx = userCanvas.getContext('2d');
      if (ctx) {
          ctx.translate(userCanvas.width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(gymWebcamRef.current, 0, 0);
          const userBase64 = userCanvas.toDataURL('image/jpeg').split(',')[1];
          
          let rawRes;
          if (gymSubMode === 'COMPARE') {
              rawRes = await geminiService.sendMessageToGemini("", userBase64, undefined, "REF_PLACEHOLDER");
          } else {
              // Free mode: No reference image, just User video check
              // We pass a dummy prompt to indicate FREE mode analysis in the service if needed, 
              // or relying on the lack of referenceImageBase64 in sendMessageToGemini is handled by the service prompt logic.
              // We'll prepend a text instruction to be safe.
              rawRes = await geminiService.sendMessageToGemini("[GYM: FREE MODE] Analyze my form based on this image. Keep it short and energetic.", userBase64);
          }
          
          const cleanRes = processGeminiResponse(rawRes);
          setGymFeedback(cleanRes);
      }
      setIsAnalyzingPose(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setSelectedImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // --- RENDER ---
  if (!hasOnboarded) {
      return (
          <div className="h-screen w-full flex flex-col items-center justify-center bg-cream p-6 animate-in fade-in duration-700">
              <div className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-2xl text-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-sky-300 to-macaron-pink-dark"></div>
                  <div className="mb-6 flex justify-center">
                      <LakiAvatar mood={LakiMood.HAPPY} shape={LakiShape.CLOUD} theme={ThemeMode.MORNING} />
                  </div>
                  <h1 className="text-2xl font-bold text-soft-brown mb-2">Welcome to Laki</h1>
                  <p className="text-gray-400 text-sm mb-8">Your cloud spirit friend is waking up...</p>

                  <div className="space-y-4 text-left">
                      <div>
                          <label className="block text-xs font-bold text-gray-400 mb-1 flex items-center gap-1"><Globe size={12}/> LANGUAGE</label>
                          <select 
                            value={userSettings.language}
                            onChange={(e) => setUserSettings({...userSettings, language: e.target.value as any})}
                            className="w-full p-3 rounded-xl bg-gray-50 border border-gray-100 text-soft-brown outline-none focus:ring-2 focus:ring-sky-200"
                          >
                              <option value="zh">中文 (Chinese)</option>
                              <option value="en">English</option>
                              <option value="ja">日本語 (Japanese)</option>
                          </select>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-400 mb-1 flex items-center gap-1"><Clock size={12}/> TIMEZONE</label>
                          <select 
                             value={userSettings.timezone}
                             onChange={(e) => setUserSettings({...userSettings, timezone: e.target.value})}
                             className="w-full p-3 rounded-xl bg-gray-50 border border-gray-100 text-soft-brown outline-none focus:ring-2 focus:ring-sky-200"
                          >
                              {availableTimezones.map(tz => (
                                  <option key={tz} value={tz}>{tz}</option>
                              ))}
                          </select>
                      </div>
                  </div>

                  <button 
                    onClick={handleOnboardingComplete}
                    className="w-full mt-8 py-4 bg-gradient-to-r from-sky-300 to-sky-400 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
                  >
                      Enter the Sky
                  </button>
              </div>
          </div>
      );
  }

  // --- MAIN APP RENDER ---
  return (
    <div className={`flex flex-col h-screen max-w-md mx-auto relative overflow-hidden shadow-2xl transition-all duration-[2000ms] ${getBackgroundClass()}`}>
      
      {/* Header / Avatar Area */}
      <div className={`flex flex-col items-center justify-center relative transition-all duration-700 ${appMode !== AppMode.CHAT ? 'flex-[0.5] min-h-[160px]' : 'flex-1'}`}>
        <LakiAvatar mood={mood} shape={shape} theme={themeOverride || themeMode} />
        
        {/* Left Side Buttons (Mode) */}
        <div className="absolute top-4 left-4 z-10 flex gap-2">
            <button 
                onClick={() => setAppMode(AppMode.CHAT)}
                className={`p-2 rounded-full shadow-md transition-all ${appMode === AppMode.CHAT ? 'bg-white text-sky-400 scale-110' : 'bg-white/30 text-white hover:bg-white/50'}`}
                title="Chat"
            >
                <MessageCircle size={18} />
            </button>
            <button 
                onClick={() => setAppMode(AppMode.GYM)}
                className={`p-2 rounded-full shadow-md transition-all ${appMode === AppMode.GYM ? 'bg-white text-sky-400 scale-110' : 'bg-white/30 text-white hover:bg-white/50'}`}
                title="Gym"
            >
                <Dumbbell size={18} />
            </button>
            <button 
                onClick={() => setAppMode(AppMode.STUDY)}
                className={`p-2 rounded-full shadow-md transition-all ${appMode === AppMode.STUDY ? 'bg-white text-sky-400 scale-110' : 'bg-white/30 text-white hover:bg-white/50'}`}
                title="Study"
            >
                <BookOpen size={18} />
            </button>
        </div>

        {/* Right Side Buttons (Tools) */}
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
             <button 
                onClick={() => setShowLinkModal(true)}
                className="p-2 bg-white/30 backdrop-blur-md rounded-full shadow-md text-white hover:bg-white/50 transition-colors relative"
                title="Laki Link (Integration)"
             >
                 <Link size={24} />
                 <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border border-white"></span>
             </button>

             <button 
                onClick={() => setAppMode(AppMode.GAME)}
                className={`p-2 backdrop-blur-md rounded-full shadow-md text-white transition-all ${appMode === AppMode.GAME ? 'bg-white text-sky-400 scale-110' : 'bg-white/30 hover:bg-white/50'}`}
                title="Focus Game"
             >
                 <Gamepad2 size={24} />
             </button>

             <button 
                onClick={cycleShape}
                className="p-2 bg-white/30 backdrop-blur-md rounded-full shadow-md text-white hover:bg-white/50 transition-colors"
                title="Transform Shape"
             >
                 <Wand2 size={24} />
             </button>

             <button 
                onClick={() => setShowImgGen(true)}
                className="p-2 bg-white/30 backdrop-blur-md rounded-full shadow-md text-white hover:bg-white/50 transition-colors"
                title="Magic Canvas"
             >
                 <Palette size={24} />
             </button>

             <button 
                onClick={() => setShowWaterModal(true)}
                className="p-2 bg-white/30 backdrop-blur-md rounded-full shadow-md text-white hover:bg-white/50 transition-colors group relative"
                title="Hydration"
             >
                 <GlassWater size={24} />
                 {waterCount > 0 && <span className="absolute -top-1 -right-1 bg-sky-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">{waterCount}</span>}
             </button>

             <button 
                onClick={() => setShowJournal(true)}
                className="p-2 bg-white/30 backdrop-blur-md rounded-full shadow-md text-white hover:bg-white/50 transition-colors"
                title="Shared Journal"
             >
                 <BookHeart size={24} />
             </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`bg-white/70 backdrop-blur-xl rounded-t-[3rem] shadow-[0_-10px_40px_rgba(0,0,0,0.05)] flex flex-col overflow-hidden border-t border-white/40 transition-all duration-500 ${appMode !== AppMode.CHAT ? 'flex-[2.5]' : 'flex-[1.5]'}`}>
        
        {appMode === AppMode.CHAT && (
            <>
                <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
                    {messages.map(msg => <ChatBubble key={msg.id} message={msg} />)}
                    {isProcessing && <div className="text-center text-xs text-soft-brown/60 italic animate-pulse py-2">Laki is thinking...</div>}
                    <div ref={messagesEndRef} />
                </div>
                
                {/* Input Area */}
                <div className="p-4 bg-white/60 backdrop-blur-md">
                    {selectedImage && (
                        <div className="relative inline-block mb-2"><img src={selectedImage} className="h-16 w-16 object-cover rounded-xl border-2 border-white" /><button onClick={() => setSelectedImage(null)} className="absolute -top-1 -right-1 bg-white rounded-full p-0.5"><X size={12}/></button></div>
                    )}
                    <div className="flex items-center gap-2">
                         <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleFileUpload} />
                         <button onClick={() => fileInputRef.current?.click()} className="p-3 text-sky-500/80 bg-white/50 rounded-full"><ImageIcon size={22} /></button>
                         <input 
                            value={inputText} 
                            onChange={handleInputChange} 
                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                            placeholder="Chat with Laki..." 
                            className="flex-1 bg-white/80 border-white rounded-full py-3 px-4 text-soft-brown focus:outline-none shadow-inner"
                        />
                        <button onClick={() => handleSendMessage()} className="p-3 bg-sky-400 text-white rounded-full shadow-md"><Send size={20}/></button>
                    </div>
                </div>
            </>
        )}

        {appMode === AppMode.GAME && (
            <div className="flex flex-col h-full bg-indigo-50/30 relative">
                {/* Game Area */}
                <div className="flex-1 relative overflow-hidden">
                    {gameClouds.map(cloud => (
                         <div
                            key={cloud.id}
                            onClick={() => handleCloudClick(cloud)}
                            className={`absolute transition-all duration-500 cursor-pointer ${cloud.isPopped ? 'scale-0 opacity-0' : 'hover:scale-110 opacity-90'}`}
                            style={{
                                left: `${cloud.x}%`,
                                top: `${cloud.y}%`,
                                transform: `scale(${cloud.scale})`,
                                transitionProperty: 'transform, opacity, left, top',
                            }}
                         >
                             {/* SVG Cloud Shape */}
                             <svg width="80" height="50" viewBox="0 0 100 60" fill={cloud.color} className="drop-shadow-md">
                                <path d="M 25 50 Q 5 50 5 35 Q 5 20 20 20 Q 25 5 40 10 Q 55 0 70 15 Q 90 10 90 30 Q 100 50 80 50 Z" />
                             </svg>
                         </div>
                    ))}

                    {/* Victory Overlay */}
                    {isGameWon && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm z-20 animate-in zoom-in">
                            <div className="text-center">
                                <Trophy size={64} className="text-yellow-400 mx-auto mb-4 animate-bounce" />
                                <h2 className="text-2xl font-bold text-soft-brown mb-4">Focus Master!</h2>
                                <button onClick={startNewGame} className="px-6 py-2 bg-sky-400 text-white rounded-full shadow-lg font-bold hover:bg-sky-500 transition">
                                    Play Again
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Mentor Feedback Area */}
                <div className="h-32 bg-white/60 p-4 border-t border-white/50 backdrop-blur-md">
                     <div className="flex justify-between items-center mb-2">
                        <h3 className="text-xs font-bold text-soft-brown">Mentor Laki</h3>
                        <button onClick={startNewGame} className="text-xs bg-indigo-300 text-white px-3 py-1.5 rounded-full flex items-center gap-1 hover:bg-indigo-400 transition shadow-sm">
                            <RefreshCw size={12}/> Reset Game
                        </button>
                     </div>
                     <p className="text-sm text-gray-600 italic leading-relaxed">{gameFeedback}</p>
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

                     {/* Settings Controls (Only visible when paused) */}
                     {!isTimerRunning && (
                         <div className="flex gap-4 bg-white/40 p-3 rounded-2xl mb-4 animate-in fade-in slide-in-from-bottom-2">
                             <div className="flex flex-col items-center">
                                 <label className="text-[10px] font-bold text-gray-400 uppercase">Focus</label>
                                 <input 
                                    type="number" 
                                    value={focusDuration} 
                                    onChange={(e) => setFocusDuration(Number(e.target.value))} 
                                    className="w-12 text-center bg-white/80 rounded-lg p-1 text-sm font-bold text-soft-brown focus:ring-2 ring-sky-200 outline-none"
                                 />
                             </div>
                             <div className="flex flex-col items-center">
                                 <label className="text-[10px] font-bold text-gray-400 uppercase">Break</label>
                                 <input 
                                    type="number" 
                                    value={breakDuration} 
                                    onChange={(e) => setBreakDuration(Number(e.target.value))} 
                                    className="w-12 text-center bg-white/80 rounded-lg p-1 text-sm font-bold text-soft-brown focus:ring-2 ring-sky-200 outline-none"
                                 />
                             </div>
                         </div>
                     )}

                     {/* Webcam Area */}
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
                
                {/* Gym Sub-Mode Tabs */}
                <div className="flex justify-center p-4 bg-white/50 gap-2">
                    <button onClick={() => setGymSubMode('COMPARE')} className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${gymSubMode === 'COMPARE' ? 'bg-sky-400 text-white shadow-md' : 'bg-white text-gray-400'}`}>
                        <SplitSquareHorizontal size={14} /> Compare
                    </button>
                    <button onClick={() => setGymSubMode('FREE')} className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${gymSubMode === 'FREE' ? 'bg-sky-400 text-white shadow-md' : 'bg-white text-gray-400'}`}>
                        <Camera size={14} /> Free
                    </button>
                    <button onClick={() => setGymSubMode('TIMER')} className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${gymSubMode === 'TIMER' ? 'bg-sky-400 text-white shadow-md' : 'bg-white text-gray-400'}`}>
                        <Timer size={14} /> Timer
                    </button>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center p-4 relative">
                    
                    {/* COMPARE MODE UI */}
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

                    {/* FREE MODE UI */}
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

                    {/* TIMER MODE UI */}
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
                    
                    {/* NEW BUTTON: ASK LUMI FOR PLAN (Only visible in Compare/Free modes when not analyzing) */}
                    {gymSubMode !== 'TIMER' && !gymFeedback && (
                        <div className="absolute top-20 right-4 z-10 animate-in fade-in slide-in-from-right">
                             <button 
                                onClick={handleSmartPlan}
                                className="p-3 bg-gradient-to-r from-green-400 to-emerald-500 text-white rounded-2xl shadow-lg flex flex-col items-center gap-1 hover:scale-105 transition-transform"
                                title="Get Plan from Coach Lumi"
                             >
                                 <ClipboardList size={20} />
                                 <span className="text-[10px] font-bold">Ask Lumi</span>
                             </button>
                        </div>
                    )}

                </div>
                
                {/* Feedback Panel (Only for Camera Modes) */}
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

        {/* Image Gen Modal */}
        {showImgGen && (
          <div className="absolute inset-0 z-50 bg-black/20 backdrop-blur-md flex items-end sm:items-center justify-center p-4">
              <div className="bg-white/90 w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in slide-in-from-bottom-10 border border-white/50 backdrop-blur-xl">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-soft-brown flex items-center gap-2">
                          <Palette size={20} className="text-sky-400"/> Magic Canvas
                      </h3>
                      <button onClick={() => setShowImgGen(false)} className="text-gray-400 hover:text-gray-600 bg-white/50 rounded-full p-2">
                          <X size={20} />
                      </button>
                  </div>
                  
                  <textarea
                    value={imgGenPrompt}
                    onChange={(e) => setImgGenPrompt(e.target.value)}
                    placeholder="Describe what you want Laki to paint..."
                    className="w-full h-24 p-4 bg-white/50 rounded-2xl border border-white focus:ring-2 focus:ring-sky-200/50 resize-none text-sm mb-4 text-gray-600 shadow-inner focus:outline-none"
                  />
                  <div className="flex gap-2 mb-6">
                      {(['1K', '2K', '4K'] as ImageSize[]).map(size => (
                          <button
                            key={size}
                            onClick={() => setImgGenSize(size)}
                            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                                imgGenSize === size 
                                ? 'bg-sky-100 text-sky-600 border border-sky-200 shadow-sm' 
                                : 'bg-white/50 text-gray-400 border border-transparent hover:bg-white'
                            }`}
                          >
                              {size}
                          </button>
                      ))}
                  </div>
                  <button onClick={() => { /* Implementation in previous snippets, assuming handled */ }} className="w-full py-3.5 bg-gradient-to-r from-sky-300 to-sky-400 text-white rounded-xl font-medium shadow-lg hover:shadow-xl disabled:opacity-50 flex justify-center items-center gap-2 transition-transform active:scale-98">
                      <Sparkles size={18} /> Generate Image
                  </button>
              </div>
          </div>
        )}

        {/* Water Modal */}
        {showWaterModal && (
            <div className="absolute inset-0 z-50 bg-black/20 backdrop-blur-md flex items-end sm:items-center justify-center p-4">
                <div className="bg-white/90 w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in slide-in-from-bottom-10 border border-white/50 backdrop-blur-xl">
                     <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="text-lg font-semibold text-soft-brown flex items-center gap-2">
                                <GlassWater size={20} className="text-sky-400"/> Hydration Check
                            </h3>
                            <p className="text-xs text-gray-400 mt-1">Laki loves fresh water!</p>
                        </div>
                        <button onClick={() => setShowWaterModal(false)} className="text-gray-400 hover:text-gray-600 bg-white/50 rounded-full p-2">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex items-center justify-center py-6">
                         <div className="text-center">
                             <div className="text-5xl font-bold text-sky-400 mb-2">{waterCount}</div>
                             <div className="text-xs font-bold text-soft-brown uppercase tracking-wider">Glasses Today</div>
                         </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                         <div className="col-span-2">
                            <button 
                                onClick={handleDrinkWater}
                                className="w-full py-4 bg-sky-100 text-sky-600 rounded-2xl font-bold text-lg hover:bg-sky-200 transition-colors flex items-center justify-center gap-2 active:scale-95 duration-200"
                            >
                                <GlassWater size={24} fill="#0ea5e9" className="text-sky-500" />
                                Drink Water
                            </button>
                         </div>
                    </div>
                </div>
            </div>
        )}
        
        {/* Laki Link (Data Sync) Modal */}
        {showLinkModal && (
            <div className="absolute inset-0 z-50 bg-black/20 backdrop-blur-md flex items-end sm:items-center justify-center p-4">
                <div className="bg-white/95 w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in slide-in-from-bottom-10 border border-white/50 backdrop-blur-xl max-h-[90vh] overflow-y-auto no-scrollbar">
                     <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-lg font-semibold text-soft-brown flex items-center gap-2">
                                <Link size={20} className="text-green-500"/> Laki Link
                            </h3>
                            <p className="text-xs text-gray-400 mt-1">Sync your life data</p>
                        </div>
                        <button onClick={() => setShowLinkModal(false)} className="text-gray-400 hover:text-gray-600 bg-white/50 rounded-full p-2">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="space-y-4">
                        {/* Body Stats */}
                        <div className="bg-orange-50/50 p-4 rounded-2xl border border-orange-100">
                            <h4 className="text-xs font-bold text-orange-400 uppercase tracking-widest mb-3 flex items-center gap-1"><Activity size={12}/> Body Data</h4>
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <input placeholder="Height (cm)" value={userProfile.height} onChange={e => setUserProfile({...userProfile, height: e.target.value})} className="p-2 bg-white rounded-xl text-sm border-0 focus:ring-2 ring-orange-200"/>
                                <input placeholder="Weight (kg)" value={userProfile.weight} onChange={e => setUserProfile({...userProfile, weight: e.target.value})} className="p-2 bg-white rounded-xl text-sm border-0 focus:ring-2 ring-orange-200"/>
                            </div>
                             <div className="mb-3">
                                <input placeholder="Target Weight (kg)" value={userProfile.targetWeight} onChange={e => setUserProfile({...userProfile, targetWeight: e.target.value})} className="w-full p-2 bg-white rounded-xl text-sm border-0 focus:ring-2 ring-orange-200"/>
                             </div>
                            <input placeholder="Fitness Goal (e.g. Lose fat)" value={userProfile.fitnessGoal} onChange={e => setUserProfile({...userProfile, fitnessGoal: e.target.value})} className="w-full p-2 bg-white rounded-xl text-sm border-0 focus:ring-2 ring-orange-200"/>
                        </div>

                        {/* Calendar */}
                        <div className="bg-sky-50/50 p-4 rounded-2xl border border-sky-100">
                             <h4 className="text-xs font-bold text-sky-400 uppercase tracking-widest mb-3 flex items-center gap-1"><CalendarCheck size={12}/> Schedule</h4>
                             <textarea 
                                placeholder="Paste your schedule here (Simulated Calendar Sync)" 
                                value={userProfile.schedule}
                                onChange={e => setUserProfile({...userProfile, schedule: e.target.value})}
                                className="w-full h-20 p-2 bg-white rounded-xl text-sm border-0 focus:ring-2 ring-sky-200 resize-none"
                             />
                        </div>

                        {/* Study Focus */}
                        <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                             <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-1"><BookOpen size={12}/> Study Target</h4>
                             <input placeholder="What are you learning today?" value={userProfile.studyTopic} onChange={e => setUserProfile({...userProfile, studyTopic: e.target.value})} className="w-full p-2 bg-white rounded-xl text-sm border-0 focus:ring-2 ring-indigo-200"/>
                        </div>

                        {/* Health Connect Sim */}
                        <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100 flex justify-between items-center">
                             <div>
                                <h4 className="text-xs font-bold text-rose-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Heart size={12}/> Health Connect</h4>
                                <div className="text-[10px] text-gray-400">Simulated real-time data</div>
                             </div>
                             <div className="text-right">
                                 <div className="text-xl font-bold text-rose-500">{userProfile.heartRate} <span className="text-xs">BPM</span></div>
                             </div>
                        </div>

                        <button 
                            onClick={handleSmartPlan}
                            className="w-full py-4 bg-gradient-to-r from-green-400 to-emerald-500 text-white rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
                        >
                            <Zap size={20} fill="white" />
                            {isGeneratingPlan ? "Thinking..." : "Generate Day Plan"}
                        </button>
                    </div>
                </div>
            </div>
        )}
        
        {/* Journal Sidebar */}
        {showJournal && (
            <div className="absolute inset-0 z-50 flex justify-end">
                {/* Backdrop */}
                <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowJournal(false)}></div>
                
                {/* Sidebar */}
                <div className="relative w-[85%] h-full bg-[#fffdf9] shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col p-6 overflow-hidden">
                    
                    {/* Header */}
                    <div className="flex justify-between items-center mb-6">
                         <h3 className="text-xl font-bold text-soft-brown font-serif tracking-wide flex items-center gap-2">
                             <BookHeart size={24} className="text-rose-400" /> Our Memories
                         </h3>
                         <button onClick={() => setShowJournal(false)} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200">
                             <X size={20} />
                         </button>
                    </div>

                    {/* Generate Button */}
                    <button 
                        onClick={generateJournal}
                        disabled={isWritingJournal}
                        className="mb-6 w-full py-3 border-2 border-dashed border-rose-300 rounded-xl text-rose-400 font-bold flex items-center justify-center gap-2 hover:bg-rose-50 transition-colors disabled:opacity-50"
                    >
                        {isWritingJournal ? <RefreshCw size={18} className="animate-spin" /> : <PenLine size={18} />}
                        {isWritingJournal ? "Writing..." : "Write Today's Entry"}
                    </button>

                    {/* Entries List */}
                    <div className="flex-1 overflow-y-auto pr-2 space-y-6 no-scrollbar">
                        {journalEntries.map(entry => (
                            <div key={entry.id} className="relative pl-6 border-l-2 border-gray-200">
                                <div className="absolute -left-[9px] top-0 w-4 h-4 bg-rose-200 rounded-full border-2 border-white"></div>
                                <div className="text-xs font-bold text-gray-400 mb-1">{entry.date}</div>
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-sm text-soft-brown leading-relaxed font-serif relative">
                                    <span className="absolute top-2 right-2 text-xl">{entry.emoji}</span>
                                    {entry.content}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Footer Decoration */}
                    <div className="mt-4 text-center text-[10px] text-gray-300 uppercase tracking-widest">
                        Laki's Cloud Diary
                    </div>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default App;
