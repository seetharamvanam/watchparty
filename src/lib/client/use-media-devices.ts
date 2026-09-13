"use client";

import { useCallback, useEffect, useState } from "react";

export interface MediaDeviceOption {
  deviceId: string;
  label: string;
}

export function useMediaDevices() {
  const [cameras, setCameras] = useState<MediaDeviceOption[]>([]);
  const [mics, setMics] = useState<MediaDeviceOption[]>([]);
  const [cameraId, setCameraId] = useState("");
  const [micId, setMicId] = useState("");

  const refresh = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const devices = await navigator.mediaDevices.enumerateDevices();
    const video = devices
      .filter((d) => d.kind === "videoinput")
      .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }));
    const audio = devices
      .filter((d) => d.kind === "audioinput")
      .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}` }));
    setCameras(video);
    setMics(audio);
    setCameraId((current) => current || video[0]?.deviceId || "");
    setMicId((current) => current || audio[0]?.deviceId || "");
  }, []);

  useEffect(() => {
    const onChange = () => {
      void refresh();
    };
    navigator.mediaDevices?.addEventListener?.("devicechange", onChange);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", onChange);
  }, [refresh]);

  return { cameras, mics, cameraId, micId, setCameraId, setMicId, refresh };
}
