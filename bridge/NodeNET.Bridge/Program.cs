using System.Text.Json;
using NodeNET.Bridge;

var protocolOut = Console.Out;
var protocolError = Console.Error;
var jsonOptions = new JsonSerializerOptions(JsonSerializerDefaults.Web);

while (true)
{
    var line = await Console.In.ReadLineAsync().ConfigureAwait(false);
    if (line is null) break;
    if (string.IsNullOrWhiteSpace(line)) continue;

    RpcRequest? request = null;
    try
    {
        request = JsonSerializer.Deserialize<RpcRequest>(line, jsonOptions)
            ?? throw new InvalidOperationException("Request was empty.");

        if (request.Method == "shutdown")
        {
            await WriteResponseAsync(new RpcResponse { Id = request.Id, Ok = true, Result = "bye" });
            break;
        }

        if (request.Method == "ping")
        {
            await WriteResponseAsync(new RpcResponse { Id = request.Id, Ok = true, Result = "pong" });
            continue;
        }

        if (request.Method != "invoke")
            throw new InvalidOperationException($"Unsupported RPC method: {request.Method}");

        using var capturedOut = new StringWriter();
        using var capturedError = new StringWriter();
        Console.SetOut(capturedOut);
        Console.SetError(capturedError);
        try
        {
            var result = await Invocation.InvokeAsync(request).ConfigureAwait(false);
            Console.SetOut(protocolOut);
            Console.SetError(protocolError);
            await WriteResponseAsync(new RpcResponse
            {
                Id = request.Id,
                Ok = true,
                Result = result,
                Stdout = capturedOut.ToString(),
                Stderr = capturedError.ToString()
            });
        }
        finally
        {
            Console.SetOut(protocolOut);
            Console.SetError(protocolError);
        }
    }
    catch (Exception error)
    {
        Console.SetOut(protocolOut);
        Console.SetError(protocolError);
        await WriteResponseAsync(new RpcResponse
        {
            Id = request?.Id,
            Ok = false,
            Error = new RpcError
            {
                Type = error.GetType().FullName ?? error.GetType().Name,
                Message = error.Message,
                Stack = error.StackTrace
            }
        });
    }
}

async Task WriteResponseAsync(RpcResponse response)
{
    await protocolOut.WriteLineAsync(JsonSerializer.Serialize(response, jsonOptions)).ConfigureAwait(false);
    await protocolOut.FlushAsync().ConfigureAwait(false);
}
