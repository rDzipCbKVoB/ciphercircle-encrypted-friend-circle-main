import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Upload, Lock, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  getCipherCircleContract,
  generatePostId,
  CONTRACT_ADDRESS,
  DEFAULT_CONTRACT_ADDRESS,
} from "@/lib/contract";
import { saveLocalPostDraft } from "@/lib/postsStorage";

const CreatePost = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [ipfsHash, setIpfsHash] = useState("");
  const [isEncrypted, setIsEncrypted] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!text.trim()) {
      toast({
        title: "Error",
        description: "Please enter some text for your post",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);

      if (CONTRACT_ADDRESS === DEFAULT_CONTRACT_ADDRESS) {
        toast({
          title: "Contract not configured",
          description: "Please set VITE_CONTRACT_ADDRESS in the .env file.",
          variant: "destructive",
        });
        return;
      }

      // Generate the deterministic post ID
      const postId = generatePostId(text, ipfsHash);
      console.log("Generated postId:", postId.toString());

      const contract = await getCipherCircleContract(CONTRACT_ADDRESS);

      console.log("Contract address:", CONTRACT_ADDRESS);
      console.log("Calling createPost with postId:", postId.toString());
      
      toast({
        title: "Submitting...",
        description: "Sending the post to the blockchain.",
      });

      try {
        console.log("Estimating gas...");
        const gasEstimate = await contract.createPost.estimateGas(postId);
        console.log("Gas estimate:", gasEstimate.toString());
        
        const tx = await contract.createPost(postId, {
          gasLimit: (gasEstimate * 120n) / 100n,
        });
        
        console.log("Transaction hash:", tx.hash);
        
        toast({
          title: "Transaction sent",
          description: `Tx hash: ${tx.hash.slice(0, 10)}...`,
        });

        const receipt = await tx.wait();
        console.log("Transaction confirmed:", receipt);
        
        saveLocalPostDraft(postId.toString(), {
          text: text.trim(),
          ipfsHash: ipfsHash || undefined,
          isEncrypted,
          createdAt: Date.now(),
        });
        
        toast({
          title: "Post Created! 🎉",
          description: `Post ID: ${postId.toString().slice(0, 10)}...`,
        });

        setTimeout(() => {
          navigate("/");
        }, 1500);
      } catch (gasError: any) {
        console.error("Gas estimation failed, trying direct send:", gasError);
        
        try {
          console.log("Sending transaction without gas estimate...");
          const tx = await contract.createPost(postId, {
            gasLimit: 1000000,
          });
          
          console.log("Transaction hash:", tx.hash);
          
          toast({
            title: "Transaction sent",
            description: `Tx hash: ${tx.hash.slice(0, 10)}...`,
          });

          const receipt = await tx.wait();
          console.log("Transaction receipt:", receipt);
          
          if (receipt.status === 0) {
            throw new Error("Transaction failed. Check the transaction details for more info.");
          }
          
          saveLocalPostDraft(postId.toString(), {
            text: text.trim(),
            ipfsHash: ipfsHash || undefined,
            isEncrypted,
            createdAt: Date.now(),
          });
          
          toast({
            title: "Post Created! 🎉",
            description: `Post ID: ${postId.toString().slice(0, 10)}...`,
          });

          setTimeout(() => {
            navigate("/");
          }, 1500);
        } catch (txError: any) {
          console.error("Direct transaction failed:", txError);
          throw new Error(`Transaction failed: ${txError.reason || txError.message || "Contract execution reverted."}`);
        }
      }
    } catch (error: any) {
      console.error("Create post error:", error);
      
      let errorMessage = "Something went wrong while creating the post. Please try again.";
      if (error.code === 4001) {
        errorMessage = "User rejected the transaction request.";
      } else if (error.reason) {
        errorMessage = error.reason;
      } else if (error.message?.includes("Post already exists")) {
        errorMessage = "Post ID already exists. Please try again.";
      } else if (error.message?.includes("missing revert data")) {
        errorMessage = "Contract call failed. Verify the contract address, deployment status, and selected network.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: "Failed to create post",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold mb-3 gradient-text">Create Post</h1>
            <p className="text-muted-foreground">
              Share your thoughts with FHE-powered privacy
            </p>
          </div>

          {/* Form Card */}
          <Card className="glass border-border/40 p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Text Input */}
              <div className="space-y-2">
                <Label htmlFor="text" className="text-foreground">
                  Post Content
                </Label>
                <Textarea
                  id="text"
                  placeholder="What's on your mind?"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="min-h-[150px] glass border-border/40 resize-none"
                  maxLength={500}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Share your thoughts securely</span>
                  <span>{text.length}/500</span>
                </div>
              </div>

              {/* IPFS Hash Input */}
              <div className="space-y-2">
                <Label htmlFor="ipfs" className="text-foreground flex items-center gap-2">
                  IPFS Hash
                  <span className="text-xs text-muted-foreground font-normal">
                    (Optional)
                  </span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="ipfs"
                    placeholder="QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco"
                    value={ipfsHash}
                    onChange={(e) => setIpfsHash(e.target.value)}
                    className="glass border-border/40 font-mono text-sm"
                  />
                  <Button type="button" variant="glass" size="icon">
                    <Upload className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Upload files to IPFS and add the hash here
                </p>
              </div>

              {/* Privacy Toggle */}
              <div className="glass p-4 rounded-lg border border-border/40">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-primary" />
                    <Label className="text-foreground cursor-pointer">
                      Enable FHE Encryption
                    </Label>
                  </div>
                  <input
                    type="checkbox"
                    checked={isEncrypted}
                    onChange={(e) => setIsEncrypted(e.target.checked)}
                    className="w-4 h-4 accent-primary cursor-pointer"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Encrypt likes and tips using Fully Homomorphic Encryption for maximum
                  privacy
                </p>
              </div>

              {/* Submit Button */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate("/")}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="glow"
                  className="flex-1 gap-2"
                  disabled={submitting}
                >
                  <Send className="w-4 h-4" />
                  {submitting ? "Publishing..." : "Publish Post"}
                </Button>
              </div>
            </form>
          </Card>

          {/* Info Cards */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="glass border-border/40 p-4">
              <h3 className="font-semibold text-primary mb-2 flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Privacy First
              </h3>
              <p className="text-sm text-muted-foreground">
                All engagement metrics are encrypted using FHE, ensuring your privacy
                while maintaining transparency
              </p>
            </Card>
            <Card className="glass border-border/40 p-4">
              <h3 className="font-semibold text-secondary mb-2 flex items-center gap-2">
                <Upload className="w-4 h-4" />
                IPFS Storage
              </h3>
              <p className="text-sm text-muted-foreground">
                Store rich media on IPFS for decentralized, permanent content hosting
              </p>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CreatePost;
