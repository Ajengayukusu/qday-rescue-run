# VIDEO SCRIPT — Q-Day Rescue Run (Quantum Pass)

- **Kategori:** Quantum Pass · **Status:** LIVE di Diana (chainId 9800)
- **Kontrak:** `RescueRun` — `0xE589EC857101bf2ecD874EdCC80ddF2F63feE59A`
- **Target durasi:** 2:30–2:55 (maksimum contest 3:00) · **Kecepatan baca acuan:** ~130 kata/menit
- **Jumlah kata narasi:** 372 kata · **Estimasi durasi baca:** ±2:52
- **Bahasa narasi:** Inggris (juri internasional). Hash dibaca dalam bentuk pendek ("zero-nine-e-b-a-three, a-nine-six-seven-one"); hash lengkap tampil di layar, JANGAN dibaca penuh.

## Tabel segmen

| Segmen | Waktu | Durasi | Isi | Kata |
|---|---|---|---|---|
| 1 | 0:00–0:15 | 15 dtk | Hook — masalah Q-Day | 33 |
| 2 | 0:15–1:51 | ±96 dtk | Demo — 5 misi di frontend | 209 |
| 3 | 1:51–2:22 | ±31 dtk | Bukti on-chain di explorer | 67 |
| 4 | 2:22–2:41 | ±19 dtk | Keamanan — serangan yang ditolak | 42 |
| 5 | 2:41–2:51 | ±10 dtk | Penutup — syarat kategori | 21 |

---

## Naskah narasi (voice-over)

### [0:00–0:15] Segmen 1 — Hook

> When Q-Day arrives, a quantum computer will forge the classical signatures protecting your wallet. Most people won't know what to do. Q-Day Rescue Run teaches them — by making them do it, on-chain.

### [0:15–1:51] Segmen 2 — Demo alur utama

> This is the game. Five missions, five real post-quantum actions, in the order a real user performs them. Mission one: register your ML-DSA-87 key — and yes, on QoreChain that registration must be your account's very first transaction. Mission two: open a scoped EVM window, an authorization with limits on blocks, transaction count, value, and targets. Mission three: send a hybrid transfer, signed with both secp256k1 and ML-DSA-87, verified by the chain itself. Mission four: register an ML-KEM-1024 encryption key, so your messages survive the quantum era too. And mission five is the one no tool can do for you: a convincing phishing transaction — a fake migration that would drain the vault. Approve it, and the mission fails. Reject it, and you pass. Every mission is recorded on-chain in the RescueRun contract as a progress bitmap. Finish all five and the contract lets you claim the Q-Day Survivor badge — an on-chain record with your score: five hundred points. The game runs in your browser: demo mode mirrors the contract's rules exactly, so judges can play the full run with no wallet. Connect QoreX, and the same buttons write to the live contract on Diana testnet instead — what you just played is exactly what already happened on-chain.

### [1:51–2:22] Segmen 3 — Bukti on-chain

> Don't take our word for it — this is the contract on the Diana explorer, deployed in transaction 09eba3…a9671. The deployer played the full game on-chain: five mission transactions, the phishing rejection, and the badge claim. Read the state: progress bitmap zero-b-one-one-one-one-one, five missions completed, score five hundred, badge claimed — exactly as the contract rules require. Every hash is also listed in the repository's deployment file.

### [2:22–2:41] Segmen 4 — Keamanan

> Try to cheat, and the contract says no. Claiming the badge early reverts. Replaying a mission reverts. Approving the phishing transaction completes nothing. Eighteen tests, including nine attack cases, lock these rules in — and the contract holds no funds at all.

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
- Di akhir segmen: sorot toggle/penanda mode demo vs live (QoreX) di `src/lib/qore.ts` bila ditampilkan UI; cukup tampilkan panel status koneksi.

**Segmen 3 — Bukti on-chain (1:51–2:22)**
- Layar: explorer https://explore.qore.network (toggle **Testnet**) — buka halaman kontrak `0xE589EC857101bf2ecD874EdCC80ddF2F63feE59A`.
- Tampilkan tx deploy `0x09eba3445f1ab073c7845ca8af2a5fe1c28a72265c8840568354633218ea9671` (block 10086809).
- Gulir daftar tx kontrak: completeMission(0..3) `0x81ec9fca…`, `0xda4a89a3…`, `0x5c715620…`, `0x29ccbb2d…`; reportPhishingDecision `0xdc2aa133…`; claimBadge `0x05a540d1…` (block 10086838).
- Tampilkan read-contract / hasil eth_call: progressOf = 31, missionsCompleted = 5, scoreOf = 500, hasBadge = true (boleh dari tab terminal dengan output `deployments.testnet.json` bagian verification bila explorer tidak menampilkan read state).
- Sisihkan 3 detik menampilkan REST fondasi: tx register ML-DSA `84EBDFC9…FF687CCC` dan hybrid send `9B1AA39F…F785BAD` (event `pqc_hybrid_verify = verified`).

**Segmen 4 — Keamanan (2:22–2:41)**
- Layar: terminal `npm test` — output "18 passing".
- Potong ke daftar test negatif di `test/RescueRun.test.ts` (klaim badge di 0 dan 4/5 misi, replay misi, phishing disetujui, klaim badge ganda).

**Segmen 5 — Penutup (2:41–2:51)**
- Layar: layar badge game + alamat kontrak di bawahnya; fade ke logo.

---

## Aset yang disiapkan sebelum rekam

1. Tab explorer (Testnet) sudah terbuka di: halaman kontrak `0xE589EC857101bf2ecD874EdCC80ddF2F63feE59A`, tx deploy `0x09eba344…ea9671`, tx claimBadge `0x05a540d1…502f`.
2. Tab REST siap paste: `https://api-testnet.qore.host/cosmos/tx/v1beta1/txs/84EBDFC9544E82FA961A45265F3976C274152A7F012BD8897BFD9721FF687CCC` dan `.../9B1AA39F2D087A1BCB31496A9DD57AF6039A784236DCF861F790AB3C2F785BAD`.
3. Frontend berjalan lokal (port 5173), state demo di-reset ke 0 misi sebelum rekam; satu run cadangan sudah direkam sebagai backup.
4. Terminal siap dengan `npm test` (root project) untuk shot Segmen 4.
5. File `deployments.testnet.json` terbuka di editor untuk shot verifikasi state (bitmap 0b11111, score 500, hasBadge true).
6. Alamat yang disalin ke clipboard berurutan: alamat kontrak → hash deploy → hash claimBadge.
7. Featured image project (`featured.webp`) untuk shot pembuka/penutup.
