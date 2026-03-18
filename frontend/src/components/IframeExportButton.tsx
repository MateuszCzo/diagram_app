import { useState, useCallback } from 'react';

interface IframeExportButtonProps {
  diagramId: string;
}

const FRONTEND_URL = window.location.origin;

export function IframeExportButton({ diagramId }: IframeExportButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const iframeHtml = `<iframe\n  src="${FRONTEND_URL}/embed/${diagramId}"\n  width="100%"\n  height="auto"\n  frameborder="0"\n  allowfullscreen\n></iframe>`;

    try {
      await navigator.clipboard.writeText(iframeHtml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = iframeHtml;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [diagramId]);

  return (
    <button
      onClick={handleCopy}
      title="Copy embed code"
      style={{
        background: copied ? '#1a3a2a' : 'transparent',
        border: `1px solid ${copied ? '#3fb950' : '#30363d'}`,
        color: copied ? '#3fb950' : '#7d8590',
        borderRadius: 6,
        padding: '5px 12px',
        fontSize: 12,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      {copied ? '✓ Copied!' : '</>  Embed'}
    </button>
  );
}