"use client";

import { useRef, useState, useTransition } from "react";
import { uploadImageAction } from "@/app/actions/admin/media";
import { Icon } from "@/components/icons";

/**
 * Uploads immediately on pick and stores the resulting URL in a hidden input,
 * so the surrounding form submits a plain string and needs no multipart body.
 */
export default function ImageUpload({
  name,
  value,
  label,
  hint,
  removeLabel,
  uploadLabel,
}: {
  name: string;
  value: string;
  label: string;
  hint: string;
  removeLabel: string;
  uploadLabel: string;
}) {
  const [url, setUrl] = useState(value);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (file: File | undefined) => {
    if (!file) return;
    setError("");
    const form = new FormData();
    form.append("file", file);
    start(async () => {
      const result = await uploadImageAction(form);
      if (result.error) setError(result.error);
      else if (result.url) setUrl(result.url);
    });
  };

  return (
    <div>
      <span className="label">{label}</span>
      <input type="hidden" name={name} value={url} />

      <div className="flex items-center gap-3">
        <span className="surface-2 flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--border)]">
          {url ? (
            // Arbitrary uploaded dimensions, so the intrinsic size is unknown here.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="muted">
              <Icon name="package" size={22} />
            </span>
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={pending}
              className="btn btn-ghost btn-sm"
            >
              {pending ? (
                <span className="inline-flex animate-spin">
                  <Icon name="spinner" size={15} />
                </span>
              ) : (
                <Icon name="download" size={15} />
              )}
              {uploadLabel}
            </button>
            {url && (
              <button type="button" onClick={() => setUrl("")} className="btn btn-danger btn-sm">
                <Icon name="trash" size={15} />
                {removeLabel}
              </button>
            )}
          </div>
          <p className="form-hint">{hint}</p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
        className="sr-only"
        onChange={(e) => pick(e.target.files?.[0])}
      />

      {error && (
        <p className="form-error" role="alert">
          <Icon name="alert" size={14} />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
