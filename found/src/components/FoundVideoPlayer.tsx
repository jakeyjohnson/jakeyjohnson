import { useRef } from "react";
import { StyleSheet } from "react-native";
import Video, { type OnProgressData, type OnReceiveAdEventData, type VideoRef } from "react-native-video";

interface Props {
  playbackUrl: string;
  adTagUrl: string | null;
  startPositionSeconds?: number;
  onProgress?: (seconds: number) => void;
  onComplete?: () => void;
}

/**
 * Plays a Mux HLS stream with a pre-roll (or VMAP-scheduled) ad break via
 * react-native-video's built-in Google IMA integration — ad request,
 * playback UI, and pausing/resuming content are all handled natively by the
 * library (see the `ad` field on `source`), so this component just wires up
 * the source and forwards progress/completion callbacks.
 *
 * Requires the `enableADSExtension` react-native-video config plugin option
 * (set in app.config.ts) and a native build — Expo Go does not include the
 * IMA SDK, so `adTagUrl` is silently ignored there and content plays without
 * ads rather than crashing.
 */
export function FoundVideoPlayer({
  playbackUrl,
  adTagUrl,
  startPositionSeconds = 0,
  onProgress,
  onComplete,
}: Props) {
  const videoRef = useRef<VideoRef>(null);

  const handleProgress = (data: OnProgressData) => onProgress?.(Math.floor(data.currentTime));

  const handleAdEvent = (event: OnReceiveAdEventData) => {
    if (event.event === "ERROR") console.warn("[ads] ad break failed, content plays without it:", event.data);
  };

  return (
    <Video
      ref={videoRef}
      source={{
        uri: playbackUrl,
        startPosition: startPositionSeconds * 1000,
        ad: adTagUrl ? { type: "csai", adTagUrl } : undefined,
      }}
      style={styles.player}
      controls
      resizeMode="contain"
      onProgress={handleProgress}
      onReceiveAdEvent={handleAdEvent}
      onEnd={onComplete}
    />
  );
}

const styles = StyleSheet.create({
  player: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000" },
});
