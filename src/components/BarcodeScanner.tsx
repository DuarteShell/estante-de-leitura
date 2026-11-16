import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { cleanIsbn, isValidIsbn } from '../lib/isbn';

/** API nativa (Chrome/Android, Edge…). Não existe nos tipos do TS ainda. */
interface NativeDetector {
  detect(src: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: {
      new (opts: { formats: string[] }): NativeDetector;
      getSupportedFormats(): Promise<string[]>;
    };
  }
}

async function nativeDetector(): Promise<NativeDetector | null> {
  try {
    if (!window.BarcodeDetector) return null;
    const supported = await window.BarcodeDetector.getSupportedFormats();
    if (!supported.includes('ean_13')) return null;
    return new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a'] });
  } catch {
    return null;
  }
}

const VIDEO_SIZE = { width: { ideal: 1920 }, height: { ideal: 1080 } };

function hasAutofocus(track: MediaStreamTrack) {
  const caps = (track.getCapabilities?.() ?? {}) as { focusMode?: string[] };
  // Navegador que não informa (Safari) → assume que está ok
  return !caps.focusMode || caps.focusMode.includes('continuous');
}

/** Testa as outras câmeras traseiras e devolve a primeira com foco contínuo. */
async function findAutofocusCamera(currentId?: string): Promise<MediaStream | null> {
  try {
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter(
      (d) => d.kind === 'videoinput' && d.deviceId !== currentId && !/front|frontal|user|selfie/i.test(d.label)
    );
    for (const d of devices) {
      let s: MediaStream | undefined;
      try {
        s = await navigator.mediaDevices.getUserMedia({ audio: false, video: { deviceId: { exact: d.deviceId }, ...VIDEO_SIZE } });
        const t = s.getVideoTracks()[0];
        const caps = (t.getCapabilities?.() ?? {}) as { focusMode?: string[] };
        const back = !t.getSettings().facingMode || t.getSettings().facingMode === 'environment';
        if (back && caps.focusMode?.includes('continuous')) return s;
      } catch {
        /* câmera ocupada/indisponível */
      }
      s?.getTracks().forEach((t) => t.stop());
    }
  } catch {
    /* sem enumerateDevices */
  }
  return null;
}

/** Lê o código de barras (EAN-13 / ISBN) pela câmera traseira. */
export function BarcodeScanner({ onDetected }: { onDetected: (isbn: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cb = useRef(onDetected);
  cb.current = onDetected;
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [torch, setTorch] = useState<{ on: boolean; toggle: () => void } | null>(null);

  useEffect(() => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError('A câmera só funciona com https (no site publicado) ou em localhost. Digite o ISBN abaixo.');
      return;
    }
    let done = false;
    let stream: MediaStream | undefined;
    let stopLoop: (() => void) | undefined;
    let lastWrong = '';

    const handle = (raw: string) => {
      if (done) return;
      const text = cleanIsbn(raw);
      if (isValidIsbn(text)) {
        done = true;
        stopLoop?.();
        navigator.vibrate?.(60);
        cb.current(text);
      } else if (text !== lastWrong) {
        // Ex.: código de preço/estoque colado no livro
        lastWrong = text;
        setHint(`Li ${text}, mas não é um ISBN. Procure o código que começa com 978 ou 979.`);
      }
    };

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, ...VIDEO_SIZE }
        });
      } catch (e) {
        if (done) return;
        setError(
          (e as Error).name === 'NotAllowedError'
            ? 'Sem permissão pra usar a câmera. Libere nas configurações do navegador ou digite o ISBN.'
            : 'Não consegui abrir a câmera. Digite o ISBN abaixo.'
        );
        return;
      }
      if (done) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      // Celulares com várias câmeras traseiras costumam abrir a grande-angular, que não tem
      // foco automático (imagem borrada de perto). Procura uma traseira com foco contínuo.
      if (!hasAutofocus(stream.getVideoTracks()[0])) {
        const better = await findAutofocusCamera(stream.getVideoTracks()[0].getSettings().deviceId);
        if (better) {
          stream.getTracks().forEach((t) => t.stop());
          stream = better;
        }
      }
      if (done) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      // Foco contínuo: sem isso muitos celulares ficam desfocados de perto e nunca leem.
      const track = stream.getVideoTracks()[0];
      const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { focusMode?: string[]; torch?: boolean };
      if (caps.focusMode?.includes('continuous')) {
        track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => {});
      }
      if (caps.torch) {
        let on = false;
        const toggle = () => {
          on = !on;
          track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] }).catch(() => {});
          setTorch({ on, toggle });
        };
        setTorch({ on, toggle });
      }

      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play().catch(() => {});

      const native = await nativeDetector();
      if (done) return;

      if (native) {
        let timer = 0;
        let busy = false;
        const tick = async () => {
          if (done) return;
          if (!busy && video.readyState >= 2) {
            busy = true;
            try {
              const codes = await native.detect(video);
              for (const c of codes) handle(c.rawValue);
            } catch {
              /* frame ruim, tenta o próximo */
            }
            busy = false;
          }
          if (!done) timer = window.setTimeout(tick, 150);
        };
        tick();
        stopLoop = () => clearTimeout(timer);
      } else {
        // Reserva (iPhone/Safari, Firefox): ZXing em JS, no modo mais insistente
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A]);
        hints.set(DecodeHintType.TRY_HARDER, true);
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 100 });
        const controls = await reader.decodeFromVideoElement(video, (result) => {
          if (result) handle(result.getText());
        });
        stopLoop = () => controls.stop();
        if (done) controls.stop();
      }
    })();

    return () => {
      done = true;
      stopLoop?.();
      stream?.getTracks().forEach((t) => t.stop());
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
    <div className="stack" style={{ gap: 8 }}>
      <div className="scanner">
        <video ref={videoRef} muted playsInline autoPlay aria-label="Câmera lendo o código de barras" />
        <div className="frame" />
        <div className="laser" />
        {torch && (
          <button
            type="button"
            className="btn"
            onClick={torch.toggle}
            style={{ position: 'absolute', top: 10, right: 10, padding: '6px 12px', fontSize: 13 }}
            aria-pressed={torch.on}
          >
            {torch.on ? 'Apagar luz' : 'Lanterna'}
          </button>
        )}
        <span className="tiny" style={{ position: 'absolute', left: 0, right: 0, bottom: 10, textAlign: 'center', color: '#DCE4CF', fontWeight: 700 }}>
          Aponte para o código de barras no verso, a uns 15 cm
        </span>
      </div>
      {hint && (
        <p className="small" role="status" style={{ margin: 0 }}>
          {hint}
        </p>
      )}
    </div>
  );
}
