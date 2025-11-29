import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Wallet, Plus, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BrowserProvider } from "ethers";

const formatAddress = (address: string) => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const Header = () => {
  const { toast } = useToast();
  const [account, setAccount] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    const checkWalletConnection = async () => {
      try {
        const ethereum = (window as any).ethereum;
        if (!ethereum) return;

        const provider = new BrowserProvider(ethereum);
        const accounts = await provider.listAccounts();
        if (accounts.length > 0) {
          setAccount(accounts[0].address);
        }
      } catch (error) {
        console.log("Wallet not connected:", error);
      }
    };

    checkWalletConnection();

    const ethereum = (window as any).ethereum;
    if (ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
        } else {
          setAccount(null);
        }
      };

      ethereum.on("accountsChanged", handleAccountsChanged);

      return () => {
        ethereum.removeListener("accountsChanged", handleAccountsChanged);
      };
    }
  }, []);

  const handleConnectWallet = async () => {
    if (isConnecting) return;

    try {
      setIsConnecting(true);
      const ethereum = (window as any).ethereum;
      if (!ethereum) {
        toast({
          title: "Wallet not detected",
          description: "Please install MetaMask or another compatible wallet extension.",
          variant: "destructive",
        });
        return;
      }

      const provider = new BrowserProvider(ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      setAccount(address);

      toast({
        title: "Wallet connected",
        description: `Current address: ${formatAddress(address)}`,
      });
    } catch (error: any) {
      console.error("Connect wallet error:", error);
      
      // User rejected the request
      if (error.code === 4001) {
        toast({
          title: "Connection cancelled",
          description: "The wallet connection request was rejected.",
        });
      } else {
        toast({
          title: "Connection failed",
          description: error.message || "Something went wrong while connecting your wallet.",
          variant: "destructive",
        });
      }
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 glass">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center glow-strong">
            <span className="text-lg font-bold">C</span>
          </div>
          <span className="text-xl font-bold gradient-text">CipherCircle</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          <Link
            to="/"
            className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            Feed
          </Link>
          <Link
            to="/create"
            className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            Create Post
          </Link>
          <Link
            to="/profile"
            className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            Profile
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Button
            variant="glow"
            size="sm"
            className="hidden sm:flex"
            onClick={handleConnectWallet}
            disabled={isConnecting}
          >
            <Wallet className="w-4 h-4" />
            {isConnecting
              ? "Connecting..."
              : account
                ? formatAddress(account)
                : "Connect Wallet"}
          </Button>
          <Button variant="glass" size="icon" className="md:hidden">
            <Plus className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="md:hidden">
            <User className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
};
