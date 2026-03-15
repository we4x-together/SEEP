import { useState, useEffect } from "react";
import { useNavigate, useParams, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Plus, Trash2, GripVertical, CheckCircle2, BookOpen, Code2, Save, Loader2, Repeat, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface MCQQuestion {
  id: string;
  db_id?: string;
  question: string;
  options: string[];
  correctAnswer: number;
  points: number;
}

interface DSAQuestion {
  id: string;
  db_id?: string;
  title: string;
  description: string;
  codeTemplate: string;
  testCases: { input: string; output: string }[];
  points: number;
}

export default function EditExam() {
  const { examId } = useParams();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<"details" | "questions" | "review">("details");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Exam details
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"MCQ" | "DSA">("MCQ");
  const [difficulty, setDifficulty] = useState<"Easy" | "Medium" | "Hard">("Easy");
  const [duration, setDuration] = useState("30");
  const [maxAttempts, setMaxAttempts] = useState("1");

  // Questions
  const [mcqQuestions, setMcqQuestions] = useState<MCQQuestion[]>([]);
  const [dsaQuestions, setDsaQuestions] = useState<DSAQuestion[]>([]);

  useEffect(() => {
    if (isAuthenticated && user?.role === "admin" && examId) {
      fetchExamData();
    }
  }, [isAuthenticated, user, examId]);

  const fetchExamData = async () => {
    setIsLoading(true);
    try {
      const { data: exam, error: examError } = await supabase.from('exams').select('*').eq('id', examId).single();
      if (examError) throw examError;

      setTitle(exam.title);
      setDescription(exam.description);
      setCategory(exam.category);
      setDifficulty(exam.difficulty);
      setDuration(exam.duration.toString());
      setMaxAttempts((exam.max_attempts || 1).toString());

      const { data: questions, error: qError } = await supabase.from('questions').select('*, question_answers(*)').eq('exam_id', examId);
      if (qError) throw qError;

      if (exam.category === "MCQ") {
        setMcqQuestions(questions.map(q => ({
          id: Math.random().toString(36).substr(2, 9),
          db_id: q.id,
          question: q.question,
          options: q.options,
          correctAnswer: q.question_answers[0]?.correct_answer || 0,
          points: q.points
        })));
      } else {
        setDsaQuestions(questions.map(q => {
          const parts = q.question.split("\n\n");
          return {
            id: Math.random().toString(36).substr(2, 9),
            db_id: q.id,
            title: parts[0] || "",
            description: parts.slice(1).join("\n\n") || "",
            codeTemplate: q.code_template,
            testCases: q.question_answers[0]?.test_cases || [],
            points: q.points
          };
        }));
      }
    } catch (error: any) {
      toast.error("Failed to load exam: " + error.message);
      navigate("/admin");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async (status: 'active' | 'draft') => {
    setIsSaving(true);
    try {
      // 1. Update Exam
      const { error: examError } = await supabase.from('exams').update({
        title, description, category, duration: parseInt(duration),
        max_attempts: parseInt(maxAttempts),
        total_questions: category === "MCQ" ? mcqQuestions.length : dsaQuestions.length,
        total_points: category === "MCQ" ? mcqQuestions.reduce((s, q) => s + q.points, 0) : dsaQuestions.reduce((s, q) => s + q.points, 0),
        difficulty, status
      }).eq('id', examId);

      if (examError) throw examError;

      // 2. Delete existing questions
      await supabase.from('questions').delete().eq('exam_id', examId);

      // 3. Re-insert questions
      if (category === "MCQ") {
        for (const q of mcqQuestions) {
          const { data: qData } = await supabase.from('questions').insert({
            exam_id: examId, type: 'mcq', question: q.question, options: q.options, points: q.points
          }).select().single();
          await supabase.from('question_answers').insert({ question_id: qData.id, correct_answer: q.correctAnswer });
        }
      } else {
        for (const q of dsaQuestions) {
          const { data: qData } = await supabase.from('questions').insert({
            exam_id: examId, type: 'dsa', question: q.title + "\n\n" + q.description, code_template: q.codeTemplate, points: q.points
          }).select().single();
          await supabase.from('question_answers').insert({ question_id: qData.id, test_cases: q.testCases });
        }
      }

      toast.success("Exam updated successfully!");
      navigate("/admin");
    } catch (error: any) {
      toast.error("Update failed: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAuthenticated || user?.role !== "admin") return <Navigate to="/login" />;
  if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="container max-w-4xl py-8">
        <div className="mb-8 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/admin")}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
          <h1 className="text-2xl font-bold line-clamp-1">Edit: {title}</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleUpdate('draft')} disabled={isSaving}>Save Draft</Button>
            <Button onClick={() => handleUpdate('active')} disabled={isSaving} className="gradient-accent text-accent-foreground border-0">Update & Publish</Button>
          </div>
        </div>

        <div className="space-y-6">
          <Card className="shadow-soft border-border/50">
            <CardHeader><CardTitle className="text-lg">Basic Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label>Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
              <div className="space-y-2"><Label>Description</Label><Textarea value={description} rows={3} onChange={e => setDescription(e.target.value)} /></div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2"><Label>Difficulty</Label><Select value={difficulty} onValueChange={(v: any) => setDifficulty(v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Easy">Easy</SelectItem><SelectItem value="Medium">Medium</SelectItem><SelectItem value="Hard">Hard</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>Duration (min)</Label><div className="relative"><Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input type="number" className="pl-9" value={duration} onChange={e => setDuration(e.target.value)} /></div></div>
                <div className="space-y-2"><Label>Max Attempts</Label><div className="relative"><Repeat className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input type="number" className="pl-9" value={maxAttempts} onChange={e => setMaxAttempts(e.target.value)} /></div></div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
             <div className="flex items-center justify-between"><h3 className="text-xl font-bold">Questions ({category})</h3><Badge variant="secondary">{category === "MCQ" ? mcqQuestions.length : dsaQuestions.length} Total</Badge></div>
             {category === "MCQ" ? (
               mcqQuestions.map((q, i) => (
                 <Card key={q.id} className="shadow-soft border-border/50"><CardContent className="p-5 space-y-4">
                   <div className="flex justify-between items-center"><div className="flex items-center gap-2"><GripVertical className="h-4 w-4 text-muted-foreground" /><Badge variant="outline">Q{i+1}</Badge></div><div className="flex items-center gap-3"><div className="flex items-center gap-1.5"><Label className="text-xs">Points:</Label><Input type="number" className="h-8 w-16 text-center" value={q.points} onChange={e => {const n = [...mcqQuestions]; n[i].points = Number(e.target.value); setMcqQuestions(n);}} /></div><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setMcqQuestions(mcqQuestions.filter(x => x.id !== q.id))}><Trash2 className="h-4 w-4" /></Button></div></div>
                   <Textarea placeholder="Enter question..." value={q.question} onChange={e => {const n = [...mcqQuestions]; n[i].question = e.target.value; setMcqQuestions(n);}} />
                   <div className="space-y-2">
                     {q.options.map((opt, oi) => (
                       <div key={oi} className="flex gap-2">
                         <button onClick={() => {const n = [...mcqQuestions]; n[i].correctAnswer = oi; setMcqQuestions(n);}} className={`h-10 w-10 shrink-0 border rounded-lg font-bold transition-all ${q.correctAnswer === oi ? 'bg-accent text-accent-foreground border-accent' : 'bg-muted text-muted-foreground'}`}>{String.fromCharCode(65+oi)}</button>
                         <Input value={opt} onChange={e => {const n = [...mcqQuestions]; n[i].options[oi] = e.target.value; setMcqQuestions(n);}} />
                       </div>
                     ))}
                   </div>
                 </CardContent></Card>
               ))
             ) : (
               dsaQuestions.map((q, i) => (
                 <Card key={q.id} className="shadow-soft border-border/50"><CardContent className="p-5 space-y-4">
                   <div className="flex justify-between items-center"><div className="flex items-center gap-2"><GripVertical className="h-4 w-4 text-muted-foreground" /><Badge className="gradient-primary">Problem {i+1}</Badge></div><Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDsaQuestions(dsaQuestions.filter(x => x.id !== q.id))}><Trash2 className="h-4 w-4" /></Button></div>
                   <Input placeholder="Problem Title" value={q.title} onChange={e => {const n = [...dsaQuestions]; n[i].title = e.target.value; setDsaQuestions(n);}} />
                   <Textarea placeholder="Problem Description..." value={q.description} rows={4} onChange={e => {const n = [...dsaQuestions]; n[i].description = e.target.value; setDsaQuestions(n);}} />
                 </CardContent></Card>
               ))
             )}
             <Button variant="outline" className="w-full border-dashed gap-2 h-12" onClick={() => {
               if (category === "MCQ") setMcqQuestions([...mcqQuestions, { id: Math.random().toString(), question: "", options: ["","","",""], correctAnswer: 0, points: 10 }]);
               else setDsaQuestions([...dsaQuestions, { id: Math.random().toString(), title: "", description: "", codeTemplate: "// Template", testCases: [], points: 100 }]);
             }}><Plus className="h-4 w-4" /> Add New Question</Button>
          </div>
        </div>
      </main>
    </div>
  );
}
