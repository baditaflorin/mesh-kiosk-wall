import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-kiosk-wall",
  description: "Turn an old phone into a shop-window display. Peers submit; wall cycles.",
  accentHex: "#00aaff",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
