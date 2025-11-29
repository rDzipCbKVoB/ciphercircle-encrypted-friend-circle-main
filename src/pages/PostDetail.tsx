import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Heart, DollarSign, ExternalLink, Lock, Unlock, ArrowLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { BrowserProvider } from "ethers";
import { encryptEthAmountForContract, encryptValueForContract } from "@/lib/fhe";
import {
  CONTRACT_ADDRESS,
  DEFAULT_CONTRACT_ADDRESS,
  getCipherCircleContract,
} from "@/lib/contract";
import { getLocalPostDraft } from "@/lib/postsStorage";

interface PostDetailData {
  id: string;
  author: string;
  text: string;
  ipfsHash?: string;
  timestamp: Date;
  likesLabel: string;
  tipsLabel: string;
  likesHandle?: string;
  tipsHandle?: string;
  isEncrypted?: boolean;
}

const PostDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tipAmount, setTipAmount] = useState("");
  const [hasDecryptAccess, setHasDecryptAccess] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [tipLoading, setTipLoading] = useState(false);
  const [post, setPost] = useState<PostDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    if (!id) {
      setError("Invalid post ID.");
      setLoading(false);
      return;
    }

    if (CONTRACT_ADDRESS === DEFAULT_CONTRACT_ADDRESS) {
      setError("Contract address is not configured. Please set VITE_CONTRACT_ADDRESS in the .env file.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadPost = async () => {
      try {
        setLoading(true);
        setError(null);

        const contract = await getCipherCircleContract(CONTRACT_ADDRESS);
        let postId: bigint;
        try {
          postId = BigInt(id);
        } catch {
          throw new Error("The provided post ID is invalid.");
        }

        const author = await contract.authorOf(postId);
        const [likesCipher, tipsCipher] = await contract.getEncryptedStats(postId);

        let timestampMs = Date.now();
        try {
          const filter = contract.filters.PostCreated(postId);
          const events = await contract.queryFilter(filter, 0n, "latest");
          if (events.length > 0) {
            const event = events[events.length - 1];
            const runner = contract.runner;
            const provider: BrowserProvider | null =
              runner && typeof runner === "object" && "provider" in runner
                ? ((runner as { provider?: BrowserProvider | null }).provider ?? null)
                : null;
            if (provider) {
              const block = event.blockHash
                ? await provider.getBlock(event.blockHash)
                : await provider.getBlock(event.blockNumber ?? 0);
              if (block?.timestamp) {
                timestampMs = Number(block.timestamp) * 1000;
              }
            }
          }
        } catch (blockError) {
          console.warn("Failed to load block timestamp:", blockError);
        }

        const draft = getLocalPostDraft(id);

        const isEncrypted = draft?.isEncrypted ?? true;

        const ipfsText = draft?.ipfsHash ? `IPFS: ${draft.ipfsHash}` : "";

        const postData: PostDetailData = {
          id,
          author,
          text: draft?.text || ipfsText,
          ipfsHash: draft?.ipfsHash,
          timestamp: draft?.createdAt
            ? new Date(draft.createdAt)
            : new Date(timestampMs),
          likesLabel: isEncrypted ? "Encrypted" : "Unavailable",
          tipsLabel: isEncrypted ? "Encrypted" : "Unavailable",
          likesHandle: likesCipher?.toString(),
          tipsHandle: tipsCipher?.toString(),
          isEncrypted,
        };

        if (!cancelled) {
          setPost(postData);
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Failed to load the post. Please try again.";
          setError(message);
          setPost(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPost();

    return () => {
      cancelled = true;
    };
  }, [id, CONTRACT_ADDRESS, refreshVersion]);

  const handleLike = async () => {
    try {
      setLikeLoading(true);

      if (CONTRACT_ADDRESS === DEFAULT_CONTRACT_ADDRESS) {
        toast({
          title: "Contract not configured",
          description: "Please set VITE_CONTRACT_ADDRESS in the .env file before proceeding.",
          variant: "destructive",
        });
        return;
      }

      if (!id) {
        throw new Error("Invalid post ID.");
      }

      const ethereum = (window as any).ethereum;
      if (!ethereum) {
        toast({
          title: "Wallet Required",
          description: "Please install and connect a Web3 wallet to send an encrypted like.",
          variant: "destructive",
        });
        return;
      }

      const provider = new BrowserProvider(ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();

      // Like: encrypt constant 1 as euint32 to represent incrementing by one
      const encrypted = await encryptValueForContract({
        value: 1,
        type: "uint32",
        contractAddress: CONTRACT_ADDRESS,
        userAddress,
      });

      const postId = BigInt(id);
      const contract = await getCipherCircleContract(CONTRACT_ADDRESS);

      const tx = await contract.like(postId, encrypted.handle, encrypted.proof);

      toast({
        title: "Transaction sent",
        description: `Like tx hash: ${tx.hash.slice(0, 10)}...`,
      });

      const receipt = await tx.wait();
      if (receipt.status === 0) {
        throw new Error("Like transaction failed. Please inspect the chain logs for details.");
      }

      toast({
        title: "Liked! ❤️",
        description: `Encrypted like submitted. Handle: ${String(encrypted.handle).slice(0, 10)}...`,
      });

      setRefreshVersion((v) => v + 1);
    } catch (error) {
      console.error(error);
      toast({
        title: "Failed to like",
        description: error instanceof Error ? error.message : "FHE like transaction failed. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLikeLoading(false);
    }
  };

  const handleTip = async () => {
    if (!tipAmount || parseFloat(tipAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid tip amount",
        variant: "destructive",
      });
      return;
    }

    try {
      setTipLoading(true);

      if (CONTRACT_ADDRESS === DEFAULT_CONTRACT_ADDRESS) {
        toast({
          title: "Contract not configured",
          description: "Please set VITE_CONTRACT_ADDRESS in the .env file before proceeding.",
          variant: "destructive",
        });
        return;
      }

      if (!id) {
        throw new Error("Invalid post ID.");
      }

      const ethereum = (window as any).ethereum;
      if (!ethereum) {
        toast({
          title: "Wallet Required",
          description: "Please install and connect a Web3 wallet to send an encrypted tip.",
          variant: "destructive",
        });
        return;
      }

      const provider = new BrowserProvider(ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();

      const encrypted = await encryptEthAmountForContract({
        amountEth: tipAmount,
        contractAddress: CONTRACT_ADDRESS,
        userAddress,
      });

      const postId = BigInt(id);
      const contract = await getCipherCircleContract(CONTRACT_ADDRESS);

      const tx = await contract.tip(postId, encrypted.handle, encrypted.proof);

      toast({
        title: "Transaction sent",
        description: `Tip tx hash: ${tx.hash.slice(0, 10)}...`,
      });

      const receipt = await tx.wait();
      if (receipt.status === 0) {
        throw new Error("Tip transaction failed. Please inspect the chain logs for details.");
      }

      toast({
        title: "Tip Sent! 💰",
        description: `Encrypted tip submitted: ${tipAmount} ETH. Handle: ${String(
          encrypted.handle,
        ).slice(0, 10)}...`,
      });
      setTipAmount("");
      setRefreshVersion((v) => v + 1);
    } catch (error) {
      console.error(error);
      toast({
        title: "Failed to send tip",
        description: error instanceof Error ? error.message : "FHE tip transaction failed. Please try again.",
        variant: "destructive",
      });
    } finally {
      setTipLoading(false);
    }
  };

  const handleRequestDecrypt = () => {
    setHasDecryptAccess(true);
    toast({
      title: "Access Granted! 🔓",
      description: "You can now view encrypted statistics for this post",
    });
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatHandle = (value?: string) => {
    if (!value) return "-";
    return `${value.slice(0, 10)}...${value.slice(-6)}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-muted-foreground">Loading post...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <Button
              variant="ghost"
              className="mb-6 gap-2"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Feed
            </Button>
            <Card className="glass border-border/40 p-12 text-center">
              <h3 className="text-xl font-semibold mb-2">Failed to load post</h3>
              <p className="text-muted-foreground mb-6">{error}</p>
              <Button onClick={() => window.location.reload()}>Retry</Button>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <Button
              variant="ghost"
              className="mb-6 gap-2"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Feed
            </Button>
            <Card className="glass border-border/40 p-12 text-center">
              <h3 className="text-xl font-semibold mb-2">Post Not Found</h3>
              <p className="text-muted-foreground mb-6">
                The post you're looking for doesn't exist or hasn't been loaded yet.
              </p>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Back Button */}
          <Button
            variant="ghost"
            className="mb-6 gap-2"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Feed
          </Button>

          {/* Post Card */}
          <Card className="glass border-border/40 p-8 mb-6">
            {/* Author Header */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-mono text-xl font-bold">
                  {post.author.slice(2, 4).toUpperCase()}
                </div>
                <div>
                  <p className="font-mono text-lg font-medium">{formatAddress(post.author)}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDistanceToNow(post.timestamp, { addSuffix: true })}
                  </p>
                </div>
              </div>
              {post.isEncrypted && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30">
                  <Lock className="w-4 h-4 text-primary" />
                  <span className="text-sm text-primary font-medium">FHE Encrypted</span>
                </div>
              )}
            </div>

            {/* Content */}
            <p className="text-lg text-foreground mb-6 leading-relaxed">{post.text}</p>

            {/* IPFS Section */}
            {post.ipfsHash && (
              <Card className="glass border-border/40 p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ExternalLink className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium mb-1">IPFS Content</p>
                      <p className="font-mono text-xs text-muted-foreground">{post.ipfsHash}</p>
                    </div>
                  </div>
            <Button
              variant="glass"
              size="sm"
              onClick={() => window.open(`https://ipfs.io/ipfs/${post.ipfsHash}`, "_blank")}
            >
              View on IPFS
            </Button>
                </div>
              </Card>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <Card className="glass border-border/40 p-4">
                <div className="flex items-center gap-3">
                  <Heart className="w-8 h-8 text-primary" />
                  <div>
                    <p className="text-3xl font-bold">{post.likesLabel}</p>
                    <p className="text-sm text-muted-foreground">Likes</p>
                    {post.likesHandle && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Handle: {formatHandle(post.likesHandle)}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
              <Card className="glass border-border/40 p-4">
                <div className="flex items-center gap-3">
                  <DollarSign className="w-8 h-8 text-secondary" />
                  <div>
                    <p className="text-3xl font-bold">{post.tipsLabel}</p>
                    <p className="text-sm text-muted-foreground">Tips Received</p>
                    {post.tipsHandle && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Handle: {formatHandle(post.tipsHandle)}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="glow"
                className="flex-1 gap-2"
                onClick={handleLike}
                disabled={likeLoading}
              >
                <Heart className="w-4 h-4" />
                {likeLoading ? "Liking..." : "Like Post"}
              </Button>
            </div>
          </Card>

          {/* Tip Section */}
          <Card className="glass border-border/40 p-6 mb-6">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-secondary" />
              Send a Tip
            </h3>
            <div className="flex gap-3">
              <Input
                type="number"
                step="0.001"
                placeholder="0.01"
                value={tipAmount}
                onChange={(e) => setTipAmount(e.target.value)}
                className="glass border-border/40"
              />
              <Button variant="glow" onClick={handleTip} className="gap-2" disabled={tipLoading}>
                <DollarSign className="w-4 h-4" />
                {tipLoading ? "Tipping..." : `Tip ${tipAmount || "0"} ETH`}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Tips are sent directly to the author with FHE encryption
            </p>
          </Card>

          {/* Decrypt Access */}
          <Card className="glass border-border/40 p-6">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              {hasDecryptAccess ? (
                <Unlock className="w-5 h-5 text-primary" />
              ) : (
                <Lock className="w-5 h-5 text-muted-foreground" />
              )}
              Decrypt Access
            </h3>
            {hasDecryptAccess ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-primary">
                  <Unlock className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    You have decrypt access for this post's encrypted data
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  You can now view all encrypted statistics including exact like counts and tip amounts
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Request permission to decrypt and view exact engagement statistics for this post
                </p>
                <Button variant="glass" onClick={handleRequestDecrypt} className="gap-2">
                  <Unlock className="w-4 h-4" />
                  Request Decrypt Permission
                </Button>
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
};

export default PostDetail;
