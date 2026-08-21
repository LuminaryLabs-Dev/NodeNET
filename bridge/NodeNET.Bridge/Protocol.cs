using System.Text.Json;
using System.Text.Json.Serialization;

namespace NodeNET.Bridge;

internal sealed class RpcRequest
{
    [JsonPropertyName("id")]
    public string? Id { get; set; }

    [JsonPropertyName("method")]
    public string? Method { get; set; }

    [JsonPropertyName("assembly")]
    public string? Assembly { get; set; }

    [JsonPropertyName("type")]
    public string? Type { get; set; }

    [JsonPropertyName("member")]
    public string? Member { get; set; }

    [JsonPropertyName("arguments")]
    public JsonElement[] Arguments { get; set; } = Array.Empty<JsonElement>();
}

internal sealed class RpcError
{
    [JsonPropertyName("type")]
    public string Type { get; init; } = "Error";

    [JsonPropertyName("message")]
    public string Message { get; init; } = "Unknown error";

    [JsonPropertyName("stack")]
    public string? Stack { get; init; }
}

internal sealed class RpcResponse
{
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
