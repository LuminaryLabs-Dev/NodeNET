using NodeNET.Display;

using var session = NodeNETDisplay.ConnectStandardIO();
var surface = session.CreateSurface(4, 2);
var pixels = new byte[]
{
    255, 0, 0, 255,    0, 255, 0, 255,    0, 0, 255, 255,    255, 255, 255, 255,
    0, 0, 0, 255,      32, 64, 96, 255,   96, 64, 32, 255,   255, 128, 0, 255
};

var connect = session.ReadRequest() ?? throw new EndOfStreamException("Node closed before the display handshake.");
if (connect.Operation != "display.connect") throw new InvalidDataException("Expected display.connect as the first request.");
session.Respond(connect, new { connected = true });
surface.Ready(new { fixture = "managed-dotnet" });
surface.Submit(pixels, new { frame = "initial" });

while (session.ReadRequest() is { } request)
{
    try
    {
        if (request.Operation == "display.dispose")
        {
            session.Respond(request, new { disposed = true });
            break;
        }

        if (request.Operation == "display.pointer")
        {
            pixels[0] = 17;
            pixels[1] = 34;
            pixels[2] = 51;
            surface.Submit(pixels, new { frame = "after-input" });
            session.Respond(request, new { state = new { display = "changed" } });
            continue;
        }

        session.Respond(request, new { accepted = true });
    }
    catch (Exception error)
    {
        session.RespondError(request, error);
    }
}
