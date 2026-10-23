// XHR instead of fetch: we need upload progress for the progress bar on slow Wi-Fi.
export type SubmitResult = { ok: true; referenceId: string } | { ok: false; error: string; status: number };

export function postSubmission(form: FormData, onProgress: (p: number) => void): Promise<SubmitResult> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/submit");
    xhr.timeout = 120_000;
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.upload.onload = () => onProgress(1);
    xhr.onload = () => {
      let body: { referenceId?: string; error?: string } = {};
      try {
        body = JSON.parse(xhr.responseText) as typeof body;
      } catch {
        /* non-JSON (proxy error page) */
      }
      if (xhr.status === 200 && body.referenceId) resolve({ ok: true, referenceId: body.referenceId });
      else resolve({ ok: false, error: body.error ?? (xhr.status === 413 ? "too_large" : "server"), status: xhr.status });
    };
    xhr.onerror = () => resolve({ ok: false, error: "network", status: 0 });
    xhr.ontimeout = () => resolve({ ok: false, error: "network", status: 0 });
    xhr.send(form);
  });
}
