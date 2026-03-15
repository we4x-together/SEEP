import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { Exam } from "@/types/exam";
import {
  Users, FileText, BarChart3, Plus, Search,
  Edit, Trash2, Eye, Download, TrendingUp, Loader2,
  RefreshCw, UserCheck, UserPlus, Shield, User as UserIcon
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { toast } from "sonner";

const fade = (i: number) => ({
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: i * 0.08, duration: 0.4 },
});

export default function AdminDashboard() {
  const { user, isAuthenticated } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedExamId, setSelectedExamId] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"exams" | "results" | "users">("exams");
  const [exams, setExams] = useState<Exam[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);

  // Add User State
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', fullName: '', role: 'user' as 'user' | 'admin' });

  useEffect(() => {
    if (isAuthenticated && user?.role === "admin") {
      fetchData();
    }
  }, [isAuthenticated, user]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: examsData } = await supabase.from('exams').select('*').order('created_at', { ascending: false });
      const { data: resultsData } = await supabase.from('user_results').select('*, exams (title), profiles:user_id (full_name, avatar_url)').order('completed_at', { ascending: false });
      const { data: profilesData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });

      setExams((examsData || []).map((e: any) => ({
        id: e.id, title: e.title, description: e.description, category: e.category,
        duration: e.duration, totalQuestions: e.total_questions, totalPoints: e.total_points,
        difficulty: e.difficulty, status: e.status, createdAt: e.created_at
      })));

      setResults((resultsData || []).map((r: any) => ({
        id: r.id, examId: r.exam_id, examTitle: r.exams?.title || 'Unknown Exam',
        userId: r.user_id, userName: r.profiles?.full_name || 'Anonymous Student',
        avatarUrl: r.profiles?.avatar_url, score: r.score, totalPoints: r.total_points,
        percentage: r.percentage, timeTaken: Math.round(r.time_taken / 60),
        completedAt: new Date(r.completed_at).toLocaleDateString(), status: r.status
      })));

      setUsers(profilesData || []);
    } catch (error: any) {
      toast.error("Failed to fetch data: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadCSV = (data: any[], filename: string) => {
    if (!data.length) return toast.error("No data to export");
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map(obj => Object.values(obj).map(val => `"${val}"`).join(",")).join("\n");
    const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleExamStatus = async (examId: string, currentStatus: string) => {
    setIsActionLoading(examId);
    const newStatus = currentStatus === 'active' ? 'draft' : 'active';
    try {
      await supabase.from('exams').update({ status: newStatus }).eq('id', examId);
      setExams(exams.map(e => e.id === examId ? { ...e, status: newStatus as any } : e));
      toast.success(`Exam set to ${newStatus}`);
    } catch (error: any) {
      toast.error("Update failed: " + error.message);
    } finally {
      setIsActionLoading(null);
    }
  };

  const deleteExam = async (examId: string) => {
    if (!confirm("Are you sure? All questions and results will be lost.")) return;
    setIsActionLoading(examId);
    try {
      await supabase.from('exams').delete().eq('id', examId);
      setExams(exams.filter(e => e.id !== examId));
      toast.success("Exam deleted");
    } catch (error: any) {
      toast.error("Delete failed: " + error.message);
    } finally {
      setIsActionLoading(null);
    }
  };

  const updateUserRole = async (userId: string, newRole: 'user' | 'admin') => {
    setIsActionLoading(userId);
    try {
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
      if (error) throw error;
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      toast.success(`User role updated to ${newRole}`);
    } catch (error: any) {
      toast.error("Failed to update role: " + error.message);
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleAddUser = async () => {
    if (!newUser.email || !newUser.password || !newUser.fullName) return toast.error("Fill all fields");
    setIsActionLoading("adding_user");
    try {
      const { data, error } = await supabase.auth.signUp({
        email: newUser.email,
        password: newUser.password,
        options: { data: { name: newUser.fullName, role: newUser.role } }
      });
      if (error) throw error;
      toast.success("User added successfully!");
      setIsAddUserOpen(false);
      fetchData(); // Refresh list
    } catch (error: any) {
      toast.error("Signup failed: " + error.message);
    } finally {
      setIsActionLoading(null);
    }
  };

  if (!isAuthenticated || user?.role !== "admin") return <Navigate to="/login" />;

  const filteredExams = exams.filter(e => e.title.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredResults = results.filter(r => 
    (selectedExamId === "all" || r.examId === selectedExamId) &&
    (r.userName.toLowerCase().includes(searchTerm.toLowerCase()) || r.examTitle.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  const filteredUsers = users.filter(u => 
    (u.full_name || "").toLowerCase().includes(searchTerm.toLowerCase()) || (u.role || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="container py-8">
        <motion.div {...fade(0)} className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="mt-1 text-muted-foreground">Manage exams, students, and system settings</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchData} className="gap-2"><RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh</Button>
            <Link to="/admin/create-exam"><Button className="gap-2 gradient-accent text-accent-foreground border-0"><Plus className="h-4 w-4" /> Create Exam</Button></Link>
          </div>
        </motion.div>

        {/* Tabs + Search */}
        <motion.div {...fade(5)} className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {(["exams", "results", "users"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${activeTab === tab ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {activeTab === "results" && (
              <Select value={selectedExamId} onValueChange={setSelectedExamId}>
                <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="All Exams" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Exams</SelectItem>
                  {exams.map(e => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <div className="relative w-full lg:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder={`Search ${activeTab}...`} className="pl-10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            {activeTab === "users" && (
              <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                <DialogTrigger asChild><Button className="gap-2"><UserPlus className="h-4 w-4" /> Add User</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add New User</DialogTitle><DialogDescription>Create a new student or admin account manually.</DialogDescription></DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2"><Label>Full Name</Label><Input value={newUser.fullName} onChange={e => setNewUser({...newUser, fullName: e.target.value})} /></div>
                    <div className="space-y-2"><Label>Email Address</Label><Input type="email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} /></div>
                    <div className="space-y-2"><Label>Password</Label><Input type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} /></div>
                    <div className="space-y-2"><Label>Role</Label><Select value={newUser.role} onValueChange={v => setNewUser({...newUser, role: v as any})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="user">Student (User)</SelectItem><SelectItem value="admin">Administrator</SelectItem></SelectContent></Select></div>
                  </div>
                  <DialogFooter><Button onClick={handleAddUser} disabled={isActionLoading === "adding_user"}>{isActionLoading === "adding_user" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create User"}</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </motion.div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {activeTab === "exams" && (
            <motion.div key="exams" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full">
                <thead><tr className="border-b bg-muted/20">
                  <th className="p-4 text-left text-xs font-semibold uppercase text-muted-foreground">Title</th>
                  <th className="p-4 text-left text-xs font-semibold uppercase text-muted-foreground">Category</th>
                  <th className="p-4 text-left text-xs font-semibold uppercase text-muted-foreground">Difficulty</th>
                  <th className="p-4 text-left text-xs font-semibold uppercase text-muted-foreground">Status</th>
                  <th className="p-4 text-right text-xs font-semibold uppercase text-muted-foreground">Actions</th>
                </tr></thead>
                <tbody>{filteredExams.map(exam => (
                  <tr key={exam.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-4 font-medium">{exam.title}</td>
                    <td className="p-4"><Badge variant={exam.category === "DSA" ? "default" : "secondary"}>{exam.category}</Badge></td>
                    <td className="p-4"><Badge variant="outline">{exam.difficulty}</Badge></td>
                    <td className="p-4"><Badge className={exam.status === "active" ? "bg-success text-success-foreground cursor-pointer" : "bg-warning text-warning-foreground cursor-pointer"} onClick={() => toggleExamStatus(exam.id, exam.status)}>{exam.status}</Badge></td>
                    <td className="p-4 text-right flex justify-end gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => {
                          const examResults = results.filter(r => r.examId === exam.id);
                          downloadCSV(examResults, `${exam.title.replace(/\s+/g, '_')}_results`);
                        }}
                        title="Download Exam Results"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Link to={`/admin/edit-exam/${exam.id}`}><Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button></Link>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteExam(exam.id)}><Trash2 className="h-4 w-4" /></Button>
                    </td>
                  </tr>
                ))}</tbody>
              </table></div></CardContent></Card>
            </motion.div>
          )}

          {activeTab === "results" && (
            <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Card><CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-lg">Exam Results</CardTitle>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => downloadCSV(filteredResults, "exam_results")}><Download className="h-4 w-4" /> Export CSV</Button>
              </CardHeader>
              <CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full">
                <thead><tr className="border-b bg-muted/20">
                  <th className="p-4 text-left text-xs font-semibold uppercase text-muted-foreground">Student</th>
                  <th className="p-4 text-left text-xs font-semibold uppercase text-muted-foreground">Exam</th>
                  <th className="p-4 text-left text-xs font-semibold uppercase text-muted-foreground">Score</th>
                  <th className="p-4 text-left text-xs font-semibold uppercase text-muted-foreground">Status</th>
                  <th className="p-4 text-right text-xs font-semibold uppercase text-muted-foreground">Date</th>
                </tr></thead>
                <tbody>{filteredResults.map(r => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-4"><div className="flex items-center gap-3"><div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-xs uppercase">{r.userName.charAt(0)}</div><span>{r.userName}</span></div></td>
                    <td className="p-4 text-muted-foreground">{r.examTitle}</td>
                    <td className="p-4 font-bold">{r.score}/{r.totalPoints} ({r.percentage}%)</td>
                    <td className="p-4"><Badge className={r.status === "passed" ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}>{r.status}</Badge></td>
                    <td className="p-4 text-right text-muted-foreground text-xs">{r.completedAt}</td>
                  </tr>
                ))}</tbody>
              </table></div></CardContent></Card>
            </motion.div>
          )}

          {activeTab === "users" && (
            <motion.div key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Card><CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-lg">User Management</CardTitle>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => downloadCSV(filteredUsers, "system_users")}><Download className="h-4 w-4" /> Export CSV</Button>
              </CardHeader>
              <CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full">
                <thead><tr className="border-b bg-muted/20">
                  <th className="p-4 text-left text-xs font-semibold uppercase text-muted-foreground">Name</th>
                  <th className="p-4 text-left text-xs font-semibold uppercase text-muted-foreground">Role</th>
                  <th className="p-4 text-left text-xs font-semibold uppercase text-muted-foreground">Joined</th>
                  <th className="p-4 text-right text-xs font-semibold uppercase text-muted-foreground">Actions</th>
                </tr></thead>
                <tbody>{filteredUsers.map(u => (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-4"><div className="flex items-center gap-2"><span>{u.full_name}</span></div></td>
                    <td className="p-4"><Badge variant={u.role === 'admin' ? 'default' : 'outline'} className={u.role === 'admin' ? 'bg-accent text-accent-foreground' : ''}>{u.role}</Badge></td>
                    <td className="p-4 text-muted-foreground text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="p-4 text-right flex justify-end gap-2">
                      {u.role === 'user' ? 
                        <Button variant="ghost" size="sm" className="h-8 gap-1 text-accent" onClick={() => updateUserRole(u.id, 'admin')}><Shield className="h-3 w-3" /> Make Admin</Button> :
                        <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={() => updateUserRole(u.id, 'user')}><UserIcon className="h-3 w-3" /> Revoke Admin</Button>
                      }
                    </td>
                  </tr>
                ))}</tbody>
              </table></div></CardContent></Card>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
