import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, addDoc, collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { examDb } from "@/lib/examFirebase";
import { useAuth } from "@/contexts/AuthContext";
import { Exam, ExamAnswer, ExamSubmission } from "@/types/exam";
import { uploadToImgBB } from "@/lib/imgbb";
import { toast } from "sonner";
import { Camera, Clock, ChevronLeft, ChevronRight, Send, Trophy, CheckCircle, XCircle, ArrowLeft } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function ExamTakePage() {
  const { examId } = useParams<{ examId: string }>();
  const { user, userDoc } = useAuth();
  const navigate = useNavigate();
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, ExamAnswer>>({});
  const [currentQ, setCurrentQ] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [started, setStarted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ExamSubmission | null>(null);
  const [existingSubmission, setExistingSubmission] = useState<ExamSubmission | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [rankings, setRankings] = useState<ExamSubmission[]>([]);
  const [showRankings, setShowRankings] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchExam = async () => {
      if (!examId) return;
      const snap = await getDoc(doc(examDb, "exams", examId));
      if (snap.exists()) {
        setExam({ id: snap.id, ...snap.data() } as Exam);
      }
      // Check existing submission
      if (user) {
        const subSnap = await getDocs(query(collection(examDb, "submissions"), where("examId", "==", examId), where("userId", "==", user.uid)));
        if (!subSnap.empty) {
          const sub = { id: subSnap.docs[0].id, ...subSnap.docs[0].data() } as ExamSubmission;
          setExistingSubmission(sub);
          setResult(sub);
          setSubmitted(true);
        }
      }
      setLoading(false);
    };
    fetchExam();
  }, [examId, user]);

  // Timer
  useEffect(() => {
    if (!started || submitted || timeLeft <= 0) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [started, submitted]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const now = Date.now();
  const examStarted = exam ? (exam.startTime?.toMillis?.() || 0) <= now : false;
  const examEnded = exam ? (exam.endTime?.toMillis?.() || 0) < now : false;

  const startExam = () => {
    if (!exam) return;
    setTimeLeft(exam.duration * 60);
    setStarted(true);
    // Initialize answers
    const initial: Record<string, ExamAnswer> = {};
    exam.questions.forEach(q => {
      initial[q.id] = { questionId: q.id, marks: q.marks };
    });
    setAnswers(initial);
  };

  const selectOption = (questionId: string, optionIdx: number) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: { ...prev[questionId], selectedOption: optionIdx },
    }));
  };

  const handleCameraCapture = async (questionId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const url = await uploadToImgBB(file);
      setAnswers(prev => ({
        ...prev,
        [questionId]: { ...prev[questionId], writtenImageUrl: url },
      }));
      toast.success("Image uploaded");
    } catch {
      toast.error("Upload failed");
    }
    setUploadingImage(false);
  };

  const handleSubmit = useCallback(async () => {
    if (!exam || !user || !userDoc || submitting) return;
    setSubmitting(true);

    const answersList: ExamAnswer[] = exam.questions.map(q => {
      const ans = answers[q.id] || { questionId: q.id, marks: q.marks };
      if (exam.type === "mcq") {
        const isCorrect = ans.selectedOption === q.correctAnswer;
        return { ...ans, isCorrect, marks: q.marks };
      }
      return ans;
    });

    const correctCount = answersList.filter(a => a.isCorrect).length;
    const wrongCount = exam.type === "mcq" ? answersList.filter(a => a.selectedOption !== undefined && !a.isCorrect).length : 0;
    const obtainedMarks = exam.type === "mcq" ? answersList.filter(a => a.isCorrect).reduce((s, a) => s + a.marks, 0) : 0;

    const submission: Omit<ExamSubmission, "id"> = {
      examId: exam.id,
      userId: user.uid,
      userName: userDoc.name,
      userEmail: userDoc.email,
      courseId: exam.courseId,
      answers: answersList,
      totalMarks: exam.totalMarks,
      obtainedMarks,
      correctCount,
      wrongCount,
      submittedAt: Timestamp.now(),
    };

    try {
      const docRef = await addDoc(collection(examDb, "submissions"), submission);
      const resultSub = { id: docRef.id, ...submission } as ExamSubmission;
      setResult(resultSub);
      setSubmitted(true);
      setStarted(false);
      if (timerRef.current) clearInterval(timerRef.current);
      toast.success("Exam submitted!");
    } catch (err: any) {
      toast.error(err.message);
    }
    setSubmitting(false);
  }, [exam, user, userDoc, answers, submitting]);

  const loadRankings = async () => {
    if (!exam) return;
    const snap = await getDocs(query(collection(examDb, "submissions"), where("examId", "==", exam.id)));
    const subs = snap.docs.map(d => ({ id: d.id, ...d.data() } as ExamSubmission)).sort((a, b) => b.obtainedMarks - a.obtainedMarks);
    setRankings(subs);
    setShowRankings(true);
  };

  if (loading) return <div className="p-4 text-center text-muted-foreground text-sm py-8">Loading...</div>;
  if (!exam) return <div className="p-4 text-center text-muted-foreground text-sm py-8">Exam not found</div>;

  // Result view
  if (submitted && result) {
    return (
      <div className="p-4 max-w-2xl mx-auto animate-fade-in">
        <button onClick={() => navigate("/exams")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Exams
        </button>

        <div className="bg-card border border-border rounded-lg p-6 text-center">
          <h2 className="text-lg font-semibold text-foreground">{exam.title}</h2>
          <p className="text-sm text-muted-foreground mb-4">Your Result</p>
          <div className="text-4xl font-bold text-foreground">{result.obtainedMarks}/{result.totalMarks}</div>
          <div className="flex items-center justify-center gap-4 mt-3 text-sm">
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400"><CheckCircle className="h-4 w-4" /> {result.correctCount} Correct</span>
            <span className="flex items-center gap-1 text-destructive"><XCircle className="h-4 w-4" /> {result.wrongCount} Wrong</span>
          </div>
        </div>

        {/* Answer review */}
        {exam.type === "mcq" && (
          <div className="mt-6 space-y-3">
            <h3 className="font-medium text-foreground">Answer Review</h3>
            {exam.questions.map((q, idx) => {
              const ans = result.answers.find(a => a.questionId === q.id);
              return (
                <div key={q.id} className="bg-card border border-border rounded-lg p-3">
                  <p className="text-sm font-medium text-foreground">Q{idx + 1}. {q.questionText}</p>
                  {q.questionImage && <img src={q.questionImage} alt="" className="h-24 rounded-md object-contain mt-2" />}
                  <div className="mt-2 space-y-1">
                    {q.options?.map((opt, oIdx) => {
                      const isCorrect = oIdx === q.correctAnswer;
                      const isSelected = ans?.selectedOption === oIdx;
                      let bg = "bg-card";
                      if (isCorrect) bg = "bg-green-500/10";
                      if (isSelected && !isCorrect) bg = "bg-red-500/10";
                      return (
                        <div key={oIdx} className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${bg}`}>
                          {isCorrect && <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0" />}
                          {isSelected && !isCorrect && <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                          {!isCorrect && !isSelected && <span className="w-3.5" />}
                          <span className="text-foreground">{opt.text}</span>
                          {opt.image && <img src={opt.image} alt="" className="h-8 rounded object-contain ml-auto" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Rankings - only after exam ends */}
        {examEnded && (
          <div className="mt-6">
            {!showRankings ? (
              <button onClick={loadRankings} className="w-full py-3 bg-primary text-primary-foreground rounded-md text-sm font-medium flex items-center justify-center gap-2">
                <Trophy className="h-4 w-4" /> View Rankings
              </button>
            ) : (
              <div>
                <h3 className="font-medium text-foreground mb-3 flex items-center gap-2"><Trophy className="h-4 w-4" /> Rankings</h3>
                <div className="space-y-2">
                  {rankings.map((sub, idx) => (
                    <div key={sub.id} className={`flex items-center justify-between p-3 rounded-lg border ${sub.userId === user?.uid ? "border-primary bg-accent" : "border-border bg-card"}`}>
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${idx < 3 ? "bg-primary text-primary-foreground" : "bg-accent text-foreground"}`}>{idx + 1}</span>
                        <div>
                          <p className="text-sm font-medium text-foreground">{sub.userName}</p>
                          <p className="text-xs text-muted-foreground">{sub.userEmail}</p>
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-foreground">{sub.obtainedMarks}/{sub.totalMarks}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Pre-start view
  if (!started) {
    return (
      <div className="p-4 max-w-lg mx-auto animate-fade-in">
        <button onClick={() => navigate("/exams")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="bg-card border border-border rounded-lg p-6 text-center">
          <h2 className="text-lg font-semibold text-foreground">{exam.title}</h2>
          <p className="text-sm text-muted-foreground mt-1">{exam.courseName}</p>
          <div className="mt-4 space-y-2 text-sm text-muted-foreground">
            <p>Type: <span className="text-foreground font-medium">{exam.type.toUpperCase()}</span></p>
            <p>Questions: <span className="text-foreground font-medium">{exam.questions.length}</span></p>
            <p>Total Marks: <span className="text-foreground font-medium">{exam.totalMarks}</span></p>
            <p>Duration: <span className="text-foreground font-medium">{exam.duration} minutes</span></p>
            <p>Start: <span className="text-foreground font-medium">{exam.startTime?.toDate?.()?.toLocaleString()}</span></p>
            <p>End: <span className="text-foreground font-medium">{exam.endTime?.toDate?.()?.toLocaleString()}</span></p>
          </div>

          {!examStarted && (
            <p className="mt-4 text-sm text-warning">Exam hasn't started yet. Please wait.</p>
          )}
          {examEnded && !existingSubmission && (
            <p className="mt-4 text-sm text-destructive">Exam has ended.</p>
          )}
          {examStarted && !examEnded && (
            <button onClick={startExam} className="mt-6 w-full py-3 bg-primary text-primary-foreground rounded-md font-medium text-sm">
              Start Exam
            </button>
          )}
        </div>
      </div>
    );
  }

  // Exam taking view
  const question = exam.questions[currentQ];

  return (
    <div className="p-4 max-w-2xl mx-auto animate-fade-in">
      {/* Timer bar */}
      <div className="sticky top-14 z-40 bg-background border-b border-border -mx-4 px-4 py-2 flex items-center justify-between">
        <span className="text-sm text-foreground font-medium">Q {currentQ + 1}/{exam.questions.length}</span>
        <span className={`flex items-center gap-1 text-sm font-mono font-bold ${timeLeft < 60 ? "text-destructive" : "text-foreground"}`}>
          <Clock className="h-4 w-4" /> {formatTime(timeLeft)}
        </span>
      </div>

      {/* Question navigation dots */}
      <div className="flex flex-wrap gap-1.5 my-4">
        {exam.questions.map((q, idx) => {
          const answered = answers[q.id]?.selectedOption !== undefined || answers[q.id]?.writtenImageUrl;
          return (
            <button key={q.id} onClick={() => setCurrentQ(idx)}
              className={`w-8 h-8 rounded-md text-xs font-medium border ${idx === currentQ ? "border-primary bg-primary text-primary-foreground" : answered ? "border-primary/50 bg-primary/10 text-foreground" : "border-border bg-card text-muted-foreground"}`}
            >{idx + 1}</button>
          );
        })}
      </div>

      {/* Question */}
      <div className="bg-card border border-border rounded-lg p-4">
        <p className="text-sm font-medium text-foreground mb-1">Question {currentQ + 1} <span className="text-muted-foreground">({question.marks} marks)</span></p>
        <p className="text-foreground">{question.questionText}</p>
        {question.questionImage && <img src={question.questionImage} alt="" className="mt-3 max-h-48 rounded-md object-contain" />}

        {exam.type === "mcq" && question.options && (
          <div className="mt-4 space-y-2">
            {question.options.map((opt, oIdx) => {
              const selected = answers[question.id]?.selectedOption === oIdx;
              return (
                <button key={oIdx} onClick={() => selectOption(question.id, oIdx)}
                  className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-md border text-sm transition-colors ${selected ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-foreground hover:bg-accent"}`}
                >
                  <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs shrink-0 ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                    {String.fromCharCode(65 + oIdx)}
                  </span>
                  <span className="flex-1">{opt.text}</span>
                  {opt.image && <img src={opt.image} alt="" className="h-10 rounded object-contain" />}
                </button>
              );
            })}
          </div>
        )}

        {exam.type === "written" && (
          <div className="mt-4">
            <p className="text-sm text-muted-foreground mb-2">Upload your answer (take a photo):</p>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={e => handleCameraCapture(question.id, e)} className="hidden" />
            <button onClick={() => cameraRef.current?.click()} disabled={uploadingImage}
              className="flex items-center gap-2 px-4 py-3 bg-accent border border-border rounded-md text-sm text-foreground w-full justify-center">
              <Camera className="h-4 w-4" /> {uploadingImage ? "Uploading..." : "Take Photo / Upload Image"}
            </button>
            {answers[question.id]?.writtenImageUrl && (
              <img src={answers[question.id].writtenImageUrl} alt="Answer" className="mt-3 max-h-48 rounded-md object-contain mx-auto" />
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-4">
        <button onClick={() => setCurrentQ(Math.max(0, currentQ - 1))} disabled={currentQ === 0}
          className="flex items-center gap-1 px-4 py-2 bg-card border border-border rounded-md text-sm text-foreground disabled:opacity-40">
          <ChevronLeft className="h-4 w-4" /> Previous
        </button>

        {currentQ === exam.questions.length - 1 ? (
          <button onClick={() => setShowConfirm(true)} disabled={submitting}
            className="flex items-center gap-1 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50">
            <Send className="h-4 w-4" /> Submit
          </button>
        ) : (
          <button onClick={() => setCurrentQ(Math.min(exam.questions.length - 1, currentQ + 1))}
            className="flex items-center gap-1 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium">
            Next <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Submit confirmation */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Exam</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to submit? You answered {Object.values(answers).filter(a => a.selectedOption !== undefined || a.writtenImageUrl).length}/{exam.questions.length} questions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit}>Submit</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
