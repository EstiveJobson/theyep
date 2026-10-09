"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { installPreviewHostBridge } from "@/lib/preview-host-bridge";

const PATHS = ["/", "/postar", "/perfil"];

export function PreviewBridge() {
  const router = useRouter();

  useEffect(() => {
    return installPreviewHostBridge({
      navigate: (path) => {
        router.push(path);
      },
      getRoutePaths: () => PATHS,
    });
  }, [router]);

  return null;
}
