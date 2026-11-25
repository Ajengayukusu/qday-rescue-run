// Sources flattened with hardhat v2.29.2 https://hardhat.org

// SPDX-License-Identifier: MIT

// File contracts/RescueRun.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity 0.8.24;

/// @title IQorePqcKeyStatus — interface for the QoreChain pqcKeyStatus precompile.
/// @notice Copied EXACTLY (signature and return order) from the proven
///         interface in the DeedLock Escrow project (IQorePqc.sol). The
///         precompile returns FOUR values since chain v3.2.4 — older
///         3-value decoders break against the live precompile.
interface IQorePqcKeyStatus {
    /// @return registered       The account has an ML-DSA key registered on chain.
    /// @return algorithmId      Signature algorithm id (1 = ML-DSA-87 / FIPS 204).
    /// @return pubkey           The public key actually registered on chain.
    /// @return possessionProven The account proved possession of the private key
    ///                          at registration time (MsgRegisterPQCKeyV2).
    function pqcKeyStatus(
        address account
    )
        external
        view
        returns (
            bool registered,
            uint8 algorithmId,
            bytes memory pubkey,
            bool possessionProven
        );
}

/// @title RescueRun — Q-Day Rescue Run (Quantum Pass, QoreChain Developer Fest)
/// @notice Educational game contract. A player completes 5 missions that map to
///         real post-quantum actions on QoreChain; finishing all 5 lets the
///         player claim an on-chain "Q-Day Survivor" badge record.
///
///         Mission map (missionId -> real QoreChain action taught by the game):
///           0 -> Register an ML-DSA-87 (FIPS 204) post-quantum key
///           1 -> Open a scoped EVM authorisation window
///           2 -> Send a hybrid transfer (secp256k1 + ML-DSA-87)
///           3 -> Register an ML-KEM-1024 (FIPS 203) encryption key
///           4 -> Reject a phishing transaction (ONLY via reportPhishingDecision)
///
/// @dev    VERIFICATION MODEL — stated honestly, because the game teaches
///         verification and must practise it:
///
///         - Mission 0 is CONTRACT-VERIFIED. Before accepting it, this
///           contract calls the pqcKeyStatus precompile (0x0A02) for the
///           player and reverts with PqcKeyNotRegistered if no ML-DSA key
///           is registered for them. Claiming the mission without the real
///           action is impossible.
///         - Mission 1 is CHAIN-GATED on Diana: an EVM transaction is only
///           admitted inside the player's open EVM authorisation window, so
///           the completion transaction itself could only land on the live
///           chain if a window was really open. The contract cannot read
///           native window state, so it does not pretend to check more.
///         - Missions 2 and 3 are SELF-REPORTED. The underlying actions (a
///           hybrid-signed native transfer; an ML-KEM key registration in
///           the native KEM registry) happen in QoreChain's native lane and
///           are NOT observable from the EVM, so no contract check is
///           possible. They emit MissionSelfReported (not MissionCompleted)
///           so indexers, the UI and auditors can tell the difference.
///         - Mission 4 records the player's DECISION on-chain; the skill
///           being taught is the decision itself, and only rejecting the
///           phishing transaction completes the mission.
///
///         ORDER: missions are a curriculum and are SEQUENTIAL by design —
///         mission n only unlocks once missions 0..n-1 are complete,
///         mirroring the real migration order (you cannot open a window
///         before registering a key, and so on).
///
///         Progress is a 5-bit bitmap per player. Each mission can be
///         completed exactly once (anti-replay). The badge is a plain
///         on-chain record (struct + event), deliberately NOT an external
///         NFT dependency.
contract RescueRun {
    uint8 public constant MISSION_COUNT = 5;
    uint8 public constant PHISHING_MISSION = 4;
    uint8 public constant FULL_BITMAP = 0x1F; // 0b11111
    uint256 public constant POINTS_PER_MISSION = 100;
    uint256 public constant MAX_SCORE = 500; // 5 missions * 100

    /// @notice The pqcKeyStatus precompile on QoreChain Diana (chain v3.2.4+).
    address public constant PQC_KEY_STATUS_PRECOMPILE =
        0x0000000000000000000000000000000000000a02;

    struct Badge {
        bool claimed;
        uint64 claimedAt; // block.timestamp at claim time
        uint256 score; // score snapshot at claim time (always MAX_SCORE)
    }

    mapping(address => uint8) private _progress; // mission bitmap per player
    mapping(address => Badge) private _badges;

    uint256 public totalPlayers; // addresses that completed >= 1 mission
    uint256 public totalBadges; // badges claimed

    /// @notice Emitted for missions whose completion the chain/contract can
    ///         back: 0 (precompile-verified), 1 (chain-gated by the EVM
    ///         window) and 4 (the recorded decision itself).
    event MissionCompleted(
        address indexed player,
        uint8 indexed missionId,
        uint8 progressBitmap,
        uint256 score
    );
    /// @notice Emitted for missions 2 and 3 ONLY. Their underlying actions
    ///         happen in the native lane and cannot be observed from the
    ///         EVM, so the completion is the player's own report — kept
    ///         visibly distinct from MissionCompleted on purpose.
    event MissionSelfReported(
        address indexed player,
        uint8 indexed missionId,
        uint8 progressBitmap,
        uint256 score
    );
    event PhishingReported(
        address indexed player,
        bool rejected,
        bool missionCompleted
    );
    event BadgeClaimed(
        address indexed player,
        uint256 score,
        uint64 claimedAt
    );

    error InvalidMission(uint8 missionId);
    error MissionAlreadyCompleted(address player, uint8 missionId);
    error PhishingMissionRequiresReport();
    error MissionsIncomplete(address player, uint8 progressBitmap);
    error BadgeAlreadyClaimed(address player);
    /// @notice Mission 0 was claimed but the pqcKeyStatus precompile reports
    ///         no ML-DSA key registered for the player.
    error PqcKeyNotRegistered(address player);
    /// @notice Missions are sequential: an earlier mission is still missing.
    error PreviousMissionsIncomplete(
        address player,
        uint8 missionId,
        uint8 progressBitmap
    );

    // ------------------------------------------------------------------
    // Write API
    // ------------------------------------------------------------------

    /// @notice Complete one of missions 0..3. Mission 4 (phishing) is NOT
    ///         accepted here; it must go through reportPhishingDecision().
    /// @dev    Mission 0 is verified against the pqcKeyStatus precompile
    ///         (0x0A02): no registered ML-DSA key -> PqcKeyNotRegistered.
    ///         All missions are sequential: 0..missionId-1 must be done.
    function completeMission(uint8 missionId) external {
        if (missionId >= MISSION_COUNT) revert InvalidMission(missionId);
        if (missionId == PHISHING_MISSION) {
            revert PhishingMissionRequiresReport();
        }
        if (missionId == 0) {
            _requirePqcKeyRegistered(msg.sender);
        }
        _completeMission(msg.sender, missionId);
    }

    /// @notice Mission 4: the player is shown a malicious transaction and must
    ///         reject it. Only `rejected == true` completes the mission.
    ///         Approving the phishing tx is recorded (for the game's feedback
    ///         loop) but completes nothing and can be retried.
    function reportPhishingDecision(bool rejected) external {
        if (!rejected) {
            emit PhishingReported(msg.sender, false, false);
            return;
        }
        if (_isDone(msg.sender, PHISHING_MISSION)) {
            revert MissionAlreadyCompleted(msg.sender, PHISHING_MISSION);
        }
        _completeMission(msg.sender, PHISHING_MISSION);
        emit PhishingReported(msg.sender, true, true);
    }

    /// @notice Claim the "Q-Day Survivor" badge once all 5 missions are done.
    function claimBadge() external {
        uint8 bitmap = _progress[msg.sender];
        if (bitmap != FULL_BITMAP) {
            revert MissionsIncomplete(msg.sender, bitmap);
        }
        if (_badges[msg.sender].claimed) {
            revert BadgeAlreadyClaimed(msg.sender);
        }
        uint256 finalScore = scoreOf(msg.sender);
        _badges[msg.sender] = Badge({
            claimed: true,
            claimedAt: uint64(block.timestamp),
            score: finalScore
        });
        totalBadges += 1;
        emit BadgeClaimed(msg.sender, finalScore, uint64(block.timestamp));
    }

    // ------------------------------------------------------------------
    // Read API (frontend)
    // ------------------------------------------------------------------

    /// @notice Raw 5-bit mission bitmap for a player.
    function progressOf(address player) external view returns (uint8) {
        return _progress[player];
    }

    /// @notice Whether one mission is completed for a player.
    function isMissionDone(address player, uint8 missionId)
        external
        view
        returns (bool)
    {
        if (missionId >= MISSION_COUNT) revert InvalidMission(missionId);
        return _isDone(player, missionId);
    }

    /// @notice Live PQC key check for a player, straight from the 0x0A02
    ///         precompile — the same check mission 0 enforces.
    function hasPqcKey(address player) external view returns (bool) {
        (bool registered, , , ) = IQorePqcKeyStatus(
            PQC_KEY_STATUS_PRECOMPILE
        ).pqcKeyStatus(player);
        return registered;
    }

    /// @notice Number of missions completed (0..5).
    function missionsCompleted(address player) external view returns (uint8) {
        uint8 bitmap = _progress[player];
        uint8 count;
        for (uint8 i = 0; i < MISSION_COUNT; i++) {
            if (bitmap & (uint8(1) << i) != 0) count += 1;
        }
        return count;
    }

    /// @notice Score = 100 points per completed mission (max 500).
    function scoreOf(address player) public view returns (uint256) {
        uint8 bitmap = _progress[player];
        uint256 count;
        for (uint8 i = 0; i < MISSION_COUNT; i++) {
            if (bitmap & (uint8(1) << i) != 0) count += 1;
        }
        return count * POINTS_PER_MISSION;
    }

    /// @notice Badge record for a player: (claimed, claimedAt, score).
    function badgeOf(address player)
        external
        view
        returns (bool claimed, uint64 claimedAt, uint256 score)
    {
        Badge storage badge = _badges[player];
        return (badge.claimed, badge.claimedAt, badge.score);
    }

    /// @notice Convenience flag for the frontend badge screen.
    function hasBadge(address player) external view returns (bool) {
        return _badges[player].claimed;
    }

    // ------------------------------------------------------------------
    // Internal
    // ------------------------------------------------------------------

    function _isDone(address player, uint8 missionId)
        internal
        view
        returns (bool)
    {
        return _progress[player] & (uint8(1) << missionId) != 0;
    }

    /// @dev Mission 0 gate: ask the pqcKeyStatus precompile whether the
    ///      player really has an ML-DSA key registered on chain.
    function _requirePqcKeyRegistered(address player) internal view {
        (bool registered, , , ) = IQorePqcKeyStatus(
            PQC_KEY_STATUS_PRECOMPILE
        ).pqcKeyStatus(player);
        if (!registered) revert PqcKeyNotRegistered(player);
    }

    function _completeMission(address player, uint8 missionId) internal {
        if (_isDone(player, missionId)) {
            revert MissionAlreadyCompleted(player, missionId);
        }
        // Sequential curriculum: every earlier mission must already be done.
        // requiredMask for mission n is bits 0..n-1 (0 for mission 0).
        uint8 bitmap = _progress[player];
        uint8 requiredMask = uint8((uint16(1) << missionId) - 1);
        if (bitmap & requiredMask != requiredMask) {
            revert PreviousMissionsIncomplete(player, missionId, bitmap);
        }
        if (bitmap == 0) {
            totalPlayers += 1;
        }
        _progress[player] = bitmap | (uint8(1) << missionId);
        uint256 newScore = scoreOf(player);
        if (missionId == 2 || missionId == 3) {
            // Native-lane actions the EVM cannot observe: self-reported.
            emit MissionSelfReported(
                player,
                missionId,
                _progress[player],
                newScore
            );
        } else {
            emit MissionCompleted(
                player,
                missionId,
                _progress[player],
                newScore
            );
        }
    }
}
