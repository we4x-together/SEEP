export interface ExamQuestion {
  id: string;
  type: "mcq" | "dsa";
  question: string;
  options?: string[];
  correctAnswer?: number;
  points: number;
  codeTemplate?: string;
  testCases?: { input: string; output: string }[];
}

export interface Exam {
  id: string;
  title: string;
  description: string;
  category: "MCQ" | "DSA";
  duration: number; // minutes
  totalQuestions: number;
  totalPoints: number;
  difficulty: "Easy" | "Medium" | "Hard";
  status: "active" | "draft" | "archived";
  createdAt: string;
}

export interface UserResult {
  id: string;
  examId: string;
  examTitle: string;
  userId: string;
  userName: string;
  score: number;
  totalPoints: number;
  percentage: number;
  timeTaken: number;
  completedAt: string;
  status: "passed" | "failed";
}

export interface UserStats {
  totalExams: number;
  averageScore: number;
  bestScore: number;
  totalTime: number;
  examsTaken: number;
  streak: number;
  recentScores: number[];
}
