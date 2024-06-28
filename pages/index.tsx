import React from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
// import Bridge from "../components/Bridge";
import BridgeV2 from "../components/BridgeV2";

export default function IndexPage() {
  return (
    <div>
      <div className="flex justify-end p-5">
        <ConnectButton showBalance={false} />
      </div>
      <div className="flex flex-col items-center">
        <BridgeV2 />
      </div>
    </div>
  );
}
