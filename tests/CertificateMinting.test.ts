// CertificateMinting.test.ts

import { describe, it, expect, beforeEach } from "vitest";
import { stringAsciiCV, uintCV, bufferCV, principalCV } from "@stacks/transactions";

const ERR_INVALID_RECIPIENT = 401;
const ERR_INVALID_TEST_TYPE = 402;
const ERR_INVALID_SCORE = 403;
const ERR_INVALID_DATA_HASH = 404;
const ERR_INVALID_EXPIRY = 405;
const ERR_INVALID_LEVEL = 406;
const ERR_INVALID_ISSUER_NAME = 407;
const ERR_INVALID_RECIPIENT_NAME = 408;
const ERR_INVALID_LOCATION = 409;
const ERR_INVALID_CURRENCY = 410;
const ERR_INVALID_MIN_SCORE = 414;
const ERR_INVALID_MAX_SCORE = 415;
const ERR_MAX_CERTS_EXCEEDED = 417;
const ERR_AUTHORITY_NOT_VERIFIED = 418;
const ERR_NOT_AUTHORIZED = 412;
const ERR_CERT_ALREADY_EXISTS = 420;
const ERR_INVALID_LANGUAGE = 422;
const ERR_INVALID_CATEGORY = 423;

interface Certificate {
  issuer: string;
  recipient: string;
  testType: string;
  score: number;
  issueDate: number;
  dataHash: Uint8Array;
  expiryDate: number;
  level: string;
  issuerName: string;
  recipientName: string;
  location: string;
  currency: string;
  status: boolean;
  minScore: number;
  maxScore: number;
  language: string;
  category: string;
}

interface CertUpdate {
  updateScore: number;
  updateExpiry: number;
  updateTimestamp: number;
  updater: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class CertificateMintingMock {
  state: {
    nextId: number;
    maxCerts: number;
    mintFee: number;
    authorityContract: string | null;
    certificates: Map<number, Certificate>;
    certUpdates: Map<number, CertUpdate>;
    certsByHash: Map<string, number>;
  } = {
    nextId: 1,
    maxCerts: 10000,
    mintFee: 500,
    authorityContract: null,
    certificates: new Map(),
    certUpdates: new Map(),
    certsByHash: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextId: 1,
      maxCerts: 10000,
      mintFee: 500,
      authorityContract: null,
      certificates: new Map(),
      certUpdates: new Map(),
      certsByHash: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.stxTransfers = [];
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: false };
    }
    if (this.state.authorityContract !== null) {
      return { ok: false, value: false };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setMintFee(newFee: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    if (newFee < 0) return { ok: false, value: false };
    this.state.mintFee = newFee;
    return { ok: true, value: true };
  }

  mintCertificate(
    recipient: string,
    testType: string,
    score: number,
    dataHash: Uint8Array,
    expiryDate: number,
    level: string,
    issuerName: string,
    recipientName: string,
    location: string,
    currency: string,
    minScore: number,
    maxScore: number,
    language: string,
    category: string
  ): Result<number> {
    if (this.state.nextId >= this.state.maxCerts) return { ok: false, value: ERR_MAX_CERTS_EXCEEDED };
    if (recipient === "SP000000000000000000002Q6VF78") return { ok: false, value: ERR_INVALID_RECIPIENT };
    if (!testType || testType.length > 20) return { ok: false, value: ERR_INVALID_TEST_TYPE };
    if (score < 0 || score > 100) return { ok: false, value: ERR_INVALID_SCORE };
    if (dataHash.length !== 32) return { ok: false, value: ERR_INVALID_DATA_HASH };
    if (expiryDate <= this.blockHeight) return { ok: false, value: ERR_INVALID_EXPIRY };
    if (!["beginner", "intermediate", "advanced"].includes(level)) return { ok: false, value: ERR_INVALID_LEVEL };
    if (!issuerName || issuerName.length > 50) return { ok: false, value: ERR_INVALID_ISSUER_NAME };
    if (!recipientName || recipientName.length > 100) return { ok: false, value: ERR_INVALID_RECIPIENT_NAME };
    if (!location || location.length > 50) return { ok: false, value: ERR_INVALID_LOCATION };
    if (!["STX", "USD", "BTC"].includes(currency)) return { ok: false, value: ERR_INVALID_CURRENCY };
    if (minScore < 0 || minScore > 100) return { ok: false, value: ERR_INVALID_MIN_SCORE };
    if (maxScore < 0 || maxScore > 100) return { ok: false, value: ERR_INVALID_MAX_SCORE };
    if (!language || language.length > 20) return { ok: false, value: ERR_INVALID_LANGUAGE };
    if (!category || category.length > 30) return { ok: false, value: ERR_INVALID_CATEGORY };
    const hashKey = Array.from(dataHash).join(",");
    if (this.state.certsByHash.has(hashKey)) return { ok: false, value: ERR_CERT_ALREADY_EXISTS };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };

    this.stxTransfers.push({ amount: this.state.mintFee, from: this.caller, to: this.state.authorityContract });

    const id = this.state.nextId;
    const cert: Certificate = {
      issuer: this.caller,
      recipient,
      testType,
      score,
      issueDate: this.blockHeight,
      dataHash,
      expiryDate,
      level,
      issuerName,
      recipientName,
      location,
      currency,
      status: true,
      minScore,
      maxScore,
      language,
      category,
    };
    this.state.certificates.set(id, cert);
    this.state.certsByHash.set(hashKey, id);
    this.state.nextId++;
    return { ok: true, value: id };
  }

  getCertificate(id: number): Certificate | null {
    return this.state.certificates.get(id) || null;
  }

  updateCertificate(id: number, updateScore: number, updateExpiry: number): Result<boolean> {
    const cert = this.state.certificates.get(id);
    if (!cert) return { ok: false, value: false };
    if (cert.issuer !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (updateScore < 0 || updateScore > 100) return { ok: false, value: ERR_INVALID_SCORE };
    if (updateExpiry <= this.blockHeight) return { ok: false, value: ERR_INVALID_EXPIRY };

    const updated: Certificate = {
      ...cert,
      score: updateScore,
      expiryDate: updateExpiry,
    };
    this.state.certificates.set(id, updated);
    this.state.certUpdates.set(id, {
      updateScore,
      updateExpiry,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
    });
    return { ok: true, value: true };
  }

  getCertCount(): Result<number> {
    return { ok: true, value: this.state.nextId };
  }

  checkCertExistence(dataHash: Uint8Array): Result<boolean> {
    const hashKey = Array.from(dataHash).join(",");
    return { ok: true, value: this.state.certsByHash.has(hashKey) };
  }
}

describe("CertificateMinting", () => {
  let contract: CertificateMintingMock;

  beforeEach(() => {
    contract = new CertificateMintingMock();
    contract.reset();
  });

  it("mints a certificate successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const dataHash = new Uint8Array(32).fill(0);
    const result = contract.mintCertificate(
      "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
      "TOEFL",
      85,
      dataHash,
      1000,
      "advanced",
      "IssuerOrg",
      "John Doe",
      "USA",
      "USD",
      0,
      100,
      "English",
      "Proficiency"
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(1);

    const cert = contract.getCertificate(1);
    expect(cert?.testType).toBe("TOEFL");
    expect(cert?.score).toBe(85);
    expect(cert?.level).toBe("advanced");
    expect(cert?.issuerName).toBe("IssuerOrg");
    expect(cert?.recipientName).toBe("John Doe");
    expect(cert?.location).toBe("USA");
    expect(cert?.currency).toBe("USD");
    expect(cert?.minScore).toBe(0);
    expect(cert?.maxScore).toBe(100);
    expect(cert?.language).toBe("English");
    expect(cert?.category).toBe("Proficiency");
    expect(contract.stxTransfers).toEqual([{ amount: 500, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects duplicate certificate hashes", () => {
    contract.setAuthorityContract("ST2TEST");
    const dataHash = new Uint8Array(32).fill(0);
    contract.mintCertificate(
      "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
      "TOEFL",
      85,
      dataHash,
      1000,
      "advanced",
      "IssuerOrg",
      "John Doe",
      "USA",
      "USD",
      0,
      100,
      "English",
      "Proficiency"
    );
    const result = contract.mintCertificate(
      "ST3NYX3MRK8DW6T3K7S7GDX4VNY2NX3BMX7Y3T1FY",
      "IELTS",
      90,
      dataHash,
      2000,
      "intermediate",
      "IssuerCorp",
      "Jane Smith",
      "UK",
      "STX",
      50,
      100,
      "French",
      "Business"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_CERT_ALREADY_EXISTS);
  });

  it("rejects mint without authority contract", () => {
    const dataHash = new Uint8Array(32).fill(0);
    const result = contract.mintCertificate(
      "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
      "TOEFL",
      85,
      dataHash,
      1000,
      "advanced",
      "IssuerOrg",
      "John Doe",
      "USA",
      "USD",
      0,
      100,
      "English",
      "Proficiency"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_VERIFIED);
  });

  it("rejects invalid score", () => {
    contract.setAuthorityContract("ST2TEST");
    const dataHash = new Uint8Array(32).fill(0);
    const result = contract.mintCertificate(
      "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
      "TOEFL",
      101,
      dataHash,
      1000,
      "advanced",
      "IssuerOrg",
      "John Doe",
      "USA",
      "USD",
      0,
      100,
      "English",
      "Proficiency"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_SCORE);
  });

  it("rejects invalid level", () => {
    contract.setAuthorityContract("ST2TEST");
    const dataHash = new Uint8Array(32).fill(0);
    const result = contract.mintCertificate(
      "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
      "TOEFL",
      85,
      dataHash,
      1000,
      "expert",
      "IssuerOrg",
      "John Doe",
      "USA",
      "USD",
      0,
      100,
      "English",
      "Proficiency"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_LEVEL);
  });

  it("updates a certificate successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const dataHash = new Uint8Array(32).fill(0);
    contract.mintCertificate(
      "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
      "TOEFL",
      85,
      dataHash,
      1000,
      "advanced",
      "IssuerOrg",
      "John Doe",
      "USA",
      "USD",
      0,
      100,
      "English",
      "Proficiency"
    );
    const result = contract.updateCertificate(1, 90, 2000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const cert = contract.getCertificate(1);
    expect(cert?.score).toBe(90);
    expect(cert?.expiryDate).toBe(2000);
    const update = contract.state.certUpdates.get(1);
    expect(update?.updateScore).toBe(90);
    expect(update?.updateExpiry).toBe(2000);
    expect(update?.updater).toBe("ST1TEST");
  });

  it("rejects update for non-existent certificate", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.updateCertificate(99, 90, 2000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects update by non-issuer", () => {
    contract.setAuthorityContract("ST2TEST");
    const dataHash = new Uint8Array(32).fill(0);
    contract.mintCertificate(
      "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
      "TOEFL",
      85,
      dataHash,
      1000,
      "advanced",
      "IssuerOrg",
      "John Doe",
      "USA",
      "USD",
      0,
      100,
      "English",
      "Proficiency"
    );
    contract.caller = "ST3FAKE";
    const result = contract.updateCertificate(1, 90, 2000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("sets mint fee successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setMintFee(1000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.mintFee).toBe(1000);
    const dataHash = new Uint8Array(32).fill(0);
    contract.mintCertificate(
      "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
      "TOEFL",
      85,
      dataHash,
      1000,
      "advanced",
      "IssuerOrg",
      "John Doe",
      "USA",
      "USD",
      0,
      100,
      "English",
      "Proficiency"
    );
    expect(contract.stxTransfers).toEqual([{ amount: 1000, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects mint fee change without authority contract", () => {
    const result = contract.setMintFee(1000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("returns correct certificate count", () => {
    contract.setAuthorityContract("ST2TEST");
    const dataHash1 = new Uint8Array(32).fill(0);
    const dataHash2 = new Uint8Array(32).fill(1);
    contract.mintCertificate(
      "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
      "TOEFL",
      85,
      dataHash1,
      1000,
      "advanced",
      "IssuerOrg",
      "John Doe",
      "USA",
      "USD",
      0,
      100,
      "English",
      "Proficiency"
    );
    contract.mintCertificate(
      "ST3NYX3MRK8DW6T3K7S7GDX4VNY2NX3BMX7Y3T1FY",
      "IELTS",
      90,
      dataHash2,
      2000,
      "intermediate",
      "IssuerCorp",
      "Jane Smith",
      "UK",
      "STX",
      50,
      100,
      "French",
      "Business"
    );
    const result = contract.getCertCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(3);
  });

  it("checks certificate existence correctly", () => {
    contract.setAuthorityContract("ST2TEST");
    const dataHash = new Uint8Array(32).fill(0);
    contract.mintCertificate(
      "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
      "TOEFL",
      85,
      dataHash,
      1000,
      "advanced",
      "IssuerOrg",
      "John Doe",
      "USA",
      "USD",
      0,
      100,
      "English",
      "Proficiency"
    );
    const result = contract.checkCertExistence(dataHash);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const fakeHash = new Uint8Array(32).fill(255);
    const result2 = contract.checkCertExistence(fakeHash);
    expect(result2.ok).toBe(true);
    expect(result2.value).toBe(false);
  });

  it("rejects certificate mint with empty test type", () => {
    contract.setAuthorityContract("ST2TEST");
    const dataHash = new Uint8Array(32).fill(0);
    const result = contract.mintCertificate(
      "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
      "",
      85,
      dataHash,
      1000,
      "advanced",
      "IssuerOrg",
      "John Doe",
      "USA",
      "USD",
      0,
      100,
      "English",
      "Proficiency"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_TEST_TYPE);
  });

  it("rejects certificate mint with max certs exceeded", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.state.maxCerts = 1;
    const dataHash1 = new Uint8Array(32).fill(0);
    const dataHash2 = new Uint8Array(32).fill(1);
    contract.mintCertificate(
      "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
      "TOEFL",
      85,
      dataHash1,
      1000,
      "advanced",
      "IssuerOrg",
      "John Doe",
      "USA",
      "USD",
      0,
      100,
      "English",
      "Proficiency"
    );
    const result = contract.mintCertificate(
      "ST3NYX3MRK8DW6T3K7S7GDX4VNY2NX3BMX7Y3T1FY",
      "IELTS",
      90,
      dataHash2,
      2000,
      "intermediate",
      "IssuerCorp",
      "Jane Smith",
      "UK",
      "STX",
      50,
      100,
      "French",
      "Business"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_CERTS_EXCEEDED);
  });

  it("sets authority contract successfully", () => {
    const result = contract.setAuthorityContract("ST2TEST");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.authorityContract).toBe("ST2TEST");
  });

  it("rejects invalid authority contract", () => {
    const result = contract.setAuthorityContract("SP000000000000000000002Q6VF78");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });
});