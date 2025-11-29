import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heart, DollarSign, ExternalLink, Lock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface PostCardProps {
  post: {
    id: string;
    author: string;
    text: string;
    ipfsHash?: string;
    timestamp: Date;
    likes: number;
    tips: number;
    isEncrypted?: boolean;
  };
}

export const PostCard = ({ post }: PostCardProps) => {
  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <Card className="glass border-border/40 hover:border-primary/30 transition-all duration-300 overflow-hidden group">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-mono text-sm font-bold">
              {post.author.slice(2, 4).toUpperCase()}
            </div>
            <div>
              <p className="font-mono text-sm text-foreground font-medium">
                {formatAddress(post.author)}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(post.timestamp, { addSuffix: true })}
              </p>
            </div>
          </div>
          {post.isEncrypted && (
            <div className="flex items-center gap-1 text-xs text-primary">
              <Lock className="w-3 h-3" />
              <span>Encrypted</span>
            </div>
          )}
        </div>

        {/* Content */}
        <p className="text-foreground mb-4 leading-relaxed">{post.text}</p>

        {/* IPFS Link */}
        {post.ipfsHash && (
          <div className="mb-4 p-3 rounded-lg bg-muted/30 border border-border/40">
            <div className="flex items-center gap-2 text-sm">
              <ExternalLink className="w-4 h-4 text-primary" />
              <span className="font-mono text-xs text-muted-foreground truncate">
                {post.ipfsHash}
              </span>
              <Button variant="ghost" size="sm" className="h-6 text-xs ml-auto">
                View
              </Button>
            </div>
          </div>
        )}

        {/* Stats & Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-border/40">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 hover:text-primary group/like"
            >
              <Heart className="w-4 h-4 group-hover/like:fill-primary group-hover/like:text-primary transition-all" />
              <span className="font-medium">{post.likes}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 hover:text-secondary group/tip"
            >
              <DollarSign className="w-4 h-4 group-hover/tip:text-secondary transition-all" />
              <span className="font-medium">{post.tips} ETH</span>
            </Button>
          </div>
          <Link to={`/post/${post.id}`}>
            <Button variant="glass" size="sm">
              View Details
            </Button>
          </Link>
        </div>
      </div>

      {/* Hover glow effect */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-secondary/5" />
      </div>
    </Card>
  );
};
