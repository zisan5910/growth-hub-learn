import { useState, useEffect, useRef } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp } from "firebase/firestore";
import { examDb } from "@/lib/examFirebase";
import { db } from "@/lib/firebase";
import { Exam, ExamQuestion, ExamType, ExamSubmission } from "@/types/exam";
import { Course } from "@/types";
import { toast } from "sonner";
import { Trash2, Edit, Eye, Plus, Upload, ChevronDown, ChevronUp, X, Image } from "lucide-react";
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
  };

  return (
    <div className="p-4 max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-foreground">Exam Management</h1>
        <button onClick={() => { setEditExam(null); setCreateOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium">
          <Plus className="h-4 w-4" /> Create Exam
        </button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full mb-4">
          <TabsTrigger value="exams" className="flex-1">Exams</TabsTrigger>
          <TabsTrigger value="results" className="flex-1">Results</TabsTrigger>
        </TabsList>

        <TabsContent value="exams">
          {loading ? (
            <p className="text-muted-foreground text-sm text-center py-8">Loading...</p>
          ) : exams.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">No exams yet</p>
          ) : (
            <div className="space-y-3">
              {exams.map(exam => (
                <div key={exam.id} className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-foreground">{exam.title}</h3>
                      <p className="text-xs text-muted-foreground">{exam.courseName} • {exam.type.toUpperCase()} • {exam.questions?.length || 0} Questions • {exam.totalMarks} Marks</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {exam.startTime?.toDate?.()?.toLocaleString()} → {exam.endTime?.toDate?.()?.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">Duration: {exam.duration} min</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => viewResults(exam)} className="p-2 hover:bg-accent rounded-md"><Eye className="h-4 w-4 text-muted-foreground" /></button>
                      <button onClick={() => { setEditExam(exam); setCreateOpen(true); }} className="p-2 hover:bg-accent rounded-md"><Edit className="h-4 w-4 text-muted-foreground" /></button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild><button className="p-2 hover:bg-accent rounded-md"><Trash2 className="h-4 w-4 text-destructive" /></button></AlertDialogTrigger>
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
                <h3 className="font-medium text-foreground">{resultsExam.title} - Results</h3>
                <button onClick={() => setResultsExam(null)} className="text-sm text-muted-foreground hover:text-foreground">Back</button>
              </div>
              {submissions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No submissions yet</p>
              ) : (
                <div className="space-y-2">
                  {submissions.map((sub, idx) => (
                    <div key={sub.id} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">#{idx + 1} {sub.userName}</p>
                        <p className="text-xs text-muted-foreground">{sub.userEmail}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-foreground">{sub.obtainedMarks}/{sub.totalMarks}</p>
                        <p className="text-xs text-muted-foreground">✓{sub.correctCount} ✗{sub.wrongCount}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {exams.map(exam => (
                <button key={exam.id} onClick={() => viewResults(exam)} className="w-full text-left bg-card border border-border rounded-lg p-3 hover:bg-accent">
                  <p className="text-sm font-medium text-foreground">{exam.title}</p>
                  <p className="text-xs text-muted-foreground">{exam.courseName}</p>
                </button>
              ))}
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

function ExamFormDialog({ open, onClose, exam, courses, onSaved }: {
  open: boolean; onClose: () => void; exam: Exam | null; courses: Course[]; onSaved: () => void;
}) {
  const [title, setTitle] = useState(exam?.title || "");
  const [courseId, setCourseId] = useState(exam?.courseId || "");
  const [type, setType] = useState<ExamType>(exam?.type || "mcq");
  const [duration, setDuration] = useState(exam?.duration || 30);
  const [startTime, setStartTime] = useState(exam?.startTime?.toDate?.()?.toISOString().slice(0, 16) || "");
  const [endTime, setEndTime] = useState(exam?.endTime?.toDate?.()?.toISOString().slice(0, 16) || "");
  const [questions, setQuestions] = useState<ExamQuestion[]>(exam?.questions || []);
  const [saving, setSaving] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
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

  const removeQuestion = (idx: number) => {
    setQuestions(questions.filter((_, i) => i !== idx));
  };

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
          // CSV parsing
          const lines = text.split("\n").filter(l => l.trim());
          const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
          parsed = lines.slice(1).map(line => {
            const values = line.split(",").map(v => v.trim());
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
            { text: item.option1 || item.a || "", image: item.option1Image || "" },
            { text: item.option2 || item.b || "", image: item.option2Image || "" },
            { text: item.option3 || item.c || "", image: item.option3Image || "" },
            { text: item.option4 || item.d || "", image: item.option4Image || "" },
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
          <DialogTitle>{exam ? "Edit Exam" : "Create Exam"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Exam Title *" className="w-full px-4 py-3 rounded-md bg-card border border-border text-foreground text-sm" />

          <select value={courseId} onChange={e => setCourseId(e.target.value)} className="w-full px-4 py-3 rounded-md bg-card border border-border text-foreground text-sm">
            <option value="">Select Course *</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.courseName}</option>)}
          </select>

          <div className="flex gap-3">
            <select value={type} onChange={e => setType(e.target.value as ExamType)} className="flex-1 px-4 py-3 rounded-md bg-card border border-border text-foreground text-sm">
              <option value="mcq">MCQ</option>
              <option value="written">Written</option>
            </select>
            <input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} placeholder="Duration (min)" className="flex-1 px-4 py-3 rounded-md bg-card border border-border text-foreground text-sm" />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground">Start Time *</label>
              <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full px-4 py-3 rounded-md bg-card border border-border text-foreground text-sm" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground">End Time *</label>
              <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full px-4 py-3 rounded-md bg-card border border-border text-foreground text-sm" />
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-foreground text-sm">Questions ({questions.length})</h3>
              <div className="flex gap-2">
                <input ref={fileRef} type="file" accept=".json,.csv" onChange={handleBulkUpload} className="hidden" />
                <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1 px-3 py-1.5 bg-accent text-foreground rounded-md text-xs font-medium">
                  <Upload className="h-3 w-3" /> Bulk Import
                </button>
                <button onClick={addQuestion} className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium">
                  <Plus className="h-3 w-3" /> Add Question
                </button>
              </div>
            </div>

            <div className="space-y-4">
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
          </div>

          <button onClick={handleSave} disabled={saving} className="w-full py-3 rounded-md bg-primary text-primary-foreground font-medium text-sm disabled:opacity-50">
            {saving ? "Saving..." : exam ? "Update Exam" : "Create Exam"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function QuestionEditor({ question, index, type, onUpdate, onRemove, onUpdateOption, onUpdateOptionImage, onAddOption, onRemoveOption }: {
  question: ExamQuestion; index: number; type: ExamType;
  onUpdate: (u: Partial<ExamQuestion>) => void; onRemove: () => void;
  onUpdateOption: (oIdx: number, text: string) => void;
  onUpdateOptionImage: (oIdx: number, img: string) => void;
  onAddOption: () => void; onRemoveOption: (oIdx: number) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="bg-accent/50 border border-border rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => setCollapsed(!collapsed)} className="flex items-center gap-1 text-sm font-medium text-foreground">
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          Q{index + 1}
          {question.questionText && <span className="text-xs text-muted-foreground ml-2 truncate max-w-[200px]">{question.questionText}</span>}
        </button>
        <div className="flex items-center gap-2">
          <input type="number" value={question.marks} onChange={e => onUpdate({ marks: Number(e.target.value) })} className="w-16 px-2 py-1 rounded bg-card border border-border text-foreground text-xs text-center" placeholder="Marks" />
          <button onClick={onRemove} className="p-1 hover:bg-accent rounded"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
        </div>
      </div>

      {!collapsed && (
        <div className="space-y-2">
          <textarea value={question.questionText} onChange={e => onUpdate({ questionText: e.target.value })} placeholder="Question text" rows={2} className="w-full px-3 py-2 rounded-md bg-card border border-border text-foreground text-sm resize-none" />
          
          <div className="flex items-center gap-2">
            <Image className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input value={question.questionImage || ""} onChange={e => onUpdate({ questionImage: e.target.value })} placeholder="Question image URL (optional)" className="flex-1 px-3 py-1.5 rounded-md bg-card border border-border text-foreground text-xs" />
          </div>
          {question.questionImage && <img src={question.questionImage} alt="" className="h-20 rounded-md object-contain" />}

          {type === "mcq" && question.options && (
            <div className="space-y-2 mt-2">
              <p className="text-xs text-muted-foreground font-medium">Options (select correct answer):</p>
              {question.options.map((opt, oIdx) => (
                <div key={oIdx} className="flex items-start gap-2">
                  <input type="radio" name={`correct-${question.id}`} checked={question.correctAnswer === oIdx} onChange={() => onUpdate({ correctAnswer: oIdx })} className="mt-2.5 accent-primary" />
                  <div className="flex-1 space-y-1">
                    <input value={opt.text} onChange={e => onUpdateOption(oIdx, e.target.value)} placeholder={`Option ${oIdx + 1}`} className="w-full px-3 py-1.5 rounded-md bg-card border border-border text-foreground text-sm" />
                    <input value={opt.image || ""} onChange={e => onUpdateOptionImage(oIdx, e.target.value)} placeholder="Option image URL (optional)" className="w-full px-3 py-1 rounded-md bg-card border border-border text-foreground text-xs" />
                    {opt.image && <img src={opt.image} alt="" className="h-12 rounded object-contain" />}
                  </div>
                  {question.options!.length > 2 && (
                    <button onClick={() => onRemoveOption(oIdx)} className="p-1 mt-1 hover:bg-accent rounded"><X className="h-3 w-3 text-muted-foreground" /></button>
                  )}
                </div>
              ))}
              <button onClick={onAddOption} className="text-xs text-primary hover:underline">+ Add Option</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
