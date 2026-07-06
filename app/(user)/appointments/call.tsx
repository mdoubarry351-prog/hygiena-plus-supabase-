import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar } from "@/components/Avatar";
import { getConsultationRoom } from "@/lib/call-service";
import { colors, radius, spacing, typography } from "@/theme";

// IMPORTANT (leçon reanimated) : AUCUN import du SDK Daily au niveau module.
// Le SDK natif (react-native-webrtc) n'existe pas dans Expo Go → on l'importe
// UNIQUEMENT dynamiquement, dans un try/catch, à l'ouverture de l'écran.

type Phase = "loading" | "unavailable" | "error" | "connecting" | "joined";

export default function CallScreen() {
  const { appointmentId, mode, peerName } = useLocalSearchParams<{ appointmentId: string; mode?: string; peerName?: string }>();
  const router = useRouter();
  const isVideo = mode !== "audio";
  const peer = (peerName as string) || "Votre praticien";

  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [attempt, setAttempt] = useState(0); // incrémenté par « Réessayer »

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(isVideo);
  const [localVideoTrack, setLocalVideoTrack] = useState<unknown>(null);
  const [remoteVideoTrack, setRemoteVideoTrack] = useState<unknown>(null);
  const [remoteAudioTrack, setRemoteAudioTrack] = useState<unknown>(null);
  const [peerPresent, setPeerPresent] = useState(false);

  // Composant vidéo Daily, chargé dynamiquement puis stocké pour le rendu JSX.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [MediaView, setMediaView] = useState<any>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const callRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let call: any = null;

    (async () => {
      setPhase("loading");
      // 1) Import dynamique du SDK (échoue dans Expo Go → état « indisponible »).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let Daily: any, DailyMediaView: any;
      try {
        const mod = await import("@daily-co/react-native-daily-js");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Daily = (mod as any).default;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        DailyMediaView = (mod as any).DailyMediaView;
      } catch {
        if (!cancelled) setPhase("unavailable");
        return;
      }
      if (!Daily || !DailyMediaView) { if (!cancelled) setPhase("unavailable"); return; }
      if (cancelled) return;
      setMediaView(() => DailyMediaView);

      // 2) Récupère la salle privée (jeton temporaire) auprès de l'Edge Function.
      let room;
      try {
        room = await getConsultationRoom(appointmentId);
      } catch (e) {
        if (!cancelled) { setErrorMsg(e instanceof Error ? e.message : "Connexion impossible."); setPhase("error"); }
        return;
      }
      if (cancelled) return;

      // 3) Crée l'objet d'appel, écoute les participants, rejoint la salle.
      try {
        setPhase("connecting");
        call = Daily.createCallObject({ audioSource: true, videoSource: isVideo });
        callRef.current = call;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sync = () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const ps: any = call.participants();
          const local = ps?.local;
          setMicOn(!!local?.audio);
          setCamOn(!!local?.video);
          setLocalVideoTrack(local?.tracks?.video?.state === "playable" ? local.tracks.video.persistentTrack : null);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const remote: any = Object.values(ps ?? {}).find((p: any) => p && !p.local);
          setPeerPresent(!!remote);
          setRemoteVideoTrack(remote?.tracks?.video?.state === "playable" ? remote.tracks.video.persistentTrack : null);
          setRemoteAudioTrack(remote?.tracks?.audio?.state === "playable" ? remote.tracks.audio.persistentTrack : null);
        };

        call.on("participant-joined", sync);
        call.on("participant-updated", sync);
        call.on("participant-left", sync);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        call.on("error", (ev: any) => {
          if (!cancelled) { setErrorMsg(ev?.errorMsg || "Erreur d'appel."); setPhase("error"); }
        });

        await call.join({ url: room.roomUrl, token: room.token });
        if (!isVideo) { try { await call.setLocalVideo(false); } catch { /* ignore */ } }
        if (cancelled) return;
        setPhase("joined");
        sync();
      } catch (e) {
        if (!cancelled) { setErrorMsg(e instanceof Error ? e.message : "Connexion à la salle impossible."); setPhase("error"); }
      }
    })();

    return () => {
      cancelled = true;
      const c = callRef.current;
      if (c) { try { c.leave(); } catch { /* ignore */ } try { c.destroy(); } catch { /* ignore */ } callRef.current = null; }
    };
  }, [appointmentId, isVideo, attempt]);

  async function toggleMic() {
    const c = callRef.current; if (!c) return;
    const next = !micOn; setMicOn(next);
    try { await c.setLocalAudio(next); } catch { /* ignore */ }
  }
  async function toggleCam() {
    const c = callRef.current; if (!c) return;
    const next = !camOn; setCamOn(next);
    try { await c.setLocalVideo(next); } catch { /* ignore */ }
  }
  async function flipCam() {
    const c = callRef.current; if (!c) return;
    try { await c.cycleCamera(); } catch { /* ignore */ }
  }
  function hangup() {
    const c = callRef.current;
    if (c) { try { c.leave(); } catch { /* ignore */ } try { c.destroy(); } catch { /* ignore */ } callRef.current = null; }
    router.back();
  }

  // ----- États non vidéo (indisponible / erreur / connexion) -----
  if (phase === "unavailable") {
    return (
      <CenterScreen
        icon="phone-portrait-outline"
        title="Appels indisponibles ici"
        message="Les appels audio/vidéo nécessitent l'application installée (build de développement), pas Expo Go."
        primaryLabel="Retour"
        onPrimary={() => router.back()}
      />
    );
  }
  if (phase === "error") {
    return (
      <CenterScreen
        icon="warning-outline"
        title="Connexion impossible"
        message={errorMsg || "La salle d'appel n'a pas pu être rejointe."}
        primaryLabel="Réessayer"
        onPrimary={() => setAttempt((a) => a + 1)}
        secondaryLabel="Retour"
        onSecondary={() => router.back()}
      />
    );
  }

  const connecting = phase === "loading" || phase === "connecting";

  return (
    <View style={styles.fill}>
      {/* Vidéo distante plein écran (mode vidéo + pair présent), sinon attente. */}
      {phase === "joined" && remoteVideoTrack && MediaView ? (
        <MediaView videoTrack={remoteVideoTrack} audioTrack={remoteAudioTrack} objectFit="cover" style={styles.remote} />
      ) : (
        <View style={styles.waiting}>
          <Avatar name={peer} size={96} />
          <Text style={styles.peerName}>{peer}</Text>
          <View style={styles.statusRow}>
            {connecting ? <ActivityIndicator color={colors.white} /> : null}
            <Text style={styles.statusText}>
              {connecting ? "Connexion…" : peerPresent ? (isVideo ? "Caméra coupée" : "En communication") : "En attente de votre praticien…"}
            </Text>
          </View>
        </View>
      )}

      {/* Vignette caméra locale (mode vidéo). */}
      {phase === "joined" && isVideo && camOn && localVideoTrack && MediaView ? (
        <View style={styles.pip}>
          <MediaView videoTrack={localVideoTrack} audioTrack={null} mirror objectFit="cover" style={styles.pipVideo} />
        </View>
      ) : null}

      {/* Barre de contrôles */}
      <SafeAreaView edges={["bottom"]} style={[styles.controlsSafe, { pointerEvents: "box-none" }]}>
        <View style={styles.controls}>
          <ControlButton icon={micOn ? "mic" : "mic-off"} active={micOn} onPress={toggleMic} label="Micro" />
          {isVideo ? <ControlButton icon={camOn ? "videocam" : "videocam-off"} active={camOn} onPress={toggleCam} label="Caméra" /> : null}
          {isVideo ? <ControlButton icon="camera-reverse-outline" active onPress={flipCam} label="Pivoter" /> : null}
          <ControlButton icon="call" danger onPress={hangup} label="Raccrocher" />
        </View>
      </SafeAreaView>
    </View>
  );
}

function ControlButton({ icon, onPress, active, danger, label }: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void; active?: boolean; danger?: boolean; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.ctrl, danger ? styles.ctrlDanger : active ? styles.ctrlActive : styles.ctrlOff, pressed && styles.ctrlPressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={24} color={danger || active ? colors.white : colors.text} />
    </Pressable>
  );
}

function CenterScreen({ icon, title, message, primaryLabel, onPrimary, secondaryLabel, onSecondary }: { icon: keyof typeof Ionicons.glyphMap; title: string; message: string; primaryLabel: string; onPrimary: () => void; secondaryLabel?: string; onSecondary?: () => void }) {
  return (
    <SafeAreaView style={styles.center}>
      <View style={styles.centerIcon}><Ionicons name={icon} size={34} color={colors.primaryDark} /></View>
      <Text style={styles.centerTitle}>{title}</Text>
      <Text style={styles.centerMsg}>{message}</Text>
      <Pressable onPress={onPrimary} style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]} accessibilityRole="button" accessibilityLabel={primaryLabel}>
        <Text style={styles.primaryBtnText}>{primaryLabel}</Text>
      </Pressable>
      {secondaryLabel && onSecondary ? (
        <Pressable onPress={onSecondary} style={styles.secondaryBtn} accessibilityRole="button" accessibilityLabel={secondaryLabel}>
          <Text style={styles.secondaryBtnText}>{secondaryLabel}</Text>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#0B1220" },
  remote: { ...StyleSheet.absoluteFillObject },
  waiting: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: spacing.md },
  peerName: { ...typography.h2, color: colors.white },
  statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  statusText: { ...typography.body, color: "rgba(255,255,255,0.85)" },
  pip: {
    position: "absolute", top: spacing.xl, right: spacing.lg, width: 104, height: 150,
    borderRadius: radius.md, overflow: "hidden", borderWidth: 2, borderColor: "rgba(255,255,255,0.4)", backgroundColor: "#000",
  },
  pipVideo: { flex: 1 },
  controlsSafe: { position: "absolute", left: 0, right: 0, bottom: 0 },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.md, paddingVertical: spacing.lg },
  ctrl: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  ctrlActive: { backgroundColor: "rgba(255,255,255,0.22)" },
  ctrlOff: { backgroundColor: colors.white },
  ctrlDanger: { backgroundColor: colors.danger },
  ctrlPressed: { opacity: 0.7 },
  center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.sm },
  centerIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  centerTitle: { ...typography.h2, textAlign: "center" },
  centerMsg: { ...typography.body, color: colors.textMuted, textAlign: "center", lineHeight: 22 },
  primaryBtn: { marginTop: spacing.md, backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md },
  primaryBtnText: { ...typography.name, color: colors.white },
  btnPressed: { opacity: 0.85 },
  secondaryBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  secondaryBtnText: { ...typography.body, color: colors.primary, fontWeight: "700" },
});
