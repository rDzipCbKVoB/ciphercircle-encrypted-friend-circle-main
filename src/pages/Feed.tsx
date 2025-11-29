import { useEffect, useState } from "react";
import type { BrowserProvider } from "ethers";
import { Header } from "@/components/Header";
import { PostCard } from "@/components/PostCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Search, Filter, FileText } from "lucide-react";
import { CONTRACT_ADDRESS, DEFAULT_CONTRACT_ADDRESS, getCipherCircleContract } from "@/lib/contract";
import { getLocalPostDraft } from "@/lib/postsStorage";

interface FeedPost {
  id: string;
  author: string;
  text: string;
  ipfsHash?: string;
  timestamp: Date;
  likes: number;
  tips: number;
  isEncrypted?: boolean;
}

const Feed = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (CONTRACT_ADDRESS === DEFAULT_CONTRACT_ADDRESS) {
      setError("Contract address is not configured. Please check VITE_CONTRACT_ADDRESS in .env.");
      return;
    }

    let cancelled = false;

    const loadPosts = async () => {
      try {
        setLoading(true);
        setError(null);

        const contract = await getCipherCircleContract(CONTRACT_ADDRESS);
        const runner = contract.runner;
        const provider: BrowserProvider | null =
          runner && typeof runner === "object" && "provider" in runner
            ? ((runner as { provider?: BrowserProvider | null }).provider ?? null)
            : null;
        if (!provider) {
          throw new Error("Cannot access blockchain provider. Please reconnect your wallet.");
        }

        const filter = contract.filters.PostCreated();
        const events = await contract.queryFilter(filter, 0n, "latest");

        const postsFromChain = await Promise.all(
          events.map(async (event) => {
            const rawPostId = (event.args?.postId ?? 0n) as bigint;
            const postId = rawPostId.toString();
            const author =
              (event.args?.author as string) ||
              "0x0000000000000000000000000000000000000000";

            let timestampMs = Date.now();
            try {
              if (event.blockHash) {
                const block = await provider.getBlock(event.blockHash);
                if (block?.timestamp) {
                  timestampMs = Number(block.timestamp) * 1000;
                }
              } else if (event.blockNumber !== undefined) {
                const block = await provider.getBlock(event.blockNumber);
                if (block?.timestamp) {
                  timestampMs = Number(block.timestamp) * 1000;
                }
              }
            } catch (blockError) {
              console.warn("Failed to fetch block timestamp", blockError);
            }

            const draft = getLocalPostDraft(postId);

            const fallbackText = draft?.ipfsHash ? `IPFS: ${draft.ipfsHash}` : "";

            return {
              id: postId,
              author,
              text:
                draft?.text || fallbackText,
              ipfsHash: draft?.ipfsHash,
              timestamp: draft?.createdAt
                ? new Date(draft.createdAt)
                : new Date(timestampMs),
              likes: 0,
              tips: 0,
              isEncrypted: draft?.isEncrypted ?? true,
            };
          })
        );

        if (!cancelled) {
          setPosts(postsFromChain.reverse());
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error
              ? err.message
              : "Unable to load posts from the blockchain. Please try again later.";
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPosts();

    return () => {
      cancelled = true;
    };
  }, [CONTRACT_ADDRESS]);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-4 gradient-text">
            Encrypted Social Feed
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Share your thoughts with full privacy. FHE-powered likes and tips keep your
            engagement encrypted while maintaining transparency.
          </p>
        </div>

        {/* Search & Filter */}
        <div className="mb-8 flex gap-3 max-w-2xl mx-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search posts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 glass border-border/40"
            />
          </div>
          <Button variant="glass" size="icon">
            <Filter className="w-4 h-4" />
          </Button>
        </div>

        {/* Stats Bar */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
          <div className="glass p-4 rounded-lg border border-border/40 text-center">
            <p className="text-3xl font-bold text-primary mb-1">
              {posts.length}
            </p>
            <p className="text-sm text-muted-foreground">Total Posts</p>
          </div>
          <div className="glass p-4 rounded-lg border border-border/40 text-center">
            <p className="text-3xl font-bold text-secondary mb-1">-</p>
            <p className="text-sm text-muted-foreground">Total Likes</p>
          </div>
          <div className="glass p-4 rounded-lg border border-border/40 text-center">
            <p className="text-3xl font-bold gradient-text mb-1">- ETH</p>
            <p className="text-sm text-muted-foreground">Total Tips</p>
          </div>
        </div>

        {/* Posts Grid */}
        <div className="max-w-4xl mx-auto space-y-6">
          {loading ? (
            <Card className="glass border-border/40 p-12 text-center">
              <p className="text-muted-foreground">Loading posts from the blockchain...</p>
            </Card>
          ) : error ? (
            <Card className="glass border-border/40 p-12 text-center">
              <h3 className="text-xl font-semibold mb-2">Failed to load posts</h3>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={() => window.location.reload()}>Retry</Button>
            </Card>
          ) : posts.length === 0 ? (
            <Card className="glass border-border/40 p-12 text-center">
              <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Posts Yet</h3>
              <p className="text-muted-foreground mb-6">
                Be the first to share your thoughts on CipherCircle
              </p>
            </Card>
          ) : (
            posts
              .filter(
                (post) =>
                  post.text
                    ?.toLowerCase()
                    .includes(searchQuery.toLowerCase()) ||
                  post.author
                    ?.toLowerCase()
                    .includes(searchQuery.toLowerCase())
              )
              .map((post) => <PostCard key={post.id} post={post} />)
          )}
        </div>
      </main>
    </div>
  );
};

export default Feed;
