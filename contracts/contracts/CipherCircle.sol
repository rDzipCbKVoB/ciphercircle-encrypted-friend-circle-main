// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, euint64, externalEuint32, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * CipherCircle core contract:
 * - Maintains encrypted like counts (euint32) and tip totals (euint64) per post
 * - Frontend encrypts parameters via zama-fhe/relayer-sdk and the contract imports them with FHE.fromExternal
 * - ACL: the contract itself is always allowed; authors can be granted decryption access to their stats
 *
 * Frontend mapping (demo logic):
 * - CreatePost: optionally encrypts metadata or initial like counts during creation
 * - PostDetail: encrypts constant 1 for likes (euint32) and tip amounts (euint64) when interacting
 */
contract CipherCircle is ZamaEthereumConfig {
    struct PostStats {
        address author;
        euint32 likes; // encrypted like counter
        euint64 tips; // encrypted tip total (unit decided by the dApp, e.g. wei)
        bool exists;
    }

    // postId => encrypted stats
    mapping(uint256 => PostStats) private _posts;

    event PostCreated(uint256 indexed postId, address indexed author);
    event Liked(uint256 indexed postId, address indexed from);
    event Tipped(uint256 indexed postId, address indexed from);

    /**
     * Create a new post with zeroed encrypted counts.
     * The frontend may use any deterministic or incremental postId.
     */
    function createPost(uint256 postId) external {
        require(!_posts[postId].exists, "Post already exists");

        // Initialize likes / tips with encrypted zero
        euint32 likes = FHE.asEuint32(0);
        euint64 tips = FHE.asEuint64(0);

        // Allow the contract to handle the ciphertext internally
        FHE.allowThis(likes);
        FHE.allowThis(tips);

        _posts[postId] = PostStats({
            author: msg.sender,
            likes: likes,
            tips: tips,
            exists: true
        });

        // Author can decrypt their stats as well
        FHE.allow(likes, msg.sender);
        FHE.allow(tips, msg.sender);

        emit PostCreated(postId, msg.sender);
    }

    /**
     * Like a post by submitting an encrypted constant one (externalEuint32 + proof).
     */
    function like(uint256 postId, externalEuint32 encryptedOne, bytes calldata inputProof) external {
        require(_posts[postId].exists, "Post not found");

        // Import encrypted data and validate the proof
        euint32 one = FHE.fromExternal(encryptedOne, inputProof);
        FHE.allowThis(one);

        // likes = likes + 1
        euint32 newLikes = FHE.add(_posts[postId].likes, one);
        FHE.allowThis(newLikes);

        // Persist and keep the author allowance
        _posts[postId].likes = newLikes;
        FHE.allow(newLikes, _posts[postId].author);

        emit Liked(postId, msg.sender);
    }

    /**
     * Tip a post by submitting an encrypted amount (externalEuint64 + proof).
     */
    function tip(uint256 postId, externalEuint64 encryptedAmount, bytes calldata inputProof) external {
        require(_posts[postId].exists, "Post not found");

        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        FHE.allowThis(amount);

        // tips = tips + amount
        euint64 newTips = FHE.add(_posts[postId].tips, amount);
        FHE.allowThis(newTips);

        _posts[postId].tips = newTips;
        FHE.allow(newTips, _posts[postId].author);

        emit Tipped(postId, msg.sender);
    }

    /**
     * Allow a specific viewer to decrypt this post's stats (user-driven decryption flow).
     */
    function grantStatsAccess(uint256 postId, address viewer) external {
        require(_posts[postId].exists, "Post not found");
        require(msg.sender == _posts[postId].author, "Only author");

        FHE.allow(_posts[postId].likes, viewer);
        FHE.allow(_posts[postId].tips, viewer);
    }

    /**
     * Return encrypted statistics:
     * - likes: euint32
     * - tips:  euint64
     *
     * Callers must already be allowed within the ACL to decrypt them.
     */
    function getEncryptedStats(uint256 postId) external view returns (euint32, euint64) {
        require(_posts[postId].exists, "Post not found");
        return (_posts[postId].likes, _posts[postId].tips);
    }

    function authorOf(uint256 postId) external view returns (address) {
        require(_posts[postId].exists, "Post not found");
        return _posts[postId].author;
    }
}


