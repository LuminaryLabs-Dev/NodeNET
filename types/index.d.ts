export type NodeNETMode = 'shared' | 'local' | 'temporary';
export type NodeNETIsolation = 'auto' | 'managed' | 'system';
export type NodeNETTrust = 'trusted' | 'untrusted';

export interface ProcessResult {
  ok: boolean;
  command: string;
  args: string[];
  cwd: string;
  exitCode: number | null;
  signal: string | null;
  durationMs: number;
  stdout: string;
  stderr: string;
  diagnostics: Diagnostic[];
}

export interface Diagnostic {
  file: string | null;
  line: number | null;
  column: number | null;
  severity: 'error' | 'warning';
  code: string;
  message: string;
  project: string | null;
}

export interface ProcessHandle {
  running: boolean;
  pid?: number;
  readonly binaryStdout: boolean;
  stdout: string;
  stderr: string;
  write(data: string | Uint8Array): boolean;
  closeStdin(): void;
  stop(): Promise<ProcessResult>;
  kill(): Promise<ProcessResult>;
  wait(): Promise<ProcessResult>;
  on(event: 'stdout' | 'stderr', listener: (chunk: any) => void): this;
  on(event: 'exit', listener: (result: ProcessResult) => void): this;
  once(event: 'exit', listener: (result: ProcessResult) => void): this;
}

export interface ProgressEvent {
  phase: 'resolve' | 'artifact' | 'download' | 'verify' | 'extract' | 'reuse' | 'ready' | string;
  requirement?: any;
  rid?: string;
  artifact?: any;
  received?: number;
  total?: number | null;
  source?: string;
  version?: string | null;
}

export interface NodeNETOptions {
  mode?: NodeNETMode;
  isolation?: NodeNETIsolation;
  trust?: NodeNETTrust;
  sdk?: string;
  runtime?: string;
  defaultSdk?: string;
  home?: string;
  offline?: boolean;
  dotnetPath?: string;
  dotnetArgsPrefix?: string[];
  env?: Record<string, string | undefined>;
  writeState?: boolean;
  plugins?: NodeNETPlugin[];
  signal?: AbortSignal;
  onProgress?: (event: ProgressEvent) => void;
}

export interface OperationOptions {
  cwd?: string;
  timeout?: number;
  signal?: AbortSignal;
  env?: Record<string, string | undefined>;
  configuration?: string;
  framework?: string;
  runtime?: string;
  output?: string;
  selfContained?: boolean;
  noRestore?: boolean;
  passthrough?: string[];
  properties?: Record<string, string | number | boolean>;
  binaryStdout?: boolean;
  maxBuffer?: number;
}

export type DisplayFormat = 'rgba8';

export interface FrameOptions {
  width: number;
  height: number;
  stride?: number;
  format?: DisplayFormat;
  pixels?: Uint8Array | ArrayBuffer;
  maxBytes?: number;
}

export interface PointerInput {
  type: 'move' | 'down' | 'up' | 'click';
  x: number;
  y: number;
  button?: number;
  modifiers?: { alt?: boolean; control?: boolean; meta?: boolean; shift?: boolean };
}

export interface KeyInput {
  type: 'down' | 'up' | 'text';
  key?: string;
  code?: string;
  modifiers?: { alt?: boolean; control?: boolean; meta?: boolean; shift?: boolean };
}

export class Frame {
  constructor(options: FrameOptions);
  readonly width: number;
  readonly height: number;
  readonly stride: number;
  readonly format: DisplayFormat;
  readonly pixels: Uint8Array;
  readonly byteLength: number;
  clone(): Frame;
}

export class SoftwareRasterizer {
  constructor(frame: Frame);
  readonly frame: Frame;
  clear(rgba?: ArrayLike<number>): this;
  pixel(x: number, y: number, rgba: ArrayLike<number>): this;
  line(x0: number, y0: number, x1: number, y1: number, rgba: ArrayLike<number>): this;
  fillRect(x: number, y: number, width: number, height: number, rgba: ArrayLike<number>): this;
  roundedRect(x: number, y: number, width: number, height: number, radius: number, rgba: ArrayLike<number>): this;
  blit(source: Frame, x: number, y: number): this;
  text(value: string, x: number, y: number, rgba: ArrayLike<number>, options?: { scale?: number; spacing?: number }): this;
  measureText(value: string, options?: { scale?: number; spacing?: number }): { width: number; height: number };
}

export interface DisplaySurfaceOptions {
  id?: string;
  width: number;
  height: number;
  format?: DisplayFormat;
  maxFrameBytes?: number;
  process?: ProcessHandle;
}

export class FrameSurface {
  readonly id: string;
  width: number;
  height: number;
  stride: number;
  readonly format: DisplayFormat;
  readonly maxFrameBytes: number;
  readonly allocated: boolean;
  readonly sequence: number;
  readonly readyInfo: any;
  readonly lastState: any;
  readonly disposed: boolean;
  submit(frame: Frame | FrameOptions): Frame;
  present(metadata?: Record<string, any>): { sequence: number; metadata: Record<string, any>; frame: Frame };
  capture(): Frame;
  rasterizer(): SoftwareRasterizer;
  resize(width: number, height: number, options?: { notify?: boolean }): Promise<this>;
  pointer(event: PointerInput): Promise<any>;
  key(event: KeyInput): Promise<any>;
  waitForReady(options?: { timeout?: number }): Promise<any>;
  waitForFrame(options?: { afterSequence?: number; timeout?: number }): Promise<Frame>;
  dispose(options?: { notify?: boolean }): Promise<void>;
  on(event: 'frame', listener: (frame: Frame) => void): this;
  on(event: 'present', listener: (presentation: any) => void): this;
  on(event: 'pointer' | 'key' | 'ready' | 'state' | 'resize' | 'close', listener: (...args: any[]) => void): this;
  once(event: 'close' | 'ready' | 'present', listener: (...args: any[]) => void): this;
}

export class SoftwareDisplayService {
  readonly kind: 'software-framebuffer';
  readonly headless: true;
  readonly maxFrameBytes: number;
  capabilities(): any;
  createSurface(options: DisplaySurfaceOptions): FrameSurface;
  connectProcess(processHandle: ProcessHandle, options?: Partial<DisplaySurfaceOptions>): FrameSurface;
  dispose(): Promise<void>;
}

export class ProcessDisplayAdapter {
  constructor(display: SoftwareDisplayService, processHandle: ProcessHandle, options?: Partial<DisplaySurfaceOptions>);
  readonly process: ProcessHandle;
  readonly surface: FrameSurface;
}

export class DisplayValidationHarness {
  constructor(surface: FrameSurface, options?: { outputDirectory?: string | null; timeout?: number });
  readonly surface: FrameSurface;
  readonly outputDirectory: string | null;
  readonly timeout: number;
  readonly captures: ReadonlyArray<{ name: string; width: number; height: number; format: DisplayFormat; sha256: string }>;
  waitForReady(): Promise<any>;
  pointer(input: PointerInput, options?: { expectFrame?: boolean }): Promise<any>;
  key(input: KeyInput, options?: { expectFrame?: boolean }): Promise<any>;
  capture(name: string): Promise<Frame>;
  writeVerification(value: Record<string, any>, name?: string): Promise<Record<string, any>>;
}

export function frameLayout(options: FrameOptions): Readonly<{ width: number; height: number; stride: number; format: DisplayFormat; byteLength: number }>;
export function normalizePointerEvent(event: PointerInput): Readonly<Required<PointerInput>>;
export function normalizeKeyEvent(event: KeyInput): Readonly<KeyInput>;
export function encodePng(frame: Frame): Uint8Array;
export function savePng(frame: Frame, file: string): Promise<{ file: string; bytes: number; width: number; height: number }>;
export const DISPLAY_FORMAT: 'rgba8';
export const MAX_FRAME_BYTES: number;
export const MAX_FRAME_DIMENSION: number;

export interface ExecutionService {
  kind: string;
  sandboxed: boolean;
  exec(command: string, args?: string[], options?: Record<string, any>): Promise<ProcessResult>;
  spawn(command: string, args?: string[], options?: Record<string, any>): ProcessHandle;
}

export interface NodeNETPlugin {
  name: string;
  provides?: string[];
  requires?: string[];
  replace?: boolean;
  register(registry: ServiceRegistry, helpers: { provide(capability: string, service: any, options?: { replace?: boolean }): any }): void;
  initialize?(registry: ServiceRegistry, context?: any): void | Promise<void>;
  dispose?(registry: ServiceRegistry, context?: any): void | Promise<void>;
}

export interface CallDescriptor {
  member: string;
  signature?: string;
  arguments?: any[];
}

export interface ConstructDescriptor {
  signature?: string;
  arguments?: any[];
}

export class RemoteStreamHandle {
  readonly $stream: string;
  readonly $type: string;
  closed: boolean;
  read(count?: number): Promise<{ bytes: Uint8Array; eof: boolean }>;
  write(bytes: Uint8Array | ArrayBuffer | ArrayLike<number>): Promise<any>;
  dispose(): Promise<void>;
}

export class RemoteObjectHandle {
  readonly $handle: string;
  readonly $type: string | null;
  disposed: boolean;
  call(member: string, ...args: any[]): Promise<any>;
  call(spec: CallDescriptor): Promise<any>;
  get(member: string): Promise<any>;
  set(member: string, value: any): Promise<any>;
  describe(): Promise<any>;
  dispose(): Promise<void>;
}

export class RemoteType {
  readonly name: string;
  describe(): Promise<any>;
  new(...args: any[]): Promise<RemoteObjectHandle | any>;
  construct(spec?: ConstructDescriptor): Promise<RemoteObjectHandle | any>;
  call(member: string, ...args: any[]): Promise<any>;
  call(spec: CallDescriptor): Promise<any>;
  get(member: string): Promise<any>;
  set(member: string, value: any): Promise<any>;
}

export class LibraryHandle {
  readonly assembly: string;
  readonly process: ProcessHandle;
  type(name: string): RemoteType;
  describe(type: string): Promise<any>;
  invoke(options: {
    type: string;
    method?: string;
    member?: string;
    signature?: string;
    arguments?: any[];
  }): Promise<{ result: any; stdout: string; stderr: string }>;
  on(event: string, listener: (...args: any[]) => void): this;
  close(): Promise<any>;
}

export interface ProtocolFrame {
  message: any;
  payload: Uint8Array;
}

export class ProtocolClient {
  constructor(transport: StdioTransport);
  request(op: string, fields?: Record<string, any>, options?: { payload?: Uint8Array }): Promise<any>;
  close(): Promise<any>;
  on(event: string, listener: (...args: any[]) => void): this;
}

export class StdioTransport {
  constructor(processHandle: ProcessHandle);
  readonly running: boolean;
  send(message: any, payload?: Uint8Array): boolean;
  close(): Promise<any>;
  on(event: string, listener: (...args: any[]) => void): this;
}

export class FrameDecoder {
  push(chunk: Uint8Array): ProtocolFrame[];
}

export function encodeFrame(message: any, payload?: Uint8Array): Uint8Array;
export function openLibrary(context: any, assembly: string, options?: any): Promise<LibraryHandle>;

export class NodeNET {
  readonly target: string;
  readonly options: NodeNETOptions;
  static attach(target?: string, options?: NodeNETOptions): Promise<NodeNET>;
  info(): Promise<any>;
  prepare(options?: NodeNETOptions & { restore?: boolean; force?: boolean; requireSdk?: boolean }): Promise<any>;
  restore(options?: OperationOptions): Promise<ProcessResult>;
  build(options?: OperationOptions): Promise<ProcessResult>;
  test(options?: OperationOptions): Promise<ProcessResult>;
  publish(options?: OperationOptions): Promise<ProcessResult>;
  clean(options?: OperationOptions): Promise<ProcessResult>;
  run(options?: OperationOptions & { args?: string[] }): Promise<ProcessHandle>;
  exec(args: string[], options?: OperationOptions & { requireSdk?: boolean; rejectOnNonZero?: boolean }): Promise<ProcessResult>;
  library(assembly: string, options?: { cwd?: string; timeout?: number; signal?: AbortSignal }): Promise<LibraryHandle>;
  display(options: DisplaySurfaceOptions | ({ process: ProcessHandle } & Partial<DisplaySurfaceOptions>)): Promise<FrameSurface>;
  capabilities(options?: { prepare?: boolean }): Promise<any>;
  doctor(): Promise<any>;
  environment(): any | null;
  dispose(): Promise<void>;
}

export class LocalExecutionService implements ExecutionService {
  kind: string;
  sandboxed: boolean;
  constructor(options?: { baseEnv?: Record<string, string | undefined> });
  exec(command: string, args?: string[], options?: Record<string, any>): Promise<ProcessResult>;
  spawn(command: string, args?: string[], options?: Record<string, any>): ProcessHandle;
}

export function softwareDisplayPlugin(options?: { maxFrameBytes?: number }): Readonly<NodeNETPlugin>;

export class ServiceRegistry {
  provide(capability: string, service: any, options?: { plugin?: string; replace?: boolean }): any;
  has(capability: string): boolean;
  provider(capability: string): string | null;
  require<T = any>(capability: string): T;
  register(plugin: NodeNETPlugin): this;
  validate(): true;
  initialize(context?: any): Promise<this>;
  describe(): any;
  dispose(context?: any): Promise<void>;
}

export function definePlugin(spec: NodeNETPlugin): Readonly<NodeNETPlugin>;
export function serviceContract(capability: string): string[] | null;
export function validateServiceContract(capability: string, service: any): true;
export function detectHost(options?: any): any;
export function inspectTarget(target: string): Promise<any>;

export const SERVICE: Readonly<{
  HOST: 'host';
  EXECUTION: 'execution';
  ENVIRONMENT: 'environment';
  PROJECT: 'project';
  INTEROP: 'interop';
  DISPLAY: 'display';
  CAPABILITIES: 'capabilities';
}>;

export class NodeNetError extends Error {
  code: string;
  details?: any;
}

export class UnsupportedHostError extends NodeNetError {}
export class TargetNotFoundError extends NodeNetError {}
export class DotnetResolutionError extends NodeNetError {}
export class DotnetProvisionError extends NodeNetError {}
export class DotnetIntegrityError extends NodeNetError {}
export class DotnetVerificationError extends NodeNetError {}
export class RestoreError extends NodeNetError {}
export class BuildError extends NodeNetError {}
export class TestError extends NodeNetError {}
export class PublishError extends NodeNetError {}
export class ProcessStartError extends NodeNetError {}
export class ProcessExitError extends NodeNetError {}
export class ProcessTimeoutError extends NodeNetError {}
export class GuiUnavailableError extends NodeNetError {}
export class LibraryLoadError extends NodeNetError {}
export class InvocationError extends NodeNetError {}
export class ProtocolError extends NodeNetError {}
