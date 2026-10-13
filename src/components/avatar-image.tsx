"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { subscribeSignedMedia } from "@/components/signed-media-refresh";
import { ownedStoragePath } from "@/lib/avatar-path";
import {
  imageAlreadyFailed,
  imageRetryOnError,
  imageRetryReset,
  type ImageRetryState,
} from "@/lib/image-retry";
import { refreshAvatar } from "@/server/avatars";

export function AvatarImage({
  profileId,
  src,
  alt,
  className,
  fallback,
}: {
  profileId: string;
  src: string | null;
  alt: string;
  className: string;
  fallback: ReactNode;
}) {
  const path = ownedStoragePath(profileId, src);
  const srcRef = useRef(src);
  srcRef.current = src;
  const [url, setUrl] = useState<string | null>(path ? src : null);
  const [broken, setBroken] = useState(false);
  const retryState = useRef<ImageRetryState>(imageRetryReset());
  const imgRef = useRef<HTMLImageElement>(null);
  const onErrorRef = useRef<() => void>(() => {});

  useEffect(() => {
    setUrl(path ? srcRef.current : null);
    setBroken(false);
    retryState.current = imageRetryReset();
  }, [profileId, path]);

  useEffect(() => {
    const img = imgRef.current;
    if (imageAlreadyFailed(img)) onErrorRef.current();
  }, [url, path]);

  useEffect(() => {
    if (!path) return;
    return subscribeSignedMedia("avatar", profileId, (next) => {
      retryState.current = imageRetryReset();
      if (next) {
        setUrl(next);
        setBroken(false);
      }
    });
  }, [profileId, path]);

  onErrorRef.current = () => {
    const decision = imageRetryOnError(retryState.current);
    retryState.current = decision.state;
    if (decision.action === "fallback") {
      setBroken(true);
      return;
    }
    void refreshAvatar(profileId).then((result) => {
      if (!retryState.current.retried) return;
      if (result.ok) {
        setUrl(result.url);
        setBroken(false);
        return;
      }
      setBroken(true);
    });
  };

  if (!path || broken || !url) return fallback;

  return (
    <img
      ref={imgRef}
      src={url}
      alt={alt}
      className={className}
      onError={() => onErrorRef.current()}
    />
  );
}
