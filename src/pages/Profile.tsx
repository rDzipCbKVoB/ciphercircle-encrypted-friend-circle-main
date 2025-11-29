import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { PostCard } from "@/components/PostCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Heart, DollarSign, FileText, Copy, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BrowserProvider } from "ethers";

const Profile = () => {
  const { toast } = useToast();
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [userPosts] = useState<any[]>([]); // Placeholder for future on-chain data
  const [totalLikes, setTotalLikes] = useState(0);
  const [totalTips, setTotalTips] = useState(0);

  useEffect(() => {
    // Attempt to derive the user's address from the wallet
    const loadUserAddress = async () => {
      try {
        const ethereum = (window as any).ethereum;
        if (ethereum) {
          const provider = new BrowserProvider(ethereum);
          const signer = await provider.getSigner();
          const address = await signer.getAddress();
          setUserAddress(address);
        }
      } catch (error) {
        console.log("Wallet not connected");
      }
    };
    loadUserAddress();
  }, []);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const copyAddress = () => {
    if (userAddress) {
      navigator.clipboard.writeText(userAddress);
      toast({
        title: "Copied!",
        description: "Address copied to clipboard",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Profile Header */}
          <Card className="glass border-border/40 p-8 mb-8">
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
              {/* Avatar */}
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-3xl font-bold font-mono">
                {userAddress ? userAddress.slice(2, 4).toUpperCase() : "?"}
              </div>

              {/* Info */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-5 h-5 text-primary" />
                  <h2 className="text-2xl font-bold">Your Profile</h2>
                </div>
                <div className="flex items-center gap-2 mb-4">
                  {userAddress ? (
                    <>
                      <p className="font-mono text-lg text-muted-foreground">
                        {formatAddress(userAddress)}
                      </p>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={copyAddress}>
                        <Copy className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    </>
                  ) : (
                    <p className="text-muted-foreground">Please connect your wallet</p>
                  )}
                </div>
                <p className="text-muted-foreground">
                  Web3 enthusiast | Privacy advocate | FHE explorer
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-border/40">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{userPosts.length}</p>
                  <p className="text-sm text-muted-foreground">Posts</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Heart className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{totalLikes}</p>
                  <p className="text-sm text-muted-foreground">Total Likes</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <DollarSign className="w-8 h-8 text-secondary" />
                <div>
                  <p className="text-2xl font-bold">{totalTips > 0 ? totalTips.toFixed(2) : "-"} ETH</p>
                  <p className="text-sm text-muted-foreground">Total Tips</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Posts Section */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-4">Your Posts</h2>
          </div>

          {/* Posts List */}
          <div className="space-y-6">
            {userPosts.length > 0 ? (
              userPosts.map((post) => <PostCard key={post.id} post={post} />)
            ) : (
              <Card className="glass border-border/40 p-12 text-center">
                <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Posts Yet</h3>
                <p className="text-muted-foreground mb-6">
                  Start sharing your thoughts with the CipherCircle community
                </p>
                <Button variant="glow">Create Your First Post</Button>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Profile;
