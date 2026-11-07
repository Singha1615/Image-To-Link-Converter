"use client";

import { ChangeEvent, DragEvent, useRef, useState } from "react";

const ACCEPTED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml", "image/bmp", "image/x-icon", "image/vnd.microsoft.icon", "image/avif"]);
const EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "ico", "avif"]);
const MAX_MB = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB) || 10;

type UploadResult = { secure_url: string; public_id: string; bytes: number; format: string; width?: number; height?: number };

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  const paths: Record<string, React.ReactNode> = {
    image: <><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></>,
    upload: <><path d="M12 16V4m0 0L7 9m5-5 5 5"/><path d="M20 16.5v2A2.5 2.5 0 0 1 17.5 21h-11A2.5 2.5 0 0 1 4 18.5v-2"/></>,
    folder: <><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/><path d="M3 10h18"/></>,
    close: <><path d="m18 6-12 12M6 6l12 12"/></>,
    copy: <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></>,
    external: <><path d="M14 3h7v7m0-7-9 9"/><path d="M18 13v5a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3h5"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    spark: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="m19 16 .9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9z"/></>,
  };
  return <svg {...common}>{paths[name] ?? paths.image}</svg>;
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 Bytes";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${["Bytes", "KB", "MB", "GB"][i]}`;
}

function validImage(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return ACCEPTED.has(file.type) || EXTENSIONS.has(ext);
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  function selectFile(next: File | undefined) {
    if (!next) return;
    setError(""); setResult(null); setCopied(false);
    if (!validImage(next)) { setError("That file type isn’t supported. Please choose an image file."); return; }
    if (next.size > MAX_MB * 1024 * 1024) { setError(`This image is too large. The maximum file size is ${MAX_MB} MB.`); return; }
    setFile(next);
    setPreview(URL.createObjectURL(next));
  }

  function onInput(event: ChangeEvent<HTMLInputElement>) { selectFile(event.target.files?.[0]); event.target.value = ""; }
  function onDrop(event: DragEvent<HTMLDivElement>) { event.preventDefault(); setDragging(false); selectFile(event.dataTransfer.files?.[0]); }

  function removeFile() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null); setPreview(""); setResult(null); setError(""); setProgress(0); setCopied(false);
  }

  async function upload() {
    if (!file || busy) return;
    setBusy(true); setError(""); setProgress(0);
    try {
      const signatureResponse = await fetch("/api/signature", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, format: file.name.split(".").pop(), bytes: file.size }),
      });
      const signatureData = await signatureResponse.json();
      if (!signatureResponse.ok) throw new Error(signatureData.error || "Could not prepare the upload.");

      const form = new FormData();
      form.append("file", file); form.append("api_key", signatureData.apiKey);
      form.append("timestamp", String(signatureData.timestamp)); form.append("public_id", signatureData.publicId);
      form.append("folder", "imagehost"); form.append("overwrite", "false");
      form.append("unique_filename", "false"); form.append("signature", signatureData.signature);

      const response = await new Promise<XMLHttpRequest>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `https://api.cloudinary.com/v1_1/${signatureData.cloudName}/image/upload`);
        xhr.upload.onprogress = (event) => { if (event.lengthComputable) setProgress(Math.round(event.loaded / event.total * 100)); };
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve(xhr) : reject(new Error(JSON.parse(xhr.responseText)?.error?.message || "Upload failed. Please try again."));
        xhr.onerror = () => reject(new Error("Network error while uploading. Check your connection and try again."));
        xhr.send(form);
      });
      const uploaded = JSON.parse(response.responseText) as UploadResult;
      setResult(uploaded); setProgress(100);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong. Please try again.");
    } finally { setBusy(false); }
  }

  async function copyLink() {
    if (!result) return;
    try { await navigator.clipboard.writeText(result.secure_url); }
    catch {
      const field = document.getElementById("share-url") as HTMLInputElement | null;
      field?.select(); document.execCommand("copy");
    }
    setCopied(true); window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="page-shell">
      <div className="ambient ambient-one"/><div className="ambient ambient-two"/>
      <nav className="topbar">
        <a className="brand" href="#" aria-label="ImageHost home"><span className="brand-mark"><Icon name="image" size={19}/></span><span>image to link<span className="brand-light"> converter</span></span></a>
        <div className="nav-status"><span className="status-dot"/> Free image to link converter</div>
      </nav>

      <section className="hero">
        <div className="eyebrow"><span className="eyebrow-icon"><Icon name="spark" size={14}/></span> THE SIMPLE WAY TO SHARE</div>
        <h1>Your images,<br/><span>everywhere.</span></h1>
        <p className="hero-copy">Upload once. Share anywhere. Your images deserve a home on the internet.</p>

        <div className="upload-card">
          <div className="card-heading"><div><h2>Upload an image</h2><p>Choose an image to get started</p></div><span className="secure-badge"><span/> SECURE</span></div>

          {!file ? (
            <div className={`dropzone ${dragging ? "dropzone-active" : ""}`} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop} onClick={() => inputRef.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}>
              <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/bmp,image/x-icon,image/avif,.ico" onChange={onInput} hidden/>
              <div className="drop-icon"><Icon name="upload" size={23}/></div>
              <strong>Drag &amp; drop your image here</strong>
              <span className="drop-secondary">or <span>click to browse files</span></span>
              <button className="choose-button" type="button" onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}><Icon name="folder" size={17}/> Choose image</button>
              <div className="format-list">PNG <i/> JPG <i/> WEBP <i/> GIF <i/> SVG <i/> AVIF</div>
            </div>
          ) : (
            <div className="selected-panel">
              <div className="preview-frame"><img src={preview} alt={`Preview of ${file.name}`}/><div className="preview-tag"><span/> PREVIEW</div></div>
              <div className="file-meta"><div className="file-icon"><Icon name="image" size={18}/></div><div className="file-text"><strong title={file.name}>{file.name}</strong><span>{formatBytes(file.size)} <i/> {file.type.split("/").pop()?.toUpperCase() || "IMAGE"}</span></div><button className="remove-button" type="button" onClick={removeFile} disabled={busy} aria-label="Remove image"><Icon name="close" size={17}/></button></div>
              {!result && <button className="choose-another" type="button" onClick={() => inputRef.current?.click()} disabled={busy}>Choose a different image</button>}
              <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/bmp,image/x-icon,image/avif,.ico" onChange={onInput} hidden/>
            </div>
          )}

          {error && <div className="error-message" role="alert"><span>!</span>{error}</div>}

          {file && !result && <div className="upload-action"><button className="upload-button" onClick={upload} disabled={busy}>{busy ? <><span className="spinner"/> Uploading{progress > 0 ? ` ${progress}%` : "…"}</> : <><Icon name="upload" size={18}/> Upload image <span className="button-arrow">→</span></>}</button><p>Max file size {MAX_MB} MB <i/> Your image is publicly accessible</p>{busy && <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }}/></div>}</div>}

          {result && <div className="result-panel" role="status"><div className="success-heading"><span className="success-check"><Icon name="check" size={16}/></span><div><strong>Image uploaded successfully!</strong><span>Your image is ready to share</span></div><span className="success-pill">LIVE</span></div><label className="url-label" htmlFor="share-url">PUBLIC IMAGE URL</label><div className="url-row"><input id="share-url" value={result.secure_url} readOnly onFocus={(e) => e.currentTarget.select()}/><button type="button" className={`copy-button ${copied ? "copied" : ""}`} onClick={copyLink}><Icon name={copied ? "check" : "copy"} size={16}/>{copied ? "Copied!" : "Copy link"}</button></div><a className="open-link" href={result.secure_url} target="_blank" rel="noreferrer"><Icon name="external" size={15}/> Open image in new tab <span>↗</span></a><div className="uploaded-details"><span><Icon name="check" size={13}/> Original quality preserved</span><span>{result.width && result.height ? `${result.width} × ${result.height}` : formatBytes(result.bytes)}</span></div></div>}
        </div>
        <div className="trust-row"><div className="trust-item"><span className="trust-icon"><Icon name="upload" size={16}/></span><span><strong>Fast uploads</strong><small>Ready in seconds</small></span></div><div className="trust-divider"/><div className="trust-item"><span className="trust-icon"><Icon name="external" size={16}/></span><span><strong>Direct links</strong><small>Share with anyone</small></span></div><div className="trust-divider"/><div className="trust-item"><span className="trust-icon"><Icon name="image" size={16}/></span><span><strong>Full quality</strong><small>No compression</small></span></div></div>
      </section>

      <footer className="footer"><span>© 2026 Image To Link Converter</span><span>Made for the images that matter <span className="footer-heart">✳</span></span><span><span className="footer-dot"/> All systems operational</span></footer>
    </main>
  );
}
