using System.Buffers.Binary;
using System.Text.Json;
using NodeNET.Bridge;

var protocolIn = Console.OpenStandardInput();
var protocolOut = Console.OpenStandardOutput();
var protocolTextOut = Console.Out;
var protocolError = Console.Error;
var jsonOptions = new JsonSerializerOptions(JsonSerializerDefaults.Web);
var objects = new ObjectTable();

try
{
    while (true)
    {
        var frame = await ReadFrameAsync(protocolIn).ConfigureAwait(false);
        if (frame is null) break;
        RpcRequest? request = null;
        try
        {
            request = JsonSerializer.Deserialize<RpcRequest>(frame.Value.Header, jsonOptions)
                ?? throw new InvalidOperationException("Request was empty.");
            request.Payload = frame.Value.Payload;

            if (request.Operation == "shutdown")
            {
                await WriteResponseAsync(new RpcResponse { Id = request.Id, Ok = true, Result = "bye" }, Array.Empty<byte>()).ConfigureAwait(false);
                break;
            }
            if (request.Operation == "ping")
            {
                await WriteResponseAsync(new RpcResponse { Id = request.Id, Ok = true, Result = "pong" }, Array.Empty<byte>()).ConfigureAwait(false);
                continue;
            }

            using var capturedOut = new StringWriter();
            using var capturedError = new StringWriter();
            Console.SetOut(capturedOut);
            Console.SetError(capturedError);
            BridgeResult result;
            try { result = await Invocation.DispatchAsync(request, objects).ConfigureAwait(false); }
            finally { Console.SetOut(protocolTextOut); Console.SetError(protocolError); }
            await WriteResponseAsync(new RpcResponse
            {
                Id = request.Id,
                Ok = true,
                Result = result.Value,
                Stdout = capturedOut.ToString(),
                Stderr = capturedError.ToString()
            }, result.Payload).ConfigureAwait(false);
        }
        catch (Exception error)
        {
            Console.SetError(protocolError);
            await WriteResponseAsync(new RpcResponse
            {
                Id = request?.Id,
                Ok = false,
                Error = new RpcError
                {
                    Code = "INVOCATION_FAILED",
                    Type = error.GetType().FullName ?? error.GetType().Name,
                    Message = error.Message,
                    Stack = error.StackTrace
                }
            }, Array.Empty<byte>()).ConfigureAwait(false);
        }
    }
}
finally
{
    await objects.ClearAsync().ConfigureAwait(false);
}

async Task WriteResponseAsync(RpcResponse response, byte[] payload)
{
    var header = JsonSerializer.SerializeToUtf8Bytes(response, jsonOptions);
    var prefix = new byte[8];
    BinaryPrimitives.WriteInt32LittleEndian(prefix.AsSpan(0, 4), header.Length);
    BinaryPrimitives.WriteInt32LittleEndian(prefix.AsSpan(4, 4), payload.Length);
    await protocolOut.WriteAsync(prefix.AsMemory()).ConfigureAwait(false);
    await protocolOut.WriteAsync(header.AsMemory()).ConfigureAwait(false);
    if (payload.Length > 0) await protocolOut.WriteAsync(payload.AsMemory()).ConfigureAwait(false);
    await protocolOut.FlushAsync().ConfigureAwait(false);
}

static async Task<(byte[] Header, byte[] Payload)?> ReadFrameAsync(Stream input)
{
    var prefix = new byte[8];
    var gotPrefix = await ReadExactlyOrEofAsync(input, prefix).ConfigureAwait(false);
    if (!gotPrefix) return null;
    var headerLength = BinaryPrimitives.ReadInt32LittleEndian(prefix.AsSpan(0, 4));
    var payloadLength = BinaryPrimitives.ReadInt32LittleEndian(prefix.AsSpan(4, 4));
    if (headerLength < 0 || headerLength > 4 * 1024 * 1024) throw new InvalidDataException("Invalid NodeNET protocol header length.");
    if (payloadLength < 0 || payloadLength > 1024 * 1024 * 1024) throw new InvalidDataException("Invalid NodeNET protocol payload length.");
    var header = new byte[headerLength];
    var payload = new byte[payloadLength];
    await ReadExactlyRequiredAsync(input, header).ConfigureAwait(false);
    if (payloadLength > 0) await ReadExactlyRequiredAsync(input, payload).ConfigureAwait(false);
    return (header, payload);
}

static async Task<bool> ReadExactlyOrEofAsync(Stream stream, byte[] buffer)
{
    var offset = 0;
    while (offset < buffer.Length)
    {
        var read = await stream.ReadAsync(buffer.AsMemory(offset)).ConfigureAwait(false);
        if (read == 0)
        {
            if (offset == 0) return false;
            throw new EndOfStreamException("Unexpected EOF inside NodeNET protocol frame.");
        }
        offset += read;
    }
    return true;
}

static async Task ReadExactlyRequiredAsync(Stream stream, byte[] buffer)
{
    if (!await ReadExactlyOrEofAsync(stream, buffer).ConfigureAwait(false)) throw new EndOfStreamException("Unexpected EOF inside NodeNET protocol frame.");
}
