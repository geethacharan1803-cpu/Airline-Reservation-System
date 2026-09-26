import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface Props {
  chart: string;
}

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
  fontFamily: 'Outfit, Plus Jakarta Sans, sans-serif',
  themeVariables: {
    primaryColor: '#0284c7',
    primaryTextColor: '#f8fafc',
    primaryBorderColor: '#38bdf8',
    lineColor: '#38bdf8',
    secondaryColor: '#1e293b',
    tertiaryColor: '#0f172a',
    mainBkg: '#0f172a',
    nodeBorder: '#38bdf8',
  },
});

let idCounter = 0;

export function MermaidViewer({ chart }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    const renderChart = async () => {
      try {
        const uniqueId = `mermaid-chart-${++idCounter}`;
        const { svg: renderedSvg } = await mermaid.render(uniqueId, chart.trim());
        if (isMounted) {
          setSvg(renderedSvg);
          setError('');
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || 'Failed to render diagram');
        }
      }
    };

    renderChart();
    return () => {
      isMounted = false;
    };
  }, [chart]);

  if (error) {
    return (
      <div style={{
        background: 'rgba(15, 23, 42, 0.6)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-4)',
      }}>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gold-400)', marginBottom: 'var(--space-2)' }}>
          Mermaid Source:
        </div>
        <pre style={{
          fontSize: 'var(--text-xs)',
          fontFamily: 'var(--font-mono)',
          color: '#94a3b8',
          margin: 0,
          whiteSpace: 'pre-wrap',
        }}>
          {chart}
        </pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        background: '#0b1120',
        border: '1px solid rgba(56, 189, 248, 0.2)',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-6)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflowX: 'auto',
        boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
      }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
