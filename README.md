# PayVerify

Bank transfer slip auto-verification and fraud defense engine. Uses a 4-stage pipeline: duplicate check, AI extraction, rule validation, and bank SMS reconciliation.

## Setup

### Prerequisites

* Node.js v18+ (v20+ recommended)
* npm v9+
* Gemini API key (optional for test fixtures, required for real photo OCR)

### Install

```bash
git clone <repository-url>
cd payverify
npm install
cp .env.example .env
```

Edit `.env`:

```env
GEMINI_API_KEY="your_actual_gemini_api_key_here"
PORT=3000
```

### Run (development)

```bash
npm run dev
```

Runs at `http://0.0.0.0:3000`.

### Run (production)

```bash
npm run build
npm start
```

## Architecture

* **Frontend:** React 19, TypeScript, Tailwind. Includes Verification Workbench, Submissions Queue, Bank SMS Stream, Test Lab, Audit Trail, and Policy Configurator.
* **API:** Express 4 on Node.js. Handles uploads up to 25MB, plus routes for slip verification, SMS simulation, and manual overrides.
* **Deduplication:** SHA-256 hashing in-memory for instant duplicate detection.
* **Extraction:** Gemini 3.8 Flash reads the slip and returns structured JSON (amount, reference, account, tamper score, legibility).
* **Rule engine:** Checks account whitelist, exact amount, reference uniqueness, and freshness window.
* **SMS reconciliation:** Parses bank SMS (Kasikornbank, SCB, DBS, Chase formats) and matches deposits to open orders.

**Pipeline:**

1. Hash check → duplicate rejected instantly, no AI cost.
2. Gemini extracts slip data.
3. Rules check tamper score, account, amount, reference, and date.
4. SMS match → APPROVED, NEEDS_VERIFICATION (waits for SMS), or REJECTED (already claimed).

## Major Design Decisions

* **AI runs server-side only** — keeps the API key and prompts off the client.
* **Customer messages vs. internal logs are separate** — customers get plain guidance; fraud scores and details stay internal so they can't be reverse-engineered.
* **Unclear images are uncertainty, not fraud** — blurry slips go to NEEDS_VERIFICATION and ask for a resend, instead of a hard rejection.
* **No amount-only matching** — prevents assigning one customer's deposit to another when amounts coincide.
* **Manual overrides require a name and reason** — for accountability and audit compliance.

## Verification Approach

Checks four dimensions before accepting a payment:

1. **Cryptographic identity** — hash and perceptual signature of the image.
2. **Extraction** — bank, amount, currency, account, reference, timestamp via Gemini.
3. **Business rules** — account whitelist, exact amount match, freshness window (not older than 24h, not from the future).
4. **Settlement corroboration** — matched against real bank SMS; once matched, the SMS is claimed and locked to that order.

## Fraud-Handling Approach

| Attack                        | Detection                                    | Result                        |
| ----------------------------- | -------------------------------------------- | ----------------------------- |
| Edited/Photoshopped slip      | Tamper score from Gemini forensic analysis   | Rejected                      |
| Duplicate image               | SHA-256 hash match                           | Rejected instantly, 0 AI cost |
| Reused reference              | Reference registry lookup                    | Rejected                      |
| Same payment, different image | Reference tracking across re-crops/re-photos | Rejected                      |
| Old/stale receipt             | Freshness window check                       | Rejected                      |
| Fake or unconfirmed transfer  | No matching bank SMS                         | Held in `NEEDS_VERIFICATION`  |
| SMS reused across orders      | SMS claim registry                           | Rejected                      |
| Slip and SMS disagree         | Cross-check between extracted data and SMS   | Rejected                      |

## Cost Considerations

* Duplicate checks run locally (SHA-256), costing zero AI tokens.
* Uses Gemini 3.8 Flash (fast, low-cost) rather than a flagship model.
* Structured JSON output keeps responses compact (~180 tokens per call).
* AI runs once per unique image; all rule and SMS checks after that are plain in-memory logic.

## Known Limitations

* **SMS delays** — mitigated by holding valid slips in NEEDS_VERIFICATION until the SMS arrives.
* **SMS spoofing risk** — production should use authenticated bank webhooks (mTLS) instead of raw SMS.
* **Masked account collisions** — only last 4 digits are usually visible, so matching also requires amount, timestamp, and reference together.
* **No multi-slip aggregation yet** — one slip is assumed to settle one order; partial/split payments aren't combined.
* **AI-generated fake slips** — could potentially pass visual checks; the bank SMS match is the final backstop, since funds must actually settle.
