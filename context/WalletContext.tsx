"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { BrowserProvider } from "ethers";
import { GALILEO_CHAINID, RPC_URL } from "@/lib/contracts";

interface Ctx {
  address: string | null;
  chainId: number | null;
  provider: BrowserProvider | null;
  isConnecting: boolean;
  isWrongNetwork: boolean;
  connect: () => Promise<void>;
}

const WalletContext = createContext<Ctx>({
  address: null,
  chainId: null,
  provider: null,
  isConnecting: false,
  isWrongNetwork: false,
  connect: async () => {},
});

/* ---------- provider selection ---------- */
function getMetaMaskProvider(): any | null {
  if (typeof window === "undefined") return null;

  const { ethereum } = window as any;
  if (!ethereum) return null;

  // multiple wallets installed
  if (ethereum.providers) {
    return ethereum.providers.find((p: any) => p.isMetaMask);
  }

  // single wallet
  if (ethereum.isMetaMask) return ethereum;

  return null;
}

/* ---------- provider ---------- */
export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const isWrongNetwork = chainId !== null && chainId !== GALILEO_CHAINID;

  const switchNetwork = async (eth: any) => {
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x" + GALILEO_CHAINID.toString(16) }],
      });
    } catch (e: any) {
      if (e.code === 4902) {
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: "0x" + GALILEO_CHAINID.toString(16),
              chainName: "0G Galileo Testnet",
              rpcUrls: [RPC_URL],
              blockExplorerUrls: ["https://galileo-explorer.0g.ai"],
              nativeCurrency: {
                name: "0G",
                symbol: "0G",
                decimals: 18,
              },
            },
          ],
        });
      } else {
        throw e;
      }
    }
  };

  const connect = useCallback(async () => {
    const eth = getMetaMaskProvider();

    if (!eth) {
      alert("MetaMask not found");
      return;
    }

    setIsConnecting(true);

    try {
      const accounts: string[] = await eth.request({
        method: "eth_requestAccounts",
      });

      if (!accounts.length) return;

      const prov = new BrowserProvider(eth);
      const net = await prov.getNetwork();
      const id = Number(net.chainId);

      setAddress(accounts[0]);
      setChainId(id);
      setProvider(prov);

      if (id !== GALILEO_CHAINID) {
        await switchNetwork(eth);
      }
    } catch (e: any) {
      if (e.code !== 4001) {
        alert("Failed to connect: " + e.message);
      }
    } finally {
      setIsConnecting(false);
    }
  }, []);

  /* ---------- auto reconnect ---------- */
  useEffect(() => {
    const eth = getMetaMaskProvider();
    if (!eth) return;

    eth.request({ method: "eth_accounts" }).then((accs: string[]) => {
      if (!accs.length) return;

      eth.request({ method: "eth_chainId" }).then((id: string) => {
        setAddress(accs[0]);
        setChainId(parseInt(id, 16));
        setProvider(new BrowserProvider(eth));
      });
    });

    const onAccounts = (accs: string[]) => {
      setAddress(accs.length ? accs[0] : null);
    };

    const onChain = (id: string) => {
      setChainId(parseInt(id, 16));
    };

    eth.on("accountsChanged", onAccounts);
    eth.on("chainChanged", onChain);

    return () => {
      eth.removeListener("accountsChanged", onAccounts);
      eth.removeListener("chainChanged", onChain);
    };
  }, []);

  return (
    <WalletContext.Provider
      value={{
        address,
        chainId,
        provider,
        isConnecting,
        isWrongNetwork,
        connect,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => useContext(WalletContext);
