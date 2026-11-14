// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title MockPqcKeyStatus — local stand-in for the pqcKeyStatus precompile (TESTS ONLY).
/// @notice The test suite copies this contract's deployed bytecode to the
///         real precompile address 0x0A02 (hardhat_setCode), so RescueRun's
///         hardcoded precompile calls hit this mock on the local network.
///         Answers are driven by a registry the test controls, mirroring
///         MsgRegisterPQCKeyV2 outcomes on Diana: registered flag,
///         algorithmId 1 (ML-DSA-87), the registered pubkey bytes and the
///         possessionProven flag — the exact 4-value return shape of
///         IQorePqcKeyStatus since chain v3.2.4.
/// @dev This is NOT cryptography and NOT the real precompile. Never deploy
///      it to a live network; on Diana the real 0x0A02 answers instead.
contract MockPqcKeyStatus {
    struct KeyInfo {
        bool registered;
        bool possessionProven;
        bytes pubkey;
    }

    mapping(address => KeyInfo) private _keys;

    /// @notice Test helper: register (or overwrite) the key record for an
    ///         account, mirroring a successful MsgRegisterPQCKeyV2.
    function registerKey(address account, bytes calldata pubkey) external {
        _keys[account] = KeyInfo({
            registered: true,
            possessionProven: true,
            pubkey: pubkey
        });
    }

    /// @notice Test helper: remove an account's key record entirely.
    function removeKey(address account) external {
        delete _keys[account];
    }

    /// @notice Same signature/returns as the real 0x0A02 precompile.
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
        )
    {
        KeyInfo storage k = _keys[account];
        return (
            k.registered,
            k.registered ? uint8(1) : uint8(0), // 1 = ML-DSA-87
            k.pubkey,
            k.possessionProven
        );
    }
}
