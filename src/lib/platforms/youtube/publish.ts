import { createReadStream } from "node:fs";
import { google } from "googleapis";
import { getYouTubeOAuthClient } from "./token";
import {
  assertVideo,
  composeText,
  type LoadedPlatformPost,
} from "../publish-context";

export type PublishResult = {
  externalPostId: string;
  externalPermalink: string | null;
};

function ensureShortsTag(s: string): string {
  return /#shorts/i.test(s) ? s : `${s.trimEnd()} #Shorts`;
}

export async function publishYouTube(pp: LoadedPlatformPost): Promise<PublishResult> {
  const first = pp.post.media[0];
  if (!first) throw new Error("no media on post");
  assertVideo(first.mediaAsset);

  const auth = await getYouTubeOAuthClient(pp.accountId);
  const youtube = google.youtube({ version: "v3", auth });

  const title = ensureShortsTag(pp.post.title || "Untitled").slice(0, 100);
  const description = ensureShortsTag(composeText(pp)).slice(0, 5000);

  const res = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title,
        description,
        categoryId: "22",
      },
      status: {
        privacyStatus: "public",
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      mimeType: first.mediaAsset.mimeType,
      body: createReadStream(first.mediaAsset.storagePath),
    },
  });

  const id = res.data.id;
  if (!id) throw new Error("YouTube: no video id in response");
  return {
    externalPostId: id,
    externalPermalink: `https://www.youtube.com/shorts/${id}`,
  };
}
