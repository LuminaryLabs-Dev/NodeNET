using System.Text.Json;
using System.Text.Json.Serialization;

namespace NodeNET.Bridge;

internal sealed class RpcRequest
{
    [JsonPropertyName("version")]
    public int Version { get; set; } = 1;

    [JsonPropertyName("id")]
    public string? Id { get; set; }

    [JsonPropertyName("op")]
    public string? Op { get; set; }

    [JsonPropertyName("method")]
    public string? Method { get; set; }

    [JsonPropertyName("assembly")]
    public string? Assembly { get; set; }

    [JsonPropertyName("type")]
    public string? Type { get; set; }

    [JsonPropertyName("member")]
    public string? Member { get; set; }

    [JsonPropertyName("signature")]
    public string? Signature { get; set; }

    [JsonPropertyName("handle")]
    public string? Handle { get; set; }

    [JsonPropertyName("arguments")]
    public JsonElement[] Arguments { get; set; } = Array.Empty<JsonElement>();

    [JsonPropertyName("value")]
    public JsonElement Value { get; set; }

    [JsonPropertyName("count")]
    public int Count { get; set; } = 65536;

    [JsonIgnore]
    public byte[] Payload { get; set; } = Array.Empty<byte>();

    [JsonIgnore]
    public string Operation => Op ?? Method ?? string.Empty;
}

internal sealed class RpcError
{
    [JsonPropertyName("code")]
    public string Code { get; init; } = "INVOCATION_FAILED";

    [JsonPropertyName("type")]
    public string Type { get; init; } = "Error";

    [JsonPropertyName("message")]
    public string Message { get; init; } = "Unknown error";

    [JsonPropertyName("stack")]
    public string? Stack { get; init; }
}

internal sealed class RpcResponse
{
    [JsonPropertyName("version")]
    public int Version { get; init; } = 1;

    [JsonPropertyName("id")]
    public string? Id { get; init; }

    [JsonPropertyName("ok")]
    public bool Ok { get; init; }

    [JsonPropertyName("result")]
    public object? Result { get; init; }

    [JsonPropertyName("stdout")]
    public string? Stdout { get; init; }

    [JsonPropertyName("stderr")]
    public string? Stderr { get; init; }

    [JsonPropertyName("error")]
    public RpcError? Error { get; init; }
}

internal sealed record BridgeResult(object? Value, byte[] Payload)
{
    public static BridgeResult FromValue(object? value) => new(value, Array.Empty<byte>());
}
