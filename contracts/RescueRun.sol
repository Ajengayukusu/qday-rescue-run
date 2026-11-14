// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

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
/// @dev    Progress is a 5-bit bitmap per player. Each mission can be completed
///         exactly once (anti-replay). The badge is a plain on-chain record
///         (struct + event), deliberately NOT an external NFT dependency.
contract RescueRun {
    uint8 public constant MISSION_COUNT = 5;
    uint8 public constant PHISHING_MISSION = 4;
    uint8 public constant FULL_BITMAP = 0x1F; // 0b11111
    uint256 public constant POINTS_PER_MISSION = 100;
    uint256 public constant MAX_SCORE = 500; // 5 missions * 100

    struct Badge {
        bool claimed;
        uint64 claimedAt; // block.timestamp at claim time
        uint256 score; // score snapshot at claim time (always MAX_SCORE)
    }

    mapping(address => uint8) private _progress; // mission bitmap per player
    mapping(address => Badge) private _badges;

    uint256 public totalPlayers; // addresses that completed >= 1 mission
    uint256 public totalBadges; // badges claimed

    event MissionCompleted(
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

    // ------------------------------------------------------------------
    // Write API
    // ------------------------------------------------------------------

    /// @notice Complete one of missions 0..3. Mission 4 (phishing) is NOT
    ///         accepted here; it must go through reportPhishingDecision().
    function completeMission(uint8 missionId) external {
        if (missionId >= MISSION_COUNT) revert InvalidMission(missionId);
        if (missionId == PHISHING_MISSION) {
            revert PhishingMissionRequiresReport();
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

    function _completeMission(address player, uint8 missionId) internal {
        if (_isDone(player, missionId)) {
            revert MissionAlreadyCompleted(player, missionId);
        }
        if (_progress[player] == 0) {
            totalPlayers += 1;
        }
        _progress[player] = _progress[player] | (uint8(1) << missionId);
        emit MissionCompleted(
            player,
            missionId,
            _progress[player],
            scoreOf(player)
        );
    }
}
