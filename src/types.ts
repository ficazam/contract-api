export type RuntimeSchema<T> = { parse(input: unknown): T };

export type AuthMode = "public" | "required";

export type ContentType = "json" | "text" | "none";

export type EndpointDef = {
  auth: AuthMode;
  params?: RuntimeSchema<any>;
  query?: RuntimeSchema<any>;
  body?: RuntimeSchema<any>;
  headers?: RuntimeSchema<any>;
  response: RuntimeSchema<any>;
  error?: RuntimeSchema<any>;
  contentType?: ContentType;
};

export type ContractShape = Record<string, EndpointDef>;
export type Contract = ContractShape;

type Primitive = string | number | boolean | bigint | symbol | null | undefined;

type Builtin =
  | Primitive
  | Date
  | RegExp
  | Function
  | Map<any, any>
  | Set<any>
  | Promise<any>;

export type Exact<Shape, A extends Shape> = Shape extends Builtin
  ? Shape
  : Shape extends ReadonlyArray<infer SEl>
  ? A extends ReadonlyArray<infer AEl>
    ? ReadonlyArray<Exact<SEl, AEl & SEl>>
    : never
  : Shape extends object
  ? A extends object
    ? A &
        Record<Exclude<keyof A, keyof Shape>, never> & {
          [K in keyof Shape]: K extends keyof A
            ? Exact<Shape[K], A[K] & Shape[K]>
            : Shape[K];
        }
    : never
  : Shape;
export type InferSchema<S> = S extends RuntimeSchema<infer T> ? T : never;

type Has<T, K extends keyof T> = T[K] extends RuntimeSchema<any> ? true : false;

type MaybeField<T, K extends keyof T, Name extends string> = Has<
  T,
  K
> extends true
  ? { [P in Name]: InferSchema<T[K]> }
  : {};

export type AuthOverride =
  | { kind: "bearer"; token: string | (() => string | Promise<string>) }
  | { kind: "cookie" }
  | {
      kind: "headers";
      getHeaders: () =>
        | Record<string, string>
        | Promise<Record<string, string>>;
    };

type AuthField<E extends EndpointDef> = E["auth"] extends "required"
  ? { auth: true | AuthOverride }
  : { auth?: never };

export type Simplify<T> = { [K in keyof T]: T[K] } & {};

export type CallArgs<E extends EndpointDef> = Simplify<
  MaybeField<E, "params", "params"> &
    MaybeField<E, "query", "query"> &
    MaybeField<E, "body", "body"> &
    MaybeField<E, "headers", "headers"> &
    AuthField<E> & {
      signal?: AbortSignal;
      init?: Omit<RequestInit, "method" | "body" | "headers" | "signal">;
    }
>;

export type CallResult<E extends EndpointDef> = InferSchema<E["response"]>;

export type Keys<C extends Contract> = Extract<keyof C, string>;

export type EndpointFor<C extends Contract, K extends Keys<C>> = C[K];

export type QueryValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Array<string | number | boolean>;

export type BaseUrl = string | (() => string | Promise<string>);
export type AuthStrategy =
  | {
      kind: "bearer";
      token: () => string | Promise<string>;
    }
  | { kind: "cookie" }
  | {
      kind: "headers";
      getHeaders: () =>
        | Record<string, string>
        | Promise<Record<string, string>>;
    };

export type BeforeRequestContext = {
  key: string;
  url: string;
  init: RequestInit;
};

export type AfterResponseContext = {
  key: string;
  url: string;
  init: RequestInit;
  response: Response;
};

export type ClientOptions = {
  baseUrl?: BaseUrl;
  fetcher?: typeof fetch;
  auth?: AuthStrategy;
  hooks?: {
    beforeRequest?: Array<
      (
        ctx: BeforeRequestContext
      ) => void | RequestInit | Promise<void | RequestInit>
    >;
    afterResponse?: Array<
      (ctx: AfterResponseContext) => void | Response | Promise<void | Response>
    >;
  };
  codecs?: {
    encodeJson?: (v: unknown) => string;
    decodeJson?: (text: string) => unknown;
  };
};
