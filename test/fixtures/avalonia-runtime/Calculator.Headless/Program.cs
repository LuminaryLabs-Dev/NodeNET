using System.Runtime.InteropServices;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Headless;
using Avalonia.Input;
using Avalonia.Platform;
using Avalonia.Threading;
using NodeNET.Display;

namespace NodeNET.RuntimeFixture;

internal static class Program
{
    private sealed record Center(double X, double Y);

    [STAThread]
    public static void Main()
    {
        AppBuilder.Configure<HeadlessApp>()
            .UseSkia()
            .UseHeadless(new AvaloniaHeadlessPlatformOptions { UseHeadlessDrawing = false })
            .WithInterFont()
            .SetupWithoutStarting();

        var window = new CalculatorWindow();
        window.Show();
        Dispatcher.UIThread.RunJobs();

        using var session = NodeNETDisplay.ConnectStandardIO();
        var initial = Capture(window, out var width, out var height);
        var surface = session.CreateSurface(width, height);
        var controls = new Dictionary<string, Center>
        {
            ["1"] = CenterOf(window.FindControl<Button>("B1")!, window),
            ["2"] = CenterOf(window.FindControl<Button>("B2")!, window),
            ["+"] = CenterOf(window.FindControl<Button>("BPlus")!, window),
            ["7"] = CenterOf(window.FindControl<Button>("B7")!, window),
            ["="] = CenterOf(window.FindControl<Button>("BEquals")!, window)
        };

        var connect = session.ReadRequest() ?? throw new EndOfStreamException("Node closed before the display handshake.");
        if (connect.Operation != "display.connect") throw new InvalidDataException("Expected display.connect as the first request.");
        session.Respond(connect, new { connected = true });
        surface.Ready(new
        {
            framework = "Avalonia",
            frameworkVersion = typeof(AppBuilder).Assembly.GetName().Version?.ToString(),
            adapter = "NodeNET.Display",
            managed = true,
            processId = Environment.ProcessId,
            controlCount = controls.Count,
            controls
        });
        surface.Submit(initial, FrameMetadata("initial", window));

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
                    var type = request.Input.GetProperty("type").GetString();
                    if (type != "click") throw new InvalidDataException($"Unsupported pointer operation: {type}");
                    var point = new Point(request.Input.GetProperty("x").GetDouble(), request.Input.GetProperty("y").GetDouble());
                    window.MouseDown(point, MouseButton.Left);
                    window.MouseUp(point, MouseButton.Left);
                    Dispatcher.UIThread.RunJobs();

                    var pixels = Capture(window, out var nextWidth, out var nextHeight);
                    if (nextWidth != surface.Width || nextHeight != surface.Height) surface.Resize(nextWidth, nextHeight);
                    surface.Submit(pixels, FrameMetadata("input", window));
                    var state = StateMetadata(window);
                    surface.State(state);
                    session.Respond(request, new { state });
                    continue;
                }

                session.Respond(request, new { accepted = true });
            }
            catch (Exception error)
            {
                session.RespondError(request, error);
            }
        }

        window.Close();
    }

    private static object FrameMetadata(string stage, CalculatorWindow window) => new
    {
        stage,
        display = window.DisplayText,
        expression = window.ExpressionText,
        inputCount = window.State.InputCount
    };

    private static object StateMetadata(CalculatorWindow window) => new
    {
        display = window.DisplayText,
        expression = window.ExpressionText,
        inputCount = window.State.InputCount
    };

    private static Center CenterOf(Control control, Window window)
    {
        var point = control.TranslatePoint(new Point(control.Bounds.Width / 2, control.Bounds.Height / 2), window)
            ?? throw new InvalidOperationException("Control was not attached to the window.");
        return new Center(point.X, point.Y);
    }

    private static byte[] Capture(Window window, out int width, out int height)
    {
        using var bitmap = window.CaptureRenderedFrame()
            ?? throw new InvalidOperationException("Avalonia did not produce a rendered frame.");
        using var locked = bitmap.Lock();
        width = locked.Size.Width;
        height = locked.Size.Height;
        var source = new byte[checked(locked.RowBytes * height)];
        Marshal.Copy(locked.Address, source, 0, source.Length);
        var rgba = new byte[checked(width * height * 4)];
        var sourceIsRgba = locked.Format.Equals(PixelFormat.Rgba8888);
        var sourceIsBgra = locked.Format.Equals(PixelFormat.Bgra8888);
        if (!sourceIsRgba && !sourceIsBgra) throw new NotSupportedException($"Unsupported Avalonia pixel format: {locked.Format}");

        for (var y = 0; y < height; y++)
        {
            for (var x = 0; x < width; x++)
            {
                var sourceOffset = y * locked.RowBytes + x * 4;
                var targetOffset = (y * width + x) * 4;
                rgba[targetOffset] = sourceIsRgba ? source[sourceOffset] : source[sourceOffset + 2];
                rgba[targetOffset + 1] = source[sourceOffset + 1];
                rgba[targetOffset + 2] = sourceIsRgba ? source[sourceOffset + 2] : source[sourceOffset];
                rgba[targetOffset + 3] = source[sourceOffset + 3];
            }
        }

        return rgba;
    }
}
