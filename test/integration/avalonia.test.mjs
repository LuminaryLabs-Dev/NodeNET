import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { DisplayValidationHarness, NodeNET } from '../../src/index.js';

const enabled = process.env.NODENET_AVALONIA === '1';
const sdk = process.env.NODENET_TEST_SDK ?? '10.0';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('NodeNET drives and captures a real Avalonia calculator through DisplayService', { skip: !enabled, timeout: 25 * 60_000 }, async () => {
  const work = await fs.mkdtemp(path.join(os.tmpdir(), 'nodenet-avalonia-'));
  const home = path.join(work, 'home');
  const output = path.resolve(process.env.NODENET_AVALONIA_OUTPUT ?? path.join(root, 'artifacts', 'avalonia-local'));
  const net = await NodeNET.attach(work, { mode: 'shared', home, isolation: 'managed', sdk, writeState: false });
  try {
    const context = await net.prepare({ restore: false });
    assert.equal(context.dotnet.source, 'managed');
    await net.exec(['new', 'install', 'Avalonia.Templates'], { cwd: work });
    await net.exec(['new', 'avalonia.app', '-o', 'App'], { cwd: work });
    const appDir = path.join(work, 'App');
    const project = path.join(appDir, 'App.csproj');
    const displayHelper = path.join(root, 'bridge', 'NodeNET.Display', 'NodeNET.Display.csproj');
    const projectSource = await fs.readFile(project, 'utf8');
    const configuredTarget = projectSource.replace(/<TargetFramework>[^<]+<\/TargetFramework>/, '<TargetFramework>net10.0</TargetFramework>');
    assert.match(configuredTarget, /<TargetFramework>net10\.0<\/TargetFramework>/);
    await fs.writeFile(project, configuredTarget);
    await net.exec(['add', project, 'package', 'Avalonia.Headless'], { cwd: appDir });
    await net.exec(['add', project, 'reference', displayHelper], { cwd: appDir });
    const referencedProject = await fs.readFile(project, 'utf8');
    const configuredProject = referencedProject.replace(
      /<ProjectReference Include="([^"]*NodeNET\.Display[^"]*)"\s*\/>/,
      '<ProjectReference Include="$1" AdditionalProperties="NodeNETTargetFramework=net10.0" />'
    );
    assert.notEqual(configuredProject, referencedProject, 'NodeNET.Display project reference was not configured for net10.0.');
    await fs.writeFile(project, configuredProject);

    await fs.writeFile(path.join(appDir, 'MainWindow.axaml'), `<Window xmlns="https://github.com/avaloniaui" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" x:Class="App.MainWindow" Width="420" Height="640" Background="#080D1F" Title="NodeNET Calculator">
  <Grid Margin="24" RowDefinitions="84,150,42,*">
    <StackPanel Grid.Row="0" Spacing="8">
      <TextBlock Text="NODENET" Foreground="#43DBDA" FontSize="25" FontWeight="Bold"/>
      <TextBlock Text="DISPLAY SERVICE" Foreground="#7D92B5" FontSize="13"/>
    </StackPanel>
    <Border Grid.Row="1" Background="#111B36" CornerRadius="18" Padding="22">
      <StackPanel VerticalAlignment="Center" Spacing="18">
        <TextBlock x:Name="Expression" Text="READY" Foreground="#7D92B5" FontSize="14"/>
        <TextBlock x:Name="Display" Text="0" Foreground="#F0F6FF" FontSize="50" HorizontalAlignment="Right"/>
      </StackPanel>
    </Border>
    <TextBlock Grid.Row="2" Text="AVALONIA HEADLESS / RGBA8" Foreground="#7D92B5" FontSize="11" VerticalAlignment="Center"/>
    <Grid Grid.Row="3" RowDefinitions="*,*,*,*" ColumnDefinitions="*,*,*,*" RowSpacing="12" ColumnSpacing="12">
      <Button x:Name="B7" Grid.Row="0" Grid.Column="0" Content="7" Click="OnButton"/><Button x:Name="B8" Grid.Row="0" Grid.Column="1" Content="8" Click="OnButton"/><Button x:Name="B9" Grid.Row="0" Grid.Column="2" Content="9" Click="OnButton"/><Button x:Name="BDivide" Grid.Row="0" Grid.Column="3" Content="/" Click="OnButton" Background="#50399E"/>
      <Button x:Name="B4" Grid.Row="1" Grid.Column="0" Content="4" Click="OnButton"/><Button x:Name="B5" Grid.Row="1" Grid.Column="1" Content="5" Click="OnButton"/><Button x:Name="B6" Grid.Row="1" Grid.Column="2" Content="6" Click="OnButton"/><Button x:Name="BMinus" Grid.Row="1" Grid.Column="3" Content="-" Click="OnButton" Background="#50399E"/>
      <Button x:Name="B1" Grid.Row="2" Grid.Column="0" Content="1" Click="OnButton"/><Button x:Name="B2" Grid.Row="2" Grid.Column="1" Content="2" Click="OnButton"/><Button x:Name="B3" Grid.Row="2" Grid.Column="2" Content="3" Click="OnButton"/><Button x:Name="BPlus" Grid.Row="2" Grid.Column="3" Content="+" Click="OnButton" Background="#50399E"/>
      <Button x:Name="B0" Grid.Row="3" Grid.Column="0" Content="0" Click="OnButton"/><Button x:Name="BDot" Grid.Row="3" Grid.Column="1" Content="." Click="OnButton"/><Button x:Name="BClear" Grid.Row="3" Grid.Column="2" Content="C" Click="OnButton"/><Button x:Name="BEquals" Grid.Row="3" Grid.Column="3" Content="=" Click="OnButton" Background="#E26236"/>
    </Grid>
  </Grid>
</Window>
`);
    await fs.writeFile(path.join(appDir, 'MainWindow.axaml.cs'), `using Avalonia.Controls;
using Avalonia.Interactivity;
namespace App;
public partial class MainWindow : Window
{
    private decimal? _left;
    private string? _operator;
    private bool _replace = true;
    public MainWindow() => InitializeComponent();
    public string DisplayText => (this.FindControl<TextBlock>("Display")?.Text) ?? "0";
    private void OnButton(object? sender, RoutedEventArgs e)
    {
        var token = (sender as Button)?.Content?.ToString() ?? string.Empty;
        var display = this.FindControl<TextBlock>("Display") ?? throw new InvalidOperationException("Display missing.");
        var expression = this.FindControl<TextBlock>("Expression") ?? throw new InvalidOperationException("Expression missing.");
        if (token.Length == 1 && char.IsDigit(token[0]))
        {
            display.Text = _replace || display.Text == "0" ? token : display.Text + token;
            _replace = false;
        }
        else if (token == ".")
        {
            if (_replace) display.Text = "0";
            if (!(display.Text ?? string.Empty).Contains('.')) display.Text += ".";
            _replace = false;
        }
        else if (token == "C")
        {
            display.Text = "0"; expression.Text = "READY"; _left = null; _operator = null; _replace = true;
        }
        else if (token is "+" or "-" or "/")
        {
            _left = decimal.Parse(display.Text ?? "0"); _operator = token; expression.Text = $"{_left} {_operator}"; _replace = true;
        }
        else if (token == "=" && _left is not null && _operator is not null)
        {
            var right = decimal.Parse(display.Text ?? "0");
            var result = _operator == "+" ? _left.Value + right : _operator == "-" ? _left.Value - right : _left.Value / right;
            display.Text = result.ToString("0.##########"); expression.Text = "READY"; _left = null; _operator = null; _replace = true;
        }
    }
}
`);
    await fs.writeFile(path.join(appDir, 'Program.cs'), `using System.Runtime.InteropServices;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Headless;
using Avalonia.Input;
using Avalonia.Platform;
using Avalonia.Threading;
using NodeNET.Display;
namespace App;
internal static class Program
{
    private sealed record Center(double X, double Y);
    [STAThread]
    public static void Main()
    {
        AppBuilder.Configure<App>().UseSkia().UseHeadless(new AvaloniaHeadlessPlatformOptions { UseHeadlessDrawing = false }).SetupWithoutStarting();
        var window = new MainWindow();
        window.Show();
        Dispatcher.UIThread.RunJobs();
        using var session = NodeNETDisplay.ConnectStandardIO();
        var initial = Capture(window, out var width, out var height);
        var surface = session.CreateSurface(width, height);
        var controls = new Dictionary<string, Center>
        {
            ["1"] = CenterOf(window.FindControl<Button>("B1")!, window), ["2"] = CenterOf(window.FindControl<Button>("B2")!, window),
            ["+"] = CenterOf(window.FindControl<Button>("BPlus")!, window), ["7"] = CenterOf(window.FindControl<Button>("B7")!, window),
            ["="] = CenterOf(window.FindControl<Button>("BEquals")!, window)
        };
        var connect = session.ReadRequest() ?? throw new EndOfStreamException("Node closed before the display handshake.");
        if (connect.Operation != "display.connect") throw new InvalidDataException("Expected display.connect as the first request.");
        session.Respond(connect, new { connected = true });
        surface.Ready(new { framework = "Avalonia", controls });
        surface.Submit(initial, new { stage = "initial", display = window.DisplayText });
        while (session.ReadRequest() is { } request)
        {
            try
            {
                if (request.Operation == "display.dispose") { session.Respond(request, new { disposed = true }); break; }
                if (request.Operation == "display.pointer")
                {
                    var x = request.Input.GetProperty("x").GetDouble();
                    var y = request.Input.GetProperty("y").GetDouble();
                    var point = new Point(x, y);
                    window.MouseDown(point, MouseButton.Left);
                    window.MouseUp(point, MouseButton.Left);
                    Dispatcher.UIThread.RunJobs();
                    var pixels = Capture(window, out var nextWidth, out var nextHeight);
                    if (nextWidth != surface.Width || nextHeight != surface.Height) surface.Resize(nextWidth, nextHeight);
                    surface.Submit(pixels, new { stage = "input", display = window.DisplayText });
                    surface.State(new { display = window.DisplayText });
                    session.Respond(request, new { state = new { display = window.DisplayText } });
                    continue;
                }
                session.Respond(request, new { accepted = true });
            }
            catch (Exception error) { session.RespondError(request, error); }
        }
        window.Close();
    }
    private static Center CenterOf(Control control, Window window)
    {
        var point = control.TranslatePoint(new Point(control.Bounds.Width / 2, control.Bounds.Height / 2), window)
            ?? throw new InvalidOperationException("Control was not attached to the window.");
        return new Center(point.X, point.Y);
    }
    private static byte[] Capture(Window window, out int width, out int height)
    {
        using var bitmap = window.CaptureRenderedFrame() ?? throw new InvalidOperationException("Avalonia did not produce a rendered frame.");
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
`);

    const app = await NodeNET.attach(project, { mode: 'shared', home, isolation: 'managed', sdk, writeState: false });
    try {
      const prepared = await app.prepare();
      assert.equal(prepared.ready, true);
      const build = await app.build();
      assert.equal(build.ok, true);
      const handle = await app.run({ binaryStdout: true });
      const surface = await app.display({ process: handle });
      const harness = new DisplayValidationHarness(surface, { outputDirectory: output, timeout: 30_000 });
      const ready = await harness.waitForReady();
      assert.equal(ready.metadata.framework, 'Avalonia');
      await surface.waitForFrame({ afterSequence: 0, timeout: 30_000 });
      await harness.capture('calculator-initial.png');

      let result;
      for (const token of ['1', '2', '+', '7']) {
        const point = ready.metadata.controls[token];
        assert.ok(point && Number.isFinite(point.x) && Number.isFinite(point.y));
        result = await harness.pointer({ type: 'click', x: point.x, y: point.y, button: 0 });
      }
      await harness.capture('calculator-12-plus-7.png');
      const equals = ready.metadata.controls['='];
      result = await harness.pointer({ type: 'click', x: equals.x, y: equals.y, button: 0 });
      const finalFrame = await harness.capture('calculator-result-19.png');
      assert.equal(result.state.display, '19');
      assert.equal(surface.lastState.display, '19');
      const [initialCapture, expressionCapture, resultCapture] = harness.captures;
      assert.notEqual(initialCapture.sha256, resultCapture.sha256);
      const verification = {
        framework: 'Avalonia', managedDotnet: true, inputRoundTrip: true,
        expected: '19', actual: result.state.display,
        width: finalFrame.width, height: finalFrame.height, format: finalFrame.format,
        changed: initialCapture.sha256 !== resultCapture.sha256,
        hashes: { initial: initialCapture.sha256, expression: expressionCapture.sha256, result: resultCapture.sha256 },
        pass: result.state.display === '19' && initialCapture.sha256 !== resultCapture.sha256
      };
      await harness.writeVerification(verification);
      await surface.dispose();
      const run = await handle.wait();
      assert.equal(run.ok, true, run.stderr);
    } finally { await app.dispose(); }
  } finally {
    await net.dispose();
    await fs.rm(work, { recursive: true, force: true });
  }
});
