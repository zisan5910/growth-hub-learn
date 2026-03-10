import { useState, useEffect, useRef } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp } from "firebase/firestore";
import { examDb } from "@/lib/examFirebase";
import { db } from "@/lib/firebase";
import { Exam, ExamQuestion, ExamType, ExamSubmission } from "@/types/exam";
import { Course } from "@/types";
import { toast } from "sonner";
import { Trash2, Edit, Eye, Plus, Upload, ChevronDown, ChevronUp, X, Image, Download, ExternalLink, FileText, Trophy, CheckCircle, XCircle } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminExamsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [editExam, setEditExam] = useState<Exam | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [resultsExam, setResultsExam] = useState<Exam | null>(null);
  const [submissions, setSubmissions] = useState<ExamSubmission[]>([]);
  const [activeTab, setActiveTab] = useState("exams");
  const [filterCourse, setFilterCourse] = useState("");

  const fetchExams = async () => {
    setLoading(true);
    const snap = await getDocs(collection(examDb, "exams"));
    setExams(snap.docs.map(d => ({ id: d.id, ...d.data() } as Exam)));
    setLoading(false);
  };

  const fetchCourses = async () => {
    const snap = await getDocs(collection(db, "courses"));
    setCourses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Course)));
  };

  useEffect(() => { fetchExams(); fetchCourses(); }, []);

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(examDb, "exams", id));
    toast.success("Exam deleted");
    fetchExams();
  };

  const viewResults = async (exam: Exam) => {
    setResultsExam(exam);
    const snap = await getDocs(collection(examDb, "submissions"));
    const subs = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as ExamSubmission))
      .filter(s => s.examId === exam.id)
      .sort((a, b) => b.obtainedMarks - a.obtainedMarks);
    setSubmissions(subs);
    setActiveTab("results");
  };

  const downloadRankingPDF = () => {
    if (!resultsExam || submissions.length === 0) return;
    const passMark = resultsExam.passMark || 0;
    
    let html = `<html><head><meta charset="utf-8"><title>${resultsExam.title} - Rankings</title>
    <style>
      body { font-family: 'Segoe UI', sans-serif; padding: 40px; color: #333; }
      h1 { font-size: 22px; margin-bottom: 4px; }
      h2 { font-size: 14px; color: #666; margin-bottom: 20px; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th { background: #f5f5f5; text-align: left; padding: 10px; border-bottom: 2px solid #ddd; }
      td { padding: 10px; border-bottom: 1px solid #eee; }
      .pass { color: #2e7d32; font-weight: 600; }
      .fail { color: #c62828; font-weight: 600; }
    </style></head><body>
    <h1>${resultsExam.title}</h1>
    <h2>${resultsExam.courseName} • Total Marks: ${resultsExam.totalMarks} • Pass Mark: ${passMark}</h2>
    <table>
      <tr><th>Rank</th><th>Name</th><th>Email</th><th>Marks</th><th>Correct</th><th>Wrong</th><th>Status</th></tr>`;
    
    submissions.forEach((sub, idx) => {
      const passed = sub.obtainedMarks >= passMark;
      html += `<tr>
        <td>${idx + 1}</td><td>${sub.userName}</td><td>${sub.userEmail}</td>
        <td>${sub.obtainedMarks}/${sub.totalMarks}</td><td>${sub.correctCount}</td><td>${sub.wrongCount}</td>
        <td class="${passed ? 'pass' : 'fail'}">${passed ? 'Pass' : 'Fail'}</td>
      </tr>`;
    });
    html += `</table></body></html>`;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => { printWindow.print(); };
    }
  };

  const filteredExams = filterCourse ? exams.filter(e => e.courseId === filterCourse) : exams;

  return (
    <div className="p-4 max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-foreground">Exam Management</h1>
        <button onClick={() => { setEditExam(null); setCreateOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
          <Plus className="h-4 w-4" /> Create Exam
        </button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full mb-4">
          <TabsTrigger value="exams" className="flex-1">Exams</TabsTrigger>
          <TabsTrigger value="results" className="flex-1">Results</TabsTrigger>
        </TabsList>

        <TabsContent value="exams">
          {/* Course filter */}
          <select value={filterCourse} onChange={e => setFilterCourse(e.target.value)} className="w-full px-4 py-2.5 rounded-lg bg-card border border-border text-foreground text-sm mb-4">
            <option value="">All Courses</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.courseName}</option>)}
          </select>

          {loading ? (
            <p className="text-muted-foreground text-sm text-center py-8">Loading...</p>
          ) : filteredExams.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">No exams yet</p>
          ) : (
            <div className="space-y-3">
              {filteredExams.map(exam => (
                <div key={exam.id} className="bg-card border border-border rounded-xl p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-foreground">{exam.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{exam.courseName} • {exam.type.toUpperCase()} • {exam.questions?.length || 0} Q • {exam.totalMarks} Marks</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Pass: {exam.passMark || 0} • Negative: {exam.negativeMark || 0} per wrong
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {exam.startTime?.toDate?.()?.toLocaleString()} → {exam.endTime?.toDate?.()?.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">Duration: {exam.duration} min</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => viewResults(exam)} className="p-2 hover:bg-accent rounded-lg"><Eye className="h-4 w-4 text-muted-foreground" /></button>
                      <button onClick={() => { setEditExam(exam); setCreateOpen(true); }} className="p-2 hover:bg-accent rounded-lg"><Edit className="h-4 w-4 text-muted-foreground" /></button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild><button className="p-2 hover:bg-accent rounded-lg"><Trash2 className="h-4 w-4 text-destructive" /></button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Delete Exam</AlertDialogTitle><AlertDialogDescription>Are you sure?</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(exam.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="results">
          {resultsExam ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-foreground">{resultsExam.title} - Results ({submissions.length})</h3>
                <div className="flex gap-2">
                  <button onClick={downloadRankingPDF} className="flex items-center gap-1 px-3 py-1.5 bg-accent border border-border rounded-lg text-xs font-medium text-foreground">
                    <Download className="h-3 w-3" /> Download PDF
                  </button>
                  <button onClick={() => setResultsExam(null)} className="text-sm text-muted-foreground hover:text-foreground">Back</button>
                </div>
              </div>
              {submissions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No submissions yet</p>
              ) : (
                <div className="space-y-2">
                  {submissions.map((sub, idx) => {
                    const passed = sub.obtainedMarks >= (resultsExam.passMark || 0);
                    return (
                      <div key={sub.id} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${idx < 3 ? "bg-primary text-primary-foreground" : "bg-accent text-foreground"}`}>{idx + 1}</span>
                          <div>
                            <p className="text-sm font-medium text-foreground">{sub.userName}</p>
                            <p className="text-xs text-muted-foreground">{sub.userEmail}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-foreground">{sub.obtainedMarks}/{sub.totalMarks}</p>
                          <div className="flex items-center gap-2 justify-end">
                            <p className="text-xs text-muted-foreground">✓{sub.correctCount} ✗{sub.wrongCount}</p>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${passed ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-red-500/10 text-destructive"}`}>
                              {passed ? "Pass" : "Fail"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div>
              <select value={filterCourse} onChange={e => setFilterCourse(e.target.value)} className="w-full px-4 py-2.5 rounded-lg bg-card border border-border text-foreground text-sm mb-3">
                <option value="">All Courses</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.courseName}</option>)}
              </select>
              <div className="space-y-2">
                {filteredExams.map(exam => (
                  <button key={exam.id} onClick={() => viewResults(exam)} className="w-full text-left bg-card border border-border rounded-xl p-3 hover:bg-accent transition-colors">
                    <p className="text-sm font-medium text-foreground">{exam.title}</p>
                    <p className="text-xs text-muted-foreground">{exam.courseName} • {exam.questions?.length || 0} Q</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {createOpen && (
        <ExamFormDialog
          open={createOpen}
          onClose={() => { setCreateOpen(false); setEditExam(null); }}
          exam={editExam}
          courses={courses}
          onSaved={fetchExams}
        />
      )}
    </div>
  );
}

/* ============================================
   Exam Form Dialog (styled like AddVideoPage)
   ============================================ */
function ExamFormDialog({ open, onClose, exam, courses, onSaved }: {
  open: boolean; onClose: () => void; exam: Exam | null; courses: Course[]; onSaved: () => void;
}) {
  const [title, setTitle] = useState(exam?.title || "");
  const [courseId, setCourseId] = useState(exam?.courseId || "");
  const [type, setType] = useState<ExamType>(exam?.type || "mcq");
  const [duration, setDuration] = useState(exam?.duration || 30);
  const [negativeMark, setNegativeMark] = useState(exam?.negativeMark || 0);
  const [passMark, setPassMark] = useState(exam?.passMark || 0);
  const [startTime, setStartTime] = useState(exam?.startTime?.toDate?.()?.toISOString().slice(0, 16) || "");
  const [endTime, setEndTime] = useState(exam?.endTime?.toDate?.()?.toISOString().slice(0, 16) || "");
  const [questions, setQuestions] = useState<ExamQuestion[]>(exam?.questions || []);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const selectedCourse = courses.find(c => c.id === courseId);

  const addQuestion = () => {
    const newQ: ExamQuestion = {
      id: Date.now().toString(),
      questionText: "",
      type,
      options: type === "mcq" ? [{ text: "" }, { text: "" }, { text: "" }, { text: "" }] : undefined,
      correctAnswer: type === "mcq" ? 0 : undefined,
      marks: 1,
    };
    setQuestions([...questions, newQ]);
  };

  const updateQuestion = (idx: number, updates: Partial<ExamQuestion>) => {
    const updated = [...questions];
    updated[idx] = { ...updated[idx], ...updates };
    setQuestions(updated);
  };

  const removeQuestion = (idx: number) => setQuestions(questions.filter((_, i) => i !== idx));

  const updateOption = (qIdx: number, oIdx: number, text: string) => {
    const updated = [...questions];
    if (updated[qIdx].options) {
      updated[qIdx].options![oIdx] = { ...updated[qIdx].options![oIdx], text };
      setQuestions(updated);
    }
  };

  const updateOptionImage = (qIdx: number, oIdx: number, image: string) => {
    const updated = [...questions];
    if (updated[qIdx].options) {
      updated[qIdx].options![oIdx] = { ...updated[qIdx].options![oIdx], image };
      setQuestions(updated);
    }
  };

  const addOption = (qIdx: number) => {
    const updated = [...questions];
    if (updated[qIdx].options) {
      updated[qIdx].options!.push({ text: "" });
      setQuestions(updated);
    }
  };

  const removeOption = (qIdx: number, oIdx: number) => {
    const updated = [...questions];
    if (updated[qIdx].options && updated[qIdx].options!.length > 2) {
      updated[qIdx].options!.splice(oIdx, 1);
      if ((updated[qIdx].correctAnswer || 0) >= updated[qIdx].options!.length) {
        updated[qIdx].correctAnswer = 0;
      }
      setQuestions(updated);
    }
  };

  const downloadTemplate = (format: "json" | "csv") => {
    if (format === "json") {
      const template = [
        {
          question: "What is 2+2?",
          questionImage: "",
          option1: "3",
          option1Image: "",
          option2: "4",
          option2Image: "",
          option3: "5",
          option3Image: "",
          option4: "6",
          option4Image: "",
          correct: 1,
          marks: 1
        },
        {
          question: "Capital of Bangladesh?",
          questionImage: "",
          option1: "Chittagong",
          option1Image: "",
          option2: "Dhaka",
          option2Image: "",
          option3: "Sylhet",
          option3Image: "",
          option4: "Rajshahi",
          option4Image: "",
          correct: 1,
          marks: 1
        }
      ];
      const blob = new Blob([JSON.stringify(template, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "exam_questions_template.json"; a.click();
      URL.revokeObjectURL(url);
    } else {
      const csv = `question,questionImage,option1,option1Image,option2,option2Image,option3,option3Image,option4,option4Image,correct,marks
"What is 2+2?","","3","","4","","5","","6","",1,1
"Capital of Bangladesh?","","Chittagong","","Dhaka","","Sylhet","","Rajshahi","",1,1`;
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "exam_questions_template.csv"; a.click();
      URL.revokeObjectURL(url);
    }
    toast.success(`${format.toUpperCase()} template downloaded`);
  };

  const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        let parsed: any[];
        if (file.name.endsWith(".json")) {
          parsed = JSON.parse(text);
        } else {
          const lines = text.split("\n").filter(l => l.trim());
          const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/"/g, ''));
          parsed = lines.slice(1).map(line => {
            // Handle CSV with quoted values
            const values: string[] = [];
            let current = '';
            let inQuotes = false;
            for (const char of line) {
              if (char === '"') { inQuotes = !inQuotes; }
              else if (char === ',' && !inQuotes) { values.push(current.trim()); current = ''; }
              else { current += char; }
            }
            values.push(current.trim());
            const obj: any = {};
            headers.forEach((h, i) => obj[h] = values[i] || "");
            return obj;
          });
        }
        const newQuestions: ExamQuestion[] = parsed.map((item, idx) => ({
          id: (Date.now() + idx).toString(),
          questionText: item.question || item.questionText || "",
          questionImage: item.questionImage || item.image || "",
          type: type,
          options: type === "mcq" ? [
            { text: item.option1 || item.a || "", image: item.option1Image || item.option1image || "" },
            { text: item.option2 || item.b || "", image: item.option2Image || item.option2image || "" },
            { text: item.option3 || item.c || "", image: item.option3Image || item.option3image || "" },
            { text: item.option4 || item.d || "", image: item.option4Image || item.option4image || "" },
          ].filter(o => o.text) : undefined,
          correctAnswer: type === "mcq" ? parseInt(item.correct || item.correctAnswer || "0") : undefined,
          marks: parseInt(item.marks || "1"),
        }));
        setQuestions(prev => [...prev, ...newQuestions]);
        toast.success(`${newQuestions.length} questions imported`);
      } catch {
        toast.error("Failed to parse file");
      }
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSave = async () => {
    if (!title || !courseId || !startTime || !endTime) {
      toast.error("Please fill all required fields");
      return;
    }
    setSaving(true);
    const totalMarks = questions.reduce((s, q) => s + q.marks, 0);
    const data = {
      title,
      courseId,
      courseName: selectedCourse?.courseName || "",
      type,
      duration,
      totalMarks,
      negativeMark,
      passMark,
      startTime: Timestamp.fromDate(new Date(startTime)),
      endTime: Timestamp.fromDate(new Date(endTime)),
      questions,
      createdAt: exam?.createdAt || Timestamp.now(),
    };
    try {
      if (exam) {
        await updateDoc(doc(examDb, "exams", exam.id), data);
        toast.success("Exam updated");
      } else {
        await addDoc(collection(examDb, "exams"), data);
        toast.success("Exam created");
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {exam ? "Edit Exam" : "Create New Exam"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Basic Info Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">1</span>
              Basic Information
            </h3>
            <div className="ml-8 space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Exam Title *</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Enter exam title" className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Course *</label>
                <select value={courseId} onChange={e => setCourseId(e.target.value)} className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all">
                  <option value="">Select Course</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.courseName}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Type</label>
                  <select value={type} onChange={e => setType(e.target.value as ExamType)} className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all">
                    <option value="mcq">MCQ</option>
                    <option value="written">Written</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Duration (min)</label>
                  <input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
                </div>
              </div>
            </div>
          </div>

          {/* Marks Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">2</span>
              Marks Settings
            </h3>
            <div className="ml-8 grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Pass Mark</label>
                <input type="number" value={passMark} onChange={e => setPassMark(Number(e.target.value))} placeholder="0" className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Negative Mark (per wrong)</label>
                <input type="number" step="0.25" value={negativeMark} onChange={e => setNegativeMark(Number(e.target.value))} placeholder="0" className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
              </div>
            </div>
          </div>

          {/* Schedule Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">3</span>
              Schedule
            </h3>
            <div className="ml-8 grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Start Time *</label>
                <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">End Time *</label>
                <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
              </div>
            </div>
          </div>

          {/* Questions Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">4</span>
              Questions ({questions.length})
            </h3>
            <div className="ml-8">
              {/* Bulk import area */}
              <div className="bg-accent/50 border border-dashed border-border rounded-xl p-4 mb-4">
                <p className="text-sm font-medium text-foreground mb-2">Bulk Import Questions</p>
                <p className="text-xs text-muted-foreground mb-3">Download the template, add your questions, then upload the file.</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  <button onClick={() => downloadTemplate("json")} className="flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border rounded-lg text-xs font-medium text-foreground hover:bg-accent transition-colors">
                    <Download className="h-3 w-3" /> JSON Template
                  </button>
                  <button onClick={() => downloadTemplate("csv")} className="flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border rounded-lg text-xs font-medium text-foreground hover:bg-accent transition-colors">
                    <Download className="h-3 w-3" /> CSV Template
                  </button>
                </div>
                <input ref={fileRef} type="file" accept=".json,.csv" onChange={handleBulkUpload} className="hidden" />
                <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium w-full justify-center">
                  <Upload className="h-3.5 w-3.5" /> Upload Questions File
                </button>
              </div>

              {/* Questions list */}
              <div className="space-y-3">
                {questions.map((q, qIdx) => (
                  <QuestionEditor
                    key={q.id}
                    question={q}
                    index={qIdx}
                    type={type}
                    onUpdate={(updates) => updateQuestion(qIdx, updates)}
                    onRemove={() => removeQuestion(qIdx)}
                    onUpdateOption={(oIdx, text) => updateOption(qIdx, oIdx, text)}
                    onUpdateOptionImage={(oIdx, img) => updateOptionImage(qIdx, oIdx, img)}
                    onAddOption={() => addOption(qIdx)}
                    onRemoveOption={(oIdx) => removeOption(qIdx, oIdx)}
                  />
                ))}
              </div>

              <button onClick={addQuestion} className="flex items-center gap-1.5 px-4 py-2.5 mt-3 bg-accent border border-dashed border-border rounded-xl text-sm font-medium text-foreground w-full justify-center hover:bg-accent/80 transition-colors">
                <Plus className="h-4 w-4" /> Add Question Manually
              </button>
            </div>
          </div>

          {/* Summary */}
          <div className="ml-8 bg-accent/30 border border-border rounded-xl p-3">
            <p className="text-xs text-muted-foreground">
              Total Questions: <span className="text-foreground font-medium">{questions.length}</span> •
              Total Marks: <span className="text-foreground font-medium">{questions.reduce((s, q) => s + q.marks, 0)}</span> •
              Pass Mark: <span className="text-foreground font-medium">{passMark}</span> •
              Negative: <span className="text-foreground font-medium">{negativeMark}</span>
            </p>
          </div>

          <button onClick={handleSave} disabled={saving} className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm disabled:opacity-50 transition-colors">
            {saving ? "Saving..." : exam ? "Update Exam" : "Create Exam"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================
   Question Editor Component
   ============================================ */
function QuestionEditor({ question, index, type, onUpdate, onRemove, onUpdateOption, onUpdateOptionImage, onAddOption, onRemoveOption }: {
  question: ExamQuestion; index: number; type: ExamType;
  onUpdate: (u: Partial<ExamQuestion>) => void; onRemove: () => void;
  onUpdateOption: (oIdx: number, text: string) => void;
  onUpdateOptionImage: (oIdx: number, img: string) => void;
  onAddOption: () => void; onRemoveOption: (oIdx: number) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="bg-card border border-border rounded-xl p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => setCollapsed(!collapsed)} className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          <span className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-xs font-bold">{index + 1}</span>
          {question.questionText && <span className="text-xs text-muted-foreground ml-1 truncate max-w-[200px]">{question.questionText}</span>}
        </button>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <label className="text-[10px] text-muted-foreground">Marks:</label>
            <input type="number" value={question.marks} onChange={e => onUpdate({ marks: Number(e.target.value) })} className="w-14 px-2 py-1 rounded-lg bg-background border border-border text-foreground text-xs text-center" />
          </div>
          <button onClick={onRemove} className="p-1 hover:bg-accent rounded-lg"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
        </div>
      </div>

      {!collapsed && (
        <div className="space-y-2.5 mt-3">
          <textarea value={question.questionText} onChange={e => onUpdate({ questionText: e.target.value })} placeholder="Enter question text" rows={2} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
          
          <ImageUrlField
            value={question.questionImage || ""}
            onChange={(v) => onUpdate({ questionImage: v })}
            placeholder="Question image URL (optional)"
          />
          {question.questionImage && <img src={question.questionImage} alt="" className="h-20 rounded-lg object-contain" />}

          {type === "mcq" && question.options && (
            <div className="space-y-2 mt-2">
              <p className="text-xs text-muted-foreground font-medium">Options (select correct answer):</p>
              {question.options.map((opt, oIdx) => (
                <div key={oIdx} className="flex items-start gap-2">
                  <input type="radio" name={`correct-${question.id}`} checked={question.correctAnswer === oIdx} onChange={() => onUpdate({ correctAnswer: oIdx })} className="mt-2.5 accent-primary" />
                  <div className="flex-1 space-y-1.5">
                    <input value={opt.text} onChange={e => onUpdateOption(oIdx, e.target.value)} placeholder={`Option ${oIdx + 1}`} className="w-full px-3 py-1.5 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
                    <ImageUrlField
                      value={opt.image || ""}
                      onChange={(v) => onUpdateOptionImage(oIdx, v)}
                      placeholder="Option image URL (optional)"
                      small
                    />
                    {opt.image && <img src={opt.image} alt="" className="h-12 rounded-lg object-contain" />}
                  </div>
                  {question.options!.length > 2 && (
                    <button onClick={() => onRemoveOption(oIdx)} className="p-1 mt-1 hover:bg-accent rounded-lg"><X className="h-3 w-3 text-muted-foreground" /></button>
                  )}
                </div>
              ))}
              <button onClick={onAddOption} className="text-xs text-primary hover:underline ml-5">+ Add Option</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================
   Image URL Field with Get URL button
   ============================================ */
function ImageUrlField({ value, onChange, placeholder, small }: {
  value: string; onChange: (v: string) => void; placeholder: string; small?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Image className={`${small ? "h-3 w-3" : "h-3.5 w-3.5"} text-muted-foreground shrink-0`} />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`flex-1 px-3 ${small ? "py-1" : "py-1.5"} rounded-lg bg-background border border-border text-foreground ${small ? "text-xs" : "text-sm"} focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all`}
      />
      {value && (
        <button type="button" onClick={() => onChange("")} className="p-1 hover:bg-destructive/10 text-destructive/60 hover:text-destructive rounded-lg transition-colors shrink-0">
          <X className="h-3 w-3" />
        </button>
      )}
      <a
        href="https://postimages.org"
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center gap-1 px-2 ${small ? "py-0.5" : "py-1"} bg-accent border border-border rounded-lg ${small ? "text-[10px]" : "text-xs"} font-medium text-primary hover:bg-accent/80 transition-colors shrink-0 whitespace-nowrap`}
      >
        <ExternalLink className={`${small ? "h-2.5 w-2.5" : "h-3 w-3"}`} /> Get URL
      </a>
    </div>
  );
}
