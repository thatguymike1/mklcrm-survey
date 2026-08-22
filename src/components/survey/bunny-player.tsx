"use client";

import { isValidBunnyUrl, getBunnyEmbedUrl } from "@/lib/survey/media";

interface BunnyPlayerProps {
  videoUrl: string;
  questionText: string;
}

export function BunnyPlayer({ videoUrl, questionText }: BunnyPlayerProps) {
  if (!isValidBunnyUrl(videoUrl)) {
    return (
      <div className="w-full aspect-video rounded-lg bg-gray-100 flex items-center justify-center text-sm text-gray-400">
        Video unavailable.
      </div>
    );
  }

  return (
    <div className="w-full aspect-video rounded-lg overflow-hidden bg-black">
      <iframe
        src={getBunnyEmbedUrl(videoUrl)}
        title={questionText}
        className="w-full h-full"
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        loading="lazy"
      />
    </div>
  );
}
