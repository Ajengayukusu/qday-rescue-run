# VIDEO SCRIPT — Q-Day Rescue Run (Quantum Pass)

- **Kategori:** Quantum Pass · **Status:** LIVE di Diana (chainId 9800) — kontrak v2
- **Kontrak:** `RescueRun` v2 — `0x2dA829D9F363d4463C529D4C2170a80D13955301`
- **Target durasi:** 2:30–2:55 (maksimum contest 3:00) · **Kecepatan baca acuan:** ~130 kata/menit
- **Jumlah kata narasi:** 379 kata · **Estimasi durasi baca:** ±2:55
- **Bahasa narasi:** Inggris (juri internasional). Hash dibaca dalam bentuk pendek ("d-one-seven-nine-a-f-f-seven, a-nine-two-nine"); hash lengkap tampil di layar, JANGAN dibaca penuh.

## Tabel segmen

| Segmen | Waktu | Durasi | Isi | Kata |
|---|---|---|---|---|
| 1 | 0:00–0:15 | 15 dtk | Hook — masalah Q-Day | 33 |
| 2 | 0:15–1:51 | ±96 dtk | Demo — 5 misi di frontend | 211 |
| 3 | 1:51–2:22 | ±31 dtk | Bukti on-chain di explorer | 67 |
| 4 | 2:22–2:41 | ±19 dtk | Keamanan — serangan yang ditolak | 47 |
| 5 | 2:41–2:51 | ±10 dtk | Penutup — syarat kategori | 21 |

---

## Naskah narasi (voice-over)

### [0:00–0:15] Segmen 1 — Hook

> When Q-Day arrives, a quantum computer will forge the classical signatures protecting your wallet. Most people won't know what to do. Q-Day Rescue Run teaches them — by making them do it, on-chain.

### [0:15–1:51] Segmen 2 — Demo alur utama

> This is the game. Five missions, five real post-quantum actions, in the order a real user performs them. Mission one: register your ML-DSA-87 key — which on QoreChain must be your account's very first transaction. Mission two: open a scoped EVM window, an authorization with limits on blocks, transaction count, value, and targets. Mission three: send a hybrid transfer, signed with both secp256k1 and ML-DSA-87, verified by the chain itself. Mission four: register an ML-KEM-1024 encryption key, so your messages survive the quantum era too. And mission five is the one no tool can do for you: a convincing phishing transaction — a fake migration that would drain the vault. Approve it, and the mission fails. Reject it, and you pass. The contract itself verifies mission one against the chain's key registry; all five land on-chain as a progress bitmap. Finish all five and the contract lets you claim the Q-Day Survivor badge — an on-chain record with your score: five hundred points. The game runs in your browser: demo mode mirrors the contract's rules exactly, so judges can play the full run with no wallet. Connect QoreX, and the same buttons write to the live contract on Diana testnet instead — what you just played is exactly what already happened on-chain.

### [1:51–2:22] Segmen 3 — Bukti on-chain

> Don't take our word for it — this is the contract on the Diana explorer, deployed in transaction d179af…a929. Two players completed the full game on-chain: five mission transactions, the phishing rejection, and the badge claim. Read the state: progress bitmap zero-b-one-one-one-one-one, five missions completed, score five hundred, badge claimed — exactly as the contract rules require. Every hash is also listed in the repository's deployment file.

### [2:22–2:41] Segmen 4 — Keamanan

> Try to cheat, and the contract says no. Claiming the badge early reverts. Replaying a mission reverts. Approving the phishing transaction completes nothing. Twenty-five tests — including a missing post-quantum key and out-of-order mission attempts — lock these rules in, and the contract holds no funds at all.

### [2:41–2:51] Segmen 5 — Penutup

> Q-Day Rescue Run: five missions, five real post-quantum skills, one badge — live on QoreChain Diana for the Quantum Pass track.

---

## Shot list per segmen

**Segmen 1 — Hook (0:00–0:15)**
- Layar: featured image / layar judul game (logo Q-Day Rescue Run), zoom pelan.
- Potong cepat ke kartu Mission 5 (phishing) saat kata "forge" — bangun rasa bahaya.

**Segmen 2 — Demo (0:15–1:51)**
- Layar: frontend game (`cd frontend && npm run dev`, http://localhost:5173), mode demo.
- Klik berurutan mengikuti narasi: kartu Mission 1 (register key) → Mission 2 (scoped window) → Mission 3 (hybrid transfer) → Mission 4 (ML-KEM) — progress bar naik tiap misi, skor bertambah 100/misi hingga 500.
- Mission 5: tampilkan spesimen tx phishing; pertama tunjukkan tombol **Approve** (UI menandai misi gagal, retry) lalu klik **Reject** — misi selesai.
- Klik **Claim Badge** → layar badge tampil (claimed, score 500).
- Di akhir segmen: klik **Connect Wallet** dan tunjukkan panel panduan key + EVM window — mode live mengirim transaksi asli ke kontrak v2.

**Segmen 3 — Bukti on-chain (1:51–2:22)**
- Layar: explorer https://explore.qore.network (toggle **Testnet**) — buka halaman kontrak v2 `0x2dA829D9F363d4463C529D4C2170a80D13955301`.
- Tampilkan tx deploy `0xd179aff7c3b7ba96ab77f5c2caab9a1079d7aad009358a549f14a8ba2627a929` (block 10091884).
- Gulir daftar tx kontrak (pemain 1): completeMission(0..3) `0xe725e48b…`, `0x73a4b466…`, `0xa17a056f…`, `0x9bf7c29b…`; reportPhishingDecision `0xebb290b5…`; claimBadge `0x4042a4ba…` (block 10091934). Sorot juga run pemain 2 (alamat berbeda, block 10091971–10091979).
- Tampilkan read-contract / hasil eth_call: progressOf = 31, missionsCompleted = 5, scoreOf = 500, hasBadge = true (boleh dari tab terminal dengan output `deployments.testnet.json` bagian verification bila explorer tidak menampilkan read state).
- Sisihkan 3 detik menampilkan REST fondasi: tx register ML-DSA `84EBDFC9…FF687CCC` dan hybrid send `9B1AA39F…F785BAD` (event `pqc_hybrid_verify = verified`).

**Segmen 4 — Keamanan (2:22–2:41)**
- Layar: terminal `npm test` — output "25 passing".
- Potong ke daftar test negatif di `test/RescueRun.test.ts` (misi 0 tanpa kunci PQC terdaftar, lompat urutan misi, klaim badge di 0 dan 4/5 misi, replay misi, phishing disetujui, klaim badge ganda).

**Segmen 5 — Penutup (2:41–2:51)**
- Layar: layar badge game + alamat kontrak di bawahnya; fade ke logo.

---

## Aset yang disiapkan sebelum rekam

1. Tab explorer (Testnet) sudah terbuka di: halaman kontrak `0x2dA829D9F363d4463C529D4C2170a80D13955301`, tx deploy `0xd179aff7…a929`, tx claimBadge pemain 1 `0x4042a4ba…ff15`.
2. Tab REST siap paste: `https://api-testnet.qore.host/cosmos/tx/v1beta1/txs/84EBDFC9544E82FA961A45265F3976C274152A7F012BD8897BFD9721FF687CCC` dan `.../9B1AA39F2D087A1BCB31496A9DD57AF6039A784236DCF861F790AB3C2F785BAD`.
3. Frontend berjalan lokal (port 5173), state demo di-reset ke 0 misi sebelum rekam; satu run cadangan sudah direkam sebagai backup.
4. Terminal siap dengan `npm test` (root project) untuk shot Segmen 4.
5. File `deployments.testnet.json` terbuka di editor untuk shot verifikasi state (bitmap 0b11111, score 500, hasBadge true).
6. Alamat yang disalin ke clipboard berurutan: alamat kontrak → hash deploy → hash claimBadge.
7. Featured image project (`featured.webp`) untuk shot pembuka/penutup.
