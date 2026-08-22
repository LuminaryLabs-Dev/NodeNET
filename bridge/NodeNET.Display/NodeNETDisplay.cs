using System.Buffers.Binary;
using System.Text.Json;

namespace NodeNET.Display;

public static class NodeNETDisplay
{
    public static NodeNETDisplaySession ConnectStandardIO() =>
        new(Console.OpenStandardInput(), Console.OpenStandardOutput());
}

public sealed record NodeNETDisplayRequest(
    string Id,
    string Operation,
    string? Surface,
    JsonElement Input,
    int? Width,
    int? Height,
    byte[] Payload);

public sealed class NodeNETDisplaySession : IDisposable
{
    private const int MaxHeaderBytes = 4 * 1024 * 1024;
    private const int MaxPayloadBytes = 256 * 1024 * 1024;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly Stream _input;
    private readonly Stream _output;
    private int _surfaceSequence;
    private bool _disposed;

    public NodeNETDisplaySession(Stream input, Stream output)
    {
        _input = input ?? throw new ArgumentNullException(nameof(input));
        _output = output ?? throw new ArgumentNullException(nameof(output));
    }

    public NodeNETDisplaySurface CreateSurface(int width, int height, string? id = null)
    {
        ThrowIfDisposed();
        return new NodeNETDisplaySurface(this, id ?? $"surface:{++_surfaceSequence}", width, height);
    }

    public NodeNETDisplayRequest? ReadRequest()
    {
        ThrowIfDisposed();
        var prefix = new byte[8];
        if (!ReadExactlyOrEof(_input, prefix)) return null;
        var headerLength = BinaryPrimitives.ReadInt32LittleEndian(prefix.AsSpan(0, 4));
        var payloadLength = BinaryPrimitives.ReadInt32LittleEndian(prefix.AsSpan(4, 4));
        if (headerLength < 0 || headerLength > MaxHeaderBytes) throw new InvalidDataException("Invalid NodeNET display header length.");
        if (payloadLength < 0 || payloadLength > MaxPayloadBytes) throw new InvalidDataException("Invalid NodeNET display payload length.");
        var header = new byte[headerLength];
        var payload = new byte[payloadLength];
        ReadExactlyRequired(_input, header);
        if (payloadLength > 0) ReadExactlyRequired(_input, payload);
        using var document = JsonDocument.Parse(header);
        var root = document.RootElement;
        var id = root.TryGetProperty("id", out var idElement) ? idElement.GetString() ?? string.Empty : string.Empty;
        var operation = root.TryGetProperty("op", out var opElement) ? opElement.GetString() ?? string.Empty : string.Empty;
        var surface = root.TryGetProperty("surface", out var surfaceElement) ? surfaceElement.GetString() : null;
        var input = root.TryGetProperty("input", out var inputElement) ? inputElement.Clone() : default;
        int? width = root.TryGetProperty("width", out var widthElement) && widthElement.TryGetInt32(out var widthValue) ? widthValue : null;
        int? height = root.TryGetProperty("height", out var heightElement) && heightElement.TryGetInt32(out var heightValue) ? heightValue : null;
        return new NodeNETDisplayRequest(id, operation, surface, input, width, height, payload);
    }

    public void Respond(NodeNETDisplayRequest request, object? result = null) =>
        WriteFrame(new { version = 1, id = request.Id, ok = true, result }, Array.Empty<byte>());

    public void RespondError(NodeNETDisplayRequest request, Exception error) =>
        WriteFrame(new
        {
            version = 1,
            id = request.Id,
            ok = false,
            error = new { code = "DISPLAY_REQUEST_FAILED", type = error.GetType().FullName, message = error.Message }
        }, Array.Empty<byte>());

    internal void WriteEvent(string eventName, string surface, object? payload, byte[] bytes) =>
        WriteFrame(new { version = 1, @event = eventName, surface, payload }, bytes);

    private void WriteFrame(object headerValue, byte[] payload)
    {
        ThrowIfDisposed();
        if (payload.Length > MaxPayloadBytes) throw new InvalidDataException("NodeNET display payload exceeds the maximum size.");
        var header = JsonSerializer.SerializeToUtf8Bytes(headerValue, headerValue.GetType(), JsonOptions);
        if (header.Length > MaxHeaderBytes) throw new InvalidDataException("NodeNET display header exceeds the maximum size.");
        var prefix = new byte[8];
        BinaryPrimitives.WriteInt32LittleEndian(prefix.AsSpan(0, 4), header.Length);
        BinaryPrimitives.WriteInt32LittleEndian(prefix.AsSpan(4, 4), payload.Length);
        _output.Write(prefix);
        _output.Write(header);
        if (payload.Length > 0) _output.Write(payload);
        _output.Flush();
    }

    private static bool ReadExactlyOrEof(Stream stream, byte[] buffer)
    {
        var offset = 0;
        while (offset < buffer.Length)
        {
            var read = stream.Read(buffer, offset, buffer.Length - offset);
            if (read == 0)
            {
                if (offset == 0) return false;
                throw new EndOfStreamException("Unexpected EOF inside a NodeNET display frame.");
            }
            offset += read;
        }
        return true;
    }

    private static void ReadExactlyRequired(Stream stream, byte[] buffer)
    {
        if (!ReadExactlyOrEof(stream, buffer)) throw new EndOfStreamException("Unexpected EOF inside a NodeNET display frame.");
    }

    private void ThrowIfDisposed()
    {
        if (_disposed) throw new ObjectDisposedException(nameof(NodeNETDisplaySession));
    }

    public void Dispose() => _disposed = true;
}

public sealed class NodeNETDisplaySurface
{
    private readonly NodeNETDisplaySession _session;

    internal NodeNETDisplaySurface(NodeNETDisplaySession session, string id, int width, int height)
    {
        if (width <= 0 || height <= 0) throw new ArgumentOutOfRangeException(nameof(width), "Display dimensions must be positive.");
        _session = session;
        Id = id;
        Width = width;
        Height = height;
    }

    public string Id { get; }
    public int Width { get; private set; }
    public int Height { get; private set; }
    public int Stride => checked(Width * 4);
    public string Format => "rgba8";

    public void Ready(object? metadata = null) =>
        _session.WriteEvent("display.ready", Id, new { width = Width, height = Height, stride = Stride, format = Format, metadata }, Array.Empty<byte>());

    public void Submit(ReadOnlySpan<byte> rgba, object? metadata = null)
    {
        var expected = checked(Stride * Height);
        if (rgba.Length != expected) throw new ArgumentException($"RGBA frame must contain exactly {expected} bytes.", nameof(rgba));
        _session.WriteEvent("display.frame", Id, new { width = Width, height = Height, stride = Stride, format = Format, metadata }, rgba.ToArray());
    }

    public void State(object state) => _session.WriteEvent("display.state", Id, state, Array.Empty<byte>());

    public void Resize(int width, int height)
    {
        if (width <= 0 || height <= 0) throw new ArgumentOutOfRangeException(nameof(width), "Display dimensions must be positive.");
        Width = width;
        Height = height;
        Ready(new { resized = true });
    }
}
