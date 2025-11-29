// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, euint64, externalEuint32, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * CipherCircle core contract:
 * - Stores encrypted likes (euint32) and tips (euint64) per post
 * - Frontend encrypts inputs with zama-fhe/relayer-sdk and imports them through FHE.fromExternal
 * - ACL: the contract is always authorized, and post authors can be granted access to their own stats
 *
 * Frontend mapping (sample workflow):
 * - CreatePost: encrypt optional metadata (e.g., length) or initialize counters
 * - PostDetail: encrypt constant 1 for likes (uint32) and encrypt amounts for tips (uint64)
 */
contract CipherCircle is ZamaEthereumConfig {
    struct PostStats {
        address author;
        euint32 likes; // Encrypted like counter
        euint64 tips; // Encrypted tips total (e.g., in wei)
        bool exists;
    }

    // postId => stats struct
    mapping(uint256 => PostStats) private _posts;

    event PostCreated(uint256 indexed postId, address indexed author);
    event Liked(uint256 indexed postId, address indexed from);
    event Tipped(uint256 indexed postId, address indexed from);

    function createPost(uint256 postId) external {
        require(!_posts[postId].exists, "Post already exists");

        euint32 likes = FHE.asEuint32(0);
        euint64 tips = FHE.asEuint64(0);

        FHE.allowThis(likes);
        FHE.allowThis(tips);

        _posts[postId] = PostStats({
            author: msg.sender,
            likes: likes,
            tips: tips,
            exists: true
        });

        FHE.allow(likes, msg.sender);
        FHE.allow(tips, msg.sender);

        emit PostCreated(postId, msg.sender);
    }

    function like(uint256 postId, externalEuint32 encryptedOne, bytes calldata inputProof) external {
        require(_posts[postId].exists, "Post not found");

        euint32 one = FHE.fromExternal(encryptedOne, inputProof);
        FHE.allowThis(one);

        euint32 newLikes = FHE.add(_posts[postId].likes, one);
        FHE.allowThis(newLikes);

        _posts[postId].likes = newLikes;
        FHE.allow(newLikes, _posts[postId].author);

        emit Liked(postId, msg.sender);
    }

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
     * Allow the author to share encrypted stats with a specified viewer.
     * Once granted, the viewer can call getEncryptedStats and decrypt via the relayer SDK.
     */
    function grantStatsAccess(uint256 postId, address viewer) external {
        require(_posts[postId].exists, "Post not found");
        require(msg.sender == _posts[postId].author, "Only author");

        FHE.allow(_posts[postId].likes, viewer);
        FHE.allow(_posts[postId].tips, viewer);
    }

    /**
     * Return the encrypted statistics for a post.
     * - likes: euint32
     * - tips:  euint64
     *
     * Only addresses with ACL permissions can successfully decrypt the result.
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


