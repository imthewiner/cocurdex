import CloseIcon from "@expo/material-symbols/close.xml";
import LinkIcon from "@expo/material-symbols/link.xml";
import {
  type BarcodeScanningResult,
  CameraView,
  useCameraPermissions,
} from "expo-camera";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { Stack } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, StyleSheet, Text, View } from "react-native";
import { space, themeColors } from "@/theme";
import { hosts, selectHost } from "./hosts";
import type { PairFailure } from "./hosts-store";

const scanColors = themeColors.dark;
const SCAN_FOREGROUND = scanColors.foreground;
const CORNER = { size: 48, width: 4, radius: 28 } as const;

type ScanFailure = PairFailure | "notPairingCode";

function useScanFailureMessages(): Record<ScanFailure, string> {
  const { t } = useTranslation("hosts");
  return {
    notPairingCode: t("scan.failure.notPairingCode"),
    link: t("scan.failure.notPairingCode"),
    invalid: t("pair.failure.invalid"),
    rateLimited: t("pair.failure.rateLimited"),
    unreachable: t("pair.failure.unreachable"),
  };
}

function Viewfinder() {
  const { t } = useTranslation("hosts");
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={t("scan.viewfinder")}
      style={styles.viewfinder}
    >
      <View style={[styles.corner, styles.topLeft]} />
      <View style={[styles.corner, styles.topRight]} />
      <View style={[styles.corner, styles.bottomLeft]} />
      <View style={[styles.corner, styles.bottomRight]} />
    </View>
  );
}

function CameraBlocked() {
  const { t } = useTranslation("hosts");
  return (
    <View style={styles.message}>
      <Text accessibilityRole="header" style={styles.title}>
        {t("scan.blocked.title")}
      </Text>
      <Text style={styles.hint}>{t("scan.blocked.description")}</Text>
      <Text
        accessibilityRole="link"
        onPress={() => void Linking.openSettings()}
        style={[styles.hint, styles.link]}
      >
        {t("scan.blocked.openSettings")}
      </Text>
    </View>
  );
}

export function ScanPairing({
  onPaired,
  onClose,
  onPaste,
}: {
  onPaired(): void;
  onClose(): void;
  onPaste(): void;
}) {
  const { t } = useTranslation("hosts");
  const failureMessages = useScanFailureMessages();
  const [permission] = useCameraPermissions();
  const [pairing, setPairing] = useState(false);
  const [failure, setFailure] = useState<ScanFailure | null>(null);
  const lastScanned = useRef<string | null>(null);

  const handleScan = async ({ data }: BarcodeScanningResult) => {
    if (data === lastScanned.current) return;
    lastScanned.current = data;
    setPairing(true);
    setFailure(null);
    const result = await hosts.pair(
      data,
      Constants.deviceName ?? "Cocurdex Mobile",
    );
    setPairing(false);
    if ("failure" in result) {
      setFailure(result.failure);
      return;
    }
    selectHost(result.host.hostId);
    onPaired();
  };

  const granted = permission?.granted === true;
  const blocked = permission !== null && !granted;
  const status = failure ? failureMessages[failure] : t("scan.hint");

  return (
    <>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          icon={Platform.OS === "ios" ? "xmark" : CloseIcon}
          accessibilityLabel={t("scan.close")}
          onPress={onClose}
        />
      </Stack.Toolbar>
      <Stack.Toolbar placement="bottom">
        <Stack.Toolbar.Button
          icon={Platform.OS === "ios" ? "link" : LinkIcon}
          onPress={onPaste}
        >
          {t("scan.paste")}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <View style={styles.fill}>
        {granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={
              pairing ? undefined : (result) => void handleScan(result)
            }
          />
        ) : null}
        {blocked ? (
          <CameraBlocked />
        ) : (
          <View style={styles.message}>
            <Viewfinder />
            <Text accessibilityRole="header" style={styles.title}>
              {pairing ? t("pair.pairing") : t("scan.title")}
            </Text>
            <Text
              accessibilityLiveRegion="polite"
              style={[styles.hint, failure && styles.failure]}
            >
              {status}
            </Text>
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: scanColors.background },
  message: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    paddingHorizontal: space.xxl,
  },
  viewfinder: {
    width: "64%",
    aspectRatio: 1,
    marginBottom: space.xl,
  },
  corner: {
    position: "absolute",
    width: CORNER.size,
    height: CORNER.size,
    borderColor: SCAN_FOREGROUND,
  },
  topLeft: {
    left: 0,
    top: 0,
    borderLeftWidth: CORNER.width,
    borderTopWidth: CORNER.width,
    borderTopLeftRadius: CORNER.radius,
  },
  topRight: {
    right: 0,
    top: 0,
    borderRightWidth: CORNER.width,
    borderTopWidth: CORNER.width,
    borderTopRightRadius: CORNER.radius,
  },
  bottomLeft: {
    left: 0,
    bottom: 0,
    borderLeftWidth: CORNER.width,
    borderBottomWidth: CORNER.width,
    borderBottomLeftRadius: CORNER.radius,
  },
  bottomRight: {
    right: 0,
    bottom: 0,
    borderRightWidth: CORNER.width,
    borderBottomWidth: CORNER.width,
    borderBottomRightRadius: CORNER.radius,
  },
  title: {
    color: SCAN_FOREGROUND,
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
  },
  hint: {
    color: scanColors.mutedForeground,
    fontSize: 15,
    textAlign: "center",
  },
  failure: { color: scanColors.destructive },
  link: { color: SCAN_FOREGROUND, fontWeight: "600", marginTop: space.md },
});
