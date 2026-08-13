"use client";

import Script from "next/script";

export type CaptchaProps = { provider: string; siteKey: string; className: string; script: string };

/**
 * Draws the provider's widget.
 *
 * All three providers scan the document for their own class and render into
 * it, writing the token into a hidden input the form then submits — so there
 * is nothing to wire up beyond the markup and the script.
 */
export default function CaptchaField({ config }: { config: CaptchaProps }) {
  return (
    <div>
      <div className={config.className} data-sitekey={config.siteKey} data-theme="auto" />
      <Script src={config.script} strategy="lazyOnload" async defer />
    </div>
  );
}
