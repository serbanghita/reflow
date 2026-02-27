## Settlement Schedule Reflow System

A back-office mechanism used by payment processors and clearinghouses to handle failed inter-institutional settlements. When a batch settlement can't clear (e.g., insufficient liquidity, missed cutoff window, counterparty failure), the reflow system redistributes the outstanding obligations across future settlement windows — potentially splitting amounts — rather than failing outright.

Not to be confused with consumer-facing payment retry/dunning systems. Settlement reflow operates at the bank-to-bank layer, invisible to end users.


## Settlement Reschedule — Constraints & Dependencies

### Timing Constraints

- **Cutoff deadlines** — Each settlement window has a hard submission cutoff (e.g., ACH same-day cutoff at 16:45 ET).
- **Business day calendars** — Settlements typically only process on banking days; holidays and weekends push to the next available window.
- **Regulatory hold periods** — Some jurisdictions mandate minimum holding periods before retry (e.g., R09 returns in ACH have specific retry windows).
- **Max retry horizon** — A hard deadline after which the obligation must be escalated or written off.

### Financial Constraints

- **Counterparty liquidity** — The receiving/sending institution must have sufficient funds in the next window.
- **Netting position limits** — Reflowed amounts change net positions; the new window must accommodate the added volume without breaching exposure caps.
- **Partial settlement tolerance** — Whether the system and the contract allow splitting (e.g., can you settle $6k of a $10k obligation?).
- **Fee accumulation** — Retry/reflow may incur additional processing fees per attempt.

### Ordering & Priority

- **Priority ranking** — Reflowed settlements compete with fresh ones; rules determine who goes first (regulatory payments > interbank > merchant payouts).
- **FIFO vs. weighted** — Whether older failed settlements take precedence or are weighted by amount/urgency.
- **Dependency chains** — Settlement A may depend on Settlement B clearing first (e.g., funding account must receive before it can pay out).

### Capacity Constraints

- **Window throughput limits** — Each batch window has a max number of transactions or total volume it can process.
- **Concentration limits** — Regulatory caps on how much exposure one institution can have to another in a single cycle.
- **Channel availability** — The original rail (ACH, wire, RTGS) may not be available in the rescheduled window; fallback rails may have different rules.

### Data & System Dependencies

- **Idempotency keys** — Must track original transaction IDs to prevent double-settlement on retry.
- **State consistency** — Ledger, reconciliation, and reporting systems must all reflect the rescheduled state atomically.
- **Counterparty notification** — The other side needs to know the schedule changed (messaging protocols like ISO 20022, SWIFT).
- **Audit trail** — Regulators require full traceability of why, when, and how a settlement was reflowed.


## Glossary

- **Settlement** — The actual transfer of funds between financial institutions to fulfill a payment obligation.
- **Settlement Window (Batch Window)** — A scheduled time slot during which settlements are processed (e.g., ACH cutoff times, daily card network settlement cycles).
- **Reflow** — The redistribution of a failed settlement across future windows, possibly split into smaller amounts.
- **Netting** — Aggregating multiple obligations between parties into a single net amount to reduce the number of transfers.
- **Liquidity** — Available funds an institution has to meet its settlement obligations.
- **Counterparty** — The other institution involved in a settlement (e.g., the acquiring bank on the other side of a merchant payout).
- **Clearinghouse** — An intermediary that facilitates settlement between institutions (e.g., ACH, Visa/Mastercard networks).
- **Dunning** — Consumer-facing process of retrying failed payments and notifying the customer to update their payment method.
- **Deadletter** — A failed settlement that has exhausted all retry/reflow attempts and requires manual intervention.
- **Idempotency** — Ensuring a settlement or retry can be safely re-executed without duplicating the transfer.