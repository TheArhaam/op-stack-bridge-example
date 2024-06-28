import React, { useEffect, useMemo, useState } from "react";
import { baseSepolia, Chain, sepolia } from "wagmi/chains";
import { SwitchIcon } from "./Icons";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { useEthersSigner } from "../lib/ethers";
import { ethers } from "ethers";
import * as OP from "@eth-optimism/sdk";

const L1_EXPLORER_URL = "https://sepolia.etherscan.io/";
const L2_EXPLORER_URL = "https://sepolia.basescan.org";

enum TRANSFER_DIRECTION {
  L1_TO_L2,
  L2_TO_L1,
}

enum TOKEN_TYPE {
  NATIVE,
  ERC20,
}

const tokens = [
  {
    name: "Ether",
    symbol: "ETH",
    type: TOKEN_TYPE.NATIVE,
  },
  // @todo - ERC20 support
  // {
  //   name: "USDC",
  //   symbol: "USDC",
  //   type: TOKEN_TYPE.ERC20,
  //   addresses: {
  //     11_155_111: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  //     84532: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  //   },
  // },
];

export default function BridgeV2() {
  //WEB3
  const { address } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync, isPending } = useSwitchChain();
  const signer = useEthersSigner();
  // NETWORK
  const [fromNetwork, setFromNetwork] = useState<Chain>(sepolia);
  const [toNetwork, setToNetwork] = useState<Chain>(baseSepolia);
  const [transferDirection, setTransferDirection] = useState(
    TRANSFER_DIRECTION.L1_TO_L2,
  );
  // TOKEN
  // const [token, setToken] = useState(tokens[0]);
  const [amount, setAmount] = useState("0.001");
  // BRIDGING
  const [isBridging, setIsBridging] = useState(false);
  // L1_TO_L2: Step-0=Deposit, Step-1=Done
  // L2_TO_L1: Step-0=Withdraw, Step-1=Finalize, Step-2=Done
  const [step, setStep] = useState(0);
  const [expectedChainId, setExpectedChainId] = useState<number>(sepolia.id);
  const [, setL1TxHash] = useState("");
  const [l2TxHash, setL2TxHash] = useState("");
  const [logs, setLogs] = useState<React.JSX.Element[]>([]);

  const messenger = useMemo(() => {
    console.log("messenger update");
    if (!signer || !address) return;
    const l1Provider = new ethers.providers.JsonRpcProvider(
      sepolia.rpcUrls.default.http[0],
    ).getSigner(address);
    const l2Provider = new ethers.providers.JsonRpcProvider(
      baseSepolia.rpcUrls.default.http[0],
    ).getSigner(address);
    return new OP.CrossChainMessenger({
      l1ChainId: OP.L1ChainID.SEPOLIA,
      l2ChainId: OP.L2ChainID.BASE_SEPOLIA,
      l1SignerOrProvider: chainId == sepolia.id ? signer : l1Provider,
      l2SignerOrProvider: chainId == baseSepolia.id ? signer : l2Provider,
    });
  }, [address, signer, chainId]);

  // Interchange the selected networks
  const flipNetworks = () => {
    const _fromNetwork = fromNetwork;
    const _toNetwork = toNetwork;
    setFromNetwork(_toNetwork);
    setToNetwork(_fromNetwork);
  };

  const switchToExpectedChain = async () => {
    try {
      await switchChainAsync({ chainId: expectedChainId });
    } catch (err) {
      console.error("Failed to switch network: ", err);
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(e.target.value);
  };

  // Route actions based on transferDirection & step
  const handleAction = () => {
    if (transferDirection == TRANSFER_DIRECTION.L1_TO_L2) {
      if (step == 0) deposit();
      else if (step == 1) window.location.reload();
    } else if (transferDirection == TRANSFER_DIRECTION.L2_TO_L1) {
      if (step == 0) withdraw();
      else if (step == 1) proveAndFinalize();
      else if (step == 2) window.location.reload();
    }
  };

  const getAction = () => {
    if (transferDirection == TRANSFER_DIRECTION.L1_TO_L2) {
      if (step == 0) return "Deposit";
      else if (step == 1) return "Restart";
    } else if (transferDirection == TRANSFER_DIRECTION.L2_TO_L1) {
      if (step == 0) return "Withdraw";
      else if (step == 1) return "Prove & Finalize";
      else if (step == 2) return "Restart";
    }
  };

  // Push log to logs state
  const log = (log: React.JSX.Element) => {
    setLogs((prevLogs) => [...prevLogs, log]);
  };

  const deposit = async () => {
    try {
      if (!messenger) return;
      setIsBridging(true);

      const _amount = parseFloat(amount) * 10 ** 18;

      // L1
      const response = await messenger.depositETH(_amount);
      setL1TxHash(response.hash);
      log(
        <>
          <a
            href={`${L1_EXPLORER_URL}/tx/${response.hash}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Transaction
          </a>{" "}
          submitted, waiting for confirmation...
        </>,
      );
      await response.wait();
      log(<>Transaction confirmed! Waiting for L2...</>);

      const l2Block = await messenger.l2Provider.getBlockNumber();
      const waitTime = await messenger.estimateMessageWaitTimeSeconds(
        response.hash,
        0,
        l2Block,
      );
      log(<>Estimated wait time: {waitTime}seconds</>);
      const l2Receipt = await messenger.waitForMessageReceipt(response.hash, {
        fromBlockOrBlockHash: l2Block,
      });
      setL2TxHash(l2Receipt.transactionReceipt.transactionHash);
      setIsBridging(false);
      log(
        <>
          <a
            href={`${L2_EXPLORER_URL}/tx/${l2Receipt.transactionReceipt.transactionHash}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Transaction
          </a>{" "}
          complete!
        </>,
      );
    } catch (err) {
      setIsBridging(false);
      console.error("Failed to deposit: ", err);
    }
  };

  const withdraw = async () => {
    try {
      if (!messenger) return;
      setIsBridging(true);

      const _amount = parseFloat(amount) * 10 ** 18;

      // L2
      const response = await messenger.withdrawETH(_amount);
      setL2TxHash(response.hash);
      log(
        <>
          <a
            href={`${L2_EXPLORER_URL}/tx/${response.hash}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Transaction
          </a>{" "}
          submitted, waiting for confirmation...
        </>,
      );
      await messenger.waitForMessageStatus(
        response.hash,
        OP.MessageStatus.READY_TO_PROVE,
      );
      log(<>Transaction ready to prove...</>);

      setIsBridging(false);
      setStep(1);
    } catch (err) {
      setIsBridging(false);
      console.error("Failed to deposit: ", err);
    }
  };

  const proveAndFinalize = async () => {
    try {
      if (!messenger) return;
      setIsBridging(true);

      await messenger.proveMessage(l2TxHash);

      await messenger.waitForMessageStatus(
        l2TxHash,
        OP.MessageStatus.READY_FOR_RELAY,
      );
      log(<>Transaction ready to relay...</>);

      // L1
      const response = await messenger.finalizeMessage(l2TxHash);
      log(
        <>
          <a
            href={`${L1_EXPLORER_URL}/tx/${response.hash}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Transaction
          </a>{" "}
          submitted, waiting for confirmation...
        </>,
      );
      await messenger.waitForMessageStatus(l2TxHash, OP.MessageStatus.RELAYED);
      log(
        <>
          <a
            href={`${L1_EXPLORER_URL}/tx/${response.hash}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Transaction
          </a>{" "}
          complete!
        </>,
      );
      setIsBridging(false);
      setStep(2);
    } catch (err) {
      setIsBridging(false);
      console.error("Failed to deposit: ", err);
    }
  };

  // Effect to set `transferDirection`
  useEffect(() => {
    if (fromNetwork == sepolia)
      setTransferDirection(TRANSFER_DIRECTION.L1_TO_L2);
    else if (fromNetwork == baseSepolia)
      setTransferDirection(TRANSFER_DIRECTION.L2_TO_L1);
  }, [fromNetwork, toNetwork]);

  // Effect to set `expectedChainId`
  useEffect(() => {
    if (transferDirection == TRANSFER_DIRECTION.L1_TO_L2) {
      setExpectedChainId(sepolia.id);
    } else if (transferDirection == TRANSFER_DIRECTION.L2_TO_L1) {
      if (step == 0) setExpectedChainId(baseSepolia.id);
      else if (step == 1) setExpectedChainId(sepolia.id);
    }
  }, [chainId, step, transferDirection]);

  return (
    <div className="flex flex-col items-center justify-center w-[100%] gap-2">
      {/* TXN BOX */}
      <div className="border-gray border-2 rounded-lg p-6 max-w-[350px] w-[100%]">
        {/* NETWORK SELECTION ROW */}
        <div className="flex align-center justify-center">
          <span className="text-lg text-center align-center w-[35%]">
            {fromNetwork.name}
          </span>
          <button onClick={flipNetworks} className="mx-5">
            <SwitchIcon className="h-6 w-6 hover:h-7 hover:w-7 duration-100" />
          </button>
          <span className="text-lg text-center align-center w-[35%]">
            {toNetwork.name}
          </span>
        </div>
        {/* AMOUNT + TOKEN ROW */}
        <div className="flex align-center justify-center w-[100%] py-4">
          {/* Amount */}
          <span>Amount:</span>
          <input
            type="number"
            value={amount}
            onChange={handleAmountChange}
            className="border-gray border-2 rounded-lg w-[100%]"
          />
          {/* TOKEN */}
          <select name="token" id="token">
            {tokens.map((token, index) => (
              <option key={index} value={index}>
                {token.symbol}
              </option>
            ))}
          </select>
        </div>
        {/* ACTION ROW */}
        <div className="flex align-center justify-center">
          {chainId != expectedChainId ? (
            <button
              onClick={switchToExpectedChain}
              disabled={isPending}
              className="rounded-lg bg-blue-500 p-2 text-white disabled:bg-gray-300"
            >
              Switch Network
            </button>
          ) : (
            <button
              onClick={handleAction}
              disabled={isBridging}
              className="rounded-lg bg-blue-500 p-2 text-white disabled:bg-gray-300"
            >
              {getAction()}
            </button>
          )}
        </div>
      </div>
      {/* UPDATE BOX */}
      {logs.length > 0 && (
        <div className="flex flex-col items-start justify-center border-gray border-2 rounded-lg p-6 max-w-[350px] w-[100%]">
          {logs.map((log, index) => {
            return <div key={index}>{log}</div>;
          })}
        </div>
      )}
    </div>
  );
}
