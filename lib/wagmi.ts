import { createClient, configureChains, sepolia } from "wagmi";
import { jsonRpcProvider } from "@wagmi/core/providers/jsonRpc";
import { getDefaultWallets } from "@rainbow-me/rainbowkit";

// const RPC_URL = "https://rpc.eth.gateway.fm";

const { provider, chains, webSocketProvider } = configureChains(
  [sepolia],
  [
    jsonRpcProvider({
      rpc: (_) => ({
        http: sepolia.rpcUrls.public.http[0],
      }),
    }),
  ],
);

const { connectors } = getDefaultWallets({
  appName: "bridge",
  projectId: "350569e85a7ff1842b079dc92cf87b48",
  chains,
});

export const client = createClient({
  autoConnect: true,
  connectors,
  provider,
  webSocketProvider,
});
