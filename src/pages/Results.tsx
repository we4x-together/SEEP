import { useLocation, Navigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, ArrowLeft, Trophy, Target } from "lucide-react";
import { motion } from "framer-motion";

export default function Results() {
  const { state } = useLocation();
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" />;
  if (!state) return <Navigate to="/dashboard" />;

  const { score, total, answers, questions, examTitle, detailed_answers } = state as {
    score: number;
    total: number;
    answers: Record<string, number>;
    questions: { id: string; question: string; options?: string[]; points: number }[];
    examTitle: string;
    detailed_answers?: any[];
  };

  const percentage = Math.round((score / total) * 100);
  const passed = percentage >= 40;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container max-w-3xl py-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          {/* Score Card */}
          <Card className="mb-8 overflow-hidden shadow-elevated border-border/50">
            <div className={`p-8 text-center ${passed ? "gradient-accent" : "bg-destructive text-destructive-foreground"}`}>
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-background/20">
                {passed ? (
                  <Trophy className="h-10 w-10 text-accent-foreground" />
                ) : (
                  <Target className="h-10 w-10 text-destructive-foreground" />
                )}
              </div>
              <h1 className="text-3xl font-bold">{passed ? "Congratulations!" : "Keep Trying!"}</h1>
              <p className="mt-1 opacity-80">{examTitle}</p>
            </div>
            <CardContent className="p-6">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-3xl font-bold">{score}</p>
                  <p className="text-sm text-muted-foreground">Score</p>
                </div>
                <div>
                  <p className="text-3xl font-bold">{percentage}%</p>
                  <p className="text-sm text-muted-foreground">Percentage</p>
                </div>
                <div>
                  <p className="text-3xl font-bold">{Object.keys(answers).length}/{questions.length}</p>
                  <p className="text-sm text-muted-foreground">Attempted</p>
                </div>
              </div>
              <Progress value={percentage} className="mt-4 h-3" />
            </CardContent>
          </Card>

          {/* Question Review */}
          <h2 className="mb-4 text-xl font-semibold">Question Review</h2>
          <div className="space-y-4">
            {questions.map((q, i) => {
              const userAnswer = answers[q.id];
              const detail = detailed_answers?.find(d => d.question_id === q.id);
              const isCorrect = detail ? detail.is_correct : false;
              const correctAnswer = detail ? detail.correct_answer : null;
              
              return (
                <motion.div
                  key={q.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className={`shadow-soft border-2 ${
                    userAnswer === undefined
                      ? "border-border/50"
                      : isCorrect
                      ? "border-success/30"
                      : "border-destructive/30"
                  }`}>
                    <CardContent className="p-5">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Q{i + 1}</span>
                        {userAnswer === undefined ? (
                          <Badge variant="outline">Skipped</Badge>
                        ) : isCorrect ? (
                          <Badge className="gap-1 bg-success text-success-foreground border-0">
                            <CheckCircle2 className="h-3 w-3" /> Correct
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <XCircle className="h-3 w-3" /> Wrong
                          </Badge>
                        )}
                      </div>
                      <p className="font-medium">{q.question}</p>
                      <div className="mt-3 space-y-2">
                        {q.options?.map((opt, idx) => (
                          <div
                            key={idx}
                            className={`rounded-lg border p-3 text-sm ${
                              idx === correctAnswer
                                ? "border-success/50 bg-success/5 font-medium"
                                : idx === userAnswer && !isCorrect
                                ? "border-destructive/50 bg-destructive/5"
                                : "border-border/30"
                            }`}
                          >
                            <span className="mr-2 font-semibold">{String.fromCharCode(65 + idx)}.</span>
                            {opt}
                            {idx === correctAnswer && <span className="ml-2 text-success">✓</span>}
                            {idx === userAnswer && !isCorrect && <span className="ml-2 text-destructive">✗</span>}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          <div className="mt-8 flex justify-center">
            <Link to="/dashboard">
              <Button className="gap-2 gradient-accent text-accent-foreground border-0">
                <ArrowLeft className="h-4 w-4" /> Back to Dashboard
              </Button>
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
