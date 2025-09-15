# LangCert: Decentralized Language Test Certification Platform

## Overview

LangCert is a Web3 project built on the Stacks blockchain using Clarity smart contracts. It provides a decentralized platform for certifying language test results (e.g., TOEFL, IELTS, or custom proficiency exams). By leveraging blockchain technology, LangCert ensures that certificates are tamper-proof, easily verifiable, and resistant to fraud. Issuers (such as testing agencies) can mint certificates as NFTs or data entries on the blockchain, test takers can claim and own them, and third parties (e.g., universities, employers) can verify authenticity without relying on centralized databases.

### Real-World Problems Solved
- **Certificate Fraud**: Traditional paper or digital certificates can be forged. LangCert stores cryptographic hashes of certificate data on-chain, making alterations impossible without detection.
- **Verification Delays and Costs**: Centralized systems require contacting issuers for verification, which can take days or weeks. LangCert allows instant, permissionless verification via public blockchain queries.
- **Data Portability and Accessibility**: Certificates are often tied to specific institutions or countries. LangCert makes them globally accessible and verifiable, aiding international mobility for students and professionals.
- **Corruption and Centralization Risks**: In some regions, corrupt officials alter records. Decentralization removes single points of failure and ensures immutability.
- **Privacy Concerns**: Test takers control their data sharing; they can selectively reveal certificates without exposing full personal info.
- **Incentivization for Honest Issuance**: Utility tokens or fees can reward compliant issuers and penalize fraud via governance.

The platform uses STX (Stacks' native token) for transaction fees and could integrate a custom token for governance or staking.

## Architecture
- **Blockchain**: Stacks (secured by Bitcoin), chosen for its Clarity language which emphasizes security, predictability, and auditability.
- **Frontend**: (Not included here) A web app built with React or similar, interacting with contracts via Stacks.js.
- **Smart Contracts**: 6 core contracts (described below) handling registration, issuance, storage, verification, governance, and payments.
- **Data Storage**: On-chain for hashes and metadata; off-chain (e.g., IPFS) for full certificate PDFs/images to minimize costs.
- **Workflow**:
  1. Issuers register and get approved.
  2. Test takers register.
  3. Issuer mints a certificate for a test taker.
  4. Test taker claims ownership.
  5. Third parties verify via contract queries.
  6. Governance handles updates/disputes.

## Smart Contracts
All contracts are written in Clarity. Below are descriptions, key functions, and full code for each. Deploy them in order (e.g., registries first). Contracts use traits for modularity and error handling with Clarity's `err`/`ok` pattern.

### 1. AdminContract.clar
Manages platform admins who can approve issuers or update configurations. Solves: Centralized control by allowing decentralized governance hooks.

```clarity
;; Admin Contract for LangCert

(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-ALREADY-ADMIN (err u101))

(define-data-var admins (list 10 principal) (list tx-sender))

(define-public (add-admin (new-admin principal))
  (if (is-some (index-of (var-get admins) tx-sender))
    (match (index-of (var-get admins) new-admin)
      _ (err ERR-ALREADY-ADMIN)
      (ok (var-set admins (unwrap! (as-max-len? (append (var-get admins) new-admin) u10) ERR-NOT-AUTHORIZED))))
    ERR-NOT-AUTHORIZED))

(define-public (remove-admin (admin-to-remove principal))
  (if (is-some (index-of (var-get admins) tx-sender))
    (ok (var-set admins (filter not-equal-to (var-get admins) admin-to-remove)))
    ERR-NOT-AUTHORIZED))

(define-private (not-equal-to (item principal) (target principal))
  (not (is-eq item target)))

(define-read-only (is-admin (user principal))
  (is-some (index-of (var-get admins) user)))
```

### 2. IssuerRegistry.clar
Registers and manages authorized certificate issuers (e.g., testing agencies). Admins approve/revoke issuers. Solves: Ensuring only trusted entities issue certificates.

```clarity
;; Issuer Registry for LangCert

(use-trait admin-trait .AdminContract.is-admin)

(define-constant ERR-NOT-ADMIN (err u200))
(define-constant ERR-ALREADY-REGISTERED (err u201))
(define-constant ERR-NOT-REGISTERED (err u202))

(define-map issuers principal { approved: bool, name: (string-ascii 50) })

(define-public (register-issuer (name (string-ascii 50)))
  (if (is-none (map-get? issuers tx-sender))
    (ok (map-set issuers tx-sender { approved: false, name: name }))
    ERR-ALREADY-REGISTERED))

(define-public (approve-issuer (issuer principal) (admin-contract <admin-trait>))
  (if (try! (contract-call? admin-contract is-admin tx-sender))
    (match (map-get? issuers issuer)
      details (ok (map-set issuers issuer (merge details { approved: true })))
      ERR-NOT-REGISTERED)
    ERR-NOT-ADMIN))

(define-read-only (is-approved-issuer (issuer principal))
  (match (map-get? issuers issuer)
    details (get approved details)
    false))
```

### 3. TestTakerRegistry.clar
Registers test takers with basic profile info. Solves: Linking certificates to verifiable identities without full KYC.

```clarity
;; Test Taker Registry for LangCert

(define-constant ERR-ALREADY-REGISTERED (err u300))

(define-map test-takers principal { name: (string-ascii 100), registered-at: uint })

(define-public (register-test-taker (name (string-ascii 100)))
  (if (is-none (map-get? test-takers tx-sender))
    (ok (map-set test-takers tx-sender { name: name, registered-at: block-height }))
    ERR-ALREADY-REGISTERED))

(define-read-only (get-test-taker (user principal))
  (map-get? test-takers user))
```

### 4. CertificateMinting.clar
Handles minting of certificates as unique entries (like NFTs). Issuers create them with hashes of off-chain data. Solves: Immutable issuance of certificates.

```clarity
;; Certificate Minting for LangCert

(use-trait issuer-trait .IssuerRegistry.is-approved-issuer)

(define-constant ERR-NOT-ISSUER (err u400))
(define-constant ERR-INVALID-RECIPIENT (err u401))

(define-map certificates uint { issuer: principal, recipient: principal, test-type: (string-ascii 20), score: uint, issue-date: uint, data-hash: (buff 32) })
(define-data-var next-id uint u1)

(define-public (mint-certificate (recipient principal) (test-type (string-ascii 20)) (score uint) (data-hash (buff 32)) (issuer-contract <issuer-trait>))
  (if (try! (contract-call? issuer-contract is-approved-issuer tx-sender))
    (let ((id (var-get next-id)))
      (map-set certificates id { issuer: tx-sender, recipient: recipient, test-type: test-type, score: score, issue-date: block-height, data-hash: data-hash })
      (var-set next-id (+ id u1))
      (ok id))
    ERR-NOT-ISSUER))

(define-read-only (get-certificate (id uint))
  (map-get? certificates id))
```

### 5. VerificationContract.clar
Allows anyone to verify a certificate's authenticity by checking on-chain data against provided hashes. Solves: Easy, trustless verification.

```clarity
;; Verification Contract for LangCert

(define-constant ERR-INVALID-CERT (err u500))

(define-public (verify-certificate (id uint) (provided-hash (buff 32)))
  (match (map-get? certificates id)
    cert (if (is-eq (get data-hash cert) provided-hash)
           (ok true)
           (ok false))
    ERR-INVALID-CERT))

(define-read-only (get-certificate-details (id uint))
  (map-get? certificates id))
```

### 6. GovernanceContract.clar
Handles voting on platform updates, issuer revocations, etc., using a simple token-weighted system (assume a separate token contract). Solves: Decentralized management to prevent admin abuse.

```clarity
;; Governance Contract for LangCert

(use-trait admin-trait .AdminContract.is-admin)

(define-constant ERR-NOT-AUTHORIZED (err u600))
(define-constant ERR-PROPOSAL-EXISTS (err u601))

(define-map proposals uint { proposer: principal, description: (string-ascii 200), votes-for: uint, votes-against: uint, active: bool })
(define-data-var next-proposal-id uint u1)

(define-public (create-proposal (description (string-ascii 200)) (admin-contract <admin-trait>))
  (if (try! (contract-call? admin-contract is-admin tx-sender))
    (let ((id (var-get next-proposal-id)))
      (map-set proposals id { proposer: tx-sender, description: description, votes-for: u0, votes-against: u0, active: true })
      (var-set next-proposal-id (+ id u1))
      (ok id))
    ERR-NOT-AUTHORIZED))

(define-public (vote-on-proposal (proposal-id uint) (vote-for bool))
  ;; Assume token balance check here; simplified for brevity
  (match (map-get? proposals proposal-id)
    prop (if (get active prop)
           (if vote-for
             (ok (map-set proposals proposal-id (merge prop { votes-for: (+ (get votes-for prop) u1) })))
             (ok (map-set proposals proposal-id (merge prop { votes-against: (+ (get votes-against prop) u1) }))))
           ERR-NOT-AUTHORIZED)
    ERR-PROPOSAL-EXISTS))
```

## Deployment and Usage
1. Deploy contracts on Stacks testnet/mainnet using Clarinet or Stacks CLI.
2. Fund wallets with STX for gas.
3. Interact via Clarity console or integrate with a frontend.
4. For off-chain data: Use IPFS for storing full certificates, hash them, and store hashes on-chain.

## Security Considerations
- Clarity's lack of reentrancy and explicit error handling enhances security.
- Audit contracts before production.
- Use multisig for initial admins.

## Future Enhancements
- Integrate SIP-009 NFTs for certificates.
- Add tokenomics for incentives.
- Privacy features like zero-knowledge proofs for selective disclosure.

## License
MIT License.