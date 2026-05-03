'use client';
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { BrowserProvider } from 'ethers';
import { GALILEO_CHAINID, RPC_URL } from '@/lib/contracts';

interface Ctx {
  address:        string | null;
  chainId:        number | null;
  provider:       BrowserProvider | null;
  isConnecting:   boolean;
  isWrongNetwork: boolean;
  connect:        () => Promise<void>;
}

const WalletContext = createContext<Ctx>({
  address: null, chainId: null, provider: null,
  isConnecting: false, isWrongNetwork: false,
  connect: async () => {},
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address,      setAddress]      = useState<string | null>(null);
  const [chainId,      setChainId]      = useState<number | null>(null);
  const [provider,     setProvider]     = useState<BrowserProvider | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const isWrongNetwork = chainId !== null && chainId !== GALILEO_CHAINID;

  const switchNetwork = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x' + GALILEO_CHAINID.toString(16) }],
      });
    } catch (e: any) {
      if (e.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId:         '0x' + GALILEO_CHAINID.toString(16),
            chainName:       '0G Galileo Testnet',
            rpcUrls:         [RPC_URL],
            blockExplorerUrls: ['https://galileo-explorer.0g.ai'],
            nativeCurrency:  { name: '0G', symbol: '0G', decimals: 18 },
          }],
        });
      }
    }
  };

  const connect = useCallback(async () => {
    if (!window.ethereum) { alert('Please install MetaMask'); return; }
    setIsConnecting(true);
    try {
      const accounts: string[] = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (!accounts.length) return;
      const prov = new BrowserProvider(window.ethereum);
      const net  = await prov.getNetwork();
      const id   = Number(net.chainId);
      setAddress(accounts[0]);
      setChainId(id);
      setProvider(prov);
      if (id !== GALILEO_CHAINID) await switchNetwork();
    } catch (e: any) {
      if (e.code !== 4001) alert('Failed to connect: ' + e.message);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // Auto-reconnect on mount
  useEffect(() => {
    if (!window.ethereum) return;
    window.ethereum.request({ method: 'eth_accounts' }).then((accs: string[]) => {
      if (!accs.length) return;
      window.ethereum.request({ method: 'eth_chainId' }).then((id: string) => {
        setAddress(accs[0]);
        setChainId(parseInt(id, 16));
        setProvider(new BrowserProvider(window.ethereum));
      });
    });
    const onAccounts = (accs: string[]) => accs.length ? setAddress(accs[0]) : setAddress(null);
    const onChain    = (id: string)      => setChainId(parseInt(id, 16));
    window.ethereum.on('accountsChanged', onAccounts);
    window.ethereum.on('chainChanged',    onChain);
    return () => {
      window.ethereum.removeListener('accountsChanged', onAccounts);
      window.ethereum.removeListener('chainChanged',    onChain);
    };
  }, []);

  return (
    <WalletContext.Provider value={{ address, chainId, provider, isConnecting, isWrongNetwork, connect }}>
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => useContext(WalletContext);
