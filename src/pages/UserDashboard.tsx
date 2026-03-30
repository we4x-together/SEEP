import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/lib/supabase";
import { Exam, UserResult } from "@/types/exam";
import {
  BarChart3, Clock, Trophy, Target, Flame, Play,
  CheckCircle2, XCircle, TrendingUp, BookOpen, Loader2, AlertCircle
} from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect, useMemo } from "react";

const fade = (i: number) => ({
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: i * 0.08, duration: 0.4 },
});

export default function UserDashboard() {
  const { user, isAuthenticated } = useAuth();
  const [exams, setExams] = useState<any[]>([]);
  const [userResults, setUserResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated && user?.role === "user") {
      fetchData();
    }
  }, [isAuthenticated, user]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: examsData, error: examsError } = await supabase
        .from('exams')
        .select('*')
        .eq('status', 'active');

      if (examsError) throw examsError;

      const { data: resultsData, error: resultsError } = await supabase
        .from('user_results')
        .select(`
          *,
          exams (title)
        `)
        .eq('user_id', user?.id)
        .order('completed_at', { ascending: false });

      if (resultsError) throw resultsError;

      const results = (resultsData || []).map((r: any) => ({
        id: r.id,
        examId: r.exam_id,
        examTitle: r.exams?.title || 'Unknown Exam',
        userId: r.user_id,
        score: r.score,
        totalPoints: r.total_points,
        percentage: r.percentage,
        timeTaken: Math.round(r.time_taken / 60),
        completedAt: new Date(r.completed_at).toLocaleDateString(),
        status: r.status
      }));

      setUserResults(results);

      setExams((examsData || []).map((e: any) => {
        const attemptsUsed = results.filter(r => r.examId === e.id).length;
        const attemptsLeft = Math.max(0, (e.max_attempts || 1) - attemptsUsed);
        return {
          id: e.id,
          title: e.title,
          description: e.description,
          category: e.category,
          duration: e.duration,
          totalQuestions: e.total_questions,
          totalPoints: e.total_points,
          difficulty: e.difficulty,
          status: e.status,
          maxAttempts: e.max_attempts || 1,
          attemptsUsed,
          attemptsLeft,
          createdAt: e.created_at
        };
      }));

    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const stats = useMemo(() => {
    if (userResults.length === 0) {
      return {
        examsTaken: 0,
        averageScore: 0,
        bestScore: 0,
        streak: 0,
        recentScores: []
      };
    }

    const scores = userResults.map(r => r.percentage);
    const averageScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const bestScore = Math.max(...scores);
    const recentScores = [...scores].reverse().slice(-7);

    return {
      examsTaken: userResults.length,
      averageScore,
      bestScore,
      streak: 2, 
      recentScores
    };
  }, [userResults]);

  if (!isAuthenticated || user?.role !== "user") return <Navigate to="/login" />;

  const statCards = [
    { label: "Exams Taken", value: stats.examsTaken, icon: BookOpen, color: "text-accent" },
    { label: "Avg Score", value: `${stats.averageScore}%`, icon: Target, color: "text-info" },
    { label: "Best Score", value: `${stats.bestScore}%`, icon: Trophy, color: "text-warning" },
    { label: "Streak", value: `${stats.streak} days`, icon: Flame, color: "text-destructive" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="container py-8">
        <motion.div {...fade(0)} className="mb-8">
          <h1 className="text-3xl font-bold">Welcome back, {user.name} 👋</h1>
          <p className="mt-1 text-muted-foreground">Track your progress and take new exams</p>
        </motion.div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {statCards.map((s, i) => (
                <motion.div key={s.label} {...fade(i + 1)}>
                  <Card className="shadow-soft border-border/50">
                    <CardContent className="flex items-center gap-4 p-5">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-muted ${s.color}`}>
                        <s.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{s.label}</p>
                        <p className="text-2xl font-bold">{s.value}</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Performance Trend */}
            {stats.recentScores.length > 0 && (
              <motion.div {...fade(5)} className="mb-8">
                <Card className="shadow-soft border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <TrendingUp className="h-5 w-5 text-accent" />
                      Performance Trend
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-end gap-2 h-40">
                      {stats.recentScores.map((score, i) => (
                        <motion.div
                          key={i}
                          className="flex-1 rounded-t-md gradient-accent"
                          initial={{ height: 0 }}
                          animate={{ height: `${score}%` }}
                          transition={{ delay: 0.3 + i * 0.1, duration: 0.5 }}
                        />
                      ))}
                    </div>
                    <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                      {stats.recentScores.map((s, i) => (
                        <span key={i}>{s}%</span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            <div className="grid gap-8 lg:grid-cols-2">
              {/* Available Exams */}
              <motion.div {...fade(6)}>
                <Card className="shadow-soft border-border/50 h-full">
                  <CardHeader>
                    <CardTitle className="text-lg">Available Exams</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {exams.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No exams available at the moment.
                      </div>
                    ) : (
                      exams.map((exam) => (
                        <div key={exam.id} className={`flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border border-border/50 p-4 transition-colors ${exam.attemptsLeft === 0 ? 'bg-muted/20 opacity-80' : 'hover:bg-muted/30'}`}>
                          <div className="flex gap-4 mb-4 sm:mb-0">
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${exam.attemptsLeft === 0 ? 'bg-muted text-muted-foreground' : 'bg-muted text-accent'}`}>
                              <BookOpen className="h-5 w-5" />
                            </div>
                            <div>
                              <h3 className="font-semibold">{exam.title}</h3>
                              <p className="text-xs text-muted-foreground">{exam.category} • {exam.duration} mins • {exam.totalQuestions} questions</p>
                              <div className="mt-1 flex items-center gap-2">
                                <Badge variant="outline" className={`text-[10px] h-4 ${exam.attemptsLeft === 0 ? 'text-destructive border-destructive/30' : 'text-success border-success/30'}`}>
                                  {exam.attemptsLeft} attempts left
                                </Badge>
                              </div>
                            </div>
                          </div>
                          
                          {exam.attemptsLeft > 0 ? (
                            <Link to={`/exam/${exam.id}`}>
                              <Button size="sm" className="w-full sm:w-auto gap-2 gradient-accent text-accent-foreground border-0">
                                <Play className="h-4 w-4" /> Start Exam
                              </Button>
                            </Link>
                          ) : (
                            <Button size="sm" variant="ghost" disabled className="w-full sm:w-auto gap-2 bg-muted text-muted-foreground">
                              <AlertCircle className="h-4 w-4" /> Maxed Out
                            </Button>
                          )}
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Recent Results */}
              <motion.div {...fade(7)}>
                <Card className="shadow-soft border-border/50 h-full">
                  <CardHeader>
                    <CardTitle className="text-lg">Recent Performance</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {userResults.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        You haven't taken any exams yet.
                      </div>
                    ) : (
                      userResults.slice(0, 5).map((res) => (
                        <div key={res.id} className="flex items-center justify-between rounded-lg border border-border/50 p-4">
                          <div className="flex gap-4">
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${res.status === 'passed' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                              {res.status === 'passed' ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                            </div>
                            <div>
                              <h3 className="font-semibold">{res.examTitle}</h3>
                              <p className="text-sm text-muted-foreground">{res.completedAt} • {res.score}/{res.totalPoints} pts</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold">{res.percentage}%</div>
                            <Badge variant="outline" className={`text-[10px] h-4 uppercase ${res.status === 'passed' ? 'text-success border-success/30' : 'text-destructive border-destructive/30'}`}>
                              {res.status}
                            </Badge>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
