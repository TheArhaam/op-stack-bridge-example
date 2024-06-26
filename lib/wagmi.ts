import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia, baseSepolia } from "wagmi/chains";

export const config = getDefaultConfig({
  appName: "bridge",
  projectId: "350569e85a7ff1842b079dc92cf87b48",
  chains: [sepolia, baseSepolia],
  ssr: true,
});
