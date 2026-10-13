"use client";

import { useEffect, useRef, useState } from "react";
import { SIGNED_URL_REFRESH_MS } from "@/lib/signed-url";
import { refreshAvatar } from "@/server/avatars";

export function AvatarImage({
  profileId,
  src,
  alt,
  className,
}: {
  profileId: string;
  src: string;
  alt: string;
  className: string;
}) {
  const [url, setUrl] = useState(src);
  const retriedFor = useRef<string | null>(null);

  useEffect(() => {
    setUrl(src);
    retriedFor.current = null;
  }, [profileId, src]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void refreshAvatar(profileId).then((result) => {
        if (result.ok) setUrl(result.url);
      });
    }, SIGNED_URL_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [profileId]);

  return (
    <img
      src={url}
      alt={alt}
      className={className}
      onError={() => {
        if (retriedFor.current === url) return;
        const failed = url;
        retriedFor.current = failed;
        void refreshAvatar(profileId).then((result) => {
          if (result.ok && result.url !== failed) setUrl(result.url);
        });
      }}
    />
  );
}
