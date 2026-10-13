'use client';

import { DialogFrame } from '@/components/ui/DialogFrame';

import { useState, useTransition, useEffect } from 'react';
import { InterviewType } from '@prisma/client';
import {
  createInterviewAction,
  getOrganizationInterviewers,
} from '@/features/hiring/interview-actions';
import {
  X,
  Calendar,
  Clock,
  User,
  Video,
  MapPin,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface InterviewModalProps {
  applicationId: string;
  candidateName: string;
  jobTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface InterviewerOption {
  id: string;
  name: string;
  email: string;
  role: string;
}

export function InterviewModal({
  applicationId,
  candidateName,
  jobTitle,
  isOpen,
  onClose,
  onSuccess,
}: InterviewModalProps) {
  const [interviewers, setInterviewers] = useState<InterviewerOption[]>([]);
  const [loadingInterviewers, setLoadingInterviewers] = useState(true);

  const [interviewerId, setInterviewerId] = useState('');
  const [type, setType] = useState<InterviewType>(InterviewType.INITIAL_SCREENING);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [location, setLocation] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [notes, setNotes] = useState('');

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    getOrganizationInterviewers()
      .then((users) => {
        if (cancelled) return;
        setError(null);
        setSuccess(false);
        setInterviewers(users);
        if (users.length > 0) setInterviewerId(users[0].id);
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setDate(tomorrow.toISOString().split('T')[0]);
      })
      .catch(() => {
        if (!cancelled) setError('Unable to load interviewers. Close this dialog and try again.');
      })
      .finally(() => { if (!cancelled) setLoadingInterviewers(false); });
    return () => { cancelled = true; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!interviewerId) {
      setError('Please select an interviewer.');
      return;
    }
    if (!date || !time) {
      setError('Please provide scheduled date and time.');
      return;
    }

    const scheduledAt = new Date(`${date}T${time}:00`).toISOString();

    startTransition(async () => {
      const result = await createInterviewAction({
        applicationId,
        interviewerId,
        scheduledAt,
        durationMinutes: Number(durationMinutes),
        type,
        location: location.trim() || undefined,
        meetingUrl: meetingUrl.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        setTimeout(() => {
          onClose();
          if (onSuccess) onSuccess();
        }, 1000);
      }
    });
  };

  return (
    <DialogFrame label="Schedule interview" onClose={onClose} busy={isPending}>
      <div className="relative w-full max-w-lg rounded-lg bg-white p-6 shadow-2xl border border-slate-200 space-y-5 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-[var(--wp-text)] flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[var(--wp-text)]" />
              Schedule Candidate Interview
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Candidate: <span className="font-semibold text-slate-700">{candidateName}</span> • Position: {jobTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose} aria-label="Close dialog"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800 flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-800 flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>Interview scheduled successfully!</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          {/* Interview Type */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Interview Stage / Type
            </label>
            <select aria-label="Interview Stage / Type"
              value={type}
              onChange={(e) => setType(e.target.value as InterviewType)}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[var(--tenant-accent)] focus:ring-1 focus:ring-[var(--tenant-accent)]"
            >
              <option value={InterviewType.INITIAL_SCREENING}>Initial Screening Interview</option>
              <option value={InterviewType.TEACHING_DEMONSTRATION}>
                Teaching Demonstration Evaluation (Faculty Only)
              </option>
              <option value={InterviewType.HEAD_OF_DEPARTMENT}>
                Head of Department (HOD) Interview
              </option>
              <option value={InterviewType.PRESIDENT_FINAL}>
                President Final Interview (Endorsement Stage)
              </option>
              <option value={InterviewType.TECHNICAL}>Technical Assessment / Coding Interview</option>
              <option value={InterviewType.BEHAVIORAL}>Behavioral & Culture Fit Interview</option>
              <option value={InterviewType.FINAL}>Final Executive / Panel Interview</option>
              <option value={InterviewType.OTHER}>Other / Special Interview</option>
            </select>
          </div>

          {/* Interviewer Picker (Strictly Organization Users) */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-slate-400" /> Assigned Interviewer
            </label>
            {loadingInterviewers ? (
              <div className="flex items-center gap-2 text-slate-500 py-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading team members...
              </div>
            ) : (
              <select
                value={interviewerId}
                onChange={(e) => setInterviewerId(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[var(--tenant-accent)] focus:ring-1 focus:ring-[var(--tenant-accent)]"
              >
                {interviewers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role.replace('_', ' ')}) • {u.email}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Date, Time & Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-slate-400" /> Date
              </label>
              <input aria-label="Date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[var(--tenant-accent)] focus:ring-1 focus:ring-[var(--tenant-accent)]"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-slate-400" /> Time
              </label>
              <input aria-label="Time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[var(--tenant-accent)] focus:ring-1 focus:ring-[var(--tenant-accent)]"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Duration (Min)
              </label>
              <select aria-label="Duration (Min)"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[var(--tenant-accent)] focus:ring-1 focus:ring-[var(--tenant-accent)]"
              >
                <option value={15}>15 mins</option>
                <option value={30}>30 mins</option>
                <option value={45}>45 mins</option>
                <option value={60}>60 mins</option>
                <option value={90}>90 mins</option>
                <option value={120}>2 hours</option>
              </select>
            </div>
          </div>

          {/* Meeting URL & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Video className="h-3.5 w-3.5 text-slate-400" /> Meeting Link (Optional)
              </label>
              <input aria-label="Meeting Link (Optional)"
                type="url"
                placeholder="https://meet.google.com/..."
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[var(--tenant-accent)] focus:ring-1 focus:ring-[var(--tenant-accent)]"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-slate-400" /> Physical Location (Optional)
              </label>
              <input aria-label="Physical Location (Optional)"
                type="text"
                placeholder="e.g. Conference Room A"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[var(--tenant-accent)] focus:ring-1 focus:ring-[var(--tenant-accent)]"
              />
            </div>
          </div>

          {/* Notes / Agenda */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <FileText className="h-3.5 w-3.5 text-slate-400" /> Notes & Instructions (Optional)
            </label>
            <textarea aria-label="Notes & Instructions (Optional)"
              rows={3}
              placeholder="Topics to evaluate, instructions for candidate or interviewer..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-900 focus:border-[var(--tenant-accent)] focus:ring-1 focus:ring-[var(--tenant-accent)]"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || loadingInterviewers}
              className="inline-flex items-center gap-2 rounded-md bg-[var(--tenant-primary)] px-5 py-2.5 text-sm font-bold text-[var(--tenant-primary-foreground)] hover:brightness-95 disabled:opacity-50 transition"
            >
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Confirm & Schedule Interview
            </button>
          </div>
        </form>
      </div>
    </DialogFrame>
  );
}
