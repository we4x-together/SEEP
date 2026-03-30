import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Plus, Trash2, GripVertical,
  CheckCircle2, BookOpen, Code2, Save, Eye, Loader2, Repeat, Clock
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface MCQQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  points: number;
}

interface DSAQuestion {
  id: string;
  title: string;
  description: string;
  codeTemplate: string;
  testCases: { input: string; output: string }[];
  points: number;
}

type Step = "details" | "questions" | "review";

export default function CreateExam() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("details");

  // Exam details
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"MCQ" | "DSA">("MCQ");
  const [difficulty, setDifficulty] = useState<"Easy" | "Medium" | "Hard">("Easy");
  const [duration, setDuration] = useState("30");
  const [maxAttempts, setMaxAttempts] = useState("1");

  // Questions
  const [mcqQuestions, setMcqQuestions] = useState<MCQQuestion[]>([
    { id: "1", question: "", options: ["", "", "", ""], correctAnswer: 0, points: 10 },
  ]);
  const [dsaQuestions, setDsaQuestions] = useState<DSAQuestion[]>([
    { id: "1", title: "", description: "", codeTemplate: "function solution() {\n  // Write your code here\n}", testCases: [{ input: "", output: "" }], points: 100 },
  ]);

  if (!isAuthenticated || user?.role !== "admin") return <Navigate to="/login" />;

  const steps: { key: Step; label: string; num: number }[] = [
    { key: "details", label: "Exam Details", num: 1 },
    { key: "questions", label: "Add Questions", num: 2 },
    { key: "review", label: "Review & Publish", num: 3 },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === step);

  const canProceedDetails = title.trim() && description.trim() && duration && maxAttempts;

  // MCQ helpers
  const addMCQ = () => {
    setMcqQuestions((q) => [
      ...q,
      { id: String(Date.now()), question: "", options: ["", "", "", ""], correctAnswer: 0, points: 10 },
    ]);
  };

  const removeMCQ = (id: string) => {
    if (mcqQuestions.length <= 1) return;
    setMcqQuestions((q) => q.filter((x) => x.id !== id));
  };

  const updateMCQ = (id: string, field: string, value: string | number | string[]) => {
    setMcqQuestions((q) =>
      q.map((x) => (x.id === id ? { ...x, [field]: value } : x))
    );
  };

  const updateMCQOption = (qId: string, optIdx: number, value: string) => {
    setMcqQuestions((q) =>
      q.map((x) =>
        x.id === qId
          ? { ...x, options: x.options.map((o, i) => (i === optIdx ? value : o)) }
          : x
      )
    );
  };

  // DSA helpers
  const addDSA = () => {
    setDsaQuestions((q) => [
      ...q,
      { id: String(Date.now()), title: "", description: "", codeTemplate: "function solution() {\n  // Write your code here\n}", testCases: [{ input: "", output: "" }], points: 100 },
    ]);
  };

  const removeDSA = (id: string) => {
    if (dsaQuestions.length <= 1) return;
    setDsaQuestions((q) => q.filter((x) => x.id !== id));
  };

  const updateDSA = (id: string, field: string, value: string | number) => {
    setDsaQuestions((q) =>
      q.map((x) => (x.id === id ? { ...x, [field]: value } : x))
    );
  };

  const addTestCase = (qId: string) => {
    setDsaQuestions((q) =>
      q.map((x) =>
        x.id === qId ? { ...x, testCases: [...x.testCases, { input: "", output: "" }] } : x
      )
    );
  };

  const removeTestCase = (qId: string, tcIdx: number) => {
    setDsaQuestions((q) =>
      q.map((x) =>
        x.id === qId
          ? { ...x, testCases: x.testCases.filter((_, i) => i !== tcIdx) }
          : x
      )
    );
  };

  const updateTestCase = (qId: string, tcIdx: number, field: "input" | "output", value: string) => {
    setDsaQuestions((q) =>
      q.map((x) =>
        x.id === qId
          ? {
              ...x,
              testCases: x.testCases.map((tc, i) =>
                i === tcIdx ? { ...tc, [field]: value } : tc
              ),
            }
          : x
      )
    );
  };

  const totalPoints =
    category === "MCQ"
      ? mcqQuestions.reduce((s, q) => s + q.points, 0)
      : dsaQuestions.reduce((s, q) => s + q.points, 0);

  const totalQuestions = category === "MCQ" ? mcqQuestions.length : dsaQuestions.length;

  const [isSaving, setIsSaving] = useState(false);

  const saveExamData = async (status: 'active' | 'draft') => {
    setIsSaving(true);
    try {
      // 1. Save Exam
      const { data: examData, error: examError } = await supabase
        .from('exams')
        .insert({
          title,
          description,
          category,
          duration: parseInt(duration),
          max_attempts: parseInt(maxAttempts),
          total_questions: totalQuestions,
          total_points: totalPoints,
          difficulty,
          status
        })
        .select()
        .single();

      if (examError) throw examError;

      // 2. Save Questions and Answers
      if (category === "MCQ") {
        for (const q of mcqQuestions) {
          const { data: qData, error: qError } = await supabase
            .from('questions')
            .insert({
              exam_id: examData.id,
              type: 'mcq',
              question: q.question,
              options: q.options,
              points: q.points
            })
            .select()
            .single();

          if (qError) throw qError;

          const { error: aError } = await supabase
            .from('question_answers')
            .insert({
              question_id: qData.id,
              correct_answer: q.correctAnswer
            });

          if (aError) throw aError;
        }
      } else {
        for (const q of dsaQuestions) {
          const { data: qData, error: qError } = await supabase
            .from('questions')
            .insert({
              exam_id: examData.id,
              type: 'dsa',
              question: q.title + "\n\n" + q.description,
              code_template: q.codeTemplate,
              points: q.points
            })
            .select()
            .single();

          if (qError) throw qError;

          const { error: aError } = await supabase
            .from('question_answers')
            .insert({
              question_id: qData.id,
              test_cases: q.testCases
            });

          if (aError) throw aError;
        }
      }

      toast.success(status === 'active' ? "Exam published successfully!" : "Draft saved!");
      navigate("/admin");
    } catch (error: any) {
      console.error("Error saving exam:", error);
      toast.error(`Failed to save: ${error.message || "Unknown error"}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = () => saveExamData('active');
  const handleSaveDraft = () => saveExamData('draft');

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="container max-w-4xl py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Button variant="ghost" className="mb-4 gap-2 text-muted-foreground" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold">Create New Exam</h1>
          <p className="mt-1 text-muted-foreground">Set up exam details, add questions, then publish</p>
        </motion.div>

        {/* Stepper */}
        <div className="mb-8 flex items-center justify-center gap-2 text-foreground">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (i < currentStepIndex) setStep(s.key);
                }}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                  step === s.key
                    ? "gradient-accent text-accent-foreground shadow-sm"
                    : i < currentStepIndex
                    ? "bg-accent/10 text-accent"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i < currentStepIndex ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-background/20 text-xs">{s.num}</span>
                )}
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < steps.length - 1 && (
                <div className={`h-px w-8 ${i < currentStepIndex ? "bg-accent" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          {step === "details" && (
            <motion.div
              key="details"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              <Card className="shadow-card border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">Exam Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="title">Exam Title</Label>
                    <Input
                      id="title"
                      placeholder="e.g. Data Structures Fundamentals"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="desc">Description</Label>
                    <Textarea
                      id="desc"
                      placeholder="Describe what this exam covers..."
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-4">
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select value={category} onValueChange={(v) => setCategory(v as "MCQ" | "DSA")}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MCQ">
                            <span className="flex items-center gap-2"><BookOpen className="h-4 w-4" /> MCQ</span>
                          </SelectItem>
                          <SelectItem value="DSA">
                            <span className="flex items-center gap-2"><Code2 className="h-4 w-4" /> DSA Coding</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Difficulty</Label>
                      <Select value={difficulty} onValueChange={(v) => setDifficulty(v as "Easy" | "Medium" | "Hard")}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Easy">Easy</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="Hard">Hard</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="duration">Duration (min)</Label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="duration"
                          type="number"
                          min="1"
                          className="pl-9"
                          value={duration}
                          onChange={(e) => setDuration(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="attempts">Max Attempts</Label>
                      <div className="relative">
                        <Repeat className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="attempts"
                          type="number"
                          min="1"
                          className="pl-9"
                          value={maxAttempts}
                          onChange={(e) => setMaxAttempts(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={() => setStep("questions")}
                      disabled={!canProceedDetails}
                      className="gap-2 gradient-accent text-accent-foreground border-0"
                    >
                      Next: Add Questions <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === "questions" && category === "MCQ" && (
            <motion.div
              key="mcq-questions"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              {mcqQuestions.map((q, qi) => (
                <Card key={q.id} className="shadow-soft border-border/50">
                  <CardContent className="p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <Badge variant="outline">Q{qi + 1}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <Label className="text-xs text-muted-foreground">Points:</Label>
                          <Input
                            type="number"
                            min="1"
                            className="h-8 w-16 text-center text-sm"
                            value={q.points}
                            onChange={(e) => updateMCQ(q.id, "points", Number(e.target.value))}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => removeMCQ(q.id)}
                          disabled={mcqQuestions.length <= 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Question</Label>
                        <Textarea
                          placeholder="Enter your question here..."
                          rows={2}
                          value={q.question}
                          onChange={(e) => updateMCQ(q.id, "question", e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Options</Label>
                        <div className="space-y-2">
                          {q.options.map((opt, oi) => (
                            <div key={oi} className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => updateMCQ(q.id, "correctAnswer", oi)}
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all ${
                                  q.correctAnswer === oi
                                    ? "gradient-accent text-accent-foreground"
                                    : "bg-muted text-muted-foreground hover:bg-accent/20"
                                }`}
                                title="Mark as correct answer"
                              >
                                {String.fromCharCode(65 + oi)}
                              </button>
                              <Input
                                placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                                value={opt}
                                onChange={(e) => updateMCQOption(q.id, oi, e.target.value)}
                              />
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Click a letter to mark it as the correct answer. Currently: <strong>Option {String.fromCharCode(65 + q.correctAnswer)}</strong>
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Button variant="outline" onClick={addMCQ} className="w-full gap-2 border-dashed">
                <Plus className="h-4 w-4" /> Add Question
              </Button>

              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" onClick={() => setStep("details")} className="gap-2">
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <div className="text-sm text-muted-foreground">
                  {mcqQuestions.length} questions · {totalPoints} total points
                </div>
                <Button onClick={() => setStep("review")} className="gap-2 gradient-accent text-accent-foreground border-0">
                  Next: Review <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === "questions" && category === "DSA" && (
            <motion.div
              key="dsa-questions"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              {dsaQuestions.map((q, qi) => (
                <Card key={q.id} className="shadow-soft border-border/50">
                  <CardContent className="p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <Badge variant="outline" className="gradient-primary text-primary-foreground border-0">
                          Problem {qi + 1}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <Label className="text-xs text-muted-foreground">Points:</Label>
                          <Input
                            type="number"
                            min="1"
                            className="h-8 w-16 text-center text-sm"
                            value={q.points}
                            onChange={(e) => updateDSA(q.id, "points", Number(e.target.value))}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => removeDSA(q.id)}
                          disabled={dsaQuestions.length <= 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Problem Title</Label>
                        <Input
                          placeholder="e.g. Two Sum"
                          value={q.title}
                          onChange={(e) => updateDSA(q.id, "title", e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Problem Description</Label>
                        <Textarea
                          placeholder="Describe the problem, input/output format, constraints..."
                          rows={4}
                          value={q.description}
                          onChange={(e) => updateDSA(q.id, "description", e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Code Template</Label>
                        <Textarea
                          className="font-mono text-sm"
                          rows={5}
                          value={q.codeTemplate}
                          onChange={(e) => updateDSA(q.id, "codeTemplate", e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Test Cases</Label>
                          <Button variant="ghost" size="sm" onClick={() => addTestCase(q.id)} className="gap-1 text-xs">
                            <Plus className="h-3 w-3" /> Add
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {q.testCases.map((tc, tci) => (
                            <div key={tci} className="flex items-start gap-2 rounded-lg border border-border/50 p-3">
                              <div className="flex-1 grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-xs text-muted-foreground">Input</Label>
                                  <Input
                                    className="font-mono text-sm"
                                    placeholder="[2, 7, 11, 15], 9"
                                    value={tc.input}
                                    onChange={(e) => updateTestCase(q.id, tci, "input", e.target.value)}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground">Expected Output</Label>
                                  <Input
                                    className="font-mono text-sm"
                                    placeholder="[0, 1]"
                                    value={tc.output}
                                    onChange={(e) => updateTestCase(q.id, tci, "output", e.target.value)}
                                  />
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="mt-5 h-8 w-8 text-destructive"
                                onClick={() => removeTestCase(q.id, tci)}
                                disabled={q.testCases.length <= 1}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Button variant="outline" onClick={addDSA} className="w-full gap-2 border-dashed">
                <Plus className="h-4 w-4" /> Add Problem
              </Button>

              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" onClick={() => setStep("details")} className="gap-2">
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <div className="text-sm text-muted-foreground">
                  {dsaQuestions.length} problems · {totalPoints} total points
                </div>
                <Button onClick={() => setStep("review")} className="gap-2 gradient-accent text-accent-foreground border-0">
                  Next: Review <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === "review" && (
            <motion.div
              key="review"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <Card className="shadow-card border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">Exam Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-muted-foreground">Title</p>
                        <p className="font-semibold">{title}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Description</p>
                        <p className="text-sm">{description}</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <Badge className={category === "DSA" ? "gradient-primary text-primary-foreground border-0" : ""}>{category}</Badge>
                        <Badge variant="outline">{difficulty}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Duration</p>
                          <p className="font-semibold">{duration} minutes</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Max Attempts</p>
                          <p className="font-semibold">{maxAttempts} attempts</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Questions</p>
                        <p className="font-semibold">{totalQuestions} questions · {totalPoints} points</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Question Preview */}
              <Card className="shadow-soft border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">Questions Preview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {category === "MCQ"
                    ? mcqQuestions.map((q, i) => (
                        <div key={q.id} className="rounded-lg border border-border/50 p-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Q{i + 1}. {q.question || "Untitled"}</span>
                            <Badge variant="outline">{q.points} pts</Badge>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-1.5">
                            {q.options.map((o, oi) => (
                              <span
                                key={oi}
                                className={`rounded px-2 py-1 text-xs ${
                                  oi === q.correctAnswer
                                    ? "bg-success/10 text-success font-medium"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {String.fromCharCode(65 + oi)}. {o || "—"}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))
                    : dsaQuestions.map((q, i) => (
                        <div key={q.id} className="rounded-lg border border-border/50 p-4">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">Problem {i + 1}: {q.title || "Untitled"}</span>
                            <Badge variant="outline">{q.points} pts</Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                            {q.description || "No description"}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {q.testCases.length} test case{q.testCases.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                      ))}
                </CardContent>
              </Card>

              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" onClick={() => setStep("questions")} className="gap-2">
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleSaveDraft} className="gap-2" disabled={isSaving}>
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Draft
                  </Button>
                  <Button onClick={handlePublish} className="gap-2 gradient-accent text-accent-foreground border-0" disabled={isSaving}>
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Publish Exam
                  </Button>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
