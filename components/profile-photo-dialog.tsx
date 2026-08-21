"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, LoaderCircle, RotateCcw, Trash2, X } from "lucide-react";
import { frontendImageError, IMAGE_MAX_LABEL, IMAGE_TYPE_MESSAGE, cameraFailureMessage } from "@/lib/image-policy";
import { UserAvatar } from "@/components/media-display";

type ProfilePhotoDialogProps = {
  open: boolean;
  name: string;
  currentPhotoUrl: string | null;
  optional?: boolean;
  onClose: () => void;
  onUse: (file: File) => Promise<boolean>;
  onRemove?: () => Promise<boolean>;
};

export function ProfilePhotoDialog({ open, name, currentPhotoUrl, optional = false, onClose, onUse, onRemove }: ProfilePhotoDialogProps) {
  if (!open) return null;
  return <ProfilePhotoDialogContent name={name} currentPhotoUrl={currentPhotoUrl} optional={optional} onClose={onClose} onUse={onUse} onRemove={onRemove} />;
}

function ProfilePhotoDialogContent({ name, currentPhotoUrl, optional = false, onClose, onUse, onRemove }: Omit<ProfilePhotoDialogProps, "open">) {
  const [mode, setMode] = useState<"options" | "camera" | "preview">("options");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream, mode]);

  useEffect(() => () => {
    stream?.getTracks().forEach((track) => track.stop());
  }, [stream]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function stopCamera() {
    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);
  }

  function selectFile(file: File | undefined) {
    if (!file) return;
    const error = frontendImageError(file);
    if (error) {
      setMessage(error);
      return;
    }
    stopCamera();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setMessage("");
    setMode("preview");
  }

  async function startCamera() {
    setMessage("");
    const mobileCapture = window.matchMedia?.("(pointer: coarse)").matches;
    if (mobileCapture || !navigator.mediaDevices?.getUserMedia) {
      cameraInputRef.current?.click();
      return;
    }
    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      setStream(nextStream);
      setMode("camera");
    } catch (error) {
      setMessage(cameraFailureMessage(error));
    }
  }

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setMessage("A câmera ainda está iniciando. Aguarde um instante.");
      return;
    }
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", .86));
    if (!blob) {
      setMessage("Não foi possível capturar a foto. Tente novamente.");
      return;
    }
    selectFile(new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" }));
  }

  async function applyPhoto() {
    if (!selectedFile || loading) return;
    setLoading(true);
    setMessage("");
    try {
      if (await onUse(selectedFile)) onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível atualizar a foto.");
    } finally {
      setLoading(false);
    }
  }

  async function removePhoto() {
    if (!onRemove || loading) return;
    setLoading(true);
    setMessage("");
    try {
      if (await onRemove()) onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível remover a foto.");
    } finally {
      setLoading(false);
    }
  }

  function close() {
    stopCamera();
    onClose();
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="dialog-card profile-photo-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-photo-title">
        <div className="dialog-heading">
          <span className="dialog-icon"><Camera size={22} /></span>
          <div><p className="eyebrow">Sua imagem</p><h2 id="profile-photo-title">Foto de perfil</h2></div>
          <button className="icon-button" type="button" onClick={close} aria-label="Fechar"><X size={20} /></button>
        </div>

        {mode === "options" ? (
          <>
            <div className="profile-photo-current"><UserAvatar photoUrl={currentPhotoUrl} name={name} className="profile-photo-large" /></div>
            <p className="image-help">{IMAGE_TYPE_MESSAGE} Tamanho máximo: {IMAGE_MAX_LABEL}.</p>
            <div className="profile-photo-actions">
              <button className="primary-button compact-button" type="button" onClick={() => void startCamera()} disabled={loading}><Camera size={18} /> Tirar foto</button>
              <button className="secondary-button" type="button" onClick={() => fileInputRef.current?.click()} disabled={loading}><ImagePlus size={18} /> Escolher imagem</button>
              {currentPhotoUrl && onRemove ? <button className="danger-outline-button" type="button" onClick={() => void removePhoto()} disabled={loading}><Trash2 size={18} /> Remover foto</button> : null}
              {optional ? <button className="text-button profile-skip" type="button" onClick={close}>Agora não</button> : null}
            </div>
          </>
        ) : null}

        {mode === "camera" ? (
          <>
            <div className="camera-preview"><video ref={videoRef} autoPlay muted playsInline /></div>
            <div className="dialog-actions"><button className="secondary-button" type="button" onClick={() => { stopCamera(); setMode("options"); }}>Cancelar</button><button className="primary-button compact-button" type="button" onClick={() => void capturePhoto()}><Camera size={18} /> Tirar foto</button></div>
          </>
        ) : null}

        {mode === "preview" ? (
          <>
            <div className="captured-photo-preview">{previewUrl ? <img src={previewUrl} alt="Pré-visualização da foto" /> : null}</div>
            <div className="dialog-actions"><button className="secondary-button" type="button" onClick={() => { if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null); setSelectedFile(null); setMode("options"); }} disabled={loading}><RotateCcw size={18} /> Tirar novamente</button><button className="primary-button compact-button" type="button" onClick={() => void applyPhoto()} disabled={loading}>{loading ? <LoaderCircle className="spin" size={18} /> : null} Usar esta foto</button></div>
          </>
        ) : null}

        <div className={`form-feedback${message ? " form-feedback-visible" : ""}`} role="status">{message}</div>
        <input ref={fileInputRef} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => selectFile(event.target.files?.[0])} />
        <input ref={cameraInputRef} className="visually-hidden" type="file" accept="image/*" capture="user" onChange={(event) => selectFile(event.target.files?.[0])} />
      </section>
    </div>
  );
}
