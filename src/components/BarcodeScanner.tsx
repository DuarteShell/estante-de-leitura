import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { isValidIsbn } from '../lib/isbn';

/** Lê o código de barras (EAN-13 / ISBN) pela câmera traseira. */
export function BarcodeScanner({ onDetected }: { onDetected: (isbn: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cb = useRef(onDetected);
  cb.current = onDetected;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError('A câmera só funciona com https (no site publicado) ou em localhost. Digite o ISBN abaixo.');
      return;
    }
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A]);
    const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 });
    let controls: IScannerControls | undefined;
    let done = false;

    reader
      .decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } } },
        videoRef.current!,
        (result, _err, c) => {
          if (!result || done) return;
          const text = result.getText();
          if (isValidIsbn(text)) {
            done = true;
            c.stop();
            navigator.vibrate?.(60);
            cb.current(text);
          }
        }
      )
      .then((c) => {
        controls = c;
        if (done) c.stop();
      })
      .catch((e: Error) => {
        setError(
          e.name === 'NotAllowedError'
            ? 'Sem permissão pra usar a câmera. Libere nas configurações do navegador ou digite o ISBN.'
            : 'Não consegui abrir a câmera. Digite o ISBN abaixo.'
        );
      });

    return () => {
      done = true;
      controls?.stop();
    };
  }, []);

  if (error) {
    return (
      <div className="empty" role="alert">
        {error}
      </div>
    );
  }
  return (
    <div className="scanner">
      <video ref={videoRef} muted playsInline aria-label="Câmera lendo o código de barras" />
      <div className="frame" />
      <div className="laser" />
      <span className="tiny" style={{ position: 'absolute', left: 0, right: 0, bottom: 10, textAlign: 'center', color: '#DCE4CF', fontWeight: 700 }}>
        Aponte para o código de barras no verso
      </span>
    </div>
  );
}
