export class ApiError<EParsed = unknown> extends Error {
  public readonly name = "ApiError";
  public readonly status: number;
  public readonly key: string;
  public readonly url: string;

  public readonly rawText?: string;
  public readonly rawJson?: unknown;

  public readonly parsedError?: EParsed;

  constructor(args: {
    message: string;
    status: number;
    key: string;
    url: string;
    rawText?: string;
    rawJson?: unknown;
    parsedError?: EParsed;
  }) {
    super(args.message);
    this.status = args.status;
    this.key = args.key;
    this.url = args.url;

    if (args.rawText !== undefined) this.rawText = args.rawText;
    if (args.rawJson !== undefined) this.rawJson = args.rawJson;
    if (args.parsedError !== undefined) this.parsedError = args.parsedError;
  }
}

export class ValidationError extends Error {
  public readonly name = "ValidationError";

  public readonly key: string;
  public readonly url: string;
  public readonly kind: "request" | "response";
  public readonly issues: unknown;

  constructor(args: {
    message: string;
    key: string;
    url: string;
    kind: "request" | "response";
    issues: unknown;
  }) {
    super(args.message);
    this.key = args.key;
    this.url = args.url;
    this.kind = args.kind;
    this.issues = args.issues;
  }
}
