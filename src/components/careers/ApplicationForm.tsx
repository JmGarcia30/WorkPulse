'use client';

import React, { useRef, useState } from 'react';
import { Upload, FileText, X, Send, Loader2 } from 'lucide-react';
import styles from './ApplicationForm.module.css';

interface ApplicationFormProps {
  job: { id: string; slug: string; title: string };
  org: { slug: string; name: string };
  error?: string;
  action: (formData: FormData) => Promise<void>;
}

export function ApplicationForm({ job, org, error: serverError, action }: ApplicationFormProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function selectFile(file: File | null): boolean {
    let message: string | null = null;
    if (file && !/\.(pdf|docx)$/i.test(file.name)) message = 'Choose a PDF or Word (.docx) document.';
    else if (file && (file.size === 0 || file.size > 5 * 1024 * 1024)) message = 'Choose a nonempty document no larger than 5 MB.';
    setFileError(message);
    setSelectedFile(message ? null : file);
    if (message && fileInputRef.current) fileInputRef.current.value = '';
    return !message;
  }
  function removeFile() {
    selectFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }
  function dropFile(event: React.DragEvent) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0] ?? null;
    if (event.dataTransfer.files.length > 1) {
      removeFile();
      setFileError('Choose one resume document at a time.');
      return;
    }
    // Invalid drops must never be transferred into the submitted file input.
    if (!selectFile(file) || !file || !fileInputRef.current) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    fileInputRef.current.files = transfer.files;
  }

  return <form action={async formData => {
    if (fileError) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try { await action(formData); }
    catch (error) {
      // Next redirects are handled by the framework; do not replace their outcome.
      if (error && typeof error === 'object' && 'digest' in error && String(error.digest).startsWith('NEXT_REDIRECT')) throw error;
      setSubmitError('Your application could not be submitted. Please try again.');
    } finally { setIsSubmitting(false); }
  }} aria-busy={isSubmitting} className={styles.form}>
    <input type="hidden" name="jobId" value={job.id} />
    <input type="hidden" name="organizationSlug" value={org.slug} />
    <input type="hidden" name="jobSlug" value={job.slug} />
    {(serverError || submitError) && <p role="alert" className={styles.error}>{serverError || submitError}</p>}
    <fieldset className={styles.section} disabled={isSubmitting}>
      <legend className={styles.legend}>1. Personal Information</legend>
      <p className={styles.hint}>Use an email address you can access. We will send your application verification link there. Fields marked * are required.</p>
      <div className={styles.grid}>
        <label className={styles.label} htmlFor="application-first-name">First name *<input id="application-first-name" name="firstName" autoComplete="given-name" required placeholder="Maria" className={styles.input} /></label>
        <label className={styles.label} htmlFor="application-last-name">Last name *<input id="application-last-name" name="lastName" autoComplete="family-name" required placeholder="Santos" className={styles.input} /></label>
        <label className={styles.label} htmlFor="application-email">Email address *<input id="application-email" name="email" type="email" autoComplete="email" required placeholder="maria@example.com" className={styles.input} /></label>
        <label className={styles.label} htmlFor="application-phone">Phone number *<input id="application-phone" name="phone" type="tel" autoComplete="tel" required placeholder="+63 917 123 4567" className={styles.input} /></label>
      </div>
    </fieldset>
    <fieldset className={styles.section} disabled={isSubmitting}>
      <legend className={styles.legend}>2. Cover Letter</legend>
      <label className={styles.label} htmlFor="application-cover-letter">Cover letter *<textarea id="application-cover-letter" name="coverLetter" rows={6} required placeholder="Introduce yourself and tell us about your experience and interest in this position." className={styles.input} /></label>
    </fieldset>
    <fieldset className={styles.section} disabled={isSubmitting}>
      <legend className={styles.legend}>3. Resume Upload</legend>
      <p id="resume-help" className={styles.hint}>Attach one PDF or DOCX document, up to 5 MB.</p>
      <label className={styles.dropzone + (isDragging ? ' ' + styles.dragging : '')} onDragOver={event => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={dropFile}>
        <span className={styles.uploadIcon}><Upload size={23} aria-hidden="true" /></span>
        <span><strong>{selectedFile ? 'Choose a different resume' : 'Choose your resume'}</strong> or drag and drop it here</span>
        <small>PDF or DOCX / Maximum 5 MB</small>
        <input ref={fileInputRef} type="file" id="resume-upload-input" name="resume" aria-label="Resume file" aria-describedby={fileError ? 'resume-help resume-error' : 'resume-help'} aria-invalid={!!fileError} accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={event => selectFile(event.target.files?.[0] ?? null)} className={styles.fileInput} />
      </label>
      {selectedFile && <div role="status" className={styles.preview}>
        <FileText size={24} aria-hidden="true" /><div className={styles.fileName}><strong>{selectedFile.name}</strong><small>{(selectedFile.size / 1024).toFixed(1)} KB / Ready to attach</small></div>
        <button type="button" onClick={removeFile} className={styles.remove} aria-label="Remove resume"><X size={18} aria-hidden="true" /></button>
      </div>}
      {fileError && <p id="resume-error" role="alert" className={styles.error}>{fileError}</p>}
    </fieldset>
    <div>
      <button type="submit" disabled={isSubmitting || !!fileError} className={styles.submit}>
        {isSubmitting ? <><Loader2 className="animate-spin" size={18} aria-hidden="true" />Submitting application...</> : <>Submit Application<Send size={18} aria-hidden="true" /></>}
      </button>
      <p className={styles.hint}>Your application will be sent to {org.name}. Check your email after submitting to complete verification.</p>
    </div>
  </form>;
}
