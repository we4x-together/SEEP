import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/lib/supabase";
import { Exam, ExamQuestion } from "@/types/exam";
import { Clock, ChevronLeft, ChevronRight, Flag, Loader2, AlertTriangle, Maximize, ShieldAlert, CheckCircle2, Timer } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export default function ExamInterface() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Security: Out of fullscreen timer
  const [fsViolationTime, setFsViolationTime] = useState<number>(10);
  const violationTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isAuthenticated && examId) {
      fetchExamData();
    }
    
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      if (violationTimerRef.current) clearInterval(violationTimerRef.current);
    };
  }, [isAuthenticated, examId]);

  // Handle Fullscreen Violation Logic
  useEffect(() => {
    if (!hasStarted || submitted) return;

    if (!isFullscreen) {
      // Start 10s countdown
      setFsViolationTime(10);
      violationTimerRef.current = setInterval(() => {
        setFsViolationTime(prev => {
          if (prev <= 1) {
            if (violationTimerRef.current) clearInterval(violationTimerRef.current);
            handleSecurityAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      // Clear countdown if they return
      if (violationTimerRef.current) {
        clearInterval(violationTimerRef.current);
        violationTimerRef.current = null;
      }
    }

    return () => {
      if (violationTimerRef.current) clearInterval(violationTimerRef.current);
    };
  }, [isFullscreen, hasStarted, submitted]);

  const fetchExamData = async () => {
    setIsLoading(true);
    try {
      const { data: examData, error: examError } = await supabase
        .from('exams')
        .select('*')
        .eq('id', examId)
        .single();

      if (examError) throw examError;

      const { data: qData, error: qError } = await supabase
        .from('questions')
        .select('*')
        .eq('exam_id', examId);

      if (qError) throw qError;

      setExam({
        id: examData.id,
        title: examData.title,
        description: examData.description,
        category: examData.category,
        duration: examData.duration,
        totalQuestions: examData.total_questions,
        totalPoints: examData.total_points,
        difficulty: examData.difficulty,
        status: examData.status,
        createdAt: examData.created_at
      });

      setQuestions((qData || []).map((q: any) => ({
        id: q.id,
        type: q.type,
        question: q.question,
        options: q.options,
        points: q.points,
        codeTemplate: q.code_template
      })));

    } catch (error: any) {
      toast.error("Failed to load exam: " + error.message);
      navigate("/dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  const startExam = async () => {
    try {
      await document.documentElement.requestFullscreen();
      
      let { data: attempt } = await supabase
        .from('exam_attempts')
        .select('*')
        .eq('exam_id', examId)
        .eq('user_id', user?.id)
        .eq('status', 'in_progress')
        .maybeSingle();

      if (!attempt) {
        const { data: newAttempt, error: createError } = await supabase
          .from('exam_attempts')
          .insert({ exam_id: examId, user_id: user?.id, status: 'in_progress' })
          .select()
          .single();
        if (createError) throw createError;
        attempt = newAttempt;
      }

      const startTime = new Date(attempt.started_at).getTime();
      const elapsedSeconds = Math.floor((new Date().getTime() - startTime) / 1000);
      const remaining = (exam?.duration || 0) * 60 - elapsedSeconds;

      if (remaining <= 0) {
        toast.error("Time has already expired.");
        navigate("/dashboard");
        return;
      }

      setTimeLeft(remaining);
      setHasStarted(true);
      setIsFullscreen(true);
    } catch (err: any) {
      toast.error("Please enable fullscreen to start the exam.");
    }
  };

  const handleSecurityAutoSubmit = () => {
    toast.error("Security Violation: You remained out of fullscreen for too long. Submitting exam...");
    handleSubmit(true);
  };

  const handleSubmit = useCallback(async (isAutoSubmit = false) => {
    if (submitted || !exam || !user) return;
    setSubmitted(true);
    
    if (violationTimerRef.current) clearInterval(violationTimerRef.current);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }

    if (isAutoSubmit && timeLeft && timeLeft > 0) {
        // Only show if it wasn't a normal timeout
        toast.info("Submitting your exam automatically...");
    }

    try {
      const { data, error } = await supabase.rpc('submit_exam', {
        p_exam_id: exam.id,
        p_answers: answers,
        p_time_taken: Math.max(0, (exam.duration * 60) - (timeLeft || 0))
      });

      if (error) throw error;

      navigate("/results", {
        state: { 
          score: data.score, 
          total: data.total_points, 
          answers, 
          questions, 
          examTitle: exam.title,
          percentage: data.percentage,
          status: data.status,
          detailed_answers: data.detailed_answers
        },
      });
    } catch (error: any) {
      toast.error("Submission failed: " + error.message);
      setSubmitted(false);
    }
  }, [answers, questions, submitted, navigate, exam, user, timeLeft]);

  useEffect(() => {
    if (!hasStarted || timeLeft === null || submitted) return;

    if (timeLeft <= 0) {
      handleSubmit(true);
      return;
    }

    const timer = setInterval(() => setTimeLeft(prev => (prev && prev > 0 ? prev - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, submitted, hasStarted, handleSubmit]);

  if (!isAuthenticated) return <Navigate to="/login" />;
  if (isLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-accent" /></div>;
  if (!exam) return <Navigate to="/dashboard" />;

  // Disclaimer Screen
  if (!hasStarted) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl w-full">
          <Card className="shadow-elevated border-border/50">
            <CardHeader className="bg-accent/5 border-b border-border/50 p-6">
              <div className="flex items-center gap-3 mb-2">
                <ShieldAlert className="h-6 w-6 text-accent" />
                <CardTitle className="text-2xl">Exam Instructions</CardTitle>
              </div>
              <p className="text-muted-foreground">Please read carefully before starting the examination.</p>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/30">
                  <Clock className="h-5 w-5 text-accent" />
                  <div><p className="text-xs text-muted-foreground uppercase font-semibold">Duration</p><p className="font-bold">{exam.duration} Minutes</p></div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/30">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <div><p className="text-xs text-muted-foreground uppercase font-semibold">Total Questions</p><p className="font-bold">{exam.totalQuestions} Questions</p></div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold flex items-center gap-2 text-foreground"><AlertTriangle className="h-4 w-4 text-warning" /> Security Protocols:</h4>
                <ul className="space-y-3 text-sm text-muted-foreground list-disc pl-5">
                  <li><strong>Fullscreen Lockdown:</strong> The exam requires continuous full-screen.</li>
                  <li><strong>10-Second Warning:</strong> If you exit full-screen, you have <strong>10 seconds</strong> to return before automatic submission.</li>
                  <li><strong>No Switching:</strong> Tab switching or minimizing will trigger the security blocker.</li>
                  <li><strong>Proctoring:</strong> All session interruptions are logged for administrative review.</li>
                </ul>
              </div>

              <div className="pt-4 flex flex-col gap-3">
                <Button size="lg" className="w-full gradient-accent text-accent-foreground font-bold h-12 text-lg shadow-lg" onClick={startExam}>
                  <Maximize className="mr-2 h-5 w-5" /> Agree & Start Exam
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => navigate("/dashboard")}>Cancel and Go Back</Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Fullscreen Warning Overlay
  const showFsBlocker = !isFullscreen && hasStarted && !submitted;

  return (
    <div className="min-h-screen bg-background select-none">
      <AnimatePresence>
        {showFsBlocker && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md flex items-center justify-center p-6 text-center">
            <div className="max-w-md space-y-6">
              <div className="mx-auto h-24 w-24 rounded-full bg-destructive/10 flex items-center justify-center relative">
                <ShieldAlert className="h-12 w-12 text-destructive animate-pulse" />
                <div className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground h-10 w-10 rounded-full flex items-center justify-center font-bold text-xl border-4 border-background">
                  {fsViolationTime}
                </div>
              </div>
              <h2 className="text-3xl font-bold text-foreground">Security Alert!</h2>
              <p className="text-muted-foreground text-lg">
                You have exited full-screen mode. Return within <strong>{fsViolationTime} seconds</strong> or your exam will be automatically submitted.
              </p>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <motion.div initial={{ width: "100%" }} animate={{ width: `${(fsViolationTime / 10) * 100}%` }} transition={{ duration: 1, ease: "linear" }} className="bg-destructive h-full" />
              </div>
              <Button size="lg" className="w-full gradient-accent h-14 text-xl shadow-xl" onClick={() => document.documentElement.requestFullscreen()}>
                <Maximize className="mr-2 h-6 w-6" /> Resume Exam Now
              </Button>
              <p className="text-xs text-muted-foreground italic flex items-center justify-center gap-1">
                <Timer className="h-3 w-3" /> Automatic submission in progress...
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="sticky top-0 z-50 border-b border-border/50 bg-card/90 backdrop-blur-md">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold sm:text-base line-clamp-1">{exam.title}</h1>
            <Badge variant="outline" className="hidden sm:inline-flex">{exam.category}</Badge>
          </div>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-mono font-semibold ${
              (timeLeft || 0) < 60 ? "bg-destructive/10 text-destructive animate-pulse" : "bg-muted text-foreground"
            }`}>
              <Clock className="h-4 w-4" />
              {timeLeft !== null && Math.floor(timeLeft / 60)}:{(timeLeft || 0) % 60 < 10 ? "0" : ""}{(timeLeft || 0) % 60}
            </div>
            <Button size="sm" variant="destructive" onClick={() => handleSubmit(false)} className="gap-1">
              <Flag className="h-3 w-3" /> Submit
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-3xl py-8">
        <div className="mb-6">
          <div className="mb-2 flex justify-between text-sm text-muted-foreground">
            <span>Question {currentQ + 1} of {questions.length}</span>
            <span>{Object.keys(answers).length} answered</span>
          </div>
          <Progress value={((currentQ + 1) / questions.length) * 100} className="h-2" />
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={currentQ} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
            <Card className="shadow-card border-border/50 mb-6">
              <CardContent className="p-6">
                <h2 className="text-xl font-bold mb-6 whitespace-pre-wrap">{questions[currentQ]?.question}</h2>
                <div className="grid gap-3">
                  {questions[currentQ]?.options?.map((option, idx) => (
                    <button key={idx} onClick={() => setAnswers({ ...answers, [questions[currentQ].id]: idx })}
                      className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                        answers[questions[currentQ].id] === idx ? "border-accent bg-accent/5 ring-1 ring-accent" : "border-border/50 hover:border-accent/30 hover:bg-muted/50"
                      }`}>
                      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                        answers[questions[currentQ].id] === idx ? "border-accent bg-accent text-accent-foreground" : "border-border text-muted-foreground"
                      }`}>{String.fromCharCode(65 + idx)}</div>
                      <span className="font-medium">{option}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => setCurrentQ(c => Math.max(0, c - 1))} disabled={currentQ === 0} className="gap-2"><ChevronLeft className="h-4 w-4" /> Previous</Button>
          <div className="hidden gap-1.5 sm:flex">
            {questions.map((_, i) => (
              <button key={i} onClick={() => setCurrentQ(i)} className={`h-2.5 w-2.5 rounded-full transition-all ${currentQ === i ? "bg-accent scale-125" : answers[questions[i].id] !== undefined ? "bg-accent/40" : "bg-muted"}`} />
            ))}
          </div>
          <Button onClick={() => currentQ < questions.length - 1 ? setCurrentQ(c => c + 1) : handleSubmit(false)} className="gap-2 gradient-accent border-0 text-accent-foreground font-semibold">
            {currentQ === questions.length - 1 ? "Finish" : "Next"} <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </main>
    </div>
  );
}
