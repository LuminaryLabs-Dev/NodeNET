export class NodeNetError extends Error {
  constructor(message, { code = 'NODENET_ERROR', cause, details } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = new.target.name;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function defineError(name, code) {
  return class extends NodeNetError {
    constructor(message, options = {}) {
      super(message, { ...options, code });
      this.name = name;
    }
  };
}

export const UnsupportedHostError = defineError('UnsupportedHostError', 'UNSUPPORTED_HOST');
export const TargetNotFoundError = defineError('TargetNotFoundError', 'TARGET_NOT_FOUND');
export const DotnetResolutionError = defineError('DotnetResolutionError', 'DOTNET_RESOLUTION_FAILED');
export const DotnetProvisionError = defineError('DotnetProvisionError', 'DOTNET_PROVISION_FAILED');
export const DotnetIntegrityError = defineError('DotnetIntegrityError', 'DOTNET_INTEGRITY_FAILED');
export const DotnetVerificationError = defineError('DotnetVerificationError', 'DOTNET_VERIFICATION_FAILED');
export const RestoreError = defineError('RestoreError', 'RESTORE_FAILED');
export const BuildError = defineError('BuildError', 'BUILD_FAILED');
export const TestError = defineError('TestError', 'TEST_FAILED');
export const PublishError = defineError('PublishError', 'PUBLISH_FAILED');
export const ProcessStartError = defineError('ProcessStartError', 'PROCESS_START_FAILED');
export const ProcessExitError = defineError('ProcessExitError', 'PROCESS_EXIT_FAILED');
export const ProcessTimeoutError = defineError('ProcessTimeoutError', 'PROCESS_TIMEOUT');
export const GuiUnavailableError = defineError('GuiUnavailableError', 'GUI_UNAVAILABLE');
export const LibraryLoadError = defineError('LibraryLoadError', 'LIBRARY_LOAD_FAILED');
export const InvocationError = defineError('InvocationError', 'INVOCATION_FAILED');
export const ProtocolError = defineError('ProtocolError', 'PROTOCOL_ERROR');
