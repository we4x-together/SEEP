import { useState, useEffect } from "react";
import { useParams, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { motion } from "framer-motion";
import { ArrowLeft, Search, Download, Loader2, Eye } from "lucide-react";
import { toast } from "sonner";

interface StudentResult {
  id: string;
  userId: string;
  userName: string;
  score: number;
  totalPoints: number;
  percentage: number;
  status: "passed" | "failed";
  timeTaken: number;
  completedAt: string;
  answers: any[];
}

interface Question {
  id: string;
  question: string;
  options: string[];
  points: number;
}

export default function ExamAnalytics() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [examTitle, setExamTitle] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [results, setResults] = useState<StudentResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "passed" | "failed">("all");
  const [selectedStudent, setSelectedStudent] = useState<StudentResult | null>(null);

  useEffect(() => {
    if (isAuthenticated && user?.role === "admin" && examId) {
      fetchAnalyticsData();
    }
  }, [isAuthenticated, user, examId]);

  const fetchAnalyticsData = async () => {
    setIsLoading(true);
    try {
      // Fetch exam details
      const { data: examData, error: examError } = await supabase
        .from("exams")
        .select("*")
        .eq("id", examId)
        .single();

      if (examError) throw examError;
      setExamTitle(examData.title);

      // Fetch questions
      const { data: questionsData, error: questionsError } = await supabase
        .from("questions")
        .select("*")
        .eq("exam_id", examId);

      if (questionsError) throw questionsError;
      setQuestions(
        (questionsData || []).map((q: any) => ({
          id: q.id,
          question: q.question,
          options: q.options || [],
          points: q.points,
        }))
      );

      // Fetch results with student info
      const { data: resultsData, error: resultsError } = await supabase
        .from("user_results")
        .select("*, profiles:user_id (full_name)")
        .eq("exam_id", examId)
        .order("completed_at", { ascending: false });

      if (resultsError) throw resultsError;

      setResults(
        (resultsData || []).map((r: any) => ({
          id: r.id,
          userId: r.user_id,
          userName: r.profiles?.full_name || "Anonymous",
          score: r.score,
          totalPoints: r.total_points,
          percentage: r.percentage,
          status: r.status,
          timeTaken: Math.round(r.time_taken / 60),
          completedAt: new Date(r.completed_at).toLocaleDateString(),
          answers: r.answers || [],
        }))
      );
    } catch (error: any) {
      toast.error("Failed to fetch analytics: " + error.message);
      navigate("/admin");
    } finally {
      setIsLoading(false);
    }
  };

  const getAnswerDisplay = (questionId: string, answerIndex: number) => {
    const question = questions.find((q) => q.id === questionId);
    if (!question || !question.options[answerIndex]) return "No Answer";
    return `${String.fromCharCode(65 + answerIndex)}) ${question.options[answerIndex]}`;
  };

  const filteredResults = results.filter((r) => {
    const matchesSearch =
      r.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.id.includes(searchTerm);
    const matchesStatus =
      filterStatus === "all" || r.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  if (!isAuthenticated || user?.role !== "admin") return <Navigate to="/login" />;
  if (isLoading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-accent" />
      </div>
    );

  if (selectedStudent) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <main className="container py-8">
          <Button
            variant="outline"
            className="mb-6 gap-2"
            onClick={() => setSelectedStudent(null)}
          >
            <ArrowLeft className="h-4 w-4" /> Back to Results
          </Button>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selectedStudent.userName}'s Answers</CardTitle>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Exam: {examTitle}
                    </p>
                  </div>
                  <div className="text-right space-y-2">
                    <div className="text-3xl font-bold">
                      {selectedStudent.score}/{selectedStudent.totalPoints}
                    </div>
                    <Badge
                      className={
                        selectedStudent.status === "passed"
                          ? "bg-success text-success-foreground"
                          : "bg-destructive text-destructive-foreground"
                      }
                    >
                      {selectedStudent.status.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground uppercase font-semibold">
                      Percentage
                    </p>
                    <p className="text-xl font-bold">
                      {selectedStudent.percentage.toFixed(1)}%
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground uppercase font-semibold">
                      Time Taken
                    </p>
                    <p className="text-xl font-bold">
                      {selectedStudent.timeTaken} mins
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground uppercase font-semibold">
                      Completed
                    </p>
                    <p className="text-sm font-bold">
                      {selectedStudent.completedAt}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground uppercase font-semibold">
                      Questions
                    </p>
                    <p className="text-xl font-bold">{questions.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Question Answers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {questions.map((question, index) => {
                  const studentAnswer = selectedStudent.answers.find(
                    (a: any) => a.question_id === question.id
                  );
                  const isCorrect = studentAnswer?.is_correct;

                  return (
                    <div
                      key={question.id}
                      className="space-y-3 border-b pb-4 last:border-0"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-semibold text-foreground">
                            Q{index + 1}. {question.question}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Points: {question.points}
                          </p>
                        </div>
                        <Badge
                          className={
                            isCorrect
                              ? "bg-success text-success-foreground"
                              : "bg-destructive text-destructive-foreground"
                          }
                        >
                          {isCorrect ? "✓ Correct" : "✗ Wrong"}
                        </Badge>
                      </div>

                      <div className="space-y-2 pl-4">
                        <div className="rounded-lg bg-muted/30 p-3">
                          <p className="text-xs text-muted-foreground mb-1 uppercase font-semibold">
                            Student's Answer:
                          </p>
                          <p className="font-medium">
                            {studentAnswer
                              ? getAnswerDisplay(
                                  question.id,
                                  studentAnswer.answer
                                )
                              : "No Answer"}
                          </p>
                        </div>

                        {!isCorrect && (
                          <div className="rounded-lg bg-success/10 p-3 border border-success/20">
                            <p className="text-xs text-success mb-1 uppercase font-semibold">
                              Correct Answer:
                            </p>
                            <p className="font-medium text-success">
                              {getAnswerDisplay(
                                question.id,
                                studentAnswer?.correct_answer || 0
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="container py-8">
        <Button
          variant="outline"
          className="mb-6 gap-2"
          onClick={() => navigate("/admin")}
        >
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div>
            <h1 className="text-3xl font-bold">{examTitle} - Analytics</h1>
            <p className="mt-1 text-muted-foreground">
              View student answers and performance
            </p>
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-lg">Student Results</CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  const data = filteredResults.map((r) => ({
                    Name: r.userName,
                    Score: `${r.score}/${r.totalPoints}`,
                    Percentage: `${r.percentage.toFixed(1)}%`,
                    Status: r.status,
                    "Time Taken": `${r.timeTaken} mins`,
                    "Completed At": r.completedAt,
                  }));
                  const csv =
                    "data:text/csv;charset=utf-8," +
                    Object.keys(data[0]).join(",") +
                    "\n" +
                    data
                      .map((row) =>
                        Object.values(row)
                          .map((val) => `"${val}"`)
                          .join(",")
                      )
                      .join("\n");
                  const link = document.createElement("a");
                  link.setAttribute("href", encodeURI(csv));
                  link.setAttribute(
                    "download",
                    `${examTitle}_analytics.csv`
                  );
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
              >
                <Download className="h-4 w-4" /> Export CSV
              </Button>
            </CardHeader>

            <CardContent>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search student name..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="passed">Passed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student Name</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Percentage</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Time Taken</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredResults.map((result) => (
                      <TableRow key={result.id}>
                        <TableCell className="font-medium">
                          {result.userName}
                        </TableCell>
                        <TableCell>
                          {result.score}/{result.totalPoints}
                        </TableCell>
                        <TableCell>
                          {result.percentage.toFixed(1)}%
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              result.status === "passed"
                                ? "bg-success text-success-foreground"
                                : "bg-destructive text-destructive-foreground"
                            }
                          >
                            {result.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{result.timeTaken} mins</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-2"
                            onClick={() => setSelectedStudent(result)}
                          >
                            <Eye className="h-4 w-4" /> View Answers
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {filteredResults.length === 0 && (
                <div className="py-8 text-center text-muted-foreground">
                  No results found
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
